package org.gp14.skopia.user;

import org.gp14.skopia.model.user.User;
import org.gp14.skopia.repository.UserRepository;
import org.gp14.skopia.user.dto.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.List;
import java.util.Optional;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private org.gp14.skopia.billing.BillingService billing;

    @Autowired
    private StaffRoleService staffRoles;

    private UserResponse response(User user) {
        return staffRoles.apply(UserResponse.fromEntity(user, user instanceof org.gp14.skopia.model.user.RegisteredViewer
                && billing.hasActivePremium(user.getId())), user.getId());
    }

    public LoginResponse register(RegisterUserRequest request) {
        if (userRepository.findByUsername(request.getUsername()).isPresent()) {
            return LoginResponse.builder()
                    .message("Username already exists")
                    .build();
        }

        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            return LoginResponse.builder()
                    .message("Email already exists")
                    .build();
        }

        User user = new User();
        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());
        user.setPasswordHash(hashPassword(request.getPassword()));
        user.setFirstName(request.getFirstName());
        user.setLastName(request.getLastName());
        user.setAccountStatus("ACTIVE");
        user.setRegisteredDate(LocalDateTime.now());

        User savedUser = userRepository.save(user);

        return LoginResponse.builder()
                .userId(savedUser.getId())
                .username(savedUser.getUsername())
                .email(savedUser.getEmail())
                .firstName(savedUser.getFirstName())
                .lastName(savedUser.getLastName())
                .accountStatus(savedUser.getAccountStatus())
                .message("User registered successfully")
                .build();
    }

    public LoginResponse login(LoginRequest request) {
        Optional<User> userOpt = userRepository.findByEmail(request.getEmailOrUsername());

        if (userOpt.isEmpty()) {
            userOpt = userRepository.findByUsername(request.getEmailOrUsername());
        }

        if (userOpt.isEmpty()) {
            return LoginResponse.builder()
                    .message("User not found")
                    .build();
        }

        User user = userOpt.get();

        if (!verifyPassword(request.getPassword(), user.getPasswordHash())) {
            return LoginResponse.builder()
                    .message("Invalid password")
                    .build();
        }

        if (!"ACTIVE".equals(user.getAccountStatus())) {
            return LoginResponse.builder()
                    .message("Account is " + user.getAccountStatus())
                    .build();
        }

        return LoginResponse.builder()
                .userId(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .accountStatus(user.getAccountStatus())
                .token(generateToken(user))
                .message("Login successful")
                .build();
    }

    public UserResponse getUserProfile(Long userId) {
        Optional<User> user = userRepository.findById(userId);

        if (user.isEmpty()) {
            return null;
        }

        return response(user.get());
    }

    public UserResponse updateProfile(Long userId, UpdateProfileRequest request) {
        Optional<User> userOpt = userRepository.findById(userId);

        if (userOpt.isEmpty()) {
            return null;
        }

        User user = userOpt.get();
        if (request.getFirstName() != null) {
            user.setFirstName(request.getFirstName().trim());
        }
        if (request.getLastName() != null) {
            user.setLastName(request.getLastName().trim());
        }

        if (request.getUsername() != null && !request.getUsername().trim().isEmpty()) {
            String newUsername = request.getUsername().trim().replaceFirst("^@", "");
            if (!newUsername.equalsIgnoreCase(user.getUsername())) {
                Optional<User> existingUser = userRepository.findByUsername(newUsername);
                if (existingUser.isPresent() && !existingUser.get().getId().equals(userId)) {
                    throw new IllegalArgumentException("Username @" + newUsername + " is already taken");
                }
                user.setUsername(newUsername);
            }
        }

        if (request.getEmail() != null && !request.getEmail().trim().isEmpty()) {
            String newEmail = request.getEmail().trim();
            if (!newEmail.equalsIgnoreCase(user.getEmail())) {
                Optional<User> existingEmail = userRepository.findByEmail(newEmail);
                if (existingEmail.isPresent() && !existingEmail.get().getId().equals(userId)) {
                    throw new IllegalArgumentException("Email " + newEmail + " is already registered");
                }
                user.setEmail(newEmail);
            }
        }

        if (request.getBio() != null) {
            user.setBio(request.getBio().trim());
        }

        if (request.getContactNo() != null) {
            user.setContactNo(request.getContactNo().trim());
        }

        if (user instanceof org.gp14.skopia.model.user.RegisteredViewer viewer) {
            String full = (user.getFirstName() != null ? user.getFirstName() : "") + 
                          (user.getLastName() != null && !user.getLastName().isEmpty() ? " " + user.getLastName() : "");
            if (request.getDisplayName() != null && !request.getDisplayName().trim().isEmpty()) {
                viewer.setDisplayName(request.getDisplayName().trim());
            } else if (!full.trim().isEmpty()) {
                viewer.setDisplayName(full.trim());
            }
        } else if (user instanceof org.gp14.skopia.model.user.ContentCreator creator) {
            if (request.getBio() != null) {
                creator.setChannelBio(request.getBio().trim());
            }
            if (request.getDisplayName() != null && !request.getDisplayName().trim().isEmpty()) {
                creator.setChannelName(request.getDisplayName().trim());
            }
        }

        User updated = userRepository.save(user);
        return response(updated);
    }

    public boolean changePassword(Long userId, ChangePasswordRequest request) {
        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            return false;
        }

        Optional<User> userOpt = userRepository.findById(userId);

        if (userOpt.isEmpty()) {
            return false;
        }

        User user = userOpt.get();

        if (!verifyPassword(request.getCurrentPassword(), user.getPasswordHash())) {
            return false;
        }

        user.setPasswordHash(hashPassword(request.getNewPassword()));
        userRepository.save(user);

        return true;
    }

    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    public boolean deactivateUser(Long userId) {
        Optional<User> userOpt = userRepository.findById(userId);

        if (userOpt.isEmpty()) {
            return false;
        }

        User user = userOpt.get();
        user.setAccountStatus("DEACTIVATED");
        userRepository.save(user);

        return true;
    }

    public boolean activateUser(Long userId) {
        Optional<User> userOpt = userRepository.findById(userId);

        if (userOpt.isEmpty()) {
            return false;
        }

        User user = userOpt.get();
        user.setAccountStatus("ACTIVE");
        userRepository.save(user);

        return true;
    }

    public boolean deleteUser(Long userId) {
        if (!userRepository.existsById(userId)) {
            return false;
        }

        userRepository.deleteById(userId);
        return true;
    }

    private String hashPassword(String password) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(password.getBytes());
            return Base64.getEncoder().encodeToString(hash);
        } catch (Exception e) {
            throw new RuntimeException("Error hashing password", e);
        }
    }

    private boolean verifyPassword(String rawPassword, String hashedPassword) {
        String hashOfRaw = hashPassword(rawPassword);
        return hashOfRaw.equals(hashedPassword);
    }

    private String generateToken(User user) {
        String payload = user.getId() + ":" + user.getUsername() + ":" + System.currentTimeMillis();
        return Base64.getEncoder().encodeToString(payload.getBytes());
    }
}
