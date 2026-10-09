package org.gp14.skopia.user;

import org.gp14.skopia.model.user.*;
import org.gp14.skopia.repository.*;
import org.gp14.skopia.user.dto.CreateStaffRequest;
import org.gp14.skopia.user.dto.UpdateStaffProfileRequest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.http.MediaType;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class StaffAssignmentIntegrationTest {
    @Autowired UserManagementService management;
    @Autowired UserRepository users;
    @Autowired StaffAssignmentRepository assignments;
    @Autowired StaffRepository legacyStaff;
    @Autowired MarketingOfficerRepository marketingOfficers;
    @Autowired MockMvc mvc;


    @Test
    void createsDedicatedSupportEntityWithCanonicalAssignment() {
        User actor = user("creation_actor", "creation-actor@example.test");
        CreateStaffRequest request = new CreateStaffRequest();
        request.setUsername("new_support_account"); request.setEmail("new-support@example.test");
        request.setPassword("temporary password"); request.setFirstName("New"); request.setLastName("Support");
        request.setDesignation("Support specialist"); request.setHireDate(LocalDate.of(2026, 10, 8));
        request.setStaffType("SUPPORT_OFFICER"); request.setSupportLevel("TIER_2"); request.setShift("EVENING");

        var response = management.createStaffMember(actor, request, "127.0.0.1");
        User created = users.findById(response.getId()).orElseThrow();
        assertInstanceOf(SupportOfficer.class, created);
        assertTrue(legacyStaff.existsById(created.getId()));
        assertEquals(StaffType.SUPPORT_OFFICER, assignments.findById(created.getId()).orElseThrow().getStaffType());
        assertEquals("Support Officer", assignments.findById(created.getId()).orElseThrow().getDesignation());
        assertEquals("SUPPORT_OFFICER", response.getStaffType());
    }

    @Test
    void createsMarketingOfficerRowsAndAllowsMarketingPanelLogin() throws Exception {
        User actor = user("marketing_creation_actor", "marketing-creation-actor@example.test");
        CreateStaffRequest request = new CreateStaffRequest();
        request.setUsername("new_marketing_account"); request.setEmail("new-marketing@example.test");
        request.setPassword("temporary password"); request.setFirstName("New"); request.setLastName("Marketing");
        request.setDesignation("Ignored title"); request.setOfficerCode("IGNORED-001");
        request.setHireDate(LocalDate.of(2026, 10, 8)); request.setStaffType("MARKETING_OFFICER");
        request.setDepartment("PARTNERSHIPS");

        var response = management.createStaffMember(actor, request, "127.0.0.1");
        MarketingOfficer marketing = marketingOfficers.findById(response.getId()).orElseThrow();
        StaffAssignment assignment = assignments.findById(response.getId()).orElseThrow();
        assertEquals("Marketing Officer", marketing.getDesignation());
        assertEquals(assignment.getOfficerCode(), marketing.getOfficerCode());
        assertEquals("PARTNERSHIPS", marketing.getDepartment());

        UpdateStaffProfileRequest update = new UpdateStaffProfileRequest();
        update.setStaffType(StaffType.MARKETING_OFFICER);
        update.setHireDate(LocalDate.of(2026, 10, 9));
        update.setDepartment("ADVERTISING");
        management.updateStaffProfile(actor, response.getId(), update, "127.0.0.1");
        MarketingOfficer updated = marketingOfficers.findById(response.getId()).orElseThrow();
        assertEquals("ADVERTISING", updated.getDepartment());
        assertEquals(LocalDate.of(2026, 10, 9), updated.getHireDate());
        assertEquals(marketing.getOfficerCode(), updated.getOfficerCode());

        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"identifier\":\"new_marketing_account\",\"password\":\"temporary password\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roleType").value("MARKETING_OFFICER"))
                .andExpect(jsonPath("$.staffType").value("MARKETING_OFFICER"))
                .andExpect(jsonPath("$.token").isNotEmpty());
    }

    @Test
    void createsDedicatedMarketingAccountsWithSequentialOfficerCodes() {
        User actor = user("marketing_actor", "marketing-actor@example.test");
        var first = management.createStaffMember(actor,
                marketingRequest("marketing_one", "marketing-one@example.test"), "127.0.0.1");
        var second = management.createStaffMember(actor,
                marketingRequest("marketing_two", "marketing-two@example.test"), "127.0.0.1");

        StaffAssignment firstAssignment = assignments.findById(first.getId()).orElseThrow();
        StaffAssignment secondAssignment = assignments.findById(second.getId()).orElseThrow();
        assertEquals("Marketing Officer", firstAssignment.getDesignation());
        assertEquals("Marketing Officer", secondAssignment.getDesignation());
        assertTrue(firstAssignment.getOfficerCode().matches("MKT-\\d{3,}"));
        assertTrue(secondAssignment.getOfficerCode().matches("MKT-\\d{3,}"));
        assertNotEquals(firstAssignment.getOfficerCode(), secondAssignment.getOfficerCode());
        long firstNumber = Long.parseLong(firstAssignment.getOfficerCode().substring(4));
        long secondNumber = Long.parseLong(secondAssignment.getOfficerCode().substring(4));
        assertEquals(firstNumber + 1, secondNumber);
    }

    @Test
    void rejectsCrossTypeFields() {
        User actor = user("validation_actor", "validation-actor@example.test");
        CreateStaffRequest request = new CreateStaffRequest();
        request.setUsername("invalid_admin"); request.setEmail("invalid-admin@example.test");
        request.setPassword("temporary password"); request.setStaffType("ADMINISTRATOR");
        request.setHireDate(LocalDate.of(2026, 10, 8)); request.setAdminLevel("SUPER");
        request.setSupportLevel("TIER_1");
        assertThrows(ResponseStatusException.class,
                () -> management.createStaffMember(actor, request, "127.0.0.1"));
        User rejected = users.findByUsername("invalid_admin").orElseThrow();
        assertFalse(assignments.existsById(rejected.getId()));
    }

    private CreateStaffRequest marketingRequest(String username, String email) {
        CreateStaffRequest request = new CreateStaffRequest();
        request.setUsername(username); request.setEmail(email); request.setPassword("temporary password");
        request.setStaffType("MARKETING_OFFICER"); request.setHireDate(LocalDate.of(2026, 10, 8));
        request.setDepartment("MARKETING");
        return request;
    }

    private User user(String username, String email) {
        User user = new User(); user.setUsername(username); user.setEmail(email);
        user.setPasswordHash("encoded"); user.setAccountStatus("ACTIVE");
        return users.saveAndFlush(user);
    }
}
