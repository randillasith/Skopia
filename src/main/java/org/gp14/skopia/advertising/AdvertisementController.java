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
import org.gp14.skopia.model.user.User;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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
            @AuthenticationPrincipal User principal,
            @RequestParam Long campaignId) {
        return advertisements.listForCampaign(AdvertisingAccess.idOf(principal), campaignId);
    }

    @GetMapping("/{id}")
    public AdvertisementResponse get(
            @AuthenticationPrincipal User principal,
            @PathVariable Long id) {
        return advertisements.get(AdvertisingAccess.idOf(principal), id);
    }

    @PostMapping
    public ResponseEntity<AdvertisementResponse> create(
            @AuthenticationPrincipal User principal,
            @Valid @RequestBody AdvertisementRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(advertisements.create(AdvertisingAccess.idOf(principal), request));
    }

    @PutMapping("/{id}")
    public AdvertisementResponse update(
            @AuthenticationPrincipal User principal,
            @PathVariable Long id,
            @Valid @RequestBody AdvertisementRequest request) {
        return advertisements.update(AdvertisingAccess.idOf(principal), id, request);
    }

    @PostMapping("/{id}/activate")
    public AdvertisementResponse activate(
            @AuthenticationPrincipal User principal,
            @PathVariable Long id) {
        return advertisements.activate(AdvertisingAccess.idOf(principal), id);
    }

    @PostMapping("/{id}/deactivate")
    public AdvertisementResponse deactivate(
            @AuthenticationPrincipal User principal,
            @PathVariable Long id) {
        return advertisements.deactivate(AdvertisingAccess.idOf(principal), id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal User principal,
            @PathVariable Long id) {
        advertisements.delete(AdvertisingAccess.idOf(principal), id);
        return ResponseEntity.noContent().build();
    }

    /* ---------------------------------------------------------- targeting */

    @GetMapping("/{id}/targets")
    public List<PlacementResponse> targets(
            @AuthenticationPrincipal User principal,
            @PathVariable Long id) {
        return placements.forAdvertisement(AdvertisingAccess.idOf(principal), id);
    }

    @PostMapping("/{id}/targets")
    public ResponseEntity<PlacementResponse> attach(
            @AuthenticationPrincipal User principal,
            @PathVariable Long id,
            @Valid @RequestBody PlacementRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(placements.attach(AdvertisingAccess.idOf(principal), id, request));
    }

    /** Change a placement's slot, priority or window, keeping its delivery history. */
    @PutMapping("/targets/{placementId}")
    public PlacementResponse retarget(
            @AuthenticationPrincipal User principal,
            @PathVariable Long placementId,
            @Valid @RequestBody PlacementRequest request) {
        return placements.retarget(AdvertisingAccess.idOf(principal), placementId, request);
    }

    @DeleteMapping("/targets/{placementId}")
    public ResponseEntity<Void> detach(
            @AuthenticationPrincipal User principal,
            @PathVariable Long placementId) {
        placements.detach(AdvertisingAccess.idOf(principal), placementId);
        return ResponseEntity.noContent().build();
    }

    /** What the targeting picker offers: categories and titles, in one call. */
    @GetMapping("/target-options")
    public TargetOptionsResponse options(
            @AuthenticationPrincipal User principal,
            @RequestParam(required = false) String search) {
        return placements.options(AdvertisingAccess.idOf(principal), search);
    }

    /* ------------------------------------------------------------- media */

    @PostMapping("/media")
    public UploadedMediaResponse upload(
            @AuthenticationPrincipal User principal,
            @RequestParam("file") MultipartFile file) {
        return media.store(AdvertisingAccess.idOf(principal), file);
    }
}
