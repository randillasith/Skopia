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
                        .requestMatchers("/api/auth/me", "/api/users/me", "/api/users/me/**").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/complaints").authenticated()
                        .requestMatchers("/api/complaints/**").hasAnyRole("SUPPORT_OFFICER", "ADMINISTRATOR")
                        .requestMatchers("/api/reports/**").authenticated()
                        .requestMatchers("/api/watchlist", "/api/history", "/api/videos/watchlist", "/api/videos/history").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/videos/**", "/api/advertisements/**", "/api/ads/**", "/api/placements/**", "/uploads/**").permitAll()
                        .requestMatchers("/api/videos/**").authenticated()
                        .requestMatchers("/", "/index.html", "/assets/**", "/favicon.ico", "/error").permitAll()
                        .requestMatchers("/api/**").permitAll()
                        .anyRequest().permitAll())
                .addFilterBefore(bearerTokenFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(@Value("${skopia.cors.allowed-origins:http://localhost:5173}") String origins) {
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
