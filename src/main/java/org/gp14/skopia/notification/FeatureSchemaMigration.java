package org.gp14.skopia.notification;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.Locale;

/** Additive compatibility migration for installations created before FR2/FR4 persistence. */
@Component
class FeatureSchemaMigration implements ApplicationRunner {
    private final JdbcTemplate jdbc;
    FeatureSchemaMigration(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    @Override public void run(ApplicationArguments args) {
        if (jdbc.getDataSource() == null) return;
        String product;
        try (var c = jdbc.getDataSource().getConnection()) { product = c.getMetaData().getDatabaseProductName().toLowerCase(Locale.ROOT); }
        catch (Exception e) { throw new IllegalStateException("Could not inspect feature schema", e); }
        if (!product.contains("mysql") && !product.contains("mariadb")) return;
        add("refunds","requested_date","datetime null"); add("refunds","decision_note","varchar(500) null");
        add("notifications","title","varchar(255) null"); add("notifications","target_url","varchar(500) null");
        add("notifications","dedupe_key","varchar(180) null"); add("notifications","read_at","datetime null");
        add("announcements","status","varchar(20) not null default 'DRAFT'"); add("announcements","created_at","datetime null"); add("announcements","updated_at","datetime null");
        jdbc.update("update refunds set requested_date=coalesce(requested_date, processed_date, current_timestamp) where requested_date is null");
        jdbc.update("update notifications set title=coalesce(nullif(title,''),'Notification'), dedupe_key=coalesce(nullif(dedupe_key,''),concat('LEGACY:',notification_id)) where title is null or title='' or dedupe_key is null or dedupe_key=''");
        jdbc.update("update announcements set status=case when publish_date is null then 'DRAFT' else 'PUBLISHED' end, created_at=coalesce(created_at,publish_date,current_timestamp), updated_at=coalesce(updated_at,created_at,publish_date,current_timestamp) where status is null or status='' or created_at is null or updated_at is null");
        index("notifications","uq_notification_user_dedupe","unique index uq_notification_user_dedupe (user_id,dedupe_key)");
    }
    private void add(String table,String column,String ddl){Integer n=jdbc.queryForObject("select count(*) from information_schema.columns where table_schema=database() and table_name=? and column_name=?",Integer.class,table,column);if(n!=null&&n==0)jdbc.execute("alter table `"+table+"` add column `"+column+"` "+ddl);}
    private void index(String table,String name,String ddl){Integer n=jdbc.queryForObject("select count(*) from information_schema.statistics where table_schema=database() and table_name=? and index_name=?",Integer.class,table,name);if(n!=null&&n==0)jdbc.execute("alter table `"+table+"` add "+ddl);}
}
