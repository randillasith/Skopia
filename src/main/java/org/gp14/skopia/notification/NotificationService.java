package org.gp14.skopia.notification;

import org.gp14.skopia.model.notification.Notification;
import org.gp14.skopia.model.user.User;

import org.gp14.skopia.model.video.Video;
import org.gp14.skopia.repository.NotificationRepository;
import org.gp14.skopia.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

@Service("platformNotificationService")
public class NotificationService {
    public record View(Long id, String type, String title, String body, LocalDateTime createdAt, LocalDateTime readAt, String link) {}
    private final NotificationRepository notifications; private final UserRepository users;
    public NotificationService(NotificationRepository notifications, UserRepository users){this.notifications=notifications;this.users=users;}
    @Transactional public Notification create(User user,String title,String body,String type,String link,String dedupeKey){
        var existing=notifications.findByUserIdOrderByCreatedAtDesc(user.getId()).stream().filter(n->dedupeKey.equals(n.getDedupeKey())).findFirst();if(existing.isPresent())return existing.get();
        Notification n=new Notification();n.setUser(user);n.setTitle(title);n.setMessage(body);n.setNotifType(type);n.setTargetUrl(link);n.setDedupeKey(dedupeKey);return notifications.save(n);
    }
    @Transactional public void notifyVideoCreated(Video video){if(video==null||video.getId()==null||!"PUBLISHED".equalsIgnoreCase(video.getVideoStatus()))return;Long creatorId=video.getCreator()==null?null:video.getCreator().getId();for(User user:users.findByAccountStatus("ACTIVE")){if(user.getId().equals(creatorId))continue;create(user,"New video: "+video.getTitle(),"A new Skopia video is available to watch.","VIDEO_CREATED","/watch/"+video.getId(),"VIDEO_CREATED:"+video.getId());}}
    @Transactional(readOnly=true) public List<View> list(Long userId){require(userId);return notifications.findByUserIdOrderByCreatedAtDesc(userId).stream().map(this::view).toList();}
    @Transactional(readOnly=true) public long unread(Long userId){require(userId);return notifications.countByUserIdAndReadAtIsNull(userId);}
    @Transactional public View markRead(Long userId,Long id){require(userId);Notification n=notifications.findByIdAndUserId(id,userId).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));if(n.getReadAt()==null){n.setReadAt(LocalDateTime.now());n.setIsRead(true);}return view(n);}
    @Transactional public void markAllRead(Long userId){require(userId);notifications.markAllRead(userId,LocalDateTime.now());}
    private User require(Long id){if(id==null)throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);return users.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.UNAUTHORIZED));}
    private View view(Notification n){return new View(n.getId(),n.getNotifType(),n.getTitle(),n.getMessage(),n.getCreatedAt(),n.getReadAt(),n.getTargetUrl());}
}
