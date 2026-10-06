package org.gp14.skopia.config;

import org.gp14.skopia.security.BearerTokenFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
public class SecurityConfig {
    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, BearerTokenFilter bearerTokenFilter) throws Exception {
        return http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> {})
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(errors -> errors.authenticationEntryPoint((request, response, ex) -> response.sendError(401)))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/register", "/api/auth/login", "/api/auth/check-handle").permitAll()
                        .requestMatchers("/api/admin/**").hasRole("ADMINISTRATOR")
                        .requestMatchers("/api/billing/admin/**").hasRole("ADMINISTRATOR")
                        .requestMatchers(HttpMethod.GET, "/api/billing/plans").permitAll()
                        .requestMatchers("/api/billing/**").authenticated()
                        .requestMatchers("/api/notifications/**", "/api/announcements").authenticated()
                        .requestMatchers("/api/auth/me", "/api/users/me", "/api/users/me/**").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/complaints").authenticated()
                        .requestMatchers("/api/complaints/**").hasAnyRole("SUPPORT_OFFICER", "ADMINISTRATOR")
                        .requestMatchers("/api/reports", "/api/reports/**").authenticated()
                        .requestMatchers("/api/watchlist", "/api/history", "/api/videos/watchlist", "/api/videos/history", "/api/comments/**").authenticated()
                        // --- FR5, advertisement management ---------------------------
                        // Serving is the only advertising surface a viewer touches, and
                        // it has to work for guests or no advertisement ever runs.
                        // Everything that manages, reports on or lists inventory is
                        // staff-only: these paths used to fall through to the catch-all
                        // below, so a forged X-User-Id header was the whole of the
                        // protection on them.
                        .requestMatchers(HttpMethod.GET, "/api/ads/active", "/api/ads/click/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/ads/impressions", "/api/ads/click/**").permitAll()
                        .requestMatchers("/api/ad-campaigns/**", "/api/advertisements/**",
                                "/api/advertising/**", "/api/ads/**")
                                .hasAnyRole("MARKETING_OFFICER", "ADMINISTRATOR")

                        .requestMatchers(HttpMethod.POST, "/api/videos").hasRole("CONTENT_CREATOR")
                        .requestMatchers(HttpMethod.PUT, "/api/videos/**").hasRole("CONTENT_CREATOR")
                        .requestMatchers(HttpMethod.DELETE, "/api/videos/**").hasRole("CONTENT_CREATOR")
                        .requestMatchers(HttpMethod.GET, "/api/videos", "/api/videos/**", "/api/placements", "/api/placements/**", "/uploads/**").permitAll()
                        .requestMatchers("/api/videos", "/api/videos/**").authenticated()
                        .requestMatchers("/", "/index.html", "/assets/**", "/favicon.ico", "/error").permitAll()
                        .requestMatchers("/api/**").permitAll()
                        .anyRequest().permitAll())
                .addFilterBefore(bearerTokenFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    /**
     * Which origins the browser may call the API from.
     *
     * <p>The default has to match the port the dev server actually uses, which is
     * the one in {@code frontend/vite.config.ts}. It said 5173 — Vite's own
     * default — while this project runs on 5175, so every request the UI made was
     * refused before it reached a controller and nobody could sign in. Both are
     * listed because the port is a project choice somebody may change back.
     */
    @Bean
    CorsConfigurationSource corsConfigurationSource(
            @Value("${skopia.cors.allowed-origins:http://localhost:5175,http://localhost:5173}") String origins) {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(Arrays.stream(origins.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList());
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-User-Id"));
        config.setAllowCredentials(false);
        config.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
