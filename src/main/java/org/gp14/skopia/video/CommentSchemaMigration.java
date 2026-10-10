package org.gp14.skopia.video;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.Locale;

/** Widens comment authors from registered viewers to any authenticated user account. */
@Component
class CommentSchemaMigration implements ApplicationRunner {
    private final JdbcTemplate jdbc;

    CommentSchemaMigration(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (jdbc.getDataSource() == null) return;
        String product;
        try (var connection = jdbc.getDataSource().getConnection()) {
            product = connection.getMetaData().getDatabaseProductName().toLowerCase(Locale.ROOT);
        } catch (Exception exception) {
            throw new IllegalStateException("Could not inspect comment schema", exception);
        }
        if (!product.contains("mysql") && !product.contains("mariadb")) return;

        var constraints = jdbc.query("select constraint_name, referenced_table_name " +
                        "from information_schema.key_column_usage " +
                        "where table_schema=database() and table_name='comments' and column_name='viewer_id' " +
                        "and referenced_table_name is not null",
                (result, row) -> new String[]{result.getString(1), result.getString(2)});
        if (constraints.size() == 1 && "users".equalsIgnoreCase(constraints.get(0)[1])) return;

        for (String[] foreignKey : constraints) {
            if (!foreignKey[0].matches("[A-Za-z0-9_$]+")) {
                throw new IllegalStateException("Unsafe comment foreign-key name");
            }
            jdbc.execute("alter table comments drop foreign key `" + foreignKey[0] + "`");
        }
        jdbc.execute("alter table comments add constraint fk_comments_author_user " +
                "foreign key (viewer_id) references users(user_id) on delete restrict");
    }
}
