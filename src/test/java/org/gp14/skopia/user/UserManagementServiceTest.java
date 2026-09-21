package org.gp14.skopia.user;

import org.gp14.skopia.model.user.*;
import org.gp14.skopia.repository.*;
import org.gp14.skopia.user.dto.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserManagementServiceTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private StaffRepository staffRepository;
    @Mock
    private AdministratorRepository administratorRepository;
    @Mock
    private SupportOfficerRepository supportOfficerRepository;
    @Mock
    private MarketingOfficerRepository marketingOfficerRepository;
    @Mock
    private ContentCreatorRepository contentCreatorRepository;
    @Mock
    private RegisteredViewerRepository registeredViewerRepository;
    @Mock
    private ActivityLogRepository activityLogRepository;
    @Mock
    private org.gp14.skopia.security.PasswordService passwordService;

    @InjectMocks
    private UserManagementService userManagementService;

    private User sampleUser;

    @BeforeEach
    void setUp() {
        sampleUser = new User();
        sampleUser.setId(1L);
        sampleUser.setUsername("testuser");
        sampleUser.setEmail("test@skopia.com");
        sampleUser.setAccountStatus("ACTIVE");
    }

    @Test
    void testGetUsers_ReturnsList() {
        when(userRepository.searchUsers(null, null)).thenReturn(List.of(sampleUser));

        List<UserResponse> responses = userManagementService.getUsers(null, null, null);

        assertNotNull(responses);
        assertEquals(1, responses.size());
        assertEquals("testuser", responses.get(0).getUsername());
    }

    @Test
    void testGetUserById_Success() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(sampleUser));

        UserResponse response = userManagementService.getUserById(1L);

        assertNotNull(response);
        assertEquals("testuser", response.getUsername());
    }

    @Test
    void testGetUserById_NotFound() {
        when(userRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(ResponseStatusException.class, () -> userManagementService.getUserById(99L));
    }

    @Test
    void testUpdateAccountStatus_Success() {
        UpdateAccountStatusRequest request = new UpdateAccountStatusRequest();
        request.setStatus("SUSPENDED");
        request.setReason("Policy violation");

        when(userRepository.findById(1L)).thenReturn(Optional.of(sampleUser));
        when(userRepository.save(any(User.class))).thenAnswer(i -> i.getArgument(0));

        UserResponse response = userManagementService.updateAccountStatus(1L, request, "127.0.0.1");

        assertNotNull(response);
        assertEquals("SUSPENDED", response.getAccountStatus());
        verify(activityLogRepository, times(1)).save(any(ActivityLog.class));
    }

    @Test
    void testCreateStaffMember_Administrator_Success() {
        CreateStaffRequest request = new CreateStaffRequest();
        request.setUsername("admin1");
        request.setEmail("admin1@skopia.com");
        request.setPassword("securepass");
        request.setFirstName("Admin");
        request.setLastName("User");
        request.setDesignation("Lead Administrator");
        request.setHireDate(LocalDate.now());
        request.setStaffType("ADMINISTRATOR");
        request.setAdminLevel("SUPER_ADMIN");

        when(userRepository.existsByUsername("admin1")).thenReturn(false);
        when(userRepository.existsByEmail("admin1@skopia.com")).thenReturn(false);

        Administrator savedAdmin = new Administrator();
        savedAdmin.setId(2L);
        savedAdmin.setUsername(request.getUsername());
        savedAdmin.setEmail(request.getEmail());
        savedAdmin.setAccountStatus("ACTIVE");
        savedAdmin.setDesignation(request.getDesignation());
        savedAdmin.setHireDate(request.getHireDate());
        savedAdmin.setAdminLevel(request.getAdminLevel());

        when(administratorRepository.save(any(Administrator.class))).thenReturn(savedAdmin);

        UserResponse response = userManagementService.createStaffMember(request, "127.0.0.1");

        assertNotNull(response);
        assertEquals("ADMINISTRATOR", response.getRoleType());
        assertEquals("admin1", response.getUsername());
        assertEquals("SUPER_ADMIN", response.getAdminLevel());
    }

    @Test
    void testUpdateCreatorVerification_Success() {
        ContentCreator creator = new ContentCreator();
        creator.setId(5L);
        creator.setUsername("creator1");
        creator.setIsVerified(false);

        UpdateCreatorStatusRequest request = new UpdateCreatorStatusRequest();
        request.setIsVerified(true);

        when(contentCreatorRepository.findById(5L)).thenReturn(Optional.of(creator));
        when(contentCreatorRepository.save(any(ContentCreator.class))).thenAnswer(i -> i.getArgument(0));

        UserResponse response = userManagementService.updateCreatorVerification(5L, request, "127.0.0.1");

        assertNotNull(response);
        assertTrue(response.getIsVerified());
    }

    @Test
    void testGetPlatformUserStats() {
        when(userRepository.count()).thenReturn(10L);
        when(userRepository.countByAccountStatus("ACTIVE")).thenReturn(8L);
        when(userRepository.countByAccountStatus("SUSPENDED")).thenReturn(1L);
        when(userRepository.countByAccountStatus("BLOCKED")).thenReturn(1L);
        when(staffRepository.count()).thenReturn(3L);
        when(administratorRepository.count()).thenReturn(1L);
        when(supportOfficerRepository.count()).thenReturn(1L);
        when(marketingOfficerRepository.count()).thenReturn(1L);
        when(contentCreatorRepository.count()).thenReturn(2L);
        when(contentCreatorRepository.findByIsVerified(true)).thenReturn(Collections.emptyList());
        when(registeredViewerRepository.count()).thenReturn(5L);
        when(registeredViewerRepository.countByIsPremium(true)).thenReturn(2L);

        PlatformUserStatsResponse stats = userManagementService.getPlatformUserStats();

        assertNotNull(stats);
        assertEquals(10L, stats.getTotalUsers());
        assertEquals(8L, stats.getActiveUsers());
        assertEquals(3L, stats.getTotalStaff());
        assertEquals(2L, stats.getPremiumViewers());
    }
}
