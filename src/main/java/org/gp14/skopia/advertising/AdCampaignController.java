package org.gp14.skopia.advertising;

import jakarta.validation.Valid;
import org.gp14.skopia.advertising.dto.CampaignRequest;
import org.gp14.skopia.advertising.dto.CampaignResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.gp14.skopia.model.user.User;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Campaign management (FR5 — create, schedule and assign ad campaigns).
 *
 * <p>The caller is the account behind the request's bearer token. The filter
 * chain refuses anyone without the marketing or administrator role before these
 * methods run; {@link AdvertisingAccess} checks again and says why.
 */
@RestController
@RequestMapping("/api/ad-campaigns")
public class AdCampaignController {

    private final AdCampaignService campaigns;
    private final AdExpiryJob expiry;

    public AdCampaignController(AdCampaignService campaigns, AdExpiryJob expiry) {
        this.campaigns = campaigns;
        this.expiry = expiry;
    }

    @GetMapping
    public List<CampaignResponse> list(
            @AuthenticationPrincipal User principal,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) CampaignStatus status) {
        return campaigns.list(AdvertisingAccess.idOf(principal), search, status);
    }

    @GetMapping("/{id}")
    public CampaignResponse get(
            @AuthenticationPrincipal User principal,
            @PathVariable Long id) {
        return campaigns.get(AdvertisingAccess.idOf(principal), id);
    }

    @PostMapping
    public ResponseEntity<CampaignResponse> create(
            @AuthenticationPrincipal User principal,
            @Valid @RequestBody CampaignRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(campaigns.create(AdvertisingAccess.idOf(principal), request));
    }

    @PutMapping("/{id}")
    public CampaignResponse update(
            @AuthenticationPrincipal User principal,
            @PathVariable Long id,
            @Valid @RequestBody CampaignRequest request) {
        return campaigns.update(AdvertisingAccess.idOf(principal), id, request);
    }

    @PostMapping("/{id}/confirm")
    public CampaignResponse confirm(
            @AuthenticationPrincipal User principal,
            @PathVariable Long id) {
        return campaigns.confirm(AdvertisingAccess.idOf(principal), id);
    }

    @PostMapping("/{id}/pause")
    public CampaignResponse pause(
            @AuthenticationPrincipal User principal,
            @PathVariable Long id) {
        return campaigns.pause(AdvertisingAccess.idOf(principal), id);
    }

    @PostMapping("/{id}/resume")
    public CampaignResponse resume(
            @AuthenticationPrincipal User principal,
            @PathVariable Long id) {
        return campaigns.resume(AdvertisingAccess.idOf(principal), id);
    }

    @PostMapping("/{id}/archive")
    public CampaignResponse archive(
            @AuthenticationPrincipal User principal,
            @PathVariable Long id) {
        return campaigns.archive(AdvertisingAccess.idOf(principal), id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal User principal,
            @PathVariable Long id) {
        campaigns.delete(AdvertisingAccess.idOf(principal), id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Run the expiry sweep now.
     *
     * <p>The campaign list offers this behind its "review expired" banner so an
     * officer who has just moved an end date sees the list settle immediately
     * rather than at the next cron tick.
     */
    @PostMapping("/sweep-expired")
    public Map<String, Object> sweep(
            @AuthenticationPrincipal User principal) {
        campaigns.list(AdvertisingAccess.idOf(principal), null, null); // access check, and it is cheap
        return Map.of("updated", expiry.run());
    }
}
