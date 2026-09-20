package org.gp14.skopia.user.dto;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;
import org.gp14.skopia.model.user.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@Builder
public class UserResponse {
    private Long id;
    private String username;
    private String email;
    private String firstName;
    private String lastName;
    private LocalDateTime registeredDate;
    private String accountStatus;
    private String roleType; // ADMINISTRATOR, SUPPORT_OFFICER, MARKETING_OFFICER, CONTENT_CREATOR, REGISTERED_VIEWER, GUEST_VIEWER, STAFF, VIEWER, USER

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

    public static UserResponse fromEntity(User user) {
        if (user == null) return null;

        UserResponseBuilder builder = UserResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .registeredDate(user.getRegisteredDate())
                .accountStatus(user.getAccountStatus());

        if (user instanceof Administrator admin) {
            builder.roleType("ADMINISTRATOR")
                   .designation(admin.getDesignation())
                   .hireDate(admin.getHireDate())
                   .adminLevel(admin.getAdminLevel())
                   .lastLogin(admin.getLastLogin());
        } else if (user instanceof SupportOfficer support) {
            builder.roleType("SUPPORT_OFFICER")
                   .designation(support.getDesignation())
                   .hireDate(support.getHireDate())
                   .supportLevel(support.getSupportLevel())
                   .shift(support.getShift());
        } else if (user instanceof MarketingOfficer marketing) {
            builder.roleType("MARKETING_OFFICER")
                   .designation(marketing.getDesignation())
                   .hireDate(marketing.getHireDate())
                   .officerCode(marketing.getOfficerCode())
                   .department(marketing.getDepartment());
        } else if (user instanceof ContentCreator creator) {
            builder.roleType("CONTENT_CREATOR")
                   .preferredLanguage(creator.getPreferredLanguage())
                   .deviceType(creator.getDeviceType())
                   .channelName(creator.getChannelName())
                   .channelBio(creator.getChannelBio())
                   .isVerified(creator.getIsVerified())
                   .totalUploads(creator.getTotalUploads());
        } else if (user instanceof RegisteredViewer regViewer) {
            builder.roleType("REGISTERED_VIEWER")
                   .preferredLanguage(regViewer.getPreferredLanguage())
                   .deviceType(regViewer.getDeviceType())
                   .displayName(regViewer.getDisplayName())
                   .contactNo(regViewer.getContactNo())
                   .isPremium(regViewer.getIsPremium())
                   .notifyChannel(regViewer.getNotifyChannel())
                   .street(regViewer.getStreet())
                   .city(regViewer.getCity())
                   .postalCode(regViewer.getPostalCode());
        } else if (user instanceof GuestViewer guest) {
            builder.roleType("GUEST_VIEWER")
                   .preferredLanguage(guest.getPreferredLanguage())
                   .deviceType(guest.getDeviceType());
        } else if (user instanceof Staff staff) {
            builder.roleType("STAFF")
                   .designation(staff.getDesignation())
                   .hireDate(staff.getHireDate());
        } else if (user instanceof Viewer viewer) {
            builder.roleType("VIEWER")
                   .preferredLanguage(viewer.getPreferredLanguage())
                   .deviceType(viewer.getDeviceType());
        } else {
            builder.roleType("USER");
        }

        return builder.build();
    }
}
