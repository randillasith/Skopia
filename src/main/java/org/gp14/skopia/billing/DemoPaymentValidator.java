package org.gp14.skopia.billing;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Locale;

/** Validates transient synthetic demo data. Raw values must never be persisted or logged. */
final class DemoPaymentValidator {
    private static final DateTimeFormatter EXPIRY = DateTimeFormatter.ofPattern("MM/yy", Locale.ROOT);
    private DemoPaymentValidator() {}

    static Validated validate(String cardNumber, String expiry, String cardholderName) {
        String digits = cardNumber == null ? "" : cardNumber.replaceAll("[ -]", "");
        if (!digits.matches("4216\\d{12}") || !luhn(digits)) reject();
        YearMonth expires;
        try {
            if (expiry == null || !expiry.matches("(0[1-9]|1[0-2])/\\d{2}")) reject();
            expires = YearMonth.parse(expiry, EXPIRY);
        } catch (DateTimeParseException ex) {
            throw invalid();
        }
        if (expires.isBefore(YearMonth.now())) reject();
        String name = cardholderName == null ? "" : cardholderName.trim().replaceAll("\\s+", " ");
        if (name.length() < 2 || name.length() > 80 || !name.matches("[\\p{L}][\\p{L} .'-]*[\\p{L}.]")) reject();
        return new Validated(digits.substring(12));
    }

    private static boolean luhn(String value) {
        int sum = 0; boolean doubleDigit = false;
        for (int i = value.length() - 1; i >= 0; i--) {
            int digit = value.charAt(i) - '0';
            if (doubleDigit && (digit *= 2) > 9) digit -= 9;
            sum += digit; doubleDigit = !doubleDigit;
        }
        return sum % 10 == 0;
    }
    private static void reject() { throw invalid(); }
    private static ResponseStatusException invalid() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid synthetic test payment details");
    }
    record Validated(String last4) {}
}
