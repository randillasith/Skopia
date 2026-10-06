package org.gp14.skopia.user.dto;

import jakarta.persistence.EntityNotFoundException;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;
import org.gp14.skopia.model.user.ActivityLog;
import org.gp14.skopia.model.user.User;

import java.time.LocalDateTime;

@Getter
@Setter
@Builder
public class ActivityLogResponse {
    private Long logId;
    private Long userId;
    private String username;
    private Long actorUserId;
    private String actorUsername;
    private Long targetUserId;
    private String targetUsername;
    private String detail;
    private String actionType;
    private LocalDateTime actionTime;
    private String ipAddress;

    public static ActivityLogResponse fromEntity(ActivityLog log) {
        if (log == null) return null;
        
        User legacyUser = null;
        try {
            legacyUser = log.getUser();
        } catch (EntityNotFoundException ignored) {}

        User actor = null;
        try {
            actor = log.getActor() != null ? log.getActor() : legacyUser;
        } catch (EntityNotFoundException ignored) {
            actor = legacyUser;
        }

        User target = null;
        try {
            target = log.getTargetUser() != null ? log.getTargetUser() : legacyUser;
        } catch (EntityNotFoundException ignored) {
            target = legacyUser;
        }

        return ActivityLogResponse.builder()
                .logId(log.getId())
                .userId(safeGetId(legacyUser))
                .username(safeGetUsername(legacyUser))
                .actorUserId(safeGetId(actor))
                .actorUsername(safeGetUsername(actor))
                .targetUserId(safeGetId(target))
                .targetUsername(safeGetUsername(target))
                .detail(log.getDetail())
                .actionType(log.getActionType())
                .actionTime(log.getActionTime())
                .ipAddress(log.getIpAddress())
                .build();
    }

    private static Long safeGetId(User user) {
        if (user == null) return null;
        try {
            return user.getId();
        } catch (EntityNotFoundException ex) {
            return null;
        }
    }

    private static String safeGetUsername(User user) {
        if (user == null) return null;
        try {
            return user.getUsername();
        } catch (EntityNotFoundException ex) {
            return null;
        }
    }
}
