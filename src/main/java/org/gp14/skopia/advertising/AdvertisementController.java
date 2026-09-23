package org.gp14.skopia.advertising;

import jakarta.validation.Valid;
import org.gp14.skopia.advertising.dto.AdvertisementRequest;
import org.gp14.skopia.advertising.dto.AdvertisementResponse;
import org.gp14.skopia.advertising.dto.PlacementRequest;
import org.gp14.skopia.advertising.dto.PlacementResponse;
import org.gp14.skopia.advertising.dto.TargetOptionsResponse;
import org.gp14.skopia.advertising.dto.UploadedMediaResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * Advertisements, their creative, and the targets they are assigned to.
 *
 * <p>Targeting hangs off the advertisement rather than sitting at its own top-level
 * path, because a placement has no meaning without one — {@code /advertisements/7/targets}
 * cannot be asked in a way that loses track of which creative is being placed.
 */
@RestController
@RequestMapping("/api/advertisements")
@CrossOrigin(origins = "*", maxAge = 3600)
public class AdvertisementController {

    private final AdvertisementService advertisements;
    private final AdPlacementService placements;
    private final AdMediaStorageService media;

    public AdvertisementController(AdvertisementService advertisements,
                                   AdPlacementService placements,
                                   AdMediaStorageService media) {
        this.advertisements = advertisements;
        this.placements = placements;
        this.media = media;
    }

    @GetMapping
    public List<AdvertisementResponse> list(
            @RequestHeader(value = AdvertisingAccess.ACTOR_HEADER, required = false) Long actorId,
            @RequestParam Long campaignId) {
        return advertisements.listForCampaign(actorId, campaignId);
    }

    @GetMapping("/{id}")
    public AdvertisementResponse get(
            @RequestHeader(value = AdvertisingAccess.ACTOR_HEADER, required = false) Long actorId,
            @PathVariable Long id) {
        return advertisements.get(actorId, id);
    }

    @PostMapping
    public ResponseEntity<AdvertisementResponse> create(
            @RequestHeader(value = AdvertisingAccess.ACTOR_HEADER, required = false) Long actorId,
            @Valid @RequestBody AdvertisementRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(advertisements.create(actorId, request));
    }

    @PutMapping("/{id}")
    public AdvertisementResponse update(
            @RequestHeader(value = AdvertisingAccess.ACTOR_HEADER, required = false) Long actorId,
            @PathVariable Long id,
            @Valid @RequestBody AdvertisementRequest request) {
        return advertisements.update(actorId, id, request);
    }

    @PostMapping("/{id}/activate")
    public AdvertisementResponse activate(
            @RequestHeader(value = AdvertisingAccess.ACTOR_HEADER, required = false) Long actorId,
            @PathVariable Long id) {
        return advertisements.activate(actorId, id);
    }

    @PostMapping("/{id}/deactivate")
    public AdvertisementResponse deactivate(
            @RequestHeader(value = AdvertisingAccess.ACTOR_HEADER, required = false) Long actorId,
            @PathVariable Long id) {
        return advertisements.deactivate(actorId, id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @RequestHeader(value = AdvertisingAccess.ACTOR_HEADER, required = false) Long actorId,
            @PathVariable Long id) {
        advertisements.delete(actorId, id);
        return ResponseEntity.noContent().build();
    }

    /* ---------------------------------------------------------- targeting */

    @GetMapping("/{id}/targets")
    public List<PlacementResponse> targets(
            @RequestHeader(value = AdvertisingAccess.ACTOR_HEADER, required = false) Long actorId,
            @PathVariable Long id) {
        return placements.forAdvertisement(actorId, id);
    }

    @PostMapping("/{id}/targets")
    public ResponseEntity<PlacementResponse> attach(
            @RequestHeader(value = AdvertisingAccess.ACTOR_HEADER, required = false) Long actorId,
            @PathVariable Long id,
            @Valid @RequestBody PlacementRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(placements.attach(actorId, id, request));
    }

    @DeleteMapping("/targets/{placementId}")
    public ResponseEntity<Void> detach(
            @RequestHeader(value = AdvertisingAccess.ACTOR_HEADER, required = false) Long actorId,
            @PathVariable Long placementId) {
        placements.detach(actorId, placementId);
        return ResponseEntity.noContent().build();
    }

    /** What the targeting picker offers: categories and titles, in one call. */
    @GetMapping("/target-options")
    public TargetOptionsResponse options(
            @RequestHeader(value = AdvertisingAccess.ACTOR_HEADER, required = false) Long actorId,
            @RequestParam(required = false) String search) {
        return placements.options(actorId, search);
    }

    /* ------------------------------------------------------------- media */

    @PostMapping("/media")
    public UploadedMediaResponse upload(
            @RequestHeader(value = AdvertisingAccess.ACTOR_HEADER, required = false) Long actorId,
            @RequestParam("file") MultipartFile file) {
        return media.store(actorId, file);
    }
}
