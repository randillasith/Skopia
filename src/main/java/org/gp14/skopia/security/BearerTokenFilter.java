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
    private final org.gp14.skopia.user.StaffRoleService staffRoles;

    public BearerTokenFilter(TokenService tokens,
                             UserRepository users,
                             org.gp14.skopia.user.StaffRoleService staffRoles) {
        this.tokens = tokens;
        this.users = users;
        this.staffRoles = staffRoles;
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
                    List<GrantedAuthority> authorities = staffRoles.authoritiesFor(user);
                    var auth = new UsernamePasswordAuthenticationToken(user, null, authorities);
                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            }
        }
        chain.doFilter(request, response);
    }
}
