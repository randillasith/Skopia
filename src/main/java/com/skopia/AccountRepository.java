package com.skopia;

import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

final class AccountRepository {
    private final Database database;

    AccountRepository(Database database) { this.database = database; }

    Map<String, Object> register(Map<String, Object> body) throws SQLException {
        AccountValidator.Signup input = AccountValidator.signup(body);
        String sql = "INSERT INTO users(username,email,password_hash,display_name,role) VALUES (?,?,?,?,?)";
        try (Connection c = database.open(); PreparedStatement ps = c.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, input.username());
            ps.setString(2, input.email());
            ps.setString(3, PasswordSecurity.hash(input.password()));
            ps.setString(4, input.displayName());
            ps.setString(5, input.role());
            try {
                ps.executeUpdate();
            } catch (SQLException e) {
                if (e.getSQLState() != null && e.getSQLState().startsWith("23"))
                    throw new ApiException(409, "That email or username is already registered");
                throw e;
            }
            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (!keys.next()) throw new SQLException("Account ID was not returned");
                return user(keys.getLong(1));
            }
        }
    }

    Map<String, Object> authenticate(Map<String, Object> body) throws SQLException {
        String identifier = AccountValidator.identifier(body);
        String password = AccountValidator.loginPassword(body);
        String sql = "SELECT user_id,password_hash FROM users WHERE LOWER(email)=? OR LOWER(username)=? LIMIT 1";
        long userId = 0;
        String hash = null;
        try (Connection c = database.open(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, identifier); ps.setString(2, identifier);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) { userId = rs.getLong(1); hash = rs.getString(2); }
            }
        }
        if (userId == 0 || !PasswordSecurity.verify(password, hash))
            throw new ApiException(401, "Email/username or password is incorrect");
        return user(userId);
    }

    Map<String, Object> user(long userId) throws SQLException {
        String sql = """
            SELECT u.user_id,u.username,u.email,u.display_name,u.role,u.avatar_url,u.created_at,
                   EXISTS(SELECT 1 FROM user_subscriptions s WHERE s.user_id=u.user_id AND s.status='ACTIVE' AND s.current_period_end>NOW()) premium
            FROM users u WHERE u.user_id=?
            """;
        try (Connection c = database.open(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setLong(1, userId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return null;
                Map<String, Object> user = new LinkedHashMap<>();
                user.put("id", rs.getLong("user_id"));
                user.put("username", rs.getString("username"));
                user.put("email", rs.getString("email"));
                user.put("displayName", rs.getString("display_name"));
                user.put("role", rs.getString("role"));
                user.put("avatarUrl", rs.getString("avatar_url"));
                user.put("premium", rs.getBoolean("premium"));
                user.put("createdAt", rs.getTimestamp("created_at").toInstant().toString());
                return user;
            }
        }
    }

    boolean hasPremium(long userId) throws SQLException {
        try (Connection c = database.open(); PreparedStatement ps = c.prepareStatement(
                "SELECT 1 FROM user_subscriptions WHERE user_id=? AND status='ACTIVE' AND current_period_end>NOW()")) {
            ps.setLong(1, userId);
            try (ResultSet rs = ps.executeQuery()) { return rs.next(); }
        }
    }

    Map<String, Object> subscription(long userId) throws SQLException {
        String sql = "SELECT plan_code,status,current_period_start,current_period_end FROM user_subscriptions WHERE user_id=?";
        try (Connection c = database.open(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setLong(1, userId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next() || !rs.getString("status").equals("ACTIVE")
                        || !rs.getTimestamp("current_period_end").toInstant().isAfter(Instant.now()))
                    return Map.of("active", false);
                return Map.of("active", true, "plan", rs.getString("plan_code"),
                        "periodStart", rs.getTimestamp("current_period_start").toInstant().toString(),
                        "periodEnd", rs.getTimestamp("current_period_end").toInstant().toString());
            }
        }
    }

    Map<String, Object> checkout(long userId, Map<String, Object> body) throws SQLException {
        PaymentValidator.PaymentInput input = PaymentValidator.validate(body);
        BigDecimal amount = input.plan().equals("YEARLY") ? new BigDecimal("99.00") : new BigDecimal("9.99");
        String reference = "demo_" + UUID.randomUUID().toString().replace("-", "");
        Instant now = Instant.now();
        try (Connection c = database.open()) {
            c.setAutoCommit(false);
            try {
                Instant start = now;
                try (PreparedStatement lock = c.prepareStatement("SELECT current_period_end FROM user_subscriptions WHERE user_id=? FOR UPDATE")) {
                    lock.setLong(1, userId);
                    try (ResultSet rs = lock.executeQuery()) {
                        if (rs.next() && rs.getTimestamp(1).toInstant().isAfter(now)) start = rs.getTimestamp(1).toInstant();
                    }
                }
                Instant end = (input.plan().equals("YEARLY")
                        ? start.atZone(ZoneOffset.UTC).plusYears(1) : start.atZone(ZoneOffset.UTC).plusMonths(1)).toInstant();
                try (PreparedStatement pay = c.prepareStatement("""
                    INSERT INTO payments(user_id,provider_reference,plan_code,amount,currency,status,card_brand,card_last4)
                    VALUES (?,?,?,?, 'USD','SUCCEEDED',?,?)
                    """)) {
                    pay.setLong(1, userId); pay.setString(2, reference); pay.setString(3, input.plan());
                    pay.setBigDecimal(4, amount); pay.setString(5, input.brand()); pay.setString(6, input.last4());
                    pay.executeUpdate();
                }
                try (PreparedStatement subscription = c.prepareStatement("""
                    INSERT INTO user_subscriptions(user_id,plan_code,status,current_period_start,current_period_end)
                    VALUES (?,?,'ACTIVE',?,?)
                    ON DUPLICATE KEY UPDATE plan_code=VALUES(plan_code),status='ACTIVE',
                        current_period_start=VALUES(current_period_start),current_period_end=VALUES(current_period_end),updated_at=CURRENT_TIMESTAMP
                    """)) {
                    subscription.setLong(1, userId); subscription.setString(2, input.plan());
                    subscription.setTimestamp(3, Timestamp.from(start)); subscription.setTimestamp(4, Timestamp.from(end));
                    subscription.executeUpdate();
                }
                c.commit();
                return Map.of("success", true, "reference", reference, "plan", input.plan(), "amount", amount,
                        "currency", "USD", "last4", input.last4(), "periodEnd", end.toString());
            } catch (Exception e) {
                c.rollback();
                throw e;
            } finally {
                c.setAutoCommit(true);
            }
        }
    }

    List<Map<String, Object>> payments(long userId) throws SQLException {
        String sql = """
            SELECT payment_id,provider_reference,plan_code,amount,currency,status,card_brand,card_last4,created_at
            FROM payments WHERE user_id=? ORDER BY created_at DESC,payment_id DESC
            """;
        List<Map<String, Object>> result = new ArrayList<>();
        try (Connection c = database.open(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setLong(1, userId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) result.add(payment(rs));
            }
        }
        return result;
    }

    Map<String, Object> payment(long paymentId, long userId) throws SQLException {
        String sql = """
            SELECT payment_id,provider_reference,plan_code,amount,currency,status,card_brand,card_last4,created_at
            FROM payments WHERE payment_id=? AND user_id=?
            """;
        try (Connection c = database.open(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setLong(1, paymentId); ps.setLong(2, userId);
            try (ResultSet rs = ps.executeQuery()) { return rs.next() ? payment(rs) : null; }
        }
    }

    Map<String, Object> updatePayment(long paymentId, long userId, Map<String, Object> body) throws SQLException {
        PaymentValidator.PaymentUpdate input = PaymentValidator.validateUpdate(body);
        BigDecimal amount = input.plan().equals("YEARLY") ? new BigDecimal("99.00") : new BigDecimal("9.99");
        try (Connection c = database.open()) {
            c.setAutoCommit(false);
            try {
                String currentStatus = null;
                try (PreparedStatement lock = c.prepareStatement(
                        "SELECT status FROM payments WHERE payment_id=? AND user_id=? FOR UPDATE")) {
                    lock.setLong(1, paymentId); lock.setLong(2, userId);
                    try (ResultSet rs = lock.executeQuery()) { if (rs.next()) currentStatus = rs.getString(1); }
                }
                if (currentStatus == null) { c.rollback(); return null; }
                if ((currentStatus.equals("REFUNDED") || currentStatus.equals("FAILED")) && input.status().equals("SUCCEEDED"))
                    throw new IllegalArgumentException("A failed or refunded payment cannot be changed back to succeeded");
                try (PreparedStatement update = c.prepareStatement(
                        "UPDATE payments SET plan_code=?,amount=?,status=? WHERE payment_id=? AND user_id=?")) {
                    update.setString(1, input.plan()); update.setBigDecimal(2, amount); update.setString(3, input.status());
                    update.setLong(4, paymentId); update.setLong(5, userId); update.executeUpdate();
                }
                if (!currentStatus.equals("REFUNDED") && input.status().equals("REFUNDED"))
                    cancelSubscriptionWhenNoSuccessfulPayment(c, userId);
                c.commit();
            } catch (Exception e) {
                c.rollback();
                throw e;
            } finally {
                c.setAutoCommit(true);
            }
        }
        return payment(paymentId, userId);
    }

    boolean deletePayment(long paymentId, long userId) throws SQLException {
        try (Connection c = database.open()) {
            c.setAutoCommit(false);
            try {
                int deleted;
                try (PreparedStatement ps = c.prepareStatement("DELETE FROM payments WHERE payment_id=? AND user_id=?")) {
                    ps.setLong(1, paymentId); ps.setLong(2, userId); deleted = ps.executeUpdate();
                }
                if (deleted > 0) cancelSubscriptionWhenNoSuccessfulPayment(c, userId);
                c.commit();
                return deleted > 0;
            } catch (Exception e) {
                c.rollback();
                throw e;
            } finally {
                c.setAutoCommit(true);
            }
        }
    }

    private void cancelSubscriptionWhenNoSuccessfulPayment(Connection c, long userId) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("""
                UPDATE user_subscriptions SET status='CANCELED'
                WHERE user_id=? AND NOT EXISTS (
                    SELECT 1 FROM payments WHERE user_id=? AND status='SUCCEEDED'
                )
                """)) {
            ps.setLong(1, userId); ps.setLong(2, userId); ps.executeUpdate();
        }
    }

    private Map<String, Object> payment(ResultSet rs) throws SQLException {
        Map<String, Object> payment = new LinkedHashMap<>();
        payment.put("id", rs.getLong("payment_id"));
        payment.put("reference", rs.getString("provider_reference"));
        payment.put("plan", rs.getString("plan_code"));
        payment.put("amount", rs.getBigDecimal("amount"));
        payment.put("currency", rs.getString("currency"));
        payment.put("status", rs.getString("status"));
        payment.put("cardBrand", rs.getString("card_brand"));
        payment.put("cardLast4", rs.getString("card_last4"));
        payment.put("createdAt", rs.getTimestamp("created_at").toInstant().toString());
        return payment;
    }
}
