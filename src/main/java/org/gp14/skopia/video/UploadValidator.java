package org.gp14.skopia.video;

import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.io.InputStream;
import java.util.Arrays;
import java.util.Map;

/** Validate declared MIME, extension, and file signature before persisting uploaded media. */
final class UploadValidator {
    private static final Map<String, String> TYPES = Map.of(
            ".mp4", "video/mp4", ".mov", "video/quicktime", ".webm", "video/webm",
            ".ogg", "video/ogg", ".jpg", "image/jpeg", ".jpeg", "image/jpeg",
            ".png", "image/png", ".webp", "image/webp");

    private UploadValidator() {}

    static String validate(MultipartFile file, boolean video) throws IOException {
        String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(java.util.Locale.ROOT);
        int dot = name.lastIndexOf('.');
        String ext = dot < 0 ? "" : name.substring(dot);
        String mime = TYPES.get(ext);
        if (mime == null || (video != mime.startsWith("video/")) || !mime.equalsIgnoreCase(file.getContentType())
                || file.isEmpty()) throw new IllegalArgumentException("Unsupported upload type");
        byte[] magic;
        try (InputStream in = file.getInputStream()) { magic = in.readNBytes(16); }
        boolean valid = switch (ext) {
            case ".mp4", ".mov" -> magic.length >= 12 && matches(magic, 4, "ftyp")
                    && (ext.equals(".mp4") ? !matches(magic, 8, "qt  ") : matches(magic, 8, "qt  "));
            case ".webm" -> magic.length >= 4 && (magic[0] & 255) == 0x1a && (magic[1] & 255) == 0x45
                    && (magic[2] & 255) == 0xdf && (magic[3] & 255) == 0xa3;
            case ".ogg" -> matches(magic, 0, "OggS");
            case ".jpg", ".jpeg" -> magic.length >= 3 && (magic[0] & 255) == 0xff
                    && (magic[1] & 255) == 0xd8 && (magic[2] & 255) == 0xff;
            case ".png" -> magic.length >= 8 && Arrays.equals(Arrays.copyOf(magic, 8),
                    new byte[]{(byte)137,80,78,71,13,10,26,10});
            case ".webp" -> matches(magic, 0, "RIFF") && matches(magic, 8, "WEBP");
            default -> false;
        };
        if (!valid) throw new IllegalArgumentException("Upload signature does not match its type");
        return ext;
    }

    private static boolean matches(byte[] bytes, int offset, String text) {
        return bytes.length >= offset + text.length()
                && Arrays.equals(Arrays.copyOfRange(bytes, offset, offset + text.length()),
                        text.getBytes(java.nio.charset.StandardCharsets.US_ASCII));
    }
}
