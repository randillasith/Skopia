package org.gp14.skopia.notification;

import org.gp14.skopia.model.user.User;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController @RequestMapping("/api")
public class AnnouncementController {
    private final AnnouncementService service;
    public AnnouncementController(AnnouncementService service){this.service=service;}
    @GetMapping("/announcements") public List<AnnouncementService.View> visible(@AuthenticationPrincipal User user){return service.visible(user);}
    @GetMapping("/admin/announcements") public List<AnnouncementService.View> admin(){return service.adminList();}
    @GetMapping("/announcements/admin") public List<AnnouncementService.View> adminAlias(){return service.adminList();}
    @PostMapping("/admin/announcements") @ResponseStatus(HttpStatus.CREATED) public AnnouncementService.View create(@AuthenticationPrincipal User user,@RequestBody AnnouncementService.Input input){return service.create(user,input);}
    @PostMapping("/announcements/admin") @ResponseStatus(HttpStatus.CREATED) public AnnouncementService.View createAlias(@AuthenticationPrincipal User user,@RequestBody AnnouncementService.Input input){return service.create(user,input);}
    @PutMapping("/admin/announcements/{id}") public AnnouncementService.View edit(@AuthenticationPrincipal User user,@PathVariable Long id,@RequestBody AnnouncementService.Input input){return service.edit(user,id,input);}
    @PutMapping("/announcements/admin/{id}") public AnnouncementService.View editAlias(@AuthenticationPrincipal User user,@PathVariable Long id,@RequestBody AnnouncementService.Input input){return service.edit(user,id,input);}
    @PostMapping("/admin/announcements/{id}/publish") public AnnouncementService.View publish(@AuthenticationPrincipal User user,@PathVariable Long id){return service.publish(user,id);}
    @PostMapping("/announcements/admin/{id}/publish") public AnnouncementService.View publishAlias(@AuthenticationPrincipal User user,@PathVariable Long id){return service.publish(user,id);}
    @PostMapping("/admin/announcements/{id}/archive") public AnnouncementService.View archive(@AuthenticationPrincipal User user,@PathVariable Long id){return service.archive(user,id);}
    @PostMapping("/announcements/admin/{id}/archive") public AnnouncementService.View archiveAlias(@AuthenticationPrincipal User user,@PathVariable Long id){return service.archive(user,id);}
}
