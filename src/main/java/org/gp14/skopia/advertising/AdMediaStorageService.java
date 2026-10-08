package org.gp14.skopia.advertising;

import org.gp14.skopia.advertising.dto.UploadedMediaResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDate;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.Arrays;
import java.nio.charset.StandardCharsets;

/**
 * Where advertisement creative is stored, and what is allowed through.
 *
 * <p>Files land on disk under a configured directory and are served back by
 * {@link org.gp14.skopia.config.WebConfig} — a local stand-in for the object store
 * this would use in production. The interface is a URL either way, so swapping the
 * backing store later does not reach the advertisement record.
 *
 * <p>Extension, declared content type, and container signature are checked before
 * storing anything: an attacker may rename a script to {@code .png} and declare
 * its type as an image. The stored filename is
 * then generated rather than taken from the upload, so whatever the client called
 * it cannot escape the directory or collide with somebody else's file.
 */
@Service
public class AdMediaStorageService {

    /** Extension → the content types that may legitimately arrive with it. */
    private static final Map<String, Set<String>> ALLOWED = Map.of(
            "mp4", Set.of("video/mp4"),
            "webm", Set.of("video/webm"),
            "mov", Set.of("video/quicktime"),
            "png", Set.of("image/png"),
            "jpg", Set.of("image/jpeg"),
            "jpeg", Set.of("image/jpeg"),
            "webp", Set.of("image/webp"),
            "gif", Set.of("image/gif"));

    private static final Set<String> VIDEO_EXTENSIONS = Set.of("mp4", "webm", "mov");

    private final Path root;
    private final String publicBase;
    private final long maxBytes;
    private final AdvertisingAccess access;

    public AdMediaStorageService(
            @Value("${skopia.ads.media.storage-dir:uploads/ads}") String storageDir,
            @Value("${skopia.ads.media.public-base:/uploads/ads}") String publicBase,
            @Value("${skopia.ads.media.max-bytes:52428800}") long maxBytes,
            AdvertisingAccess access) {
        this.root = Paths.get(storageDir).toAbsolutePath().normalize();
        this.publicBase = publicBase.endsWith("/")
                ? publicBase.substring(0, publicBase.length() - 1) : publicBase;
        this.maxBytes = maxBytes;
        this.access = access;
    }

    public UploadedMediaResponse store(Long actorId, MultipartFile file) {
        access.require(actorId);

        if (file == null || file.isEmpty()) {
            throw AdvertisingException.invalid("Choose a file to upload.");
        }
        if (file.getSize() > maxBytes) {
            throw AdvertisingException.invalid(
                    "That file is " + mb(file.getSize()) + " MB. The limit is " + mb(maxBytes) + " MB.");
        }

        String extension = extensionOf(file.getOriginalFilename());
        Set<String> types = ALLOWED.get(extension);
        if (types == null) {
            throw AdvertisingException.invalid(
                    "Accepted creative formats are MP4, WebM, MOV, PNG, JPEG, WebP and GIF.");
        }
        String contentType = file.getContentType() == null
                ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        if (!contentType.isEmpty() && !types.contains(contentType)) {
            throw AdvertisingException.invalid(
                    "That file is named ." + extension + " but arrived as " + contentType + ".");
        }
        // A matching extension and MIME label can still conceal a renamed script.
        // Check the container signature before creating any storage directory.
        try (InputStream in = file.getInputStream()) {
            byte[] header = in.readNBytes(16);
            boolean matches = switch (extension) {
                case "png" -> header.length >= 8 && Arrays.equals(Arrays.copyOf(header, 8),
                        new byte[]{(byte)137, 80, 78, 71, 13, 10, 26, 10});
                case "jpg", "jpeg" -> header.length >= 3 && (header[0] & 255) == 255
                        && (header[1] & 255) == 216 && (header[2] & 255) == 255;
                case "gif" -> signature(header, 0, "GIF87a") || signature(header, 0, "GIF89a");
                case "webp" -> signature(header, 0, "RIFF") && signature(header, 8, "WEBP");
                case "mp4" -> signature(header, 4, "ftyp") && !signature(header, 8, "qt  ");
                case "mov" -> signature(header, 4, "ftyp") && signature(header, 8, "qt  ");
                case "webm" -> header.length >= 4 && Arrays.equals(Arrays.copyOf(header, 4),
                        new byte[]{0x1a, 0x45, (byte)0xdf, (byte)0xa3});
                default -> false;
            };
            if (!matches) throw AdvertisingException.invalid("The file contents do not match its media format.");
        } catch (IOException e) {
            throw AdvertisingException.invalid("The creative could not be read. Try uploading it again.");
        }

        // Dated folders, generated names. The client's filename never reaches the
        // filesystem, so "../../etc/passwd.png" is just a name in the response.
        LocalDate today = LocalDate.now();
        Path folder = root.resolve(String.valueOf(today.getYear()))
                .resolve(String.format("%02d", today.getMonthValue()));
        String stored = UUID.randomUUID() + "." + extension;

        try {
            Files.createDirectories(folder);
            Path target = folder.resolve(stored).normalize();
            if (!target.startsWith(root)) {
                throw AdvertisingException.invalid("That filename is not allowed.");
            }
            try (InputStream in = file.getInputStream()) {
                Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException e) {
            throw new AdvertisingException(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR,
                    "The creative could not be stored. Try again.");
        }

        String url = publicBase + "/" + today.getYear()
                + "/" + String.format("%02d", today.getMonthValue()) + "/" + stored;

        return new UploadedMediaResponse(
                url,
                file.getOriginalFilename(),
                file.getSize(),
                contentType.isEmpty() ? types.iterator().next() : contentType,
                VIDEO_EXTENSIONS.contains(extension) ? AdType.VIDEO : AdType.IMAGE);
    }

    private static String extensionOf(String filename) {
        if (filename == null) return "";
        int dot = filename.lastIndexOf('.');
        return dot < 0 ? "" : filename.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    private static boolean signature(byte[] header, int offset, String value) {
        byte[] expected = value.getBytes(StandardCharsets.US_ASCII);
        return header.length >= offset + expected.length
                && Arrays.equals(Arrays.copyOfRange(header, offset, offset + expected.length), expected);
    }

    private static String mb(long bytes) {
        return String.valueOf(Math.round(bytes / 1_048_576d * 10) / 10d);
    }
}
