package com.skopia;

import java.sql.*;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class VideoRepository {
    private final Database database;
    VideoRepository(Database database) { this.database = database; }

    List<Map<String, Object>> categories() throws SQLException {
        List<Map<String, Object>> rows = new ArrayList<>();
        try (Connection c = database.open();
             PreparedStatement ps = c.prepareStatement("SELECT category_id, category_name FROM categories ORDER BY category_name");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) rows.add(Map.of("id", rs.getInt(1), "name", rs.getString(2)));
        }
        return rows;
    }

    List<Map<String, Object>> videos(String search, Integer categoryId, String access, Long creatorId, long userId) throws SQLException {
        search = VideoValidator.search(search);
        if (categoryId != null && categoryId <= 0) throw new IllegalArgumentException("Category must be a positive whole number");
        if (access != null && !access.isBlank() && !access.equals("FREE") && !access.equals("PREMIUM"))
            throw new IllegalArgumentException("Access type has an invalid value");
        StringBuilder sql = new StringBuilder("""
            SELECT v.video_id, v.title, v.description, v.video_url, v.thumbnail_url,
                   v.duration_seconds, v.view_count, v.access_type, v.video_status, v.upload_date,
                   c.category_id, c.category_name, u.user_id creator_id, u.display_name creator_name, u.avatar_url,
                   (SELECT COUNT(*) FROM video_likes l WHERE l.video_id=v.video_id) like_count,
                   EXISTS(SELECT 1 FROM video_likes l WHERE l.video_id=v.video_id AND l.user_id=?) liked,
                   EXISTS(SELECT 1 FROM watchlist_items wi JOIN watchlists w ON w.watchlist_id=wi.watchlist_id
                          WHERE wi.video_id=v.video_id AND w.user_id=?) saved,
                   COALESCE((SELECT h.last_position FROM watch_history h WHERE h.video_id=v.video_id AND h.user_id=?),0) last_position
            FROM videos v JOIN categories c ON c.category_id=v.category_id JOIN users u ON u.user_id=v.creator_id
            WHERE 1=1
            """);
        List<Object> params = new ArrayList<>(List.of(userId, userId, userId));
        if (creatorId == null) sql.append(" AND v.video_status='PUBLISHED'");
        else { sql.append(" AND v.creator_id=?"); params.add(creatorId); }
        if (search != null && !search.isBlank()) {
            sql.append(" AND (LOWER(v.title) LIKE ? OR LOWER(v.description) LIKE ? OR LOWER(c.category_name) LIKE ?)");
            String term = "%" + search.toLowerCase() + "%";
            params.add(term); params.add(term); params.add(term);
        }
        if (categoryId != null) { sql.append(" AND v.category_id=?"); params.add(categoryId); }
        if (access != null && (access.equals("FREE") || access.equals("PREMIUM"))) {
            sql.append(" AND v.access_type=?"); params.add(access);
        }
        sql.append(" ORDER BY v.upload_date DESC, v.video_id DESC");

        List<Map<String, Object>> rows = new ArrayList<>();
        try (Connection c = database.open(); PreparedStatement ps = c.prepareStatement(sql.toString())) {
            bind(ps, params);
            try (ResultSet rs = ps.executeQuery()) { while (rs.next()) rows.add(videoMap(rs)); }
        }
        return rows;
    }

    Map<String, Object> video(long videoId, long userId) throws SQLException {
        String sql = """
            SELECT v.video_id, v.title, v.description, v.video_url, v.thumbnail_url,
                   v.duration_seconds, v.view_count, v.access_type, v.video_status, v.upload_date,
                   c.category_id, c.category_name, u.user_id creator_id, u.display_name creator_name, u.avatar_url,
                   (SELECT COUNT(*) FROM video_likes l WHERE l.video_id=v.video_id) like_count,
                   EXISTS(SELECT 1 FROM video_likes l WHERE l.video_id=v.video_id AND l.user_id=?) liked,
                   EXISTS(SELECT 1 FROM watchlist_items wi JOIN watchlists w ON w.watchlist_id=wi.watchlist_id
                          WHERE wi.video_id=v.video_id AND w.user_id=?) saved,
                   COALESCE((SELECT h.last_position FROM watch_history h WHERE h.video_id=v.video_id AND h.user_id=?),0) last_position
            FROM videos v JOIN categories c ON c.category_id=v.category_id JOIN users u ON u.user_id=v.creator_id
            WHERE v.video_id=?
            """;
        try (Connection c = database.open(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setLong(1, userId); ps.setLong(2, userId); ps.setLong(3, userId); ps.setLong(4, videoId);
            try (ResultSet rs = ps.executeQuery()) { return rs.next() ? videoMap(rs) : null; }
        }
    }

    Map<String, Object> uploadPolicy(String videoUrl) throws SQLException {
        try (Connection c = database.open(); PreparedStatement ps = c.prepareStatement(
                "SELECT creator_id,access_type,video_status FROM videos WHERE video_url=? LIMIT 1")) {
            ps.setString(1, videoUrl);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return null;
                return Map.of("creatorId", rs.getLong("creator_id"), "accessType", rs.getString("access_type"),
                        "status", rs.getString("video_status"));
            }
        }
    }

    long create(Map<String, String> form, long creatorId, String videoUrl, String thumbnailUrl) throws SQLException {
        VideoValidator.VideoInput input = VideoValidator.createInput(form, videoUrl, thumbnailUrl);
        String sql = """
            INSERT INTO videos (creator_id, category_id, title, description, video_url, thumbnail_url,
                                duration_seconds, access_type, video_status)
            VALUES (?,?,?,?,?,?,?,?,?)
            """;
        try (Connection c = database.open(); PreparedStatement ps = c.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ensureCategory(c, input.categoryId());
            ps.setLong(1, creatorId);
            ps.setInt(2, input.categoryId());
            ps.setString(3, input.title());
            ps.setString(4, input.description());
            ps.setString(5, input.videoUrl());
            ps.setString(6, input.thumbnailUrl());
            ps.setInt(7, input.durationSeconds());
            ps.setString(8, input.accessType());
            ps.setString(9, input.status());
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) { keys.next(); return keys.getLong(1); }
        }
    }

    boolean update(long videoId, long creatorId, Map<String, Object> body) throws SQLException {
        VideoValidator.VideoInput input = VideoValidator.updateInput(body);
        String sql = """
            UPDATE videos SET title=?, description=?, category_id=?, access_type=?, video_status=?,
                duration_seconds=?, video_url=COALESCE(NULLIF(?,''),video_url),
                thumbnail_url=COALESCE(NULLIF(?,''),thumbnail_url)
            WHERE video_id=? AND creator_id=?
            """;
        try (Connection c = database.open(); PreparedStatement ps = c.prepareStatement(sql)) {
            ensureCategory(c, input.categoryId());
            ps.setString(1, input.title());
            ps.setString(2, input.description());
            ps.setInt(3, input.categoryId());
            ps.setString(4, input.accessType());
            ps.setString(5, input.status());
            ps.setInt(6, input.durationSeconds());
            ps.setString(7, input.videoUrl());
            ps.setString(8, input.thumbnailUrl());
            ps.setLong(9, videoId); ps.setLong(10, creatorId);
            return ps.executeUpdate() == 1;
        }
    }

    boolean delete(long videoId, long creatorId) throws SQLException {
        try (Connection c = database.open(); PreparedStatement ps = c.prepareStatement("DELETE FROM videos WHERE video_id=? AND creator_id=?")) {
            ps.setLong(1, videoId); ps.setLong(2, creatorId);
            return ps.executeUpdate() == 1;
        }
    }

    Map<String, Object> toggleLike(long videoId, long userId) throws SQLException {
        try (Connection c = database.open()) {
            ensureVideoExists(c, videoId);
            boolean active;
            try (PreparedStatement check = c.prepareStatement("SELECT 1 FROM video_likes WHERE user_id=? AND video_id=?")) {
                check.setLong(1, userId); check.setLong(2, videoId);
                try (ResultSet rs = check.executeQuery()) { active = !rs.next(); }
            }
            try (PreparedStatement change = c.prepareStatement(active
                    ? "INSERT INTO video_likes(user_id,video_id) VALUES (?,?)"
                    : "DELETE FROM video_likes WHERE user_id=? AND video_id=?")) {
                change.setLong(1, userId); change.setLong(2, videoId); change.executeUpdate();
            }
            try (PreparedStatement count = c.prepareStatement("SELECT COUNT(*) FROM video_likes WHERE video_id=?")) {
                count.setLong(1, videoId);
                try (ResultSet rs = count.executeQuery()) { rs.next(); return Map.of("active", active, "count", rs.getLong(1)); }
            }
        }
    }

    Map<String, Object> toggleSaved(long videoId, long userId) throws SQLException {
        try (Connection c = database.open()) {
            ensureVideoExists(c, videoId);
            c.setAutoCommit(false);
            try {
                long watchlistId;
                try (PreparedStatement create = c.prepareStatement("INSERT IGNORE INTO watchlists(user_id,list_name) VALUES (?,'My Watchlist')")) {
                    create.setLong(1, userId); create.executeUpdate();
                }
                try (PreparedStatement find = c.prepareStatement("SELECT watchlist_id FROM watchlists WHERE user_id=?")) {
                    find.setLong(1, userId); try (ResultSet rs = find.executeQuery()) { rs.next(); watchlistId = rs.getLong(1); }
                }
                boolean active;
                try (PreparedStatement check = c.prepareStatement("SELECT 1 FROM watchlist_items WHERE watchlist_id=? AND video_id=?")) {
                    check.setLong(1, watchlistId); check.setLong(2, videoId);
                    try (ResultSet rs = check.executeQuery()) { active = !rs.next(); }
                }
                try (PreparedStatement change = c.prepareStatement(active
                        ? "INSERT INTO watchlist_items(watchlist_id,video_id) VALUES (?,?)"
                        : "DELETE FROM watchlist_items WHERE watchlist_id=? AND video_id=?")) {
                    change.setLong(1, watchlistId); change.setLong(2, videoId); change.executeUpdate();
                }
                c.commit(); return Map.of("active", active);
            } catch (SQLException e) { c.rollback(); throw e; }
        }
    }

    List<Map<String, Object>> comments(long videoId) throws SQLException {
        String sql = """
            SELECT c.comment_id,c.comment_text,c.posted_datetime,c.parent_comment_id,
                   u.user_id,u.display_name,u.avatar_url
            FROM comments c JOIN users u ON u.user_id=c.user_id
            WHERE c.video_id=? AND c.comment_status='VISIBLE' ORDER BY c.posted_datetime DESC
            """;
        List<Map<String, Object>> rows = new ArrayList<>();
        try (Connection c = database.open(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setLong(1, videoId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("id", rs.getLong("comment_id")); row.put("text", rs.getString("comment_text"));
                    row.put("postedAt", rs.getTimestamp("posted_datetime").toInstant().toString());
                    row.put("parentId", rs.getObject("parent_comment_id")); row.put("userId", rs.getLong("user_id"));
                    row.put("displayName", rs.getString("display_name")); row.put("avatarUrl", rs.getString("avatar_url"));
                    rows.add(row);
                }
            }
        }
        return rows;
    }

    Map<String, Object> addComment(long videoId, long userId, String text, Long parentId) throws SQLException {
        String cleaned = VideoValidator.comment(text);
        try (Connection c = database.open()) {
            ensureVideoExists(c, videoId);
            if (parentId != null) ensureParentComment(c, parentId, videoId);
            try (PreparedStatement ps = c.prepareStatement(
                    "INSERT INTO comments(video_id,user_id,parent_comment_id,comment_text) VALUES (?,?,?,?)", Statement.RETURN_GENERATED_KEYS)) {
                ps.setLong(1, videoId); ps.setLong(2, userId);
                if (parentId == null) ps.setNull(3, Types.BIGINT); else ps.setLong(3, parentId);
                ps.setString(4, cleaned); ps.executeUpdate();
                try (ResultSet keys = ps.getGeneratedKeys()) { keys.next(); return Map.of("id", keys.getLong(1), "text", cleaned); }
            }
        }
    }

    boolean deleteComment(long commentId, long userId) throws SQLException {
        try (Connection c = database.open(); PreparedStatement ps = c.prepareStatement(
                "UPDATE comments SET comment_status='DELETED',comment_text='' WHERE comment_id=? AND user_id=?")) {
            ps.setLong(1, commentId); ps.setLong(2, userId); return ps.executeUpdate() == 1;
        }
    }

    void saveProgress(long videoId, long userId, long position, boolean completed) throws SQLException {
        int validatedPosition = VideoValidator.progress(position);
        String sql = """
            INSERT INTO watch_history(user_id,video_id,last_position,is_completed) VALUES (?,?,?,?)
            ON DUPLICATE KEY UPDATE last_position=VALUES(last_position),is_completed=VALUES(is_completed),watched_datetime=CURRENT_TIMESTAMP
        """;
        try (Connection c = database.open(); PreparedStatement ps = c.prepareStatement(sql)) {
            ensureVideoExists(c, videoId);
            ps.setLong(1, userId); ps.setLong(2, videoId); ps.setInt(3, validatedPosition); ps.setBoolean(4, completed); ps.executeUpdate();
        }
    }

    void addView(long videoId) throws SQLException {
        try (Connection c = database.open(); PreparedStatement ps = c.prepareStatement("UPDATE videos SET view_count=view_count+1 WHERE video_id=?")) {
            ps.setLong(1, videoId);
            if (ps.executeUpdate() != 1) throw new IllegalArgumentException("Video does not exist");
        }
    }

    List<Map<String, Object>> history(long userId) throws SQLException {
        String sql = """
            SELECT v.video_id,v.title,v.thumbnail_url,v.duration_seconds,v.view_count,h.last_position,h.is_completed,h.watched_datetime,
                   c.category_name
            FROM watch_history h JOIN videos v ON v.video_id=h.video_id JOIN categories c ON c.category_id=v.category_id
            WHERE h.user_id=? ORDER BY h.watched_datetime DESC
            """;
        List<Map<String, Object>> rows = new ArrayList<>();
        try (Connection c = database.open(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setLong(1, userId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("id", rs.getLong("video_id")); row.put("title", rs.getString("title"));
                    row.put("thumbnailUrl", rs.getString("thumbnail_url")); row.put("durationSeconds", rs.getInt("duration_seconds"));
                    row.put("viewCount", rs.getLong("view_count"));
                    row.put("lastPosition", rs.getInt("last_position")); row.put("completed", rs.getBoolean("is_completed"));
                    row.put("watchedAt", rs.getTimestamp("watched_datetime").toInstant().toString()); row.put("category", rs.getString("category_name"));
                    rows.add(row);
                }
            }
        }
        return rows;
    }

    List<Map<String, Object>> watchlist(long userId) throws SQLException {
        String sql = """
            SELECT v.video_id,v.title,v.thumbnail_url,v.duration_seconds,v.view_count,c.category_name,wi.added_date
            FROM watchlist_items wi JOIN watchlists w ON w.watchlist_id=wi.watchlist_id
            JOIN videos v ON v.video_id=wi.video_id JOIN categories c ON c.category_id=v.category_id
            WHERE w.user_id=? ORDER BY wi.added_date DESC
            """;
        List<Map<String, Object>> rows = new ArrayList<>();
        try (Connection c = database.open(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setLong(1, userId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("id", rs.getLong("video_id")); row.put("title", rs.getString("title"));
                    row.put("thumbnailUrl", rs.getString("thumbnail_url")); row.put("durationSeconds", rs.getInt("duration_seconds"));
                    row.put("viewCount", rs.getLong("view_count")); row.put("category", rs.getString("category_name"));
                    row.put("addedAt", rs.getTimestamp("added_date").toInstant().toString()); rows.add(row);
                }
            }
        }
        return rows;
    }

    private Map<String, Object> videoMap(ResultSet rs) throws SQLException {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", rs.getLong("video_id")); row.put("title", rs.getString("title"));
        row.put("description", rs.getString("description")); row.put("videoUrl", rs.getString("video_url"));
        row.put("thumbnailUrl", rs.getString("thumbnail_url")); row.put("durationSeconds", rs.getInt("duration_seconds"));
        row.put("viewCount", rs.getLong("view_count")); row.put("accessType", rs.getString("access_type"));
        row.put("status", rs.getString("video_status")); row.put("uploadedAt", rs.getTimestamp("upload_date").toInstant().toString());
        row.put("categoryId", rs.getInt("category_id")); row.put("category", rs.getString("category_name"));
        row.put("creatorId", rs.getLong("creator_id")); row.put("creatorName", rs.getString("creator_name"));
        row.put("creatorAvatar", rs.getString("avatar_url")); row.put("likeCount", rs.getLong("like_count"));
        row.put("liked", rs.getBoolean("liked")); row.put("saved", rs.getBoolean("saved"));
        row.put("lastPosition", rs.getInt("last_position"));
        return row;
    }

    private void bind(PreparedStatement ps, List<Object> params) throws SQLException {
        for (int i = 0; i < params.size(); i++) ps.setObject(i + 1, params.get(i));
    }

    private void ensureCategory(Connection connection, int categoryId) throws SQLException {
        try (PreparedStatement ps = connection.prepareStatement("SELECT 1 FROM categories WHERE category_id=?")) {
            ps.setInt(1, categoryId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) throw new IllegalArgumentException("Selected category does not exist");
            }
        }
    }

    private void ensureVideoExists(Connection connection, long videoId) throws SQLException {
        try (PreparedStatement ps = connection.prepareStatement("SELECT 1 FROM videos WHERE video_id=?")) {
            ps.setLong(1, videoId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) throw new IllegalArgumentException("Video does not exist");
            }
        }
    }

    private void ensureParentComment(Connection connection, long commentId, long videoId) throws SQLException {
        try (PreparedStatement ps = connection.prepareStatement(
                "SELECT 1 FROM comments WHERE comment_id=? AND video_id=? AND comment_status='VISIBLE'")) {
            ps.setLong(1, commentId);
            ps.setLong(2, videoId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) throw new IllegalArgumentException("Parent comment does not belong to this video or is unavailable");
            }
        }
    }
}
