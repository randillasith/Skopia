package org.gp14.skopia.user;

import org.gp14.skopia.model.user.ContentCreator;
import org.gp14.skopia.repository.ContentCreatorRepository;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.time.LocalDateTime;
import java.util.List;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class PublicChannelControllerTest {
    @Test
    void directoryContainsOnlyActiveCreatorsAndNoPrivateAccountFields() throws Exception {
        var repository = mock(ContentCreatorRepository.class);
        var creator = new ContentCreator();
        creator.setId(7L); creator.setUsername("real-creator"); creator.setChannelName("Channel from database");
        creator.setChannelBio("Stored description"); creator.setIsVerified(true);
        creator.setRegisteredDate(LocalDateTime.of(2026, 1, 2, 3, 4));
        creator.setEmail("private@example.test"); creator.setPasswordHash("private-hash");
        var blocked = new ContentCreator(); blocked.setAccountStatus("BLOCKED");
        when(repository.findAll()).thenReturn(List.of(creator, blocked));
        MockMvcBuilders.standaloneSetup(new PublicChannelController(repository)).build()
                .perform(get("/api/channels"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value("7"))
                .andExpect(jsonPath("$[0].name").value("Channel from database"))
                .andExpect(jsonPath("$[0].verified").value(true))
                .andExpect(jsonPath("$[0].created").value("2026-01-02"))
                .andExpect(jsonPath("$[0].email").doesNotExist())
                .andExpect(jsonPath("$[0].passwordHash").doesNotExist());
    }
}
