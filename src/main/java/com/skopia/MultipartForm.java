package com.skopia;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class MultipartForm {
    record FilePart(String fileName, String contentType, byte[] bytes) {}
    final Map<String, String> fields = new HashMap<>();
    final Map<String, FilePart> files = new HashMap<>();

    static MultipartForm parse(String contentType, byte[] body) {
        Matcher boundaryMatch = Pattern.compile("boundary=(?:\"([^\"]+)\"|([^;]+))").matcher(contentType == null ? "" : contentType);
        if (!boundaryMatch.find()) throw new IllegalArgumentException("Invalid multipart request");
        String boundary = boundaryMatch.group(1) != null ? boundaryMatch.group(1) : boundaryMatch.group(2).trim();
        String raw = new String(body, StandardCharsets.ISO_8859_1);
        String marker = "--" + boundary;
        MultipartForm result = new MultipartForm();
        int cursor = 0;
        while (true) {
            int start = raw.indexOf(marker, cursor);
            if (start < 0) break;
            start += marker.length();
            if (raw.startsWith("--", start)) break;
            if (raw.startsWith("\r\n", start)) start += 2;
            int headersEnd = raw.indexOf("\r\n\r\n", start);
            if (headersEnd < 0) break;
            String headers = raw.substring(start, headersEnd);
            int dataStart = headersEnd + 4;
            int next = raw.indexOf("\r\n" + marker, dataStart);
            if (next < 0) break;
            byte[] bytes = raw.substring(dataStart, next).getBytes(StandardCharsets.ISO_8859_1);
            String name = attribute(headers, "name");
            String fileName = attribute(headers, "filename");
            String partType = header(headers, "Content-Type");
            if (name != null) {
                if (fileName != null && !fileName.isBlank()) result.files.put(name, new FilePart(fileName, partType, bytes));
                else result.fields.put(name, new String(bytes, StandardCharsets.UTF_8));
            }
            cursor = next + 2;
        }
        return result;
    }

    private static String attribute(String headers, String name) {
        Matcher matcher = Pattern.compile("(?:^|;\\s*)" + Pattern.quote(name) + "=\"([^\"]*)\"", Pattern.CASE_INSENSITIVE).matcher(headers);
        return matcher.find() ? matcher.group(1) : null;
    }

    private static String header(String headers, String name) {
        Matcher matcher = Pattern.compile("(?im)^" + Pattern.quote(name) + ":\\s*([^\\r\\n]+)").matcher(headers);
        return matcher.find() ? matcher.group(1).trim() : "application/octet-stream";
    }
}
