package org.gp14.skopia.user;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;

import java.sql.PreparedStatement;

/** Allocates durable, concurrency-safe marketing officer codes. */
@Service
public class StaffOfficerCodeService {
    private final JdbcTemplate jdbc;

    public StaffOfficerCodeService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public String nextMarketingCode() {
        KeyHolder keys = new GeneratedKeyHolder();
        int inserted = jdbc.update(connection -> {
            PreparedStatement statement = connection.prepareStatement(
                    "insert into staff_officer_code_sequence(created_at) values (current_timestamp)",
                    new String[]{"id"});
            return statement;
        }, keys);
        if (inserted != 1 || keys.getKey() == null) {
            throw new IllegalStateException("Could not allocate marketing officer code");
        }
        return "MKT-" + String.format("%03d", keys.getKey().longValue());
    }
}
