package org.gp14.skopia.user;

import org.gp14.skopia.model.user.*;
import org.gp14.skopia.repository.*;
import org.gp14.skopia.user.dto.UserResponse;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class StaffRoleService {
    private final StaffAssignmentRepository assignments;
    private final AdministratorRepository administrators;
    private final SupportOfficerRepository support;
    private final MarketingOfficerRepository marketing;
    private final ContentCreatorRepository creators;

    public StaffRoleService(StaffAssignmentRepository assignments, AdministratorRepository administrators,
                            SupportOfficerRepository support, MarketingOfficerRepository marketing,
                            ContentCreatorRepository creators) {
        this.assignments = assignments;
        this.administrators = administrators;
        this.support = support;
        this.marketing = marketing;
        this.creators = creators;
    }

    public Optional<StaffAssignment> assignment(Long userId) { return assignments.findById(userId); }

    public Optional<StaffType> staffType(Long userId) {
        var current = assignments.findById(userId);
        if (current.isPresent()) return Optional.of(current.get().getStaffType());
        if (administrators.existsById(userId)) return Optional.of(StaffType.ADMINISTRATOR);
        if (support.existsById(userId)) return Optional.of(StaffType.SUPPORT_OFFICER);
        if (marketing.existsById(userId)) return Optional.of(StaffType.MARKETING_OFFICER);
        return Optional.empty();
    }

    public boolean hasRole(Long userId, StaffType type) {
        return staffType(userId).filter(type::equals).isPresent();
    }

    public List<GrantedAuthority> authoritiesFor(User user) {
        List<GrantedAuthority> result = new ArrayList<>();
        result.add(new SimpleGrantedAuthority("ROLE_USER"));
        staffType(user.getId()).ifPresent(type -> {
            if (type == StaffType.ADMINISTRATOR) {
                result.add(new SimpleGrantedAuthority("ROLE_ADMINISTRATOR"));
                result.add(new SimpleGrantedAuthority("ROLE_SUPPORT_OFFICER"));
            } else if (type == StaffType.SUPPORT_OFFICER) {
                result.add(new SimpleGrantedAuthority("ROLE_SUPPORT_OFFICER"));
            } else if (type == StaffType.MARKETING_OFFICER) {
                result.add(new SimpleGrantedAuthority("ROLE_MARKETING_OFFICER"));
            }
        });
        if (user instanceof ContentCreator || creators.existsById(user.getId())) {
            result.add(new SimpleGrantedAuthority("ROLE_CONTENT_CREATOR"));
        }
        return result;
    }

    public UserResponse apply(UserResponse response, Long userId) {
        assignments.findById(userId).ifPresent(a -> {
            response.setStaffType(a.getStaffType().name());
            response.setDesignation(a.getDesignation());
            response.setHireDate(a.getHireDate());
            response.setAdminLevel(a.getAdminLevel() == null ? null : a.getAdminLevel().name());
            response.setSupportLevel(a.getSupportLevel() == null ? null : a.getSupportLevel().name());
            response.setShift(a.getShift() == null ? null : a.getShift().name());
            response.setOfficerCode(a.getOfficerCode());
            response.setDepartment(a.getDepartment() == null ? null : a.getDepartment().name());
        });
        if (response.getStaffType() == null) staffType(userId).ifPresent(t -> response.setStaffType(t.name()));
        return response;
    }
}
