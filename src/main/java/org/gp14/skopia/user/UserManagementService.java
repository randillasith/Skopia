package org.gp14.skopia.user;

import org.gp14.skopia.model.user.*;
import org.gp14.skopia.repository.*;
import org.gp14.skopia.user.dto.*;
import org.gp14.skopia.security.PasswordService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional
public class UserManagementService {

    private final UserRepository userRepository;
    private final StaffRepository staffRepository;
    private final StaffAssignmentRepository staffAssignmentRepository;
    private final StaffRoleService staffRoles;
    private final StaffOfficerCodeService officerCodes;
    private final AdministratorRepository administratorRepository;
    private final SupportOfficerRepository supportOfficerRepository;
    private final MarketingOfficerRepository marketingOfficerRepository;
    private final ContentCreatorRepository contentCreatorRepository;
    private final RegisteredViewerRepository registeredViewerRepository;
    private final ActivityLogRepository activityLogRepository;
    private final PasswordService passwordService;
    private final org.gp14.skopia.billing.BillingService billing;

    public UserManagementService(UserRepository userRepository,
                                 StaffRepository staffRepository,
                                 StaffAssignmentRepository staffAssignmentRepository,
                                 StaffRoleService staffRoles,
                                 StaffOfficerCodeService officerCodes,
                                 AdministratorRepository administratorRepository,
                                 SupportOfficerRepository supportOfficerRepository,
                                 MarketingOfficerRepository marketingOfficerRepository,
                                 ContentCreatorRepository contentCreatorRepository,
                                 RegisteredViewerRepository registeredViewerRepository,
                                 ActivityLogRepository activityLogRepository,
                                 PasswordService passwordService,
                                 org.gp14.skopia.billing.BillingService billing) {
        this.userRepository = userRepository;
        this.staffRepository = staffRepository;
        this.staffAssignmentRepository = staffAssignmentRepository;
        this.staffRoles = staffRoles;
        this.officerCodes = officerCodes;
        this.administratorRepository = administratorRepository;
        this.supportOfficerRepository = supportOfficerRepository;
        this.marketingOfficerRepository = marketingOfficerRepository;
        this.contentCreatorRepository = contentCreatorRepository;
        this.registeredViewerRepository = registeredViewerRepository;
        this.activityLogRepository = activityLogRepository;
        this.passwordService = passwordService;
        this.billing = billing;
    }

    private UserResponse response(User user) {
        return staffRoles.apply(UserResponse.fromEntity(user, user instanceof RegisteredViewer && billing.hasActivePremium(user.getId())), user.getId());
    }

    @Transactional(readOnly = true)
    public List<UserResponse> getUsers(String query, String status, String role) {
        List<User> users = userRepository.searchUsers(
                (query != null && !query.trim().isEmpty()) ? query.trim() : null,
                (status != null && !status.trim().isEmpty()) ? status.trim() : null
        );

        return users.stream()
                .map(this::response)
                .filter(u -> role == null || role.trim().isEmpty() || u.getRoleType().equalsIgnoreCase(role.trim()))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public UserResponse getUserById(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found with ID: " + userId));
        return response(user);
    }

    public UserResponse updateAccountStatus(User actor, Long targetUserId, UpdateAccountStatusRequest request, String ipAddress) {
        User user = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found with ID: " + targetUserId));

        String oldStatus = user.getAccountStatus();
        user.setAccountStatus(request.getStatus().toUpperCase());
        User savedUser = userRepository.save(user);

        String detail = String.format("from %s to %s", oldStatus, request.getStatus().toUpperCase());
        if (request.getReason() != null && !request.getReason().trim().isEmpty()) {
            detail += "; reason: " + request.getReason().trim();
        }
        logActivity(actor, savedUser, "ACCOUNT_STATUS_CHANGED", detail, ipAddress);

        return response(savedUser);
    }

    public UserResponse createStaffMember(User actor, CreateStaffRequest request, String ipAddress) {
        validatePassword(request.getPassword());
        if (userRepository.existsByUsername(request.getUsername()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Username already exists: " + request.getUsername());
        if (userRepository.existsByEmail(request.getEmail()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already exists: " + request.getEmail());

        User user = new User();
        user.setUsername(request.getUsername().trim());
        user.setEmail(request.getEmail().trim().toLowerCase());
        user.setPasswordHash(passwordService.encode(request.getPassword()));
        user.setFirstName(trim(request.getFirstName()));
        user.setLastName(trim(request.getLastName()));
        user.setAccountStatus("ACTIVE");
        user = userRepository.saveAndFlush(user);

        AssignStaffRequest assignment = new AssignStaffRequest();
        try { assignment.setStaffType(StaffType.valueOf(request.getStaffType().trim().toUpperCase())); }
        catch (Exception e) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid staff type"); }
        assignment.setHireDate(request.getHireDate());
        assignment.setAdminLevel(parse(AdminLevel.class, request.getAdminLevel(), "admin level"));
        assignment.setSupportLevel(parse(SupportLevel.class, request.getSupportLevel(), "support level"));
        assignment.setShift(parse(SupportShift.class, request.getShift(), "support shift"));
        assignment.setDepartment(parse(MarketingDepartment.class, request.getDepartment(), "marketing department"));
        saveAssignment(user, assignment);
        logActivity(actor, user, "STAFF_CREATED", "staff type: " + assignment.getStaffType(), ipAddress);
        return response(user);
    }

    public UserResponse assignStaff(User actor, Long userId, AssignStaffRequest request, String ipAddress) {
        User user = userRepository.findByIdForStaffAssignment(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found with ID: " + userId));
        if (staffRoles.staffType(userId).isPresent())
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Account already has staff access");
        saveAssignment(user, request);
        user.setAuthVersion((user.getAuthVersion() == null ? 0L : user.getAuthVersion()) + 1L);
        userRepository.save(user);
        logActivity(actor, user, "STAFF_ACCESS_ASSIGNED", "staff type: " + request.getStaffType(), ipAddress);
        return response(user);
    }

    public UserResponse updateStaffProfile(User actor, Long userId, UpdateStaffProfileRequest request, String ipAddress) {
        User user = userRepository.findByIdForStaffAssignment(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found with ID: " + userId));
        StaffAssignment current = staffAssignmentRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Staff assignment not found with ID: " + userId));
        AssignStaffRequest next = new AssignStaffRequest();
        next.setStaffType(request.getStaffType() == null ? current.getStaffType() : request.getStaffType());
        next.setHireDate(request.getHireDate() == null ? current.getHireDate() : request.getHireDate());
        next.setAdminLevel(parse(AdminLevel.class, request.getAdminLevel(), "admin level"));
        next.setSupportLevel(parse(SupportLevel.class, request.getSupportLevel(), "support level"));
        next.setShift(parse(SupportShift.class, request.getShift(), "support shift"));
        next.setDepartment(parse(MarketingDepartment.class, request.getDepartment(), "marketing department"));
        if (request.getFirstName() != null) user.setFirstName(trim(request.getFirstName()));
        if (request.getLastName() != null) user.setLastName(trim(request.getLastName()));
        applyAssignment(current, next);
        staffAssignmentRepository.save(current);
        user.setAuthVersion((user.getAuthVersion() == null ? 0L : user.getAuthVersion()) + 1L);
        userRepository.save(user);
        logActivity(actor, user, "STAFF_PROFILE_UPDATED", "staff type: " + current.getStaffType(), ipAddress);
        return response(user);
    }

    private void saveAssignment(User user, AssignStaffRequest request) {
        StaffAssignment assignment = new StaffAssignment();
        assignment.setUser(user);
        applyAssignment(assignment, request);
        staffAssignmentRepository.saveAndFlush(assignment);
    }

    private void applyAssignment(StaffAssignment target, AssignStaffRequest request) {
        if (request.getStaffType() == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Staff type is required");
        if (request.getHireDate() == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Hire date is required");
        String existingOfficerCode = target.getOfficerCode();
        target.setStaffType(request.getStaffType()); target.setDesignation(defaultDesignation(request.getStaffType())); target.setHireDate(request.getHireDate());
        target.setAdminLevel(null); target.setSupportLevel(null); target.setShift(null); target.setOfficerCode(null); target.setDepartment(null);
        switch (request.getStaffType()) {
            case ADMINISTRATOR -> {
                if (request.getAdminLevel() == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Admin level is required");
                reject(request.getSupportLevel()!=null || request.getShift()!=null || notBlank(request.getOfficerCode()) || request.getDepartment()!=null);
                target.setAdminLevel(request.getAdminLevel());
            }
            case SUPPORT_OFFICER -> {
                if (request.getSupportLevel() == null || request.getShift() == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Support level and shift are required");
                reject(request.getAdminLevel()!=null || notBlank(request.getOfficerCode()) || request.getDepartment()!=null);
                target.setSupportLevel(request.getSupportLevel()); target.setShift(request.getShift());
            }
            case MARKETING_OFFICER -> {
                if (request.getDepartment() == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Marketing department is required");
                reject(request.getAdminLevel()!=null || request.getSupportLevel()!=null || request.getShift()!=null);
                String code=notBlank(existingOfficerCode) ? existingOfficerCode : officerCodes.nextMarketingCode();
                target.setOfficerCode(code); target.setDepartment(request.getDepartment());
            }
        }
    }
    private void reject(boolean invalid) { if (invalid) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fields do not match selected staff type"); }
    private String defaultDesignation(StaffType type) {
        return switch (type) {
            case ADMINISTRATOR -> "Administrator";
            case SUPPORT_OFFICER -> "Support Officer";
            case MARKETING_OFFICER -> "Marketing Officer";
        };
    }
    private boolean notBlank(String value) { return value != null && !value.isBlank(); }
    private String trim(String value) { return value == null ? null : value.trim(); }
    private void validatePassword(String value) {
        if (value == null || value.length() < 8) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must be at least 8 characters");
        if (value.getBytes(StandardCharsets.UTF_8).length > 72) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must not exceed 72 UTF-8 bytes");
    }
    private <T extends Enum<T>> T parse(Class<T> type, String value, String label) {
        if (value == null || value.isBlank()) return null;
        try { return Enum.valueOf(type, value.trim().toUpperCase()); }
        catch (IllegalArgumentException e) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid " + label); }
    }

    public UserResponse updateCreatorVerification(User actor, Long creatorId, UpdateCreatorStatusRequest request, String ipAddress) {
        ContentCreator creator = contentCreatorRepository.findById(creatorId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Content Creator not found with ID: " + creatorId));

        creator.setIsVerified(request.getIsVerified());
        ContentCreator saved = contentCreatorRepository.save(creator);
        logActivity(actor, saved, "CREATOR_VERIFICATION_CHANGED", "verified: " + request.getIsVerified(), ipAddress);
        return response(saved);
    }

    public UserResponse updateViewerPremiumStatus(User actor, Long viewerId, UpdatePremiumStatusRequest request, String ipAddress) {
        RegisteredViewer viewer = registeredViewerRepository.findById(viewerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Registered Viewer not found with ID: " + viewerId));

        viewer.setIsPremium(request.getIsPremium());
        RegisteredViewer saved = registeredViewerRepository.save(viewer);
        logActivity(actor, saved, "VIEWER_PREMIUM_STATUS_CHANGED", "premium: " + request.getIsPremium(), ipAddress);
        return response(saved);
    }

    @Transactional(readOnly = true)
    public List<ActivityLogResponse> getActivityLogs(Long userId, String actionType) {
        List<ActivityLog> logs;
        if (userId != null) {
            logs = activityLogRepository.findByTargetUserIdOrActorIdOrUserIdOrderByActionTimeDesc(userId, userId, userId);
        } else if (actionType != null && !actionType.trim().isEmpty()) {
            logs = activityLogRepository.findByActionTypeContainingIgnoreCaseOrderByActionTimeDesc(actionType.trim());
        } else {
            logs = activityLogRepository.findAllByOrderByActionTimeDesc();
        }

        return logs.stream().map(ActivityLogResponse::fromEntity).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public PlatformUserStatsResponse getPlatformUserStats() {
        long totalUsers = userRepository.count();
        long activeUsers = userRepository.countByAccountStatus("ACTIVE");
        long suspendedUsers = userRepository.countByAccountStatus("SUSPENDED");
        long blockedUsers = userRepository.countByAccountStatus("BLOCKED");

        long assigned = staffAssignmentRepository.count();
        long legacyOnly = staffRepository.findAll().stream().filter(s -> !staffAssignmentRepository.existsById(s.getId())).count();
        long totalStaff = assigned + legacyOnly;
        long adminCount = staffAssignmentRepository.countByStaffType(StaffType.ADMINISTRATOR)
                + administratorRepository.findAll().stream().filter(a -> !staffAssignmentRepository.existsById(a.getId())).count();
        long supportCount = staffAssignmentRepository.countByStaffType(StaffType.SUPPORT_OFFICER)
                + supportOfficerRepository.findAll().stream().filter(a -> !staffAssignmentRepository.existsById(a.getId())).count();
        long marketingCount = staffAssignmentRepository.countByStaffType(StaffType.MARKETING_OFFICER)
                + marketingOfficerRepository.findAll().stream().filter(a -> !staffAssignmentRepository.existsById(a.getId())).count();

        long totalCreators = contentCreatorRepository.count();
        long verifiedCreators = contentCreatorRepository.findByIsVerified(true).size();

        long registeredViewersCount = registeredViewerRepository.count();
        long premiumViewers = registeredViewerRepository.findAll().stream()
                .filter(v -> billing.hasActivePremium(v.getId())).count();

        return PlatformUserStatsResponse.builder()
                .totalUsers(totalUsers)
                .activeUsers(activeUsers)
                .suspendedUsers(suspendedUsers)
                .blockedUsers(blockedUsers)
                .totalViewers(registeredViewersCount)
                .premiumViewers(premiumViewers)
                .totalCreators(totalCreators)
                .verifiedCreators(verifiedCreators)
                .totalStaff(totalStaff)
                .administratorsCount(adminCount)
                .supportOfficersCount(supportCount)
                .marketingOfficersCount(marketingCount)
                .build();
    }

    public void logActivity(User user, String actionType, String ipAddress) {
        logActivity(user, user, actionType, null, ipAddress);
    }

    public void logActivity(User actor, User targetUser, String actionType, String detail, String ipAddress) {
        User legacyUser = actor != null ? actor : targetUser;
        if (legacyUser == null) {
            throw new IllegalArgumentException("An activity log requires an actor or target user");
        }
        ActivityLog log = new ActivityLog();
        log.setUser(legacyUser);
        log.setActor(actor);
        log.setTargetUser(targetUser);
        log.setDetail(detail);
        log.setActionType(actionType);
        log.setActionTime(LocalDateTime.now());
        log.setIpAddress(ipAddress != null ? ipAddress : "127.0.0.1");
        activityLogRepository.save(log);
    }

}
