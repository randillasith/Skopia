package org.gp14.skopia.billing;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

/** One-way compatibility migration so creator accounts can own passes without rewriting existing rows. */
@Component
class BillingSchemaMigration implements ApplicationRunner {
    private record ForeignKey(String name, String referencedTable) {}
    private final JdbcTemplate jdbc;
    BillingSchemaMigration(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Override public void run(ApplicationArguments args) {
        String product = jdbc.getDataSource() == null ? "" : databaseProduct();
        if (!product.contains("mysql") && !product.contains("mariadb")) return;
        List<ForeignKey> constraints = jdbc.query("""
                select constraint_name, referenced_table_name
                from information_schema.key_column_usage
                where table_schema = database() and table_name = 'subscriptions'
                  and column_name = 'viewer_id' and referenced_table_name is not null
                """, (rs, rowNum) -> new ForeignKey(rs.getString(1), rs.getString(2)));
        boolean pointsToViewers = constraints.stream().anyMatch(key -> "viewers".equalsIgnoreCase(key.referencedTable()));
        for (ForeignKey key : constraints) {
            if ("viewers".equalsIgnoreCase(key.referencedTable())) continue;
            String name = key.name();
            if (name == null || !name.matches("[A-Za-z0-9_]+")) throw new IllegalStateException("Unsafe subscription constraint name");
            jdbc.execute("alter table subscriptions drop foreign key `" + name + "`");
        }
        if (!pointsToViewers)
            jdbc.execute("alter table subscriptions add constraint fk_subscriptions_viewer foreign key (viewer_id) references viewers (viewer_id)");
    }

    private String databaseProduct() {
        try (var connection = jdbc.getDataSource().getConnection()) {
            return connection.getMetaData().getDatabaseProductName().toLowerCase(java.util.Locale.ROOT);
        } catch (java.sql.SQLException ex) {
            throw new IllegalStateException("Could not inspect billing schema", ex);
        }
    }
}
