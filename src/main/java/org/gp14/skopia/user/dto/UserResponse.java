package org.gp14.skopia.user.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.gp14.skopia.model.user.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserResponse {
    private Long id;
    private Long userId;
    private String username;
    private String email;
    private String firstName;
    private String lastName;
    private LocalDateTime registeredDate;
    private String accountStatus;
    private String roleType;
    private String userType;
    private String profilePicture;
    private String bio;

    // Staff details
    private String designation;
    private LocalDate hireDate;

    // Administrator details
    private String adminLevel;
    private LocalDateTime lastLogin;

    // Support Officer details
    private String supportLevel;
    private String shift;

    // Marketing Officer details
    private String officerCode;
    private String department;

    // Viewer details
    private String preferredLanguage;
    private String deviceType;

    // Registered Viewer details
    private String displayName;
    private String contactNo;
    private Boolean isPremium;
    private String notifyChannel;
    private String street;
    private String city;
    private String postalCode;

    // Content Creator details
    private String channelName;
    private String channelBio;
    private Boolean isVerified;
    private Integer totalUploads;

    public Long getId() {
        return id != null ? id : userId;
    }

    public Long getUserId() {
        return userId != null ? userId : id;
    }

    public String getRoleType() {
        return roleType != null ? roleType : (userType != null ? userType : "USER");
    }

    public String getUserType() {
        return userType != null ? userType : (roleType != null ? roleType : "USER");
    }

    public static UserResponse fromEntity(User user) {
        return fromEntity(user, false);
    }

    public static UserResponse fromEntity(User user, boolean activePremium) {
        if (user == null) return null;

        String defaultDisplayName = (user.getFirstName() != null ? user.getFirstName() : "") +
                (user.getLastName() != null && !user.getLastName().isEmpty() ? " " + user.getLastName() : "");
        if (defaultDisplayName.trim().isEmpty()) {
            defaultDisplayName = user.getUsername();
        }

        UserResponseBuilder builder = UserResponse.builder()
                .id(user.getId())
                .userId(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .displayName(defaultDisplayName.trim())
                .bio(user.getBio())
                .contactNo(user.getContactNo())
                .registeredDate(user.getRegisteredDate())
                .accountStatus(user.getAccountStatus());

        if (user instanceof Administrator admin) {
            builder.roleType("ADMINISTRATOR")
                   .userType("ADMINISTRATOR")
                   .designation(admin.getDesignation())
                   .hireDate(admin.getHireDate())
                   .adminLevel(admin.getAdminLevel())
                   .lastLogin(admin.getLastLogin());
        } else if (user instanceof SupportOfficer support) {
            builder.roleType("SUPPORT_OFFICER")
                   .userType("SUPPORT_OFFICER")
                   .designation(support.getDesignation())
                   .hireDate(support.getHireDate())
                   .supportLevel(support.getSupportLevel())
                   .shift(support.getShift());
        } else if (user instanceof MarketingOfficer marketing) {
            builder.roleType("MARKETING_OFFICER")
                   .userType("MARKETING_OFFICER")
                   .designation(marketing.getDesignation())
                   .hireDate(marketing.getHireDate())
                   .officerCode(marketing.getOfficerCode())
                   .department(marketing.getDepartment());
        } else if (user instanceof ContentCreator creator) {
            builder.roleType("CONTENT_CREATOR")
                   .userType("CONTENT_CREATOR")
                   .preferredLanguage(creator.getPreferredLanguage())
                   .deviceType(creator.getDeviceType())
                   .channelName(creator.getChannelName())
                   .channelBio(creator.getChannelBio())
                   .displayName(creator.getChannelName() != null && !creator.getChannelName().isEmpty() ? creator.getChannelName() : defaultDisplayName.trim())
                   .bio(creator.getChannelBio() != null && !creator.getChannelBio().isEmpty() ? creator.getChannelBio() : user.getBio())
                   .isVerified(creator.getIsVerified())
                   .totalUploads(creator.getTotalUploads());
        } else if (user instanceof RegisteredViewer regViewer) {
            builder.roleType("REGISTERED_VIEWER")
                   .userType("REGISTERED_VIEWER")
                   .preferredLanguage(regViewer.getPreferredLanguage())
                   .deviceType(regViewer.getDeviceType())
                   .displayName(regViewer.getDisplayName() != null && !regViewer.getDisplayName().isEmpty() ? regViewer.getDisplayName() : defaultDisplayName.trim())
                   .contactNo(user.getContactNo())
                   .isPremium(activePremium)
                   .notifyChannel(regViewer.getNotifyChannel())
                   .street(regViewer.getStreet())
                   .city(regViewer.getCity())
                   .postalCode(regViewer.getPostalCode());
        } else if (user instanceof GuestViewer guest) {
            builder.roleType("GUEST_VIEWER")
                   .userType("GUEST_VIEWER")
                   .preferredLanguage(guest.getPreferredLanguage())
                   .deviceType(guest.getDeviceType());
        } else if (user instanceof Staff staff) {
            builder.roleType("STAFF")
                   .userType("STAFF")
                   .designation(staff.getDesignation())
                   .hireDate(staff.getHireDate());
        } else if (user instanceof Viewer viewer) {
            builder.roleType("VIEWER")
                   .userType("VIEWER")
                   .preferredLanguage(viewer.getPreferredLanguage())
                   .deviceType(viewer.getDeviceType());
        } else {
            builder.roleType("USER")
                   .userType("USER");
        }

        return builder.build();
    }
}
