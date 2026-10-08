package org.gp14.skopia.user;

import jakarta.servlet.http.HttpServletRequest;
import org.gp14.skopia.billing.BillingService;
import org.gp14.skopia.model.user.ContentCreator;
import org.gp14.skopia.model.user.RegisteredViewer;
import org.gp14.skopia.model.user.User;
import org.gp14.skopia.repository.ContentCreatorRepository;
import org.gp14.skopia.repository.RegisteredViewerRepository;
import org.gp14.skopia.repository.UserRepository;
import org.gp14.skopia.security.PasswordService;
import org.gp14.skopia.security.TokenService;
import org.gp14.skopia.user.dto.LoginRequest;
import org.gp14.skopia.user.dto.LoginResponse;
import org.gp14.skopia.user.dto.RegisterUserRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private static final Pattern USERNAME = Pattern.compile("[A-Za-z0-9_]{3,50}");
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private final UserRepository users;
    private final RegisteredViewerRepository viewers;
    private final ContentCreatorRepository creators;
    private final UserManagementService userManagement;
    private final PasswordService passwords;
    private final TokenService tokens;
    private final BillingService billing;
    private final PasswordResetService passwordReset;
    private final WelcomeMailService welcomeMail;
    private final StaffRoleService staffRoles;

    public AuthController(UserRepository users, RegisteredViewerRepository viewers,
                          ContentCreatorRepository creators, UserManagementService userManagement,
                          PasswordService passwords, TokenService tokens, BillingService billing,
                          PasswordResetService passwordReset, WelcomeMailService welcomeMail, StaffRoleService staffRoles) {
        this.users = users;
        this.viewers = viewers;
        this.creators = creators;
        this.userManagement = userManagement;
        this.passwords = passwords;
        this.tokens = tokens;
        this.billing = billing;
        this.passwordReset = passwordReset;
        this.welcomeMail = welcomeMail;
        this.staffRoles = staffRoles;
    }

    public record ResetRequest(String email) {}
    public record ResetConfirm(String token, String newPassword) {}

    @PostMapping("/password-reset/request")
    public ResponseEntity<Map<String,String>> requestPasswordReset(@RequestBody ResetRequest request, HttpServletRequest servletRequest) {
        if(!passwordReset.isConfigured())
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("message","Password reset is temporarily unavailable."));
        return ResponseEntity.ok(Map.of("message",passwordReset.request(request.email(),clientIp(servletRequest))));
    }

    @PostMapping("/password-reset/confirm")
    public ResponseEntity<Map<String,String>> confirmPasswordReset(@RequestBody ResetConfirm request) {
        if(!passwordReset.confirm(request.token(),request.newPassword()))
            return ResponseEntity.badRequest().body(Map.of("message","Invalid or expired reset request or password."));
        return ResponseEntity.ok(Map.of("message","Password updated. Sign in with your new password."));
    }

    @PostMapping("/register")
    public ResponseEntity<LoginResponse> register(@RequestBody RegisterUserRequest request, HttpServletRequest servletRequest) {
        String username = request.getEffectiveUsername();
        String email = request.getEmail() == null ? "" : request.getEmail().trim().toLowerCase();
        String rawPassword = request.getPassword() == null ? "" : request.getPassword();
        if (!USERNAME.matcher(username).matches()) return bad("Username must be 3-50 letters, numbers, or underscores");
        if (!EMAIL.matcher(email).matches()) return bad("A valid email address is required");
        if (rawPassword.length() < 8) return bad("Password must be at least 8 characters");
        if (rawPassword.getBytes(StandardCharsets.UTF_8).length > 72) return bad("Password must not exceed 72 UTF-8 bytes");
        if (users.existsByUsername(username)) return conflict("Username is already taken");
        if (users.existsByEmail(email)) return conflict("Email is already registered");

        boolean creatorRole = "CONTENT_CREATOR".equals(request.getEffectiveRole());
        User created;
        if (creatorRole) {
            ContentCreator creator = new ContentCreator();
            populate(creator, request, username, email, rawPassword);
            creator.setPreferredLanguage("en");
            creator.setChannelName(nonBlank(request.getChannelName(), username + " Studio"));
            creator.setChannelBio("Skopia Creator");
            creator.setIsVerified(false);
            creator.setTotalUploads(0);
            created = creators.save(creator);
        } else {
            RegisteredViewer viewer = new RegisteredViewer();
            populate(viewer, request, username, email, rawPassword);
            viewer.setPreferredLanguage("en");
            viewer.setJoinDate(LocalDateTime.now());
            viewer.setDisplayName(nonBlank(request.getDisplayName(), username));
            viewer.setIsPremium(false);
            viewer.setNotifyChannel("EMAIL");
            created = viewers.save(viewer);
        }
        userManagement.logActivity(created, creatorRole ? "CREATOR_REGISTERED" : "VIEWER_REGISTERED", clientIp(servletRequest));
        welcomeMail.queue(created.getEmail());
        return ResponseEntity.status(HttpStatus.CREATED).body(response(created, "Account created"));
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@RequestBody LoginRequest request, HttpServletRequest servletRequest) {
        String identifier = request.getEffectiveIdentifier();
        if (identifier.startsWith("@")) identifier = identifier.substring(1);
        String raw = request.getPassword() == null ? "" : request.getPassword();
        if (identifier.isBlank() || raw.isBlank()) return bad("Identifier and password are required");
        Optional<User> found = users.findByEmail(identifier.toLowerCase());
        if (found.isEmpty()) found = users.findByUsername(identifier);
        if (found.isEmpty() || !passwords.matches(raw, found.get().getPasswordHash())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(LoginResponse.builder().message("Invalid credentials").build());
        }
        User user = found.get();
        if (!"ACTIVE".equalsIgnoreCase(user.getAccountStatus())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(LoginResponse.builder().message("Account is " + user.getAccountStatus()).build());
        }
        if (passwords.needsUpgrade(user.getPasswordHash())) {
            user.setPasswordHash(passwords.encode(raw));
            users.save(user);
        }
        userManagement.logActivity(user, "LOGIN_SUCCESS", clientIp(servletRequest));
        return ResponseEntity.ok(response(user, "Login successful"));
    }

    @GetMapping("/me")
    public LoginResponse me(@AuthenticationPrincipal User user) {
        return response(user, "Authenticated");
    }

    @GetMapping("/check-handle")
    public Map<String, Object> checkHandle(@RequestParam String handle) {
        String clean = handle.startsWith("@") ? handle.substring(1).trim() : handle.trim();
        return Map.of("handle", "@" + clean, "available", USERNAME.matcher(clean).matches() && !users.existsByUsername(clean));
    }

    private void populate(User user, RegisterUserRequest request, String username, String email, String rawPassword) {
        user.setUsername(username);
        user.setEmail(email);
        user.setPasswordHash(passwords.encode(rawPassword));
        user.setFirstName(nonBlank(request.getFirstName(), username));
        user.setLastName(nonBlank(request.getLastName(), ""));
        user.setAccountStatus("ACTIVE");
        user.setRegisteredDate(LocalDateTime.now());
    }

    private LoginResponse response(User user, String message) {
        var dto = org.gp14.skopia.user.dto.UserResponse.fromEntity(user);
        String staffType = staffRoles.staffType(user.getId()).map(Enum::name).orElse(null);
        return LoginResponse.builder().id(user.getId()).userId(user.getId()).username(user.getUsername())
                .email(user.getEmail()).firstName(user.getFirstName()).lastName(user.getLastName())
                .displayName(dto.getDisplayName()).roleType(staffType != null ? staffType : dto.getRoleType()).userType(dto.getRoleType())
                .accountType(dto.getRoleType()).staffType(staffType)
                .accountStatus(user.getAccountStatus()).isPremium(user instanceof RegisteredViewer && billing.hasActivePremium(user.getId()))
                .isVerified(dto.getIsVerified())
                .token(tokens.issue(user.getId())).message(message).build();
    }

    private ResponseEntity<LoginResponse> bad(String message) { return ResponseEntity.badRequest().body(LoginResponse.builder().message(message).build()); }
    private ResponseEntity<LoginResponse> conflict(String message) { return ResponseEntity.status(HttpStatus.CONFLICT).body(LoginResponse.builder().message(message).build()); }
    private String nonBlank(String value, String fallback) { return value == null || value.isBlank() ? fallback : value.trim(); }
    private String clientIp(HttpServletRequest request) {
        String peer=request.getRemoteAddr();
        if("127.0.0.1".equals(peer) || "::1".equals(peer)) {
            String real=request.getHeader("X-Real-IP");
            if(real!=null && real.matches("[0-9a-fA-F:.]{2,45}") && !real.contains("..")) return real;
        }
        return peer==null ? "unknown" : peer;
    }
}
