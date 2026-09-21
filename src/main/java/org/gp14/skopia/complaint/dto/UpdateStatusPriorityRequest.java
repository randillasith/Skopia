package org.gp14.skopia.complaint.dto;

import org.gp14.skopia.complaint.ComplaintPriority;
import org.gp14.skopia.complaint.ComplaintStatus;
import jakarta.validation.constraints.NotNull;

public class UpdateStatusPriorityRequest {
    @NotNull
    private ComplaintStatus status;

    @NotNull
    private ComplaintPriority priority;

    public ComplaintStatus getStatus() { return status; }
    public void setStatus(ComplaintStatus status) { this.status = status; }
    public ComplaintPriority getPriority() { return priority; }
    public void setPriority(ComplaintPriority priority) { this.priority = priority; }
}
