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
    private String actionType;
    private LocalDateTime actionTime;
    private String ipAddress;

    public static ActivityLogResponse fromEntity(ActivityLog log) {
        if (log == null) return null;
        return ActivityLogResponse.builder()
                .logId(log.getId())
                .userId(log.getUser() != null ? log.getUser().getId() : null)
                .username(log.getUser() != null ? log.getUser().getUsername() : null)
                .actionType(log.getActionType())
                .actionTime(log.getActionTime())
                .ipAddress(log.getIpAddress())
                .build();
    }
}
