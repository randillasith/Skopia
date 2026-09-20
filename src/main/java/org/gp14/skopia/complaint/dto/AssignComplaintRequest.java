package org.gp14.skopia.complaint.dto;

import jakarta.validation.constraints.NotNull;

public class AssignComplaintRequest {
    @NotNull
    private Long officerId;

    public Long getOfficerId() { return officerId; }
    public void setOfficerId(Long officerId) { this.officerId = officerId; }
}
