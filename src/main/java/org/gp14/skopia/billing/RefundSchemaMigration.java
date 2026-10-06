package org.gp14.skopia.billing;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;

/** Idempotent MariaDB/MySQL migration for persisted refund lifecycle data. */
@Component
@Order(20)
class RefundSchemaMigration implements ApplicationRunner {
    private final JdbcTemplate jdbc;

    RefundSchemaMigration(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(ApplicationArguments args) {
        String product = databaseProduct();
        if (!product.contains("mysql") && !product.contains("mariadb")) return;

        addColumnIfMissing("payments", "currency", "varchar(3) null");
        jdbc.update("update payments set currency = 'USD' where currency is null or currency = ''");
        jdbc.execute("alter table payments modify column currency varchar(3) not null default 'USD'");

        addColumnIfMissing("refunds", "category", "varchar(40) null");
        addColumnIfMissing("refunds", "currency", "varchar(3) null");
        addColumnIfMissing("refunds", "version", "bigint not null default 0");
        jdbc.update("update refunds set category = 'OTHER' where category is null or category = ''");
        jdbc.update("update refunds set refund_status = upper(refund_status) where refund_status is not null");
        Integer unknownStatuses = jdbc.queryForObject("""
                select count(*) from refunds
                where refund_status is null or refund_status not in ('PENDING','APPROVED','REJECTED','CANCELLED')
                """, Integer.class);
        if (unknownStatuses != null && unknownStatuses > 0)
            throw new IllegalStateException("Cannot migrate refunds with unknown status values");
        jdbc.update("update refunds r join payments p on p.payment_id = r.payment_id " +
                "set r.currency = p.currency where r.currency is null or r.currency = ''");
        jdbc.update("update refunds set currency = 'USD' where currency is null or currency = ''");
        jdbc.execute("alter table refunds modify column category varchar(40) not null default 'OTHER'");
        jdbc.execute("alter table refunds modify column currency varchar(3) not null default 'USD'");

        createHistoryTableIfMissing();
        backfillHistory();
        ensureOneRefundPerPayment();
        createIndexIfMissing("refunds", "idx_refunds_status_requested",
                "alter table refunds add index idx_refunds_status_requested (refund_status, requested_date)");
        createIndexIfMissing("refunds", "idx_refunds_category",
                "alter table refunds add index idx_refunds_category (category)");
    }

    private void createHistoryTableIfMissing() {
        if (tableExists("refund_status_history")) return;
        jdbc.execute("""
                create table refund_status_history (
                    history_id bigint not null auto_increment,
                    refund_id bigint not null,
                    from_status varchar(20) null,
                    to_status varchar(20) not null,
                    changed_by bigint null,
                    change_note varchar(500) null,
                    changed_at datetime(6) not null,
                    primary key (history_id),
                    constraint fk_refund_history_refund foreign key (refund_id) references refunds (refund_id),
                    constraint fk_refund_history_user foreign key (changed_by) references users (user_id),
                    index idx_refund_history_refund_changed (refund_id, changed_at)
                )
                """);
    }

    private void ensureOneRefundPerPayment() {
        List<Long> duplicatePayments = jdbc.query("""
                select payment_id from refunds group by payment_id having count(*) > 1 limit 10
                """, (rs, rowNum) -> rs.getLong(1));
        if (!duplicatePayments.isEmpty()) {
            throw new IllegalStateException("Cannot enforce one refund per payment; duplicate payment IDs: " + duplicatePayments);
        }
        if (!indexExists("refunds", "uq_refunds_payment")) {
            jdbc.execute("alter table refunds add constraint uq_refunds_payment unique (payment_id)");
        }
    }

    private void backfillHistory() {
        jdbc.update("""
                insert into refund_status_history
                    (refund_id, from_status, to_status, changed_by, change_note, changed_at)
                select r.refund_id, null, r.refund_status,
                       coalesce(r.processed_by, s.viewer_id),
                       concat('Migrated existing refund state: ', r.refund_status),
                       coalesce(r.processed_date, r.requested_date, current_timestamp(6))
                from refunds r
                join payments p on p.payment_id = r.payment_id
                join subscriptions s on s.subscription_id = p.subscription_id
                where not exists (
                    select 1 from refund_status_history h where h.refund_id = r.refund_id
                )
                """);
    }

    private void createIndexIfMissing(String table, String index, String ddl) {
        if (!indexExists(table, index)) jdbc.execute(ddl);
    }

    private void addColumnIfMissing(String table, String column, String definition) {
        if (!columnExists(table, column)) {
            jdbc.execute("alter table `" + safe(table) + "` add column `" + safe(column) + "` " + definition);
        }
    }

    private boolean tableExists(String table) {
        Integer count = jdbc.queryForObject("""
                select count(*) from information_schema.tables
                where table_schema = database() and lower(table_name) = lower(?)
                """, Integer.class, table);
        return count != null && count > 0;
    }

    private boolean columnExists(String table, String column) {
        Integer count = jdbc.queryForObject("""
                select count(*) from information_schema.columns
                where table_schema = database() and lower(table_name) = lower(?) and lower(column_name) = lower(?)
                """, Integer.class, table, column);
        return count != null && count > 0;
    }

    private boolean indexExists(String table, String index) {
        Integer count = jdbc.queryForObject("""
                select count(*) from information_schema.statistics
                where table_schema = database() and lower(table_name) = lower(?) and lower(index_name) = lower(?)
                """, Integer.class, table, index);
        return count != null && count > 0;
    }

    private String safe(String identifier) {
        if (identifier == null || !identifier.matches("[A-Za-z0-9_]+"))
            throw new IllegalArgumentException("Unsafe SQL identifier");
        return identifier;
    }

    private String databaseProduct() {
        if (jdbc.getDataSource() == null) return "";
        try (var connection = jdbc.getDataSource().getConnection()) {
            return connection.getMetaData().getDatabaseProductName().toLowerCase(Locale.ROOT);
        } catch (java.sql.SQLException ex) {
            throw new IllegalStateException("Could not inspect refund schema", ex);
        }
    }
}
