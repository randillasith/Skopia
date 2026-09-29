package com.skopia;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class SkopiaServlet extends HttpServlet {
    private static final int MAX_UPLOAD_BYTES = 250 * 1024 * 1024;

    private Config config;
    private VideoRepository repository;
    private AccountRepository accounts;
    private final SessionStore sessions = new SessionStore();

    @Override
    public void init() throws ServletException {
        try {
            String realPath = getServletContext().getRealPath("/");
            Path webRoot = realPath == null
                    ? Path.of(System.getProperty("java.io.tmpdir"), "skopia-webapp")
                    : Path.of(realPath);
            config = Config.load(webRoot);
            Files.createDirectories(config.uploadDir());
            Database database = new Database(config);
            database.initialize();
            repository = new VideoRepository(database);
            accounts = new AccountRepository(database);
            getServletContext().log("Skopia initialized with XAMPP MySQL at "
                    + config.dbHost() + ":" + config.dbPort() + "/" + config.dbName());
        } catch (Exception e) {
            throw new ServletException("Skopia could not initialize. Start MySQL in XAMPP and check the database settings.", e);
        }
    }

    @Override
    protected void service(HttpServletRequest request, HttpServletResponse response) throws IOException {
        try {
            String path = request.getRequestURI().substring(request.getContextPath().length());
            if (path.startsWith("/api/")) {
                handleApi(request, response, path);
            } else if (path.startsWith("/uploads/")) {
                requireUploadAccess(path, currentUserId(request));
                serveUpload(request, response, path.substring("/uploads/".length()));
            } else {
                sendJson(response, 404, Map.of("error", "Route not found"));
            }
        } catch (ApiException e) {
            sendJson(response, e.status(), Map.of("error", e.getMessage()));
        } catch (IllegalArgumentException e) {
            sendJson(response, 400, Map.of("error", message(e)));
        } catch (SQLException e) {
            getServletContext().log("Database operation failed", e);
            sendJson(response, 500, Map.of("error", "Database operation failed", "detail", message(e)));
        } catch (Exception e) {
            getServletContext().log("Unexpected server error", e);
            sendJson(response, 500, Map.of("error", "Unexpected server error", "detail", message(e)));
        }
    }

    private void handleApi(HttpServletRequest request, HttpServletResponse response, String path) throws Exception {
        String method = request.getMethod();
        Map<String, String> query = query(request);
        if (method.equals("POST") && path.equals("/api/auth/register")) {
            Map<String, Object> user = accounts.register(body(request));
            sessions.revoke(sessionToken(request));
            setSessionCookie(request, response, sessions.create(((Number) user.get("id")).longValue()));
            sendJson(response, 201, Map.of("user", user)); return;
        }
        if (method.equals("POST") && path.equals("/api/auth/login")) {
            Map<String, Object> user = accounts.authenticate(body(request));
            sessions.revoke(sessionToken(request));
            setSessionCookie(request, response, sessions.create(((Number) user.get("id")).longValue()));
            sendJson(response, 200, Map.of("user", user)); return;
        }
        if (method.equals("POST") && path.equals("/api/auth/logout")) {
            sessions.revoke(sessionToken(request)); clearSessionCookie(request, response);
            sendJson(response, 200, Map.of("message", "Signed out")); return;
        }
        if (method.equals("GET") && path.equals("/api/auth/me")) {
            Long id = currentUserId(request);
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("user", id == null ? null : accounts.user(id));
            sendJson(response, 200, result); return;
        }
        if (method.equals("GET") && path.equals("/api/payments/status")) {
            sendJson(response, 200, accounts.subscription(requireUser(request))); return;
        }
        if (method.equals("GET") && path.equals("/api/payments")) {
            sendJson(response, 200, accounts.payments(requireUser(request))); return;
        }
        if (method.equals("POST") && (path.equals("/api/payments") || path.equals("/api/payments/checkout"))) {
            sendJson(response, 201, accounts.checkout(requireUser(request), body(request))); return;
        }
        if (method.equals("GET") && path.equals("/api/health")) {
            sendJson(response, 200, Map.of("status", "ok", "module", "Video, Accounts & Subscriptions")); return;
        }
        if (method.equals("GET") && path.equals("/api/categories")) {
            sendJson(response, 200, repository.categories()); return;
        }
        if (method.equals("GET") && path.equals("/api/videos")) {
            Integer category = parseOptionalInt(query.get("category"));
            Long userId = currentUserId(request);
            Long creator = "mine".equals(query.get("scope")) ? requireCreator(request) : null;
            var videos = repository.videos(query.get("search"), category, query.get("access"), creator, userId == null ? 0 : userId);
            protectVideos(videos, userId);
            sendJson(response, 200, videos); return;
        }
        if (method.equals("POST") && path.equals("/api/videos")) {
            createVideo(request, response, requireCreator(request)); return;
        }
        if (method.equals("GET") && path.equals("/api/history")) {
            sendJson(response, 200, repository.history(requireUser(request))); return;
        }
        if (method.equals("GET") && path.equals("/api/watchlist")) {
            sendJson(response, 200, repository.watchlist(requireUser(request))); return;
        }

        String[] parts = path.substring(1).split("/");
        if (parts.length == 3 && parts[0].equals("api") && parts[1].equals("payments")) {
            long paymentId = parseId(parts[2]);
            long userId = requireUser(request);
            if (method.equals("GET")) {
                Map<String, Object> payment = accounts.payment(paymentId, userId);
                sendJson(response, payment == null ? 404 : 200,
                        payment == null ? Map.of("error", "Payment not found") : payment); return;
            }
            if (method.equals("PUT")) {
                Map<String, Object> payment = accounts.updatePayment(paymentId, userId, body(request));
                sendJson(response, payment == null ? 404 : 200,
                        payment == null ? Map.of("error", "Payment not found") : payment); return;
            }
            if (method.equals("DELETE")) {
                boolean deleted = accounts.deletePayment(paymentId, userId);
                sendJson(response, deleted ? 200 : 404,
                        deleted ? Map.of("message", "Payment deleted") : Map.of("error", "Payment not found")); return;
            }
        }
        if (parts.length >= 3 && parts[0].equals("api") && parts[1].equals("videos")) {
            long videoId = parseId(parts[2]);
            if (parts.length == 3 && method.equals("GET")) {
                Long userId = currentUserId(request);
                Map<String, Object> video = repository.video(videoId, userId == null ? 0 : userId);
                if (video == null || (!"PUBLISHED".equals(video.get("status"))
                        && (userId == null || ((Number) video.get("creatorId")).longValue() != userId)))
                    sendJson(response, 404, Map.of("error", "Video not found"));
                else { protectVideo(video, userId); sendJson(response, 200, video); }
                return;
            }
            if (parts.length == 3 && method.equals("PUT")) {
                boolean updated = repository.update(videoId, requireCreator(request), body(request));
                sendJson(response, updated ? 200 : 404,
                        updated ? Map.of("message", "Video updated") : Map.of("error", "Video not found")); return;
            }
            if (parts.length == 3 && method.equals("DELETE")) {
                boolean deleted = repository.delete(videoId, requireCreator(request));
                sendJson(response, deleted ? 200 : 404,
                        deleted ? Map.of("message", "Video deleted") : Map.of("error", "Video not found")); return;
            }
            if (parts.length == 4 && parts[3].equals("like") && method.equals("POST")) {
                sendJson(response, 200, repository.toggleLike(videoId, requireUser(request))); return;
            }
            if (parts.length == 4 && parts[3].equals("save") && method.equals("POST")) {
                sendJson(response, 200, repository.toggleSaved(videoId, requireUser(request))); return;
            }
            if (parts.length == 4 && parts[3].equals("view") && method.equals("POST")) {
                requireVideoAccess(videoId, currentUserId(request));
                repository.addView(videoId); sendJson(response, 200, Map.of("message", "View counted")); return;
            }
            if (parts.length == 4 && parts[3].equals("progress") && method.equals("POST")) {
                Map<String, Object> data = body(request);
                long userId = requireUser(request); requireVideoAccess(videoId, userId);
                repository.saveProgress(videoId, userId, number(data, "position"), bool(data, "completed"));
                sendJson(response, 200, Map.of("message", "Progress saved")); return;
            }
            if (parts.length == 4 && parts[3].equals("comments") && method.equals("GET")) {
                sendJson(response, 200, repository.comments(videoId)); return;
            }
            if (parts.length == 4 && parts[3].equals("comments") && method.equals("POST")) {
                Map<String, Object> data = body(request);
                Long parentId = optionalPositiveId(data.get("parentId"), "Parent comment");
                sendJson(response, 201, repository.addComment(videoId, requireUser(request),
                        String.valueOf(data.getOrDefault("text", "")), parentId)); return;
            }
        }
        if (parts.length == 3 && parts[0].equals("api") && parts[1].equals("comments") && method.equals("PUT")) {
            long userId = requireUser(request);
            Object text = body(request).get("text");
            if (!(text instanceof String)) throw new IllegalArgumentException("Comment text is required");
            boolean updated = repository.updateComment(parseId(parts[2]), userId, (String) text);
            sendJson(response, updated ? 200 : 404,
                    updated ? Map.of("message", "Comment updated") : Map.of("error", "Comment not found")); return;
        }
        if (parts.length == 3 && parts[0].equals("api") && parts[1].equals("comments") && method.equals("DELETE")) {
            boolean deleted = repository.deleteComment(parseId(parts[2]), requireUser(request));
            sendJson(response, deleted ? 200 : 404,
                    deleted ? Map.of("message", "Comment deleted") : Map.of("error", "Comment not found")); return;
        }
        sendJson(response, 404, Map.of("error", "API route not found"));
    }

    private void createVideo(HttpServletRequest request, HttpServletResponse response, long creatorId) throws Exception {
        String contentType = request.getContentType();
        if (contentType == null || !contentType.startsWith("multipart/form-data"))
            throw new IllegalArgumentException("Upload must use multipart/form-data");
        byte[] bytes = readLimited(request.getInputStream(), MAX_UPLOAD_BYTES);
        MultipartForm form = MultipartForm.parse(contentType, bytes);
        String videoUrl = form.fields.getOrDefault("videoUrl", "").trim();
        String thumbnailUrl = form.fields.getOrDefault("thumbnailUrl", "").trim();
        if (form.files.containsKey("videoFile")) videoUrl = saveUpload(form.files.get("videoFile"), true);
        if (form.files.containsKey("thumbnailFile")) thumbnailUrl = saveUpload(form.files.get("thumbnailFile"), false);
        long id = repository.create(form.fields, creatorId, videoUrl, thumbnailUrl);
        sendJson(response, 201, Map.of("id", id, "message", "Video published"));
    }

    private String saveUpload(MultipartForm.FilePart part, boolean video) throws IOException {
        String extension = VideoValidator.uploadExtension(part, video);
        String name = UUID.randomUUID() + extension;
        Files.write(config.uploadDir().resolve(name), part.bytes(), StandardOpenOption.CREATE_NEW);
        return "/uploads/" + name;
    }

    private void serveUpload(HttpServletRequest request, HttpServletResponse response, String requested) throws IOException {
        Path file = config.uploadDir().resolve(requested).normalize();
        if (!file.startsWith(config.uploadDir()) || !Files.isRegularFile(file)) {
            sendJson(response, 404, Map.of("error", "File not found")); return;
        }
        long size = Files.size(file);
        long start = 0, end = size - 1;
        String range = request.getHeader("Range");
        if (range != null && range.startsWith("bytes=")) {
            String[] values = range.substring(6).split("-", 2);
            try {
                start = Long.parseLong(values[0]);
                if (values.length > 1 && !values[1].isBlank()) end = Math.min(end, Long.parseLong(values[1]));
                if (start < 0 || start > end) throw new NumberFormatException();
                response.setStatus(HttpServletResponse.SC_PARTIAL_CONTENT);
                response.setHeader("Content-Range", "bytes " + start + "-" + end + "/" + size);
            } catch (NumberFormatException e) {
                response.setStatus(HttpServletResponse.SC_REQUESTED_RANGE_NOT_SATISFIABLE);
                response.setHeader("Content-Range", "bytes */" + size);
                return;
            }
        } else {
            response.setStatus(HttpServletResponse.SC_OK);
        }
        response.setContentType(contentType(file));
        response.setHeader("Accept-Ranges", "bytes");
        response.setHeader("Cache-Control", "no-cache");
        long length = end - start + 1;
        response.setContentLengthLong(length);
        if (!request.getMethod().equals("HEAD")) {
            try (InputStream in = Files.newInputStream(file); OutputStream out = response.getOutputStream()) {
                in.skipNBytes(start);
                byte[] buffer = new byte[64 * 1024];
                long remaining = length;
                while (remaining > 0) {
                    int read = in.read(buffer, 0, (int) Math.min(buffer.length, remaining));
                    if (read < 0) break;
                    out.write(buffer, 0, read);
                    remaining -= read;
                }
            }
        }
    }

    private Map<String, Object> body(HttpServletRequest request) throws IOException {
        String contentType = request.getContentType();
        if (contentType == null || !contentType.toLowerCase().startsWith("application/json"))
            throw new IllegalArgumentException("Content-Type must be application/json");
        return Json.parseObject(new String(readLimited(request.getInputStream(), 1024 * 1024), StandardCharsets.UTF_8));
    }

    private String sessionToken(HttpServletRequest request) {
        return SessionStore.tokenFrom(request.getHeader("Cookie"));
    }

    private Long currentUserId(HttpServletRequest request) { return sessions.resolve(sessionToken(request)); }

    private long requireUser(HttpServletRequest request) {
        Long userId = currentUserId(request);
        if (userId == null) throw ApiException.unauthorized();
        return userId;
    }

    private long requireCreator(HttpServletRequest request) throws SQLException {
        long userId = requireUser(request);
        Map<String, Object> user = accounts.user(userId);
        if (user == null || !"CREATOR".equals(user.get("role")))
            throw ApiException.forbidden("A creator account is required");
        return userId;
    }

    private void setSessionCookie(HttpServletRequest request, HttpServletResponse response, String token) {
        response.addHeader("Set-Cookie", SessionStore.COOKIE + "=" + token + "; Path=" + cookiePath(request)
                + "; HttpOnly; SameSite=Lax; Max-Age=" + SessionStore.MAX_AGE_SECONDS);
    }

    private void clearSessionCookie(HttpServletRequest request, HttpServletResponse response) {
        response.addHeader("Set-Cookie", SessionStore.COOKIE + "=; Path=" + cookiePath(request)
                + "; HttpOnly; SameSite=Lax; Max-Age=0");
    }

    private String cookiePath(HttpServletRequest request) {
        return request.getContextPath().isBlank() ? "/" : request.getContextPath();
    }

    private void protectVideos(List<Map<String, Object>> videos, Long userId) throws SQLException {
        boolean premium = userId != null && accounts.hasPremium(userId);
        for (Map<String, Object> video : videos) protectVideo(video, userId, premium);
    }

    private void protectVideo(Map<String, Object> video, Long userId) throws SQLException {
        protectVideo(video, userId, userId != null && accounts.hasPremium(userId));
    }

    private void protectVideo(Map<String, Object> video, Long userId, boolean premium) {
        boolean canWatch = VideoAccessPolicy.decide(video, userId, premium) == VideoAccessPolicy.Decision.ALLOWED;
        video.put("canWatch", canWatch);
        if (!canWatch) video.remove("videoUrl");
    }

    private void requireVideoAccess(long videoId, Long userId) throws SQLException {
        Map<String, Object> video = repository.video(videoId, userId == null ? 0 : userId);
        if (video == null) throw new ApiException(404, "Video not found");
        boolean premium = userId != null && "PREMIUM".equals(video.get("accessType")) && accounts.hasPremium(userId);
        requireAccessDecision(VideoAccessPolicy.decide(video, userId, premium), "Video not found");
    }

    private void requireUploadAccess(String path, Long userId) throws SQLException {
        Map<String, Object> policy = repository.uploadPolicy(path);
        if (policy == null) return;
        boolean premium = userId != null && "PREMIUM".equals(policy.get("accessType")) && accounts.hasPremium(userId);
        requireAccessDecision(VideoAccessPolicy.decide(policy, userId, premium), "File not found");
    }

    private void requireAccessDecision(VideoAccessPolicy.Decision decision, String hiddenMessage) {
        if (decision == VideoAccessPolicy.Decision.HIDDEN) throw new ApiException(404, hiddenMessage);
        if (decision == VideoAccessPolicy.Decision.PREMIUM_REQUIRED)
            throw new ApiException(402, "A premium subscription is required");
    }

    private byte[] readLimited(InputStream input, int limit) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int total = 0, read;
        while ((read = input.read(buffer)) >= 0) {
            total += read;
            if (total > limit) throw new IllegalArgumentException("Request is too large (maximum 250 MB)");
            out.write(buffer, 0, read);
        }
        return out.toByteArray();
    }

    private Map<String, String> query(HttpServletRequest request) {
        Map<String, String> result = new HashMap<>();
        request.getParameterMap().forEach((key, values) -> result.put(key, values.length == 0 ? "" : values[0]));
        return result;
    }

    private void sendJson(HttpServletResponse response, int status, Object value) throws IOException {
        if (response.isCommitted()) return;
        response.setStatus(status);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType("application/json");
        response.setHeader("Cache-Control", "no-store");
        response.getWriter().write(Json.stringify(value));
    }

    private String contentType(Path path) {
        String detected = getServletContext().getMimeType(path.getFileName().toString());
        return detected == null ? "application/octet-stream" : detected;
    }

    private String message(Exception e) { return e.getMessage() == null ? "" : e.getMessage(); }
    private long parseId(String value) {
        try {
            long id = Long.parseLong(value);
            if (id <= 0) throw new NumberFormatException();
            return id;
        } catch (NumberFormatException e) { throw new IllegalArgumentException("ID must be a positive whole number"); }
    }
    private Integer parseOptionalInt(String value) { try { return value == null || value.isBlank() ? null : Integer.valueOf(value); } catch (NumberFormatException e) { throw new IllegalArgumentException("Invalid category"); } }
    private long number(Map<String, Object> body, String key) {
        Object value = body.get(key);
        if (!(value instanceof Number number)) throw new IllegalArgumentException(key + " must be a number");
        double decimal = number.doubleValue();
        if (!Double.isFinite(decimal) || decimal != Math.rint(decimal))
            throw new IllegalArgumentException(key + " must be a whole number");
        return number.longValue();
    }
    private boolean bool(Map<String, Object> body, String key) {
        Object value = body.get(key);
        if (!(value instanceof Boolean result)) throw new IllegalArgumentException(key + " must be true or false");
        return result;
    }
    private Long optionalPositiveId(Object value, String name) {
        if (value == null) return null;
        if (!(value instanceof Number number) || !Double.isFinite(number.doubleValue())
                || number.doubleValue() != Math.rint(number.doubleValue()) || number.longValue() <= 0)
            throw new IllegalArgumentException(name + " ID must be a positive whole number");
        return number.longValue();
    }
}
