package org.gp14.skopia.user;

import org.gp14.skopia.model.user.*;
import org.gp14.skopia.repository.*;
import org.gp14.skopia.user.dto.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.ArgumentCaptor;
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
    private StaffAssignmentRepository staffAssignmentRepository;
    @Mock
    private StaffRoleService staffRoles;
    @Mock
    private StaffOfficerCodeService officerCodes;
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
    @Mock
    private org.gp14.skopia.billing.BillingService billing;

    @InjectMocks
    private UserManagementService userManagementService;

    private User sampleUser;
    private Administrator actor;

    @BeforeEach
    void setUp() {
        sampleUser = new User();
        sampleUser.setId(1L);
        sampleUser.setUsername("testuser");
        sampleUser.setEmail("test@skopia.com");
        sampleUser.setAccountStatus("ACTIVE");
        actor = new Administrator();
        actor.setId(99L);
        actor.setUsername("admin_actor");
        lenient().when(staffRoles.apply(any(UserResponse.class), anyLong())).thenAnswer(i -> i.getArgument(0));
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

        UserResponse response = userManagementService.updateAccountStatus(actor, 1L, request, "127.0.0.1");

        assertNotNull(response);
        assertEquals("SUSPENDED", response.getAccountStatus());
        ArgumentCaptor<ActivityLog> logCaptor = ArgumentCaptor.forClass(ActivityLog.class);
        verify(activityLogRepository).save(logCaptor.capture());
        ActivityLog log = logCaptor.getValue();
        assertSame(actor, log.getActor());
        assertSame(sampleUser, log.getTargetUser());
        assertSame(actor, log.getUser());
        assertEquals("ACCOUNT_STATUS_CHANGED", log.getActionType());
        assertEquals("from ACTIVE to SUSPENDED; reason: Policy violation", log.getDetail());
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
        request.setAdminLevel("SUPER");

        when(userRepository.existsByUsername("admin1")).thenReturn(false);
        when(userRepository.existsByEmail("admin1@skopia.com")).thenReturn(false);

        when(userRepository.saveAndFlush(any(User.class))).thenAnswer(i -> { User u=i.getArgument(0); u.setId(2L); return u; });
        when(staffAssignmentRepository.saveAndFlush(any(StaffAssignment.class))).thenAnswer(i -> i.getArgument(0));
        when(staffRoles.apply(any(UserResponse.class), eq(2L))).thenAnswer(i -> {
            UserResponse dto=i.getArgument(0); dto.setStaffType("ADMINISTRATOR"); dto.setAdminLevel("SUPER"); return dto;
        });

        UserResponse response = userManagementService.createStaffMember(actor, request, "127.0.0.1");

        assertNotNull(response);
        assertEquals("ADMINISTRATOR", response.getRoleType());
        assertEquals("ADMINISTRATOR", response.getStaffType());
        assertEquals("admin1", response.getUsername());
        assertEquals("SUPER", response.getAdminLevel());
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

        UserResponse response = userManagementService.updateCreatorVerification(actor, 5L, request, "127.0.0.1");

        assertNotNull(response);
        assertTrue(response.getIsVerified());
    }

    @Test
    void testGetPlatformUserStats() {
        when(userRepository.count()).thenReturn(10L);
        when(userRepository.countByAccountStatus("ACTIVE")).thenReturn(8L);
        when(userRepository.countByAccountStatus("SUSPENDED")).thenReturn(1L);
        when(userRepository.countByAccountStatus("BLOCKED")).thenReturn(1L);
        when(staffAssignmentRepository.count()).thenReturn(3L);
        when(staffAssignmentRepository.countByStaffType(StaffType.ADMINISTRATOR)).thenReturn(1L);
        when(staffAssignmentRepository.countByStaffType(StaffType.SUPPORT_OFFICER)).thenReturn(1L);
        when(staffAssignmentRepository.countByStaffType(StaffType.MARKETING_OFFICER)).thenReturn(1L);
        when(staffRepository.findAll()).thenReturn(List.of());
        when(administratorRepository.findAll()).thenReturn(List.of());
        when(supportOfficerRepository.findAll()).thenReturn(List.of());
        when(marketingOfficerRepository.findAll()).thenReturn(List.of());
        when(contentCreatorRepository.count()).thenReturn(2L);
        when(contentCreatorRepository.findByIsVerified(true)).thenReturn(Collections.emptyList());
        when(registeredViewerRepository.count()).thenReturn(5L);
        RegisteredViewer premiumOne = new RegisteredViewer(); premiumOne.setId(7L);
        RegisteredViewer premiumTwo = new RegisteredViewer(); premiumTwo.setId(8L);
        when(registeredViewerRepository.findAll()).thenReturn(List.of(premiumOne, premiumTwo));
        when(billing.hasActivePremium(7L)).thenReturn(true);
        when(billing.hasActivePremium(8L)).thenReturn(true);

        PlatformUserStatsResponse stats = userManagementService.getPlatformUserStats();

        assertNotNull(stats);
        assertEquals(10L, stats.getTotalUsers());
        assertEquals(8L, stats.getActiveUsers());
        assertEquals(3L, stats.getTotalStaff());
        assertEquals(2L, stats.getPremiumViewers());
    }

    @Test
    void activityLogResponseSeparatesActorAndTargetAndSupportsLegacyRows() {
        ActivityLog current = new ActivityLog();
        current.setUser(actor);
        current.setActor(actor);
        current.setTargetUser(sampleUser);
        current.setActionType("ACCOUNT_STATUS_CHANGED");
        current.setDetail("reason: review");

        ActivityLogResponse response = ActivityLogResponse.fromEntity(current);
        assertEquals(99L, response.getActorUserId());
        assertEquals("admin_actor", response.getActorUsername());
        assertEquals(1L, response.getTargetUserId());
        assertEquals("testuser", response.getTargetUsername());
        assertEquals("reason: review", response.getDetail());

        ActivityLog legacy = new ActivityLog();
        legacy.setUser(sampleUser);
        legacy.setActionType("LOGIN_SUCCESS");
        ActivityLogResponse legacyResponse = ActivityLogResponse.fromEntity(legacy);
        assertEquals(1L, legacyResponse.getActorUserId());
        assertEquals(1L, legacyResponse.getTargetUserId());
    }
}
