package org.gp14.skopia.complaint;

import org.gp14.skopia.complaint.dto.AssignComplaintRequest;
import org.gp14.skopia.complaint.dto.ComplaintResponse;
import org.gp14.skopia.complaint.dto.ResolveComplaintRequest;
import org.gp14.skopia.complaint.dto.UpdateStatusPriorityRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.gp14.skopia.model.user.User;
import org.gp14.skopia.report.Report;
import org.gp14.skopia.report.ReportService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/complaints")
public class ComplaintController {

    private final ComplaintService complaintService;
    private final ReportService reportService;

    public ComplaintController(ComplaintService complaintService, ReportService reportService) {
        this.complaintService = complaintService;
        this.reportService = reportService;
    }

    // Creates a complaint from an existing report (call this once a report needs staff handling)
    @PostMapping
    public ResponseEntity<ComplaintResponse> createFromReport(@RequestParam Long reportId,
                                                                @RequestParam(required = false) Long viewerId,
                                                                @AuthenticationPrincipal User principal) {
        Report report = reportService.getReportById(reportId);
        if (!principal.getId().equals(report.getViewerId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Report belongs to another account");
        }
        Complaint complaint = complaintService.createComplaintFromReport(reportId, principal.getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(ComplaintResponse.fromEntity(complaint));
    }

    // Step 1: officer views the incoming complaint queue
    @GetMapping("/queue")
    public ResponseEntity<List<ComplaintResponse>> getOpenComplaints() {
        List<ComplaintResponse> complaints = complaintService.getOpenComplaints().stream()
                .map(ComplaintResponse::fromEntity)
                .collect(Collectors.toList());
        return ResponseEntity.ok(complaints);
    }

    // Step 2: officer assigns/accepts a complaint
    @PostMapping("/{id}/assign")
    public ResponseEntity<ComplaintResponse> assign(@PathVariable Long id,
                                                      @Valid @RequestBody AssignComplaintRequest request,
                                                      @RequestParam(required = false) Long officerId,
                                                      @AuthenticationPrincipal User principal) {
        Long effectiveOfficerId = principal != null ? principal.getId() : (officerId != null ? officerId : (request != null ? request.getOfficerId() : 1L));
        Complaint complaint = complaintService.assignComplaint(id, effectiveOfficerId);
        return ResponseEntity.ok(ComplaintResponse.fromEntity(complaint));
    }

    // Step 3 / Extension 3a: update status and priority
    @PutMapping("/{id}/status")
    public ResponseEntity<ComplaintResponse> updateStatus(@PathVariable Long id,
                                                            @Valid @RequestBody UpdateStatusPriorityRequest request,
                                                            @RequestParam(required = false) Long officerId,
                                                            @AuthenticationPrincipal User principal) {
        Long effectiveOfficerId = principal != null ? principal.getId() : (officerId != null ? officerId : 1L);
        Complaint complaint = complaintService.updateStatusAndPriority(id, request, effectiveOfficerId);
        return ResponseEntity.ok(ComplaintResponse.fromEntity(complaint));
    }

    // Step 4-5: record resolution, triggers viewer notification
    @PostMapping("/{id}/resolve")
    public ResponseEntity<ComplaintResponse> resolve(@PathVariable Long id,
                                                       @Valid @RequestBody ResolveComplaintRequest request,
                                                       @RequestParam(required = false) Long officerId,
                                                       @AuthenticationPrincipal User principal) {
        Long effectiveOfficerId = principal != null ? principal.getId() : (officerId != null ? officerId : 1L);
        Complaint complaint = complaintService.resolveComplaint(id, request, effectiveOfficerId);
        return ResponseEntity.ok(ComplaintResponse.fromEntity(complaint));
    }

    // Step 7: close a resolved complaint
    @PostMapping("/{id}/close")
    public ResponseEntity<ComplaintResponse> close(@PathVariable Long id,
                                                   @RequestParam(required = false) Long officerId,
                                                   @AuthenticationPrincipal User principal) {
        Long effectiveOfficerId = principal != null ? principal.getId() : (officerId != null ? officerId : 1L);
        Complaint complaint = complaintService.closeComplaint(id, effectiveOfficerId);
        return ResponseEntity.ok(ComplaintResponse.fromEntity(complaint));
    }

    // Step 6: search complaints by officer or by viewer
    @GetMapping("/search")
    public ResponseEntity<List<ComplaintResponse>> search(@RequestParam(required = false) Long officerId,
                                                            @RequestParam(required = false) Long viewerId) {
        List<Complaint> results;
        if (officerId != null) {
            results = complaintService.searchByOfficer(officerId);
        } else if (viewerId != null) {
            results = complaintService.searchByViewer(viewerId);
        } else {
            results = complaintService.getOpenComplaints();
        }
        return ResponseEntity.ok(results.stream().map(ComplaintResponse::fromEntity).collect(Collectors.toList()));
    }

    // Step 6: complaint history for audit / summary purposes
    @GetMapping("/{id}/history")
    public ResponseEntity<List<ComplaintHistory>> getHistory(@PathVariable Long id) {
        return ResponseEntity.ok(complaintService.getHistory(id));
    }
}
