package org.gp14.skopia.user;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.gp14.skopia.user.dto.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/users")
public class AdminUserController {

    private final UserManagementService userManagementService;

    public AdminUserController(UserManagementService userManagementService) {
        this.userManagementService = userManagementService;
    }

    // 1. Search and list all users with optional filters (query, status, role)
    @GetMapping
    public ResponseEntity<List<UserResponse>> getUsers(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String role) {
        return ResponseEntity.ok(userManagementService.getUsers(query, status, role));
    }

    // 2. Get specific user profile details
    @GetMapping("/{id}")
    public ResponseEntity<UserResponse> getUserById(@PathVariable Long id) {
        return ResponseEntity.ok(userManagementService.getUserById(id));
    }

    // 3. Suspend, block, or activate a user account
    @PatchMapping("/{id}/status")
    public ResponseEntity<UserResponse> updateAccountStatus(
            @PathVariable Long id,
            @Valid @RequestBody UpdateAccountStatusRequest request,
            HttpServletRequest httpRequest) {
        String clientIp = getClientIp(httpRequest);
        return ResponseEntity.ok(userManagementService.updateAccountStatus(id, request, clientIp));
    }

    // 4. Register new Staff member (Administrator, Support Officer, Marketing Officer)
    @PostMapping("/staff")
    public ResponseEntity<UserResponse> createStaffMember(
            @Valid @RequestBody CreateStaffRequest request,
            HttpServletRequest httpRequest) {
        String clientIp = getClientIp(httpRequest);
        UserResponse response = userManagementService.createStaffMember(request, clientIp);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // 5. Update staff profile, designation, or role details
    @PutMapping("/staff/{id}")
    public ResponseEntity<UserResponse> updateStaffProfile(
            @PathVariable Long id,
            @Valid @RequestBody UpdateStaffProfileRequest request,
            HttpServletRequest httpRequest) {
        String clientIp = getClientIp(httpRequest);
        return ResponseEntity.ok(userManagementService.updateStaffProfile(id, request, clientIp));
    }

    // 6. Update creator verification status
    @PatchMapping("/creators/{id}/verification")
    public ResponseEntity<UserResponse> updateCreatorVerification(
            @PathVariable Long id,
            @Valid @RequestBody UpdateCreatorStatusRequest request,
            HttpServletRequest httpRequest) {
        String clientIp = getClientIp(httpRequest);
        return ResponseEntity.ok(userManagementService.updateCreatorVerification(id, request, clientIp));
    }

    // 7. Update viewer premium status
    @PatchMapping("/viewers/{id}/premium")
    public ResponseEntity<UserResponse> updateViewerPremiumStatus(
            @PathVariable Long id,
            @Valid @RequestBody UpdatePremiumStatusRequest request,
            HttpServletRequest httpRequest) {
        String clientIp = getClientIp(httpRequest);
        return ResponseEntity.ok(userManagementService.updateViewerPremiumStatus(id, request, clientIp));
    }

    // 8. View platform activity logs
    @GetMapping("/activity-logs")
    public ResponseEntity<List<ActivityLogResponse>> getActivityLogs(
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) String actionType) {
        return ResponseEntity.ok(userManagementService.getActivityLogs(userId, actionType));
    }

    // 9. View user management summary statistics
    @GetMapping("/stats")
    public ResponseEntity<PlatformUserStatsResponse> getPlatformUserStats() {
        return ResponseEntity.ok(userManagementService.getPlatformUserStats());
    }

    private String getClientIp(HttpServletRequest request) {
        if (request == null) return "127.0.0.1";
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        return ip != null ? ip : "127.0.0.1";
    }
}
