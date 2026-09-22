package org.gp14.skopia.advertising;

import jakarta.validation.Valid;
import org.gp14.skopia.advertising.dto.ImpressionRequest;
import org.gp14.skopia.advertising.dto.ServedAdResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.Map;

/**
 * What the player calls. The only advertising endpoints a viewer ever reaches.
 *
 * <p>Deliberately outside {@link AdvertisingAccess}: these are hit by guests and by
 * signed-in viewers, and requiring a staff role here would mean no advertisement
 * ever ran. What they do not do is expose anything a viewer should not see — a
 * served advertisement carries its creative and a tracking link, never a campaign,
 * a budget or an advertiser's own URL.
 */
@RestController
@RequestMapping("/api/ads")
@CrossOrigin(origins = "*", maxAge = 3600)
public class AdServingController {

    private final AdServingService serving;

    public AdServingController(AdServingService serving) {
        this.serving = serving;
    }

    /**
     * Advertisements to run against one video.
     *
     * <p>Answering with an empty list is the normal case, not an error: most titles
     * have nothing booked against them at any given moment, and a 404 here would
     * make the player treat "no advertisement" as a failure to handle.
     */
    @GetMapping("/active")
    public List<ServedAdResponse> active(
            @RequestParam Long videoId,
            @RequestParam(required = false) SlotPosition slot,
            @RequestParam(required = false) Long viewerId,
            @RequestParam(required = false) String device,
            @RequestParam(required = false, defaultValue = "1") int limit) {
        return serving.serve(videoId, slot, viewerId, device, limit);
    }

    /** Log an advertisement the client rendered from a placement it already held. */
    @PostMapping("/impressions")
    public ResponseEntity<Map<String, Object>> impression(@Valid @RequestBody ImpressionRequest request) {
        var impression = serving.recordImpression(
                request.placementId(), request.videoId(), request.viewerId(), request.deviceType());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of("impressionId", impression.getId(), "shownAt", impression.getShownAt()));
    }

    /**
     * Follow a click: record it, then send the viewer on.
     *
     * <p>302 rather than a JSON body carrying the URL, so the click works as an
     * ordinary link — no JavaScript, and it survives a middle-click into a new tab,
     * which is a real way people open advertisements.
     */
    @GetMapping("/click/{impressionId}")
    public ResponseEntity<Void> click(@PathVariable Long impressionId) {
        String destination = serving.recordClick(impressionId);
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(destination)).build();
    }
}
