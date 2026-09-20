package org.gp14.skopia.complaint.dto;

import jakarta.validation.constraints.NotBlank;

public class ResolveComplaintRequest {
    @NotBlank
    private String resolutionNotes;

    public String getResolutionNotes() { return resolutionNotes; }
    public void setResolutionNotes(String resolutionNotes) { this.resolutionNotes = resolutionNotes; }
}
