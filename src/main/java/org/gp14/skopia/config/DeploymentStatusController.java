package org.gp14.skopia.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

/** Public deployment receipt. The marker is written only after the VPS deployment passes health checks. */
@RestController
public class DeploymentStatusController {
    private final Path marker;

    public DeploymentStatusController(@Value("${skopia.deployment.sha-file:/opt/skopia/.deployed-main-sha}") String marker) {
        this.marker = Path.of(marker);
    }

    @GetMapping("/api/deployment")
    public ResponseEntity<Map<String, String>> deployedCommit() {
        try {
            String sha = Files.readString(marker).trim();
            if (sha.matches("[0-9a-f]{40}")) {
                return ResponseEntity.ok(Map.of("deployedSha", sha));
            }
        } catch (IOException ignored) {
            // No deployment receipt yet (for instance during local development).
        }
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("status", "deployment unknown"));
    }
}
