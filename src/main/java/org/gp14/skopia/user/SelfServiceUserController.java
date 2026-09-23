package org.gp14.skopia.user;

import jakarta.validation.Valid;
import org.gp14.skopia.model.user.User;
import org.gp14.skopia.user.dto.UpdateProfileRequest;
import org.gp14.skopia.user.dto.UserResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/users/me")
public class SelfServiceUserController {
    private final UserService userService;

    public SelfServiceUserController(UserService userService) {
        this.userService = userService;
    }

    @PutMapping("/profile")
    public UserResponse updateProfile(@AuthenticationPrincipal User principal,
                                      @Valid @RequestBody UpdateProfileRequest request) {
        requirePrincipal(principal);
        try {
            UserResponse updated = userService.updateProfile(principal.getId(), request);
            if (updated == null) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");
            }
            return updated;
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, ex.getMessage(), ex);
        }
    }

    @DeleteMapping
    public ResponseEntity<Void> closeAccount(@AuthenticationPrincipal User principal) {
        requirePrincipal(principal);
        if (!userService.deactivateUser(principal.getId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");
        }
        return ResponseEntity.noContent().build();
    }

    private void requirePrincipal(User principal) {
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated user required");
        }
    }
}
