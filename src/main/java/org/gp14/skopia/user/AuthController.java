package org.gp14.skopia.user;

import jakarta.servlet.http.HttpServletRequest;
import org.gp14.skopia.model.user.ContentCreator;
import org.gp14.skopia.model.user.RegisteredViewer;
import org.gp14.skopia.model.user.User;
import org.gp14.skopia.repository.ContentCreatorRepository;
import org.gp14.skopia.repository.RegisteredViewerRepository;
import org.gp14.skopia.repository.UserRepository;
import org.gp14.skopia.user.dto.LoginRequest;
import org.gp14.skopia.user.dto.LoginResponse;
import org.gp14.skopia.user.dto.RegisterUserRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*", maxAge = 3600)
public class AuthController {

    private final UserRepository userRepository;
    private final RegisteredViewerRepository registeredViewerRepository;
    private final ContentCreatorRepository contentCreatorRepository;
    private final UserManagementService userManagementService;

    public AuthController(UserRepository userRepository,
                          RegisteredViewerRepository registeredViewerRepository,
                          ContentCreatorRepository contentCreatorRepository,
                          UserManagementService userManagementService) {
        this.userRepository = userRepository;
        this.registeredViewerRepository = registeredViewerRepository;
        this.contentCreatorRepository = contentCreatorRepository;
        this.userManagementService = userManagementService;
    }

    @PostMapping("/register")
    public ResponseEntity<LoginResponse> register(@RequestBody RegisterUserRequest request, HttpServletRequest httpRequest) {
        String username = request.getEffectiveUsername();
        String email = request.getEmail() != null ? request.getEmail().trim() : "";

        if (username.isEmpty()) {
            return ResponseEntity.badRequest().body(LoginResponse.builder().message("Handle / Username is required").build());
        }
        if (email.isEmpty()) {
            return ResponseEntity.badRequest().body(LoginResponse.builder().message("Email address is required").build());
        }
        if (request.getPassword() == null || request.getPassword().trim().length() < 4) {
            return ResponseEntity.badRequest().body(LoginResponse.builder().message("Password must be at least 4 characters").build());
        }

        if (userRepository.existsByUsername(username)) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(LoginResponse.builder().message("Username @" + username + " is already taken").build());
        }
        if (userRepository.existsByEmail(email)) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(LoginResponse.builder().message("Email " + email + " is already registered").build());
        }

        String rawPassword = request.getPassword().trim();
        String hashedPassword = hashPassword(rawPassword);
        String role = request.getEffectiveRole();
        String ipAddress = getClientIp(httpRequest);

        String displayName = request.getDisplayName();
        if (displayName == null || displayName.trim().isEmpty()) {
            if (request.getFirstName() != null && !request.getFirstName().trim().isEmpty()) {
                displayName = request.getFirstName().trim() + (request.getLastName() != null ? " " + request.getLastName().trim() : "");
            } else {
                displayName = username;
            }
        }

        User createdUser;
        if (role.contains("CREATOR")) {
            ContentCreator creator = new ContentCreator();
            creator.setUsername(username);
            creator.setEmail(email);
            creator.setPasswordHash(hashedPassword);
            creator.setFirstName(request.getFirstName() != null ? request.getFirstName().trim() : displayName);
            creator.setLastName(request.getLastName() != null ? request.getLastName().trim() : "");
            creator.setAccountStatus("ACTIVE");
            creator.setRegisteredDate(LocalDateTime.now());
            creator.setPreferredLanguage("en");
            creator.setChannelName(request.getChannelName() != null && !request.getChannelName().trim().isEmpty() 
                    ? request.getChannelName().trim() 
                    : displayName + " Studio");
            
            String bio = "";
            if (request.getGenre() != null && !request.getGenre().trim().isEmpty()) {
                bio += "Genre: " + request.getGenre().trim();
            }
            if (request.getShowreelUrl() != null && !request.getShowreelUrl().trim().isEmpty()) {
                bio += " | Reel: " + request.getShowreelUrl().trim();
            }
            creator.setChannelBio(bio.isEmpty() ? "Skopia Creator Pro" : bio);
            creator.setIsVerified(false);
            creator.setTotalUploads(0);

            createdUser = contentCreatorRepository.save(creator);
            userManagementService.logActivity(createdUser, "CREATOR_REGISTERED", ipAddress);
        } else {
            RegisteredViewer viewer = new RegisteredViewer();
            viewer.setUsername(username);
            viewer.setEmail(email);
            viewer.setPasswordHash(hashedPassword);
            viewer.setFirstName(request.getFirstName() != null ? request.getFirstName().trim() : displayName);
            viewer.setLastName(request.getLastName() != null ? request.getLastName().trim() : "");
            viewer.setDisplayName(displayName);
            viewer.setAccountStatus("ACTIVE");
            viewer.setRegisteredDate(LocalDateTime.now());
            viewer.setJoinDate(LocalDateTime.now());
            viewer.setPreferredLanguage("en");
            viewer.setIsPremium(false);
            viewer.setNotifyChannel("EMAIL");

            createdUser = registeredViewerRepository.save(viewer);
            userManagementService.logActivity(createdUser, "VIEWER_REGISTERED", ipAddress);
        }

        LoginResponse response = LoginResponse.builder()
                .id(createdUser.getId())
                .userId(createdUser.getId())
                .username(createdUser.getUsername())
                .email(createdUser.getEmail())
                .firstName(createdUser.getFirstName())
                .lastName(createdUser.getLastName())
                .displayName(displayName)
                .roleType(role.contains("CREATOR") ? "CONTENT_CREATOR" : "REGISTERED_VIEWER")
                .userType(role.contains("CREATOR") ? "CONTENT_CREATOR" : "REGISTERED_VIEWER")
                .accountStatus(createdUser.getAccountStatus())
                .isPremium(false)
                .isVerified(false)
                .token(generateToken(createdUser))
                .message("Account pass provisioned successfully")
                .build();

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        String identifier = request.getEffectiveIdentifier();
        String password = request.getPassword() != null ? request.getPassword().trim() : "";

        if (identifier.isEmpty() || password.isEmpty()) {
            return ResponseEntity.badRequest().body(LoginResponse.builder().message("Identifier and password are required").build());
        }

        if (identifier.startsWith("@")) {
            identifier = identifier.substring(1);
        }

        Optional<User> userOpt = userRepository.findByEmail(identifier);
        if (userOpt.isEmpty()) {
            userOpt = userRepository.findByUsername(identifier);
        }

        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(LoginResponse.builder().message("User account not found").build());
        }

        User user = userOpt.get();

        if ("BLOCKED".equalsIgnoreCase(user.getAccountStatus())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(LoginResponse.builder().message("Account is BLOCKED. Please contact Skopia Support Desk.").build());
        }

        if ("SUSPENDED".equalsIgnoreCase(user.getAccountStatus())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(LoginResponse.builder().message("Account is SUSPENDED. Access restricted.").build());
        }

        // The administration endpoints write DEACTIVATED rather than SUSPENDED
        // for the same state. Without this, suspending an account changed a word
        // in a table and nothing else: the account could still sign in.
        if ("DEACTIVATED".equalsIgnoreCase(user.getAccountStatus())
                || "INACTIVE".equalsIgnoreCase(user.getAccountStatus())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(LoginResponse.builder()
                            .message("Account is suspended. Please contact Skopia Support Desk.").build());
        }

        // Verify password hash or plain text fallback for dev
        if (!verifyPassword(password, user.getPasswordHash()) && !password.equals(user.getPasswordHash())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(LoginResponse.builder().message("Invalid password credentials").build());
        }

        userManagementService.logActivity(user, "LOGIN_SUCCESS", getClientIp(httpRequest));

        boolean isPremium = false;
        boolean isVerified = false;
        String roleType = user.getClass().getSimpleName().toUpperCase();
        String displayName = user.getUsername();

        if (user instanceof RegisteredViewer reg) {
            roleType = "REGISTERED_VIEWER";
            isPremium = Boolean.TRUE.equals(reg.getIsPremium());
            if (reg.getDisplayName() != null) displayName = reg.getDisplayName();
        } else if (user instanceof ContentCreator cr) {
            roleType = "CONTENT_CREATOR";
            isVerified = Boolean.TRUE.equals(cr.getIsVerified());
            if (cr.getChannelName() != null) displayName = cr.getChannelName();
        }

        LoginResponse response = LoginResponse.builder()
                .id(user.getId())
                .userId(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .displayName(displayName)
                .roleType(roleType)
                .userType(roleType)
                .accountStatus(user.getAccountStatus())
                .isPremium(isPremium)
                .isVerified(isVerified)
                .token(generateToken(user))
                .message("Login successful")
                .build();

        return ResponseEntity.ok(response);
    }

    @GetMapping("/me")
    public ResponseEntity<LoginResponse> me(@RequestParam(required = false) Long userId) {
        Optional<User> userOpt;
        if (userId != null) {
            userOpt = userRepository.findById(userId);
        } else {
            userOpt = userRepository.findAll().stream().findFirst();
        }

        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }

        User user = userOpt.get();
        String roleType = user.getClass().getSimpleName().toUpperCase();
        boolean isPremium = false;
        boolean isVerified = false;
        String displayName = user.getUsername();

        if (user instanceof RegisteredViewer reg) {
            roleType = "REGISTERED_VIEWER";
            isPremium = Boolean.TRUE.equals(reg.getIsPremium());
            if (reg.getDisplayName() != null) displayName = reg.getDisplayName();
        } else if (user instanceof ContentCreator cr) {
            roleType = "CONTENT_CREATOR";
            isVerified = Boolean.TRUE.equals(cr.getIsVerified());
            if (cr.getChannelName() != null) displayName = cr.getChannelName();
        }

        return ResponseEntity.ok(LoginResponse.builder()
                .id(user.getId())
                .userId(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .displayName(displayName)
                .roleType(roleType)
                .userType(roleType)
                .accountStatus(user.getAccountStatus())
                .isPremium(isPremium)
                .isVerified(isVerified)
                .token(generateToken(user))
                .message("Authenticated")
                .build());
    }

    @GetMapping("/check-handle")
    public ResponseEntity<Map<String, Object>> checkHandle(@RequestParam String handle) {
        String clean = handle.startsWith("@") ? handle.substring(1).trim() : handle.trim();
        boolean exists = userRepository.existsByUsername(clean);
        return ResponseEntity.ok(Map.of(
                "handle", "@" + clean,
                "available", !exists && clean.length() >= 3
        ));
    }

    private String hashPassword(String password) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(password.getBytes());
            return Base64.getEncoder().encodeToString(hash);
        } catch (Exception e) {
            return password;
        }
    }

    private boolean verifyPassword(String rawPassword, String hashedPassword) {
        if (hashedPassword == null) return false;
        String hashed = hashPassword(rawPassword);
        return hashed.equals(hashedPassword);
    }

    private String generateToken(User user) {
        String payload = user.getId() + ":" + user.getUsername() + ":" + System.currentTimeMillis();
        return Base64.getEncoder().encodeToString(payload.getBytes());
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
