package org.gp14.skopia.user;

import org.gp14.skopia.model.user.*;
import org.gp14.skopia.repository.*;
import org.gp14.skopia.user.dto.AssignStaffRequest;
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
    @Autowired ContentCreatorRepository creators;
    @Autowired StaffAssignmentRepository assignments;
    @Autowired StaffRepository legacyStaff;
    @Autowired StaffRoleService roles;
    @Autowired MarketingOfficerRepository marketingOfficers;
    @Autowired MockMvc mvc;

    @Test
    void assigningCreatorAsAdministratorPreservesCreatorAndAddsBothAuthorities() {
        User actor = user("assignment_actor", "assignment-actor@example.test");
        ContentCreator creator = new ContentCreator();
        creator.setUsername("assignment_creator"); creator.setEmail("assignment-creator@example.test");
        creator.setPasswordHash("encoded"); creator.setAccountStatus("ACTIVE");
        creator.setChannelName("Preserved channel"); creator.setChannelBio("Preserved bio");
        creator.setPreferredLanguage("en"); creator.setIsVerified(true); creator.setTotalUploads(4);
        creator = creators.saveAndFlush(creator);
        Long id = creator.getId();

        AssignStaffRequest request = adminRequest();
        var response = management.assignStaff(actor, id, request, "127.0.0.1");

        User reloaded = users.findById(id).orElseThrow();
        assertInstanceOf(ContentCreator.class, reloaded);
        assertEquals("Preserved channel", ((ContentCreator) reloaded).getChannelName());
        assertFalse(legacyStaff.existsById(id));
        assertEquals(StaffType.ADMINISTRATOR, assignments.findById(id).orElseThrow().getStaffType());
        assertEquals("CONTENT_CREATOR", response.getAccountType());
        assertEquals("ADMINISTRATOR", response.getStaffType());
        var authorities = roles.authoritiesFor(reloaded).stream().map(a -> a.getAuthority()).toList();
        assertTrue(authorities.contains("ROLE_ADMINISTRATOR"));
        assertTrue(authorities.contains("ROLE_CONTENT_CREATOR"));
        assertThrows(ResponseStatusException.class, () -> management.assignStaff(actor, id, request, "127.0.0.1"));
    }

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
    void generatesCanonicalMarketingDesignationAndSequentialOfficerCodes() {
        User actor = user("marketing_actor", "marketing-actor@example.test");
        User first = user("marketing_one", "marketing-one@example.test");
        User second = user("marketing_two", "marketing-two@example.test");

        AssignStaffRequest request = new AssignStaffRequest();
        request.setStaffType(StaffType.MARKETING_OFFICER);
        request.setDesignation("Ignored custom title");
        request.setOfficerCode("IGNORED-999");
        request.setHireDate(LocalDate.of(2026, 10, 8));
        request.setDepartment(MarketingDepartment.MARKETING);

        management.assignStaff(actor, first.getId(), request, "127.0.0.1");
        management.assignStaff(actor, second.getId(), request, "127.0.0.1");

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
        User target = user("validation_target", "validation-target@example.test");
        AssignStaffRequest request = adminRequest();
        request.setSupportLevel(SupportLevel.TIER_1);
        assertThrows(ResponseStatusException.class,
                () -> management.assignStaff(actor, target.getId(), request, "127.0.0.1"));
        assertFalse(assignments.existsById(target.getId()));
    }

    private AssignStaffRequest adminRequest() {
        AssignStaffRequest request = new AssignStaffRequest();
        request.setStaffType(StaffType.ADMINISTRATOR); request.setDesignation("Administrator");
        request.setHireDate(LocalDate.of(2026, 10, 8)); request.setAdminLevel(AdminLevel.SUPER);
        return request;
    }

    private User user(String username, String email) {
        User user = new User(); user.setUsername(username); user.setEmail(email);
        user.setPasswordHash("encoded"); user.setAccountStatus("ACTIVE");
        return users.saveAndFlush(user);
    }
}
