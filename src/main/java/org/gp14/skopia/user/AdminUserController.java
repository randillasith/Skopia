package org.gp14.skopia.user;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.gp14.skopia.user.dto.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.gp14.skopia.model.user.User;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/users")
@Validated
public class AdminUserController {
    private final UserManagementService userManagementService;

    public AdminUserController(UserManagementService userManagementService) {
        this.userManagementService = userManagementService;
    }

    @GetMapping
    public List<UserResponse> getUsers(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String role,
            @RequestParam(defaultValue = "100") @Min(1) @Max(100) int limit) {
        return userManagementService.getUsers(q, status, role).stream().limit(limit).toList();
    }

    @GetMapping("/{id}")
    public UserResponse getUser(@PathVariable Long id) {
        return userManagementService.getUserById(id);
    }

    @PatchMapping("/{id}/status")
    public UserResponse updateStatus(@PathVariable Long id,
                                     @Valid @RequestBody UpdateAccountStatusRequest request,
                                     Authentication authentication,
                                     HttpServletRequest httpRequest) {
        return userManagementService.updateAccountStatus(authenticatedActor(authentication), id, request, clientIp(httpRequest));
    }

    @PostMapping("/staff")
    public ResponseEntity<UserResponse> createStaff(@Valid @RequestBody CreateStaffRequest request,
                                                     Authentication authentication,
                                                     HttpServletRequest httpRequest) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(userManagementService.createStaffMember(authenticatedActor(authentication), request, clientIp(httpRequest)));
    }

    @RequestMapping(value = "/staff/{id}", method = {RequestMethod.PUT, RequestMethod.PATCH})
    public UserResponse updateStaff(@PathVariable Long id,
                                    @Valid @RequestBody UpdateStaffProfileRequest request,
                                    Authentication authentication,
                                    HttpServletRequest httpRequest) {
        return userManagementService.updateStaffProfile(authenticatedActor(authentication), id, request, clientIp(httpRequest));
    }

    @PatchMapping("/{id}/creator-verification")
    public UserResponse updateCreatorVerification(@PathVariable Long id,
                                                   @Valid @RequestBody UpdateCreatorStatusRequest request,
                                                   Authentication authentication,
                                                   HttpServletRequest httpRequest) {
        return userManagementService.updateCreatorVerification(authenticatedActor(authentication), id, request, clientIp(httpRequest));
    }

    @GetMapping("/activity-logs")
    public List<ActivityLogResponse> activityLogs(@RequestParam(required = false) Long userId,
                                                   @RequestParam(required = false) String actionType,
                                                   @RequestParam(defaultValue = "100") @Min(1) @Max(100) int limit) {
        return userManagementService.getActivityLogs(userId, actionType).stream().limit(limit).toList();
    }

    @GetMapping("/stats")
    public PlatformUserStatsResponse stats() {
        return userManagementService.getPlatformUserStats();
    }

    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        return forwarded == null || forwarded.isBlank()
                ? request.getRemoteAddr()
                : forwarded.split(",", 2)[0].trim();
    }

    private User authenticatedActor(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof User actor)) {
            throw new org.springframework.web.server.ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated user required");
        }
        return actor;
    }
}
