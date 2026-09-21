package org.gp14.skopia.user;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.gp14.skopia.user.dto.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDate;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class AdminUserControllerTest {

    private MockMvc mockMvc;

    @Mock
    private UserManagementService userManagementService;

    @InjectMocks
    private AdminUserController adminUserController;

    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(adminUserController).build();
        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
    }


    @Test
    void getUsers_ReturnsUserList() throws Exception {
        UserResponse response = UserResponse.builder()
                .id(1L)
                .username("admin_test")
                .email("admin@skopia.com")
                .accountStatus("ACTIVE")
                .roleType("ADMINISTRATOR")
                .build();

        when(userManagementService.getUsers(any(), any(), any())).thenReturn(List.of(response));

        mockMvc.perform(get("/api/admin/users"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].username").value("admin_test"))
                .andExpect(jsonPath("$[0].roleType").value("ADMINISTRATOR"));
    }

    @Test
    void updateAccountStatus_ReturnsUpdatedUser() throws Exception {
        UpdateAccountStatusRequest request = new UpdateAccountStatusRequest();
        request.setStatus("SUSPENDED");
        request.setReason("Inappropriate conduct");

        UserResponse response = UserResponse.builder()
                .id(1L)
                .username("bad_user")
                .accountStatus("SUSPENDED")
                .build();

        when(userManagementService.updateAccountStatus(eq(1L), any(UpdateAccountStatusRequest.class), anyString()))
                .thenReturn(response);

        mockMvc.perform(patch("/api/admin/users/1/status")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accountStatus").value("SUSPENDED"));
    }

    @Test
    void createStaffMember_ReturnsCreatedStaff() throws Exception {
        CreateStaffRequest request = new CreateStaffRequest();
        request.setUsername("support1");
        request.setEmail("support1@skopia.com");
        request.setPassword("pass12345");
        request.setDesignation("Support Spec");
        request.setHireDate(LocalDate.now());
        request.setStaffType("SUPPORT_OFFICER");
        request.setSupportLevel("LEVEL_2");
        request.setShift("NIGHT");

        UserResponse response = UserResponse.builder()
                .id(10L)
                .username("support1")
                .roleType("SUPPORT_OFFICER")
                .supportLevel("LEVEL_2")
                .build();

        when(userManagementService.createStaffMember(any(CreateStaffRequest.class), anyString()))
                .thenReturn(response);

        mockMvc.perform(post("/api/admin/users/staff")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.username").value("support1"))
                .andExpect(jsonPath("$.roleType").value("SUPPORT_OFFICER"));
    }

    @Test
    void getPlatformUserStats_ReturnsStats() throws Exception {
        PlatformUserStatsResponse stats = PlatformUserStatsResponse.builder()
                .totalUsers(15)
                .activeUsers(12)
                .suspendedUsers(2)
                .blockedUsers(1)
                .totalStaff(4)
                .build();

        when(userManagementService.getPlatformUserStats()).thenReturn(stats);

        mockMvc.perform(get("/api/admin/users/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalUsers").value(15))
                .andExpect(jsonPath("$.activeUsers").value(12));
    }
}
