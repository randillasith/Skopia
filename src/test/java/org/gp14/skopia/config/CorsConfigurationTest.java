package org.gp14.skopia.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The dev server's origin has to be one the API accepts.
 *
 * <p>This is only ever wrong in a browser. Every test and every curl call omits
 * the {@code Origin} header, so the API answers them happily while refusing
 * everything the UI sends — which is how the allowed origin came to sit on Vite's
 * default port while this project runs on another, and nobody could sign in.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CorsConfigurationTest {

    /** Must match the port in frontend/vite.config.ts. */
    private static final String DEV_SERVER = "http://localhost:5175";

    @Autowired MockMvc mvc;

    @Test
    @DisplayName("the dev server's origin may call the API")
    void allowsTheDevServerOrigin() throws Exception {
        mvc.perform(options("/api/auth/login")
                        .header("Origin", DEV_SERVER)
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", DEV_SERVER));
    }

    @Test
    @DisplayName("signing in from the dev server is not turned away before it is read")
    void doesNotRefuseSignInFromTheDevServer() throws Exception {
        // Bad credentials, so a 401 is the right answer. A 403 would mean CORS
        // refused it without the controller ever seeing it.
        mvc.perform(post("/api/auth/login")
                        .header("Origin", DEV_SERVER)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"identifier\":\"nobody\",\"password\":\"wrong\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("an origin nobody configured is still refused")
    void refusesAnUnknownOrigin() throws Exception {
        mvc.perform(post("/api/auth/login")
                        .header("Origin", "http://evil.invalid")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"identifier\":\"nobody\",\"password\":\"wrong\"}"))
                .andExpect(status().isForbidden());
    }
}
