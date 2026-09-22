package org.gp14.skopia.advertising;

import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Turns advertising failures into a response shape the UI can act on.
 *
 * <p>Scoped to this package so it cannot change how the rest of the platform
 * answers. Validation failures come back as a field → message map, which is what
 * the campaign form needs to put each message under the input that caused it
 * instead of dropping one banner at the top of the page.
 */
@RestControllerAdvice(basePackages = "org.gp14.skopia.advertising")
public class AdvertisingExceptionHandler {

    @ExceptionHandler(AdvertisingException.class)
    public ResponseEntity<Map<String, Object>> onAdvertising(AdvertisingException e) {
        return ResponseEntity.status(e.getStatus()).body(body(e.getMessage(), null));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> onValidation(MethodArgumentNotValidException e) {
        Map<String, String> fields = new LinkedHashMap<>();
        for (FieldError f : e.getBindingResult().getFieldErrors()) {
            fields.putIfAbsent(f.getField(), f.getDefaultMessage());
        }
        return ResponseEntity.badRequest().body(body("That form is not complete yet.", fields));
    }

    private Map<String, Object> body(String message, Map<String, String> fields) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("message", message);
        out.put("at", LocalDateTime.now().toString());
        if (fields != null && !fields.isEmpty()) {
            out.put("fields", fields);
        }
        return out;
    }
}
