package com.skopia;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class Json {
    private Json() {}

    static String stringify(Object value) {
        if (value == null) return "null";
        if (value instanceof String s) return '"' + escape(s) + '"';
        if (value instanceof Number || value instanceof Boolean) return value.toString();
        if (value instanceof Map<?, ?> map) {
            StringBuilder out = new StringBuilder("{");
            boolean first = true;
            for (var entry : map.entrySet()) {
                if (!first) out.append(',');
                first = false;
                out.append(stringify(String.valueOf(entry.getKey()))).append(':').append(stringify(entry.getValue()));
            }
            return out.append('}').toString();
        }
        if (value instanceof Iterable<?> items) {
            StringBuilder out = new StringBuilder("[");
            boolean first = true;
            for (Object item : items) {
                if (!first) out.append(',');
                first = false;
                out.append(stringify(item));
            }
            return out.append(']').toString();
        }
        return stringify(value.toString());
    }

    static Map<String, Object> parseObject(String input) {
        Object value = new Parser(input == null ? "{}" : input).parseValue();
        if (!(value instanceof Map<?, ?>)) throw new IllegalArgumentException("JSON body must be an object");
        @SuppressWarnings("unchecked") Map<String, Object> result = (Map<String, Object>) value;
        return result;
    }

    private static String escape(String value) {
        StringBuilder out = new StringBuilder();
        for (char c : value.toCharArray()) {
            switch (c) {
                case '"' -> out.append("\\\"");
                case '\\' -> out.append("\\\\");
                case '\n' -> out.append("\\n");
                case '\r' -> out.append("\\r");
                case '\t' -> out.append("\\t");
                default -> {
                    if (c < 32) out.append(String.format("\\u%04x", (int) c));
                    else out.append(c);
                }
            }
        }
        return out.toString();
    }

    private static final class Parser {
        private final String text;
        private int pos;
        Parser(String text) { this.text = text.trim(); }

        Object parseValue() {
            skip();
            if (pos >= text.length()) return null;
            return switch (text.charAt(pos)) {
                case '{' -> object();
                case '[' -> array();
                case '"' -> string();
                case 't' -> literal("true", true);
                case 'f' -> literal("false", false);
                case 'n' -> literal("null", null);
                default -> number();
            };
        }

        private Map<String, Object> object() {
            Map<String, Object> map = new LinkedHashMap<>();
            pos++;
            skip();
            if (take('}')) return map;
            do {
                skip();
                String key = string();
                skip();
                expect(':');
                map.put(key, parseValue());
                skip();
            } while (take(','));
            expect('}');
            return map;
        }

        private List<Object> array() {
            List<Object> list = new ArrayList<>();
            pos++;
            skip();
            if (take(']')) return list;
            do { list.add(parseValue()); skip(); } while (take(','));
            expect(']');
            return list;
        }

        private String string() {
            expect('"');
            StringBuilder out = new StringBuilder();
            while (pos < text.length()) {
                char c = text.charAt(pos++);
                if (c == '"') return out.toString();
                if (c == '\\') {
                    if (pos >= text.length()) break;
                    char e = text.charAt(pos++);
                    switch (e) {
                        case '"', '\\', '/' -> out.append(e);
                        case 'b' -> out.append('\b');
                        case 'f' -> out.append('\f');
                        case 'n' -> out.append('\n');
                        case 'r' -> out.append('\r');
                        case 't' -> out.append('\t');
                        case 'u' -> {
                            out.append((char) Integer.parseInt(text.substring(pos, pos + 4), 16));
                            pos += 4;
                        }
                        default -> throw new IllegalArgumentException("Invalid JSON escape");
                    }
                } else out.append(c);
            }
            throw new IllegalArgumentException("Unterminated JSON string");
        }

        private Object number() {
            int start = pos;
            while (pos < text.length() && "-+0123456789.eE".indexOf(text.charAt(pos)) >= 0) pos++;
            String raw = text.substring(start, pos);
            try { return raw.contains(".") || raw.contains("e") || raw.contains("E") ? Double.parseDouble(raw) : Long.parseLong(raw); }
            catch (NumberFormatException e) { throw new IllegalArgumentException("Invalid JSON value"); }
        }

        private Object literal(String expected, Object value) {
            if (!text.startsWith(expected, pos)) throw new IllegalArgumentException("Invalid JSON value");
            pos += expected.length();
            return value;
        }

        private void skip() { while (pos < text.length() && Character.isWhitespace(text.charAt(pos))) pos++; }
        private boolean take(char c) { if (pos < text.length() && text.charAt(pos) == c) { pos++; return true; } return false; }
        private void expect(char c) { if (!take(c)) throw new IllegalArgumentException("Expected '" + c + "'"); }
    }
}
