package org.gp14.skopia.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.gp14.skopia.model.user.*;
import org.gp14.skopia.repository.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

@Component
public class BearerTokenFilter extends OncePerRequestFilter {
    private final TokenService tokens;
    private final UserRepository users;
    private final AdministratorRepository admins;
    private final SupportOfficerRepository supportOfficers;
    private final MarketingOfficerRepository marketingOfficers;
    private final ContentCreatorRepository creators;

    public BearerTokenFilter(TokenService tokens,
                             UserRepository users,
                             AdministratorRepository admins,
                             SupportOfficerRepository supportOfficers,
                             MarketingOfficerRepository marketingOfficers,
                             ContentCreatorRepository creators) {
        this.tokens = tokens;
        this.users = users;
        this.admins = admins;
        this.supportOfficers = supportOfficers;
        this.marketingOfficers = marketingOfficers;
        this.creators = creators;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (SecurityContextHolder.getContext().getAuthentication() == null) {
            String header = request.getHeader("Authorization");
            Long id = null;
            if (header != null && header.startsWith("Bearer ")) {
                id = tokens.verifyAndGetUserId(header.substring(7));
            }
            if (id != null) {
                User user = users.findById(id).orElse(null);
                if (user != null && tokens.verifyForUser(header.substring(7), user)
                        && ("ACTIVE".equalsIgnoreCase(user.getAccountStatus()) || user.getAccountStatus() == null)) {
                    List<GrantedAuthority> authorities = new ArrayList<>();
                    authorities.add(new SimpleGrantedAuthority("ROLE_USER"));

                    if (user instanceof Administrator || admins.existsById(user.getId())) {
                        authorities.add(new SimpleGrantedAuthority("ROLE_ADMINISTRATOR"));
                        authorities.add(new SimpleGrantedAuthority("ROLE_SUPPORT_OFFICER"));
                    } else if (user instanceof SupportOfficer || supportOfficers.existsById(user.getId())) {
                        authorities.add(new SimpleGrantedAuthority("ROLE_SUPPORT_OFFICER"));
                    } else if (user instanceof MarketingOfficer || marketingOfficers.existsById(user.getId())) {
                        authorities.add(new SimpleGrantedAuthority("ROLE_MARKETING_OFFICER"));
                    } else if (user instanceof ContentCreator || creators.existsById(user.getId())) {
                        authorities.add(new SimpleGrantedAuthority("ROLE_CONTENT_CREATOR"));
                    }
                    var auth = new UsernamePasswordAuthenticationToken(user, null, authorities);
                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            }
        }
        chain.doFilter(request, response);
    }
}
