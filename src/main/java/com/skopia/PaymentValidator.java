package com.skopia;

import java.time.YearMonth;
import java.util.Map;
import java.util.Set;

final class PaymentValidator {
    record PaymentInput(String plan, String last4, String brand) {}
    record PaymentUpdate(String plan, String status) {}

    private static final Set<String> PLANS = Set.of("MONTHLY", "YEARLY");
    private static final Set<String> EDITABLE_STATUSES = Set.of("SUCCEEDED", "REFUNDED");

    private PaymentValidator() {}

    static PaymentInput validate(Map<String, Object> body) {
        if (body == null) throw new IllegalArgumentException("Payment details are required");
        String plan = text(body, "plan").trim().toUpperCase();
        String cardholderValue = text(body, "cardholder");
        String cardholder = cardholderValue.trim().replaceAll("\\s+", " ");
        String cardValue = text(body, "cardNumber").trim();
        String card = cardValue.replaceAll("[ -]", "");
        String expiryValue = text(body, "expiry").trim();
        String cvv = text(body, "cvv").trim();
        if (!PLANS.contains(plan)) throw new IllegalArgumentException("Choose a valid subscription plan");
        if (cardholder.length() < 2 || cardholder.length() > 100 || cardholderValue.chars().anyMatch(Character::isISOControl))
            throw new IllegalArgumentException("Cardholder name must contain 2 to 100 characters");
        if (!cardValue.matches("[0-9 -]+") || !card.matches("\\d{13,19}") || !passesLuhn(card))
            throw new IllegalArgumentException("Enter a valid test card number");
        if (!cvv.matches("\\d{3,4}")) throw new IllegalArgumentException("Security code must contain 3 or 4 digits");
        if (!expiryValue.matches("(0[1-9]|1[0-2])/\\d{2}")) throw new IllegalArgumentException("Expiry must use MM/YY");
        int month = Integer.parseInt(expiryValue.substring(0, 2));
        int year = 2000 + Integer.parseInt(expiryValue.substring(3));
        YearMonth expiry = YearMonth.of(year, month);
        if (expiry.isBefore(YearMonth.now())) throw new IllegalArgumentException("Card expiry date has passed");
        if (expiry.isAfter(YearMonth.now().plusYears(20))) throw new IllegalArgumentException("Card expiry date is too far in the future");
        return new PaymentInput(plan, card.substring(card.length() - 4), brand(card));
    }

    static PaymentUpdate validateUpdate(Map<String, Object> body) {
        if (body == null) throw new IllegalArgumentException("Payment update is required");
        String plan = text(body, "plan").trim().toUpperCase();
        String status = text(body, "status").trim().toUpperCase();
        if (!PLANS.contains(plan)) throw new IllegalArgumentException("Plan must be MONTHLY or YEARLY");
        if (!EDITABLE_STATUSES.contains(status))
            throw new IllegalArgumentException("Status must be SUCCEEDED or REFUNDED");
        return new PaymentUpdate(plan, status);
    }

    static boolean passesLuhn(String digits) {
        int sum = 0;
        boolean doubleDigit = false;
        for (int i = digits.length() - 1; i >= 0; i--) {
            int digit = digits.charAt(i) - '0';
            if (doubleDigit && (digit *= 2) > 9) digit -= 9;
            sum += digit;
            doubleDigit = !doubleDigit;
        }
        return sum % 10 == 0;
    }

    private static String brand(String card) {
        if (card.startsWith("4")) return "Visa";
        if (card.matches("5[1-5].*")) return "Mastercard";
        if (card.matches("3[47].*")) return "American Express";
        return "Card";
    }

    private static String text(Map<String, Object> body, String key) {
        Object value = body.get(key);
        return value instanceof String ? (String) value : "";
    }
}
