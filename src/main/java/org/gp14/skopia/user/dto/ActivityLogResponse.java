package org.gp14.skopia.user.dto;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;
import org.gp14.skopia.model.user.ActivityLog;

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
        var legacyUser = log.getUser();
        var actor = log.getActor() != null ? log.getActor() : legacyUser;
        var target = log.getTargetUser() != null ? log.getTargetUser() : legacyUser;
        return ActivityLogResponse.builder()
                .logId(log.getId())
                .userId(legacyUser != null ? legacyUser.getId() : null)
                .username(legacyUser != null ? legacyUser.getUsername() : null)
                .actorUserId(actor != null ? actor.getId() : null)
                .actorUsername(actor != null ? actor.getUsername() : null)
                .targetUserId(target != null ? target.getId() : null)
                .targetUsername(target != null ? target.getUsername() : null)
                .detail(log.getDetail())
                .actionType(log.getActionType())
                .actionTime(log.getActionTime())
                .ipAddress(log.getIpAddress())
                .build();
    }
}
