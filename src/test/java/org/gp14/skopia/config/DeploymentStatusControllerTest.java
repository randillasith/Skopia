package org.gp14.skopia.config;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class DeploymentStatusControllerTest {
    @TempDir Path directory;

    @Test void reportsOnlyTheLastVerifiedDeploymentCommit() throws Exception {
        Path marker = directory.resolve("deployed-sha");
        var controller = new DeploymentStatusController(marker.toString());
        assertThat(controller.deployedCommit().getStatusCode().value()).isEqualTo(503);
        Files.writeString(marker, "8cb917f903105a574c3709052983e881fc9ba1c1\n");
        assertThat(controller.deployedCommit().getBody()).containsEntry("deployedSha", "8cb917f903105a574c3709052983e881fc9ba1c1");
    }

    @Test void doesNotExposeMalformedFileContents() throws Exception {
        Path marker = directory.resolve("deployed-sha");
        Files.writeString(marker, "not-a-commit\n");
        assertThat(new DeploymentStatusController(marker.toString()).deployedCommit().getStatusCode().value()).isEqualTo(503);
    }
}
