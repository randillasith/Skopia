package org.gp14.skopia.user.dto;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Builder
public class PlatformUserStatsResponse {
    private long totalUsers;
    private long activeUsers;
    private long suspendedUsers;
    private long blockedUsers;
    private long totalViewers;
    private long premiumViewers;
    private long totalCreators;
    private long verifiedCreators;
    private long totalStaff;
    private long administratorsCount;
    private long supportOfficersCount;
    private long marketingOfficersCount;
}
