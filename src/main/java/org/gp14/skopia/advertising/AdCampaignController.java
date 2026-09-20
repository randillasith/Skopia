package org.gp14.skopia.advertising;

import jakarta.validation.Valid;
import org.gp14.skopia.advertising.dto.CampaignRequest;
import org.gp14.skopia.advertising.dto.CampaignResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Campaign management (FR5 — create, schedule and assign ad campaigns).
 *
 * <p>Every endpoint identifies its caller through {@code X-User-Id}, the same
 * convention the rest of the platform's API uses, and {@link AdvertisingAccess}
 * decides whether that account may be here.
 */
@RestController
@RequestMapping("/api/ad-campaigns")
@CrossOrigin(origins = "*", maxAge = 3600)
public class AdCampaignController {

    private final AdCampaignService campaigns;

    public AdCampaignController(AdCampaignService campaigns) {
        this.campaigns = campaigns;
    }

    @GetMapping
    public List<CampaignResponse> list(
            @RequestHeader(value = AdvertisingAccess.ACTOR_HEADER, required = false) Long actorId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) CampaignStatus status) {
        return campaigns.list(actorId, search, status);
    }

    @GetMapping("/{id}")
    public CampaignResponse get(
            @RequestHeader(value = AdvertisingAccess.ACTOR_HEADER, required = false) Long actorId,
            @PathVariable Long id) {
        return campaigns.get(actorId, id);
    }

    @PostMapping
    public ResponseEntity<CampaignResponse> create(
            @RequestHeader(value = AdvertisingAccess.ACTOR_HEADER, required = false) Long actorId,
            @Valid @RequestBody CampaignRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(campaigns.create(actorId, request));
    }

    @PutMapping("/{id}")
    public CampaignResponse update(
            @RequestHeader(value = AdvertisingAccess.ACTOR_HEADER, required = false) Long actorId,
            @PathVariable Long id,
            @Valid @RequestBody CampaignRequest request) {
        return campaigns.update(actorId, id, request);
    }

    @PostMapping("/{id}/confirm")
    public CampaignResponse confirm(
            @RequestHeader(value = AdvertisingAccess.ACTOR_HEADER, required = false) Long actorId,
            @PathVariable Long id) {
        return campaigns.confirm(actorId, id);
    }

    @PostMapping("/{id}/pause")
    public CampaignResponse pause(
            @RequestHeader(value = AdvertisingAccess.ACTOR_HEADER, required = false) Long actorId,
            @PathVariable Long id) {
        return campaigns.pause(actorId, id);
    }

    @PostMapping("/{id}/resume")
    public CampaignResponse resume(
            @RequestHeader(value = AdvertisingAccess.ACTOR_HEADER, required = false) Long actorId,
            @PathVariable Long id) {
        return campaigns.resume(actorId, id);
    }

    @PostMapping("/{id}/archive")
    public CampaignResponse archive(
            @RequestHeader(value = AdvertisingAccess.ACTOR_HEADER, required = false) Long actorId,
            @PathVariable Long id) {
        return campaigns.archive(actorId, id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @RequestHeader(value = AdvertisingAccess.ACTOR_HEADER, required = false) Long actorId,
            @PathVariable Long id) {
        campaigns.delete(actorId, id);
        return ResponseEntity.noContent().build();
    }
}
