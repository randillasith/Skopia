package org.gp14.skopia.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.gp14.skopia.model.user.*;
import org.gp14.skopia.repository.UserRepository;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class BearerTokenFilter extends OncePerRequestFilter {
    private final TokenService tokens;
    private final UserRepository users;

    public BearerTokenFilter(TokenService tokens, UserRepository users) {
        this.tokens = tokens;
        this.users = users;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ") && SecurityContextHolder.getContext().getAuthentication() == null) {
            Long id = tokens.verifyAndGetUserId(header.substring(7));
            User user = id == null ? null : users.findById(id).orElse(null);
            if (user != null && "ACTIVE".equalsIgnoreCase(user.getAccountStatus())) {
                String role;
                if (user instanceof Administrator) role = "ROLE_ADMINISTRATOR";
                else if (user instanceof SupportOfficer) role = "ROLE_SUPPORT_OFFICER";
                else if (user instanceof MarketingOfficer) role = "ROLE_MARKETING_OFFICER";
                else if (user instanceof ContentCreator) role = "ROLE_CONTENT_CREATOR";
                else role = "ROLE_USER";
                var auth = new UsernamePasswordAuthenticationToken(user, null, List.of(new SimpleGrantedAuthority(role)));
                SecurityContextHolder.getContext().setAuthentication(auth);
            }
        }
        chain.doFilter(request, response);
    }
}
