package org.gp14.skopia.advertising;

import org.gp14.skopia.advertising.dto.MetricsResponse;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;

/**
 * Performance figures for the campaign and advertisement dashboards.
 *
 * <p>The range is inclusive at both ends and defaults to the last thirty days,
 * which is the window the dashboard opens on.
 */
@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*", maxAge = 3600)
public class AdAnalyticsController {

    private final AdAnalyticsService analytics;

    public AdAnalyticsController(AdAnalyticsService analytics) {
        this.analytics = analytics;
    }

    @GetMapping("/ad-campaigns/{id}/metrics")
    public MetricsResponse campaignMetrics(
            @RequestHeader(value = AdvertisingAccess.ACTOR_HEADER, required = false) Long actorId,
            @PathVariable Long id,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return analytics.forCampaign(actorId, id, from, to);
    }

    @GetMapping("/advertisements/{id}/metrics")
    public MetricsResponse adMetrics(
            @RequestHeader(value = AdvertisingAccess.ACTOR_HEADER, required = false) Long actorId,
            @PathVariable Long id,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return analytics.forAdvertisement(actorId, id, from, to);
    }

    @GetMapping("/ad-campaigns/{id}/metrics.csv")
    public ResponseEntity<byte[]> campaignCsv(
            @RequestHeader(value = AdvertisingAccess.ACTOR_HEADER, required = false) Long actorId,
            @PathVariable Long id,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return csv(analytics.csvForCampaign(actorId, id, from, to), "campaign-" + id + "-performance.csv");
    }

    @GetMapping("/advertisements/{id}/metrics.csv")
    public ResponseEntity<byte[]> adCsv(
            @RequestHeader(value = AdvertisingAccess.ACTOR_HEADER, required = false) Long actorId,
            @PathVariable Long id,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return csv(analytics.csvForAdvertisement(actorId, id, from, to), "advertisement-" + id + "-performance.csv");
    }

    private ResponseEntity<byte[]> csv(String body, String filename) {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .body(body.getBytes(StandardCharsets.UTF_8));
    }
}
