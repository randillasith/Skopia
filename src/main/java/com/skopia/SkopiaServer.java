package com.skopia;

import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
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
import java.util.concurrent.Executors;

public final class SkopiaServer {
    private static final int MAX_UPLOAD_BYTES = 250 * 1024 * 1024;

    private final Config config;
    private final VideoRepository repository;
    private final AccountRepository accounts;
    private final SessionStore sessions = new SessionStore();

    private SkopiaServer(Config config, VideoRepository repository, AccountRepository accounts) {
        this.config = config;
        this.repository = repository;
        this.accounts = accounts;
    }

    public static void main(String[] args) throws Exception {
        Config config = Config.load();
        Files.createDirectories(config.uploadDir());
        Database database = new Database(config);
        database.initialize();

        HttpServer server = HttpServer.create(new InetSocketAddress(config.appPort()), 0);
        SkopiaServer app = new SkopiaServer(config, new VideoRepository(database), new AccountRepository(database));
        server.createContext("/", app::handle);
        server.setExecutor(Executors.newFixedThreadPool(Math.max(4, Runtime.getRuntime().availableProcessors())));
        server.start();
        System.out.println("Skopia is running at http://localhost:" + config.appPort());
        System.out.println("Press Ctrl+C to stop.");
    }

    private void handle(HttpExchange exchange) throws IOException {
        try {
            String path = exchange.getRequestURI().getPath();
            if (path.startsWith("/api/")) handleApi(exchange, path);
            else if (path.startsWith("/uploads/")) {
                requireUploadAccess(path, currentUserId(exchange));
                serveFile(exchange, config.uploadDir(), path.substring("/uploads/".length()), false);
            }
            else servePublic(exchange, path);
        } catch (ApiException e) {
            sendJson(exchange, e.status(), Map.of("error", e.getMessage()));
        } catch (IllegalArgumentException e) {
            sendJson(exchange, 400, Map.of("error", e.getMessage()));
        } catch (SQLException e) {
            e.printStackTrace();
            sendJson(exchange, 500, Map.of("error", "Database operation failed", "detail", e.getMessage()));
        } catch (Exception e) {
            e.printStackTrace();
            sendJson(exchange, 500, Map.of("error", "Unexpected server error", "detail", e.getMessage() == null ? "" : e.getMessage()));
        } finally {
            exchange.close();
        }
    }

    private void handleApi(HttpExchange x, String path) throws Exception {
        String method = x.getRequestMethod();
        Map<String, String> query = query(x);
        if (method.equals("POST") && path.equals("/api/auth/register")) {
            Map<String, Object> user = accounts.register(body(x));
            sessions.revoke(sessionToken(x));
            setSessionCookie(x, sessions.create(((Number) user.get("id")).longValue()));
            sendJson(x, 201, Map.of("user", user)); return;
        }
        if (method.equals("POST") && path.equals("/api/auth/login")) {
            Map<String, Object> user = accounts.authenticate(body(x));
            sessions.revoke(sessionToken(x));
            setSessionCookie(x, sessions.create(((Number) user.get("id")).longValue()));
            sendJson(x, 200, Map.of("user", user)); return;
        }
        if (method.equals("POST") && path.equals("/api/auth/logout")) {
            sessions.revoke(sessionToken(x)); clearSessionCookie(x);
            sendJson(x, 200, Map.of("message", "Signed out")); return;
        }
        if (method.equals("GET") && path.equals("/api/auth/me")) {
            Long id = currentUserId(x);
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("user", id == null ? null : accounts.user(id));
            sendJson(x, 200, result); return;
        }
        if (method.equals("GET") && path.equals("/api/payments/status")) {
            sendJson(x, 200, accounts.subscription(requireUser(x))); return;
        }
        if (method.equals("GET") && path.equals("/api/payments")) {
            sendJson(x, 200, accounts.payments(requireUser(x))); return;
        }
        if (method.equals("POST") && (path.equals("/api/payments") || path.equals("/api/payments/checkout"))) {
            sendJson(x, 201, accounts.checkout(requireUser(x), body(x))); return;
        }
        if (method.equals("GET") && path.equals("/api/health")) {
            sendJson(x, 200, Map.of("status", "ok", "module", "Video, Accounts & Subscriptions")); return;
        }
        if (method.equals("GET") && path.equals("/api/categories")) {
            sendJson(x, 200, repository.categories()); return;
        }
        if (method.equals("GET") && path.equals("/api/videos")) {
            Integer category = parseOptionalInt(query.get("category"));
            Long userId = currentUserId(x);
            Long creator = "mine".equals(query.get("scope")) ? requireCreator(x) : null;
            var videos = repository.videos(query.get("search"), category, query.get("access"), creator, userId == null ? 0 : userId);
            protectVideos(videos, userId);
            sendJson(x, 200, videos); return;
        }
        if (method.equals("POST") && path.equals("/api/videos")) {
            createVideo(x, requireCreator(x)); return;
        }
        if (method.equals("GET") && path.equals("/api/history")) {
            sendJson(x, 200, repository.history(requireUser(x))); return;
        }
        if (method.equals("GET") && path.equals("/api/watchlist")) {
            sendJson(x, 200, repository.watchlist(requireUser(x))); return;
        }

        String[] parts = path.substring(1).split("/");
        if (parts.length == 3 && parts[0].equals("api") && parts[1].equals("payments")) {
            long paymentId = parseId(parts[2]);
            long userId = requireUser(x);
            if (method.equals("GET")) {
                Map<String, Object> payment = accounts.payment(paymentId, userId);
                sendJson(x, payment == null ? 404 : 200,
                        payment == null ? Map.of("error", "Payment not found") : payment); return;
            }
            if (method.equals("PUT")) {
                Map<String, Object> payment = accounts.updatePayment(paymentId, userId, body(x));
                sendJson(x, payment == null ? 404 : 200,
                        payment == null ? Map.of("error", "Payment not found") : payment); return;
            }
            if (method.equals("DELETE")) {
                boolean deleted = accounts.deletePayment(paymentId, userId);
                sendJson(x, deleted ? 200 : 404,
                        deleted ? Map.of("message", "Payment deleted") : Map.of("error", "Payment not found")); return;
            }
        }
        if (parts.length >= 3 && parts[0].equals("api") && parts[1].equals("videos")) {
            long videoId = parseId(parts[2]);
            if (parts.length == 3 && method.equals("GET")) {
                Long userId = currentUserId(x);
                Map<String, Object> video = repository.video(videoId, userId == null ? 0 : userId);
                if (video == null || (!"PUBLISHED".equals(video.get("status"))
                        && (userId == null || ((Number) video.get("creatorId")).longValue() != userId)))
                    sendJson(x, 404, Map.of("error", "Video not found"));
                else { protectVideo(video, userId); sendJson(x, 200, video); }
                return;
            }
            if (parts.length == 3 && method.equals("PUT")) {
                boolean updated = repository.update(videoId, requireCreator(x), body(x));
                sendJson(x, updated ? 200 : 404, updated ? Map.of("message", "Video updated") : Map.of("error", "Video not found")); return;
            }
            if (parts.length == 3 && method.equals("DELETE")) {
                boolean deleted = repository.delete(videoId, requireCreator(x));
                sendJson(x, deleted ? 200 : 404, deleted ? Map.of("message", "Video deleted") : Map.of("error", "Video not found")); return;
            }
            if (parts.length == 4 && parts[3].equals("like") && method.equals("POST")) {
                sendJson(x, 200, repository.toggleLike(videoId, requireUser(x))); return;
            }
            if (parts.length == 4 && parts[3].equals("save") && method.equals("POST")) {
                sendJson(x, 200, repository.toggleSaved(videoId, requireUser(x))); return;
            }
            if (parts.length == 4 && parts[3].equals("view") && method.equals("POST")) {
                requireVideoAccess(videoId, currentUserId(x));
                repository.addView(videoId); sendJson(x, 200, Map.of("message", "View counted")); return;
            }
            if (parts.length == 4 && parts[3].equals("progress") && method.equals("POST")) {
                Map<String, Object> data = body(x);
                long userId = requireUser(x); requireVideoAccess(videoId, userId);
                repository.saveProgress(videoId, userId, number(data, "position"), bool(data, "completed"));
                sendJson(x, 200, Map.of("message", "Progress saved")); return;
            }
            if (parts.length == 4 && parts[3].equals("comments") && method.equals("GET")) {
                sendJson(x, 200, repository.comments(videoId)); return;
            }
            if (parts.length == 4 && parts[3].equals("comments") && method.equals("POST")) {
                Map<String, Object> data = body(x);
                Long parentId = optionalPositiveId(data.get("parentId"), "Parent comment");
                sendJson(x, 201, repository.addComment(videoId, requireUser(x), String.valueOf(data.getOrDefault("text", "")), parentId)); return;
            }
        }
        if (parts.length == 3 && parts[0].equals("api") && parts[1].equals("comments") && method.equals("PUT")) {
            long userId = requireUser(x);
            Object text = body(x).get("text");
            if (!(text instanceof String)) throw new IllegalArgumentException("Comment text is required");
            boolean updated = repository.updateComment(parseId(parts[2]), userId, (String) text);
            sendJson(x, updated ? 200 : 404,
                    updated ? Map.of("message", "Comment updated") : Map.of("error", "Comment not found")); return;
        }
        if (parts.length == 3 && parts[0].equals("api") && parts[1].equals("comments") && method.equals("DELETE")) {
            boolean deleted = repository.deleteComment(parseId(parts[2]), requireUser(x));
            sendJson(x, deleted ? 200 : 404, deleted ? Map.of("message", "Comment deleted") : Map.of("error", "Comment not found")); return;
        }
        sendJson(x, 404, Map.of("error", "API route not found"));
    }

    private void createVideo(HttpExchange x, long creatorId) throws Exception {
        String contentType = x.getRequestHeaders().getFirst("Content-Type");
        if (contentType == null || !contentType.startsWith("multipart/form-data")) throw new IllegalArgumentException("Upload must use multipart/form-data");
        byte[] bytes = readLimited(x.getRequestBody(), MAX_UPLOAD_BYTES);
        MultipartForm form = MultipartForm.parse(contentType, bytes);
        String videoUrl = form.fields.getOrDefault("videoUrl", "").trim();
        String thumbnailUrl = form.fields.getOrDefault("thumbnailUrl", "").trim();
        if (form.files.containsKey("videoFile")) videoUrl = saveUpload(form.files.get("videoFile"), true);
        if (form.files.containsKey("thumbnailFile")) thumbnailUrl = saveUpload(form.files.get("thumbnailFile"), false);
        long id = repository.create(form.fields, creatorId, videoUrl, thumbnailUrl);
        sendJson(x, 201, Map.of("id", id, "message", "Video published"));
    }

    private String saveUpload(MultipartForm.FilePart part, boolean video) throws IOException {
        String extension = VideoValidator.uploadExtension(part, video);
        String name = UUID.randomUUID() + extension;
        Files.write(config.uploadDir().resolve(name), part.bytes(), StandardOpenOption.CREATE_NEW);
        return "/uploads/" + name;
    }

    private void servePublic(HttpExchange x, String path) throws IOException {
        String file = path.equals("/") ? "index.html" : path.substring(1);
        Path candidate = config.publicDir().resolve(file).normalize();
        if (!candidate.startsWith(config.publicDir()) || !Files.isRegularFile(candidate)) candidate = config.publicDir().resolve("index.html");
        servePath(x, candidate, true);
    }

    private void serveFile(HttpExchange x, Path root, String requested, boolean cache) throws IOException {
        Path candidate = root.resolve(requested).normalize();
        if (!candidate.startsWith(root) || !Files.isRegularFile(candidate)) { sendJson(x, 404, Map.of("error", "File not found")); return; }
        servePath(x, candidate, cache);
    }

    private void servePath(HttpExchange x, Path file, boolean cache) throws IOException {
        long size = Files.size(file);
        String range = x.getRequestHeaders().getFirst("Range");
        Headers headers = x.getResponseHeaders();
        headers.set("Content-Type", contentType(file));
        headers.set("Accept-Ranges", "bytes");
        headers.set("Cache-Control", cache ? "public, max-age=300" : "no-cache");
        long start = 0, end = size - 1;
        int status = 200;
        if (range != null && range.startsWith("bytes=")) {
            String[] values = range.substring(6).split("-", 2);
            try {
                start = Long.parseLong(values[0]);
                if (values.length > 1 && !values[1].isBlank()) end = Math.min(end, Long.parseLong(values[1]));
                if (start < 0 || start > end) throw new NumberFormatException();
                status = 206; headers.set("Content-Range", "bytes " + start + "-" + end + "/" + size);
            } catch (NumberFormatException e) { headers.set("Content-Range", "bytes */" + size); x.sendResponseHeaders(416, -1); return; }
        }
        long length = end - start + 1;
        x.sendResponseHeaders(status, length);
        if (!x.getRequestMethod().equals("HEAD")) {
            try (InputStream in = Files.newInputStream(file); OutputStream out = x.getResponseBody()) {
                in.skipNBytes(start);
                byte[] buffer = new byte[64 * 1024];
                long remaining = length;
                while (remaining > 0) {
                    int read = in.read(buffer, 0, (int) Math.min(buffer.length, remaining));
                    if (read < 0) break;
                    out.write(buffer, 0, read); remaining -= read;
                }
            }
        }
    }

    private Map<String, Object> body(HttpExchange x) throws IOException {
        String contentType = x.getRequestHeaders().getFirst("Content-Type");
        if (contentType == null || !contentType.toLowerCase().startsWith("application/json"))
            throw new IllegalArgumentException("Content-Type must be application/json");
        return Json.parseObject(new String(readLimited(x.getRequestBody(), 1024 * 1024), StandardCharsets.UTF_8));
    }

    private String sessionToken(HttpExchange x) {
        return SessionStore.tokenFrom(x.getRequestHeaders().getFirst("Cookie"));
    }

    private Long currentUserId(HttpExchange x) { return sessions.resolve(sessionToken(x)); }

    private long requireUser(HttpExchange x) {
        Long userId = currentUserId(x);
        if (userId == null) throw ApiException.unauthorized();
        return userId;
    }

    private long requireCreator(HttpExchange x) throws SQLException {
        long userId = requireUser(x);
        Map<String, Object> user = accounts.user(userId);
        if (user == null || !"CREATOR".equals(user.get("role")))
            throw ApiException.forbidden("A creator account is required");
        return userId;
    }

    private void setSessionCookie(HttpExchange x, String token) {
        x.getResponseHeaders().add("Set-Cookie", SessionStore.COOKIE + "=" + token
                + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=" + SessionStore.MAX_AGE_SECONDS);
    }

    private void clearSessionCookie(HttpExchange x) {
        x.getResponseHeaders().add("Set-Cookie", SessionStore.COOKIE + "=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
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

    private Map<String, String> query(HttpExchange x) {
        Map<String, String> values = new HashMap<>();
        String raw = x.getRequestURI().getRawQuery();
        if (raw == null || raw.isBlank()) return values;
        for (String pair : raw.split("&")) {
            String[] item = pair.split("=", 2);
            values.put(decode(item[0]), item.length > 1 ? decode(item[1]) : "");
        }
        return values;
    }

    private void sendJson(HttpExchange x, int status, Object value) throws IOException {
        byte[] body = Json.stringify(value).getBytes(StandardCharsets.UTF_8);
        x.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        x.getResponseHeaders().set("Cache-Control", "no-store");
        x.sendResponseHeaders(status, body.length);
        x.getResponseBody().write(body);
    }

    private String contentType(Path path) {
        String name = path.getFileName().toString().toLowerCase();
        if (name.endsWith(".html")) return "text/html; charset=utf-8";
        if (name.endsWith(".css")) return "text/css; charset=utf-8";
        if (name.endsWith(".js")) return "text/javascript; charset=utf-8";
        if (name.endsWith(".svg")) return "image/svg+xml";
        if (name.endsWith(".png")) return "image/png";
        if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
        if (name.endsWith(".webp")) return "image/webp";
        if (name.endsWith(".mp4")) return "video/mp4";
        if (name.endsWith(".webm")) return "video/webm";
        if (name.endsWith(".ogg")) return "video/ogg";
        return "application/octet-stream";
    }

    private String decode(String value) { return URLDecoder.decode(value, StandardCharsets.UTF_8); }
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
