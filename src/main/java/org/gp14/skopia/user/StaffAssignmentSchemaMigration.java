package org.gp14.skopia.user;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.Locale;

/** Additive, idempotent migration from legacy JOINED staff subclasses to composed staff assignments. */
@Component
class StaffAssignmentSchemaMigration implements ApplicationRunner {
    private final JdbcTemplate jdbc;
    StaffAssignmentSchemaMigration(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Override public void run(ApplicationArguments args) {
        if (jdbc.getDataSource() == null) return;
        String product;
        try (var c = jdbc.getDataSource().getConnection()) {
            product = c.getMetaData().getDatabaseProductName().toLowerCase(Locale.ROOT);
        } catch (Exception e) { throw new IllegalStateException("Could not inspect staff assignment schema", e); }
        if (!product.contains("mysql") && !product.contains("mariadb")) return;

        jdbc.execute("create table if not exists staff_assignments (" +
                "user_id bigint primary key, staff_type varchar(40) not null, designation varchar(100) not null," +
                "hire_date date not null, admin_level varchar(30) null, support_level varchar(30) null," +
                "shift varchar(30) null, officer_code varchar(50) null, department varchar(50) null," +
                "created_at datetime not null, updated_at datetime not null," +
                "constraint uq_staff_assignment_officer_code unique (officer_code)," +
                "constraint fk_staff_assignment_user foreign key (user_id) references users(user_id) on delete cascade)");
        jdbc.execute("create table if not exists staff_officer_code_sequence (" +
                "id bigint not null auto_increment primary key, created_at datetime not null)");

        Integer overlaps = jdbc.queryForObject("select count(*) from (select employee_no from (" +
                "select employee_no from administrators union all select employee_no from support_officers " +
                "union all select employee_no from marketing_officers) x group by employee_no having count(*) > 1) duplicates", Integer.class);
        if (overlaps != null && overlaps > 0) throw new IllegalStateException("A legacy user belongs to multiple staff subtypes");

        jdbc.update("insert ignore into staff_assignments(user_id,staff_type,designation,hire_date,admin_level,created_at,updated_at) " +
                "select a.employee_no,'ADMINISTRATOR',s.designation,s.hire_date,a.admin_level,current_timestamp,current_timestamp " +
                "from administrators a join staff s on s.employee_no=a.employee_no");
        jdbc.update("insert ignore into staff_assignments(user_id,staff_type,designation,hire_date,support_level,shift,created_at,updated_at) " +
                "select o.employee_no,'SUPPORT_OFFICER',s.designation,s.hire_date," +
                "case when upper(o.support_level) in ('TIER_1','TIER_2','TIER_3') then upper(o.support_level) else 'TIER_1' end," +
                "case when upper(coalesce(o.shift,'DAY')) in ('DAY','EVENING','NIGHT') then upper(coalesce(o.shift,'DAY')) else 'DAY' end," +
                "current_timestamp,current_timestamp from support_officers o join staff s on s.employee_no=o.employee_no");
        jdbc.update("insert ignore into staff_assignments(user_id,staff_type,designation,hire_date,officer_code,department,created_at,updated_at) " +
                "select o.employee_no,'MARKETING_OFFICER',s.designation,s.hire_date,o.officer_code," +
                "case when upper(o.department) in ('MARKETING','ADVERTISING','PARTNERSHIPS') then upper(o.department) else 'MARKETING' end," +
                "current_timestamp,current_timestamp from marketing_officers o join staff s on s.employee_no=o.employee_no");
        Long nextMarketingCode = jdbc.queryForObject("select coalesce(max(cast(substring(officer_code,5) as unsigned)),0)+1 " +
                "from staff_assignments where officer_code regexp '^MKT-[0-9]+$'", Long.class);
        if (nextMarketingCode != null && nextMarketingCode > 1) {
            jdbc.execute("alter table staff_officer_code_sequence auto_increment = " + nextMarketingCode);
        }
        rewireToUsers("refunds", "processed_by", "fk_refunds_processed_user", "set null");
        rewireToUsers("announcements", "published_by", "fk_announcements_publisher_user", "restrict");
    }

    private void rewireToUsers(String table, String column, String expectedName, String onDelete) {
        var constraints = jdbc.query("select constraint_name, referenced_table_name from information_schema.key_column_usage " +
                        "where table_schema=database() and table_name=? and column_name=? and referenced_table_name is not null",
                (rs, row) -> new String[]{rs.getString(1), rs.getString(2)}, table, column);
        if (constraints.size() == 1 && "users".equalsIgnoreCase(constraints.get(0)[1])) return;
        for (String[] fk : constraints) {
            if (!fk[0].matches("[A-Za-z0-9_$]+")) throw new IllegalStateException("Unsafe foreign-key name");
            jdbc.execute("alter table `" + table + "` drop foreign key `" + fk[0] + "`");
        }
        jdbc.execute("alter table `" + table + "` add constraint `" + expectedName + "` foreign key (`" + column + "`) references users(user_id) on delete " + onDelete);
    }
}
