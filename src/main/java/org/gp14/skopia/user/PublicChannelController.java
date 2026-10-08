package org.gp14.skopia.user;

import org.gp14.skopia.repository.ContentCreatorRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;

/** Public channel information only. Never serializes account entities or credentials. */
@RestController
@RequestMapping("/api/channels")
public class PublicChannelController {
    private final ContentCreatorRepository creators;

    public PublicChannelController(ContentCreatorRepository creators) {
        this.creators = creators;
    }

    public record ChannelResponse(String id, String name, String handle, String created,
                                  String about, boolean verified) {}

    @GetMapping
    public List<ChannelResponse> list() {
        return creators.findAll().stream()
                .filter(c -> "ACTIVE".equalsIgnoreCase(c.getAccountStatus()))
                .map(c -> new ChannelResponse(String.valueOf(c.getId()), c.getChannelName(),
                        c.getUsername(), c.getRegisteredDate() == null ? "" : c.getRegisteredDate().toLocalDate().toString(),
                        c.getChannelBio() == null ? "" : c.getChannelBio(), Boolean.TRUE.equals(c.getIsVerified())))
                .toList();
    }
}
