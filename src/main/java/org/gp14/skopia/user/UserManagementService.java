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
import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional
public class UserManagementService {

    private final UserRepository userRepository;
    private final StaffRepository staffRepository;
    private final AdministratorRepository administratorRepository;
    private final SupportOfficerRepository supportOfficerRepository;
    private final MarketingOfficerRepository marketingOfficerRepository;
    private final ContentCreatorRepository contentCreatorRepository;
    private final RegisteredViewerRepository registeredViewerRepository;
    private final ActivityLogRepository activityLogRepository;
    private final PasswordService passwordService;

    public UserManagementService(UserRepository userRepository,
                                 StaffRepository staffRepository,
                                 AdministratorRepository administratorRepository,
                                 SupportOfficerRepository supportOfficerRepository,
                                 MarketingOfficerRepository marketingOfficerRepository,
                                 ContentCreatorRepository contentCreatorRepository,
                                 RegisteredViewerRepository registeredViewerRepository,
                                 ActivityLogRepository activityLogRepository,
                                 PasswordService passwordService) {
        this.userRepository = userRepository;
        this.staffRepository = staffRepository;
        this.administratorRepository = administratorRepository;
        this.supportOfficerRepository = supportOfficerRepository;
        this.marketingOfficerRepository = marketingOfficerRepository;
        this.contentCreatorRepository = contentCreatorRepository;
        this.registeredViewerRepository = registeredViewerRepository;
        this.activityLogRepository = activityLogRepository;
        this.passwordService = passwordService;
    }

    @Transactional(readOnly = true)
    public List<UserResponse> getUsers(String query, String status, String role) {
        List<User> users = userRepository.searchUsers(
                (query != null && !query.trim().isEmpty()) ? query.trim() : null,
                (status != null && !status.trim().isEmpty()) ? status.trim() : null
        );

        return users.stream()
                .map(UserResponse::fromEntity)
                .filter(u -> role == null || role.trim().isEmpty() || u.getRoleType().equalsIgnoreCase(role.trim()))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public UserResponse getUserById(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found with ID: " + userId));
        return UserResponse.fromEntity(user);
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

        return UserResponse.fromEntity(savedUser);
    }

    public UserResponse createStaffMember(User actor, CreateStaffRequest request, String ipAddress) {
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Username already exists: " + request.getUsername());
        }
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email already exists: " + request.getEmail());
        }

        Staff createdStaff;
        String staffType = request.getStaffType().toUpperCase();

        switch (staffType) {
            case "ADMINISTRATOR":
                Administrator admin = new Administrator();
                populateBaseUserAndStaff(admin, request);
                admin.setAdminLevel(request.getAdminLevel() != null ? request.getAdminLevel() : "LEVEL_1");
                createdStaff = administratorRepository.save(admin);
                break;
            case "SUPPORT_OFFICER":
                SupportOfficer support = new SupportOfficer();
                populateBaseUserAndStaff(support, request);
                support.setSupportLevel(request.getSupportLevel() != null ? request.getSupportLevel() : "TIER_1");
                support.setShift(request.getShift() != null ? request.getShift() : "DAY");
                createdStaff = supportOfficerRepository.save(support);
                break;
            case "MARKETING_OFFICER":
                if (request.getOfficerCode() != null && marketingOfficerRepository.existsByOfficerCode(request.getOfficerCode())) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Officer code already exists: " + request.getOfficerCode());
                }
                MarketingOfficer marketing = new MarketingOfficer();
                populateBaseUserAndStaff(marketing, request);
                marketing.setOfficerCode(request.getOfficerCode() != null ? request.getOfficerCode() : "MKT-" + System.currentTimeMillis());
                marketing.setDepartment(request.getDepartment() != null ? request.getDepartment() : "MARKETING");
                createdStaff = marketingOfficerRepository.save(marketing);
                break;
            default:
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid staff type: " + staffType);
        }

        logActivity(actor, createdStaff, "STAFF_CREATED", "staff type: " + staffType, ipAddress);
        return UserResponse.fromEntity(createdStaff);
    }

    public UserResponse updateStaffProfile(User actor, Long staffId, UpdateStaffProfileRequest request, String ipAddress) {
        Staff staff = staffRepository.findById(staffId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Staff member not found with ID: " + staffId));

        if (request.getDesignation() != null) staff.setDesignation(request.getDesignation());
        if (request.getFirstName() != null) staff.setFirstName(request.getFirstName());
        if (request.getLastName() != null) staff.setLastName(request.getLastName());

        if (staff instanceof Administrator admin) {
            if (request.getAdminLevel() != null) admin.setAdminLevel(request.getAdminLevel());
        } else if (staff instanceof SupportOfficer support) {
            if (request.getSupportLevel() != null) support.setSupportLevel(request.getSupportLevel());
            if (request.getShift() != null) support.setShift(request.getShift());
        } else if (staff instanceof MarketingOfficer marketing) {
            if (request.getOfficerCode() != null) marketing.setOfficerCode(request.getOfficerCode());
            if (request.getDepartment() != null) marketing.setDepartment(request.getDepartment());
        }

        Staff updatedStaff = staffRepository.save(staff);
        logActivity(actor, updatedStaff, "STAFF_PROFILE_UPDATED", null, ipAddress);
        return UserResponse.fromEntity(updatedStaff);
    }

    public UserResponse updateCreatorVerification(User actor, Long creatorId, UpdateCreatorStatusRequest request, String ipAddress) {
        ContentCreator creator = contentCreatorRepository.findById(creatorId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Content Creator not found with ID: " + creatorId));

        creator.setIsVerified(request.getIsVerified());
        ContentCreator saved = contentCreatorRepository.save(creator);
        logActivity(actor, saved, "CREATOR_VERIFICATION_CHANGED", "verified: " + request.getIsVerified(), ipAddress);
        return UserResponse.fromEntity(saved);
    }

    public UserResponse updateViewerPremiumStatus(User actor, Long viewerId, UpdatePremiumStatusRequest request, String ipAddress) {
        RegisteredViewer viewer = registeredViewerRepository.findById(viewerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Registered Viewer not found with ID: " + viewerId));

        viewer.setIsPremium(request.getIsPremium());
        RegisteredViewer saved = registeredViewerRepository.save(viewer);
        logActivity(actor, saved, "VIEWER_PREMIUM_STATUS_CHANGED", "premium: " + request.getIsPremium(), ipAddress);
        return UserResponse.fromEntity(saved);
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

        long totalStaff = staffRepository.count();
        long adminCount = administratorRepository.count();
        long supportCount = supportOfficerRepository.count();
        long marketingCount = marketingOfficerRepository.count();

        long totalCreators = contentCreatorRepository.count();
        long verifiedCreators = contentCreatorRepository.findByIsVerified(true).size();

        long registeredViewersCount = registeredViewerRepository.count();
        long premiumViewers = registeredViewerRepository.countByIsPremium(true);

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

    private void populateBaseUserAndStaff(Staff staff, CreateStaffRequest request) {
        staff.setUsername(request.getUsername());
        staff.setEmail(request.getEmail());
        staff.setPasswordHash(passwordService.encode(request.getPassword()));
        staff.setFirstName(request.getFirstName());
        staff.setLastName(request.getLastName());
        staff.setAccountStatus("ACTIVE");
        staff.setDesignation(request.getDesignation());
        staff.setHireDate(request.getHireDate());
    }
}
