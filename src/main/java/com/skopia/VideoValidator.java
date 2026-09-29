package com.skopia;

import java.net.URI;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

final class VideoValidator {
    static final int MIN_TITLE_LENGTH = 3;
    static final int MAX_TITLE_LENGTH = 180;
    static final int MAX_DESCRIPTION_LENGTH = 4000;
    static final int MAX_URL_LENGTH = 700;
    static final int MIN_DURATION_SECONDS = 1;
    static final int MAX_DURATION_SECONDS = 86_400;
    static final int MAX_COMMENT_LENGTH = 1000;
    static final int MAX_SEARCH_LENGTH = 100;
    static final int MAX_VIDEO_BYTES = 250 * 1024 * 1024;
    static final int MAX_THUMBNAIL_BYTES = 10 * 1024 * 1024;

    private static final Set<String> VIDEO_EXTENSIONS = Set.of(".mp4", ".webm", ".ogg", ".mov");
    private static final Set<String> IMAGE_EXTENSIONS = Set.of(".jpg", ".jpeg", ".png", ".webp");

    private VideoValidator() {}

    record VideoInput(
            int categoryId,
            String title,
            String description,
            String videoUrl,
            String thumbnailUrl,
            int durationSeconds,
            String accessType,
            String status) {}

    static VideoInput createInput(Map<String, String> form, String videoUrl, String thumbnailUrl) {
        return new VideoInput(
                positiveInt(form.get("categoryId"), "Category"),
                title(form.get("title")),
                description(form.get("description")),
                mediaUrl(videoUrl, "Video", true),
                mediaUrl(thumbnailUrl, "Thumbnail", false),
                duration(form.get("durationSeconds")),
                enumValue(form.get("accessType"), "Access type", "FREE", "PREMIUM"),
                enumValue(form.get("status"), "Status", "PUBLISHED", "DRAFT"));
    }

    static VideoInput updateInput(Map<String, Object> body) {
        return new VideoInput(
                positiveInt(body.get("categoryId"), "Category"),
                title(text(body.get("title"))),
                description(text(body.get("description"))),
                optionalMediaUrl(text(body.get("videoUrl")), "Video", true),
                optionalMediaUrl(text(body.get("thumbnailUrl")), "Thumbnail", false),
                duration(body.get("durationSeconds")),
                enumValue(text(body.get("accessType")), "Access type", "FREE", "PREMIUM"),
                enumValue(text(body.get("status")), "Status", "PUBLISHED", "DRAFT"));
    }

    static String uploadExtension(MultipartForm.FilePart part, boolean video) {
        if (part == null || part.bytes() == null || part.bytes().length == 0)
            throw new IllegalArgumentException((video ? "Video" : "Thumbnail") + " file is empty");

        int limit = video ? MAX_VIDEO_BYTES : MAX_THUMBNAIL_BYTES;
        if (part.bytes().length > limit)
            throw new IllegalArgumentException(video
                    ? "Video file must be 250 MB or smaller"
                    : "Thumbnail file must be 10 MB or smaller");

        String name = part.fileName() == null ? "" : part.fileName().toLowerCase(Locale.ROOT);
        Set<String> allowed = video ? VIDEO_EXTENSIONS : IMAGE_EXTENSIONS;
        String extension = allowed.stream().filter(name::endsWith).findFirst().orElse("");
        if (extension.isEmpty())
            throw new IllegalArgumentException(video
                    ? "Video must be MP4, WebM, OGG, or MOV"
                    : "Thumbnail must be JPG, PNG, or WebP");

        String contentType = part.contentType() == null ? "" : part.contentType().toLowerCase(Locale.ROOT);
        if (!contentType.isBlank() && !contentType.equals("application/octet-stream")) {
            boolean typeMatches = video ? contentType.startsWith("video/") : contentType.startsWith("image/");
            if (!typeMatches) throw new IllegalArgumentException((video ? "Video" : "Thumbnail") + " file type does not match its content type");
        }
        if (!hasExpectedSignature(part.bytes(), extension))
            throw new IllegalArgumentException((video ? "Video" : "Thumbnail") + " file content does not match its extension");
        return extension;
    }

    static String comment(String value) {
        String cleaned = required(value, "Comment");
        if (cleaned.length() > MAX_COMMENT_LENGTH)
            throw new IllegalArgumentException("Comment must be 1000 characters or fewer");
        rejectUnsafeControls(cleaned, "Comment");
        return cleaned;
    }

    static String search(String value) {
        if (value == null || value.isBlank()) return null;
        String cleaned = value.trim();
        if (cleaned.length() > MAX_SEARCH_LENGTH)
            throw new IllegalArgumentException("Search must be 100 characters or fewer");
        rejectUnsafeControls(cleaned, "Search");
        return cleaned;
    }

    static int progress(long value) {
        if (value < 0 || value > MAX_DURATION_SECONDS)
            throw new IllegalArgumentException("Playback position must be between 0 and 86400 seconds");
        return (int) value;
    }

    private static String title(String value) {
        String cleaned = required(value, "Title");
        if (cleaned.length() < MIN_TITLE_LENGTH || cleaned.length() > MAX_TITLE_LENGTH)
            throw new IllegalArgumentException("Title must be between 3 and 180 characters");
        rejectUnsafeControls(cleaned, "Title");
        return cleaned;
    }

    private static String description(String value) {
        String cleaned = value == null ? "" : value.trim();
        if (cleaned.length() > MAX_DESCRIPTION_LENGTH)
            throw new IllegalArgumentException("Description must be 4000 characters or fewer");
        rejectUnsafeControls(cleaned, "Description");
        return cleaned;
    }

    private static int duration(Object value) {
        int result = positiveInt(value, "Duration");
        if (result < MIN_DURATION_SECONDS || result > MAX_DURATION_SECONDS)
            throw new IllegalArgumentException("Duration must be between 1 and 86400 seconds");
        return result;
    }

    private static int positiveInt(Object value, String name) {
        long parsed;
        try {
            if (value instanceof Number number) {
                double decimal = number.doubleValue();
                if (!Double.isFinite(decimal) || decimal != Math.rint(decimal))
                    throw new NumberFormatException();
                parsed = number.longValue();
            } else parsed = Long.parseLong(text(value).trim());
        } catch (Exception e) {
            throw new IllegalArgumentException(name + " must be a whole number");
        }
        if (parsed <= 0 || parsed > Integer.MAX_VALUE)
            throw new IllegalArgumentException(name + " must be a positive whole number");
        return (int) parsed;
    }

    private static String optionalMediaUrl(String value, String name, boolean video) {
        return value == null || value.isBlank() ? "" : mediaUrl(value, name, video);
    }

    private static String mediaUrl(String value, String name, boolean video) {
        String cleaned = required(value, name);
        if (cleaned.length() > MAX_URL_LENGTH)
            throw new IllegalArgumentException(name + " URL must be 700 characters or fewer");
        rejectUnsafeControls(cleaned, name + " URL");
        if (cleaned.startsWith("/uploads/")) {
            Set<String> allowed = video ? VIDEO_EXTENSIONS : IMAGE_EXTENSIONS;
            boolean validPath = cleaned.matches("/uploads/[A-Za-z0-9-]+\\.[A-Za-z0-9]+")
                    && allowed.stream().anyMatch(cleaned.toLowerCase(Locale.ROOT)::endsWith);
            if (validPath) return cleaned;
            throw new IllegalArgumentException(name + " upload path has an invalid file type");
        }
        try {
            URI uri = new URI(cleaned);
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            if (!(scheme.equals("http") || scheme.equals("https")) || uri.getHost() == null || uri.getUserInfo() != null)
                throw new IllegalArgumentException(name + " URL must be a valid HTTP or HTTPS URL");
            return cleaned;
        } catch (URISyntaxException e) {
            throw new IllegalArgumentException(name + " URL must be a valid HTTP or HTTPS URL");
        }
    }

    private static String enumValue(String value, String name, String... allowed) {
        String normalized = required(value, name).toUpperCase(Locale.ROOT);
        for (String item : allowed) if (item.equals(normalized)) return item;
        throw new IllegalArgumentException(name + " has an invalid value");
    }

    private static String required(String value, String name) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(name + " is required");
        return value.trim();
    }

    private static String text(Object value) { return value == null ? "" : String.valueOf(value); }

    private static void rejectUnsafeControls(String value, String name) {
        for (int i = 0; i < value.length(); i++) {
            char character = value.charAt(i);
            if (Character.isISOControl(character) && character != '\n' && character != '\r' && character != '\t')
                throw new IllegalArgumentException(name + " contains unsupported control characters");
        }
    }

    private static boolean hasExpectedSignature(byte[] bytes, String extension) {
        return switch (extension) {
            case ".jpg", ".jpeg" -> startsWith(bytes, 0xFF, 0xD8, 0xFF);
            case ".png" -> startsWith(bytes, 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A);
            case ".webp" -> ascii(bytes, 0, "RIFF") && ascii(bytes, 8, "WEBP");
            case ".mp4", ".mov" -> ascii(bytes, 4, "ftyp");
            case ".webm" -> startsWith(bytes, 0x1A, 0x45, 0xDF, 0xA3);
            case ".ogg" -> ascii(bytes, 0, "OggS");
            default -> false;
        };
    }

    private static boolean startsWith(byte[] bytes, int... signature) {
        if (bytes.length < signature.length) return false;
        for (int i = 0; i < signature.length; i++) if ((bytes[i] & 0xFF) != signature[i]) return false;
        return true;
    }

    private static boolean ascii(byte[] bytes, int offset, String value) {
        byte[] expected = value.getBytes(StandardCharsets.US_ASCII);
        if (bytes.length < offset + expected.length) return false;
        for (int i = 0; i < expected.length; i++) if (bytes[offset + i] != expected[i]) return false;
        return true;
    }
}
