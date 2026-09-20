package org.gp14.skopia.video;

import org.gp14.skopia.model.interaction.*;
import org.gp14.skopia.model.user.ContentCreator;
import org.gp14.skopia.model.user.RegisteredViewer;
import org.gp14.skopia.model.user.User;
import org.gp14.skopia.model.video.AccessTier;
import org.gp14.skopia.model.video.Category;
import org.gp14.skopia.model.video.Video;
import org.gp14.skopia.repository.*;
import org.gp14.skopia.video.dto.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional
public class VideoService {

    private static final Path UPLOAD_DIR = Paths.get("uploads");

    private final VideoRepository videoRepository;
    private final CategoryRepository categoryRepository;
    private final AccessTierRepository accessTierRepository;
    private final ContentCreatorRepository contentCreatorRepository;
    private final UserRepository userRepository;
    private final RegisteredViewerRepository registeredViewerRepository;
    private final VideoLikeRepository videoLikeRepository;
    private final CommentRepository commentRepository;
    private final WatchHistoryRepository watchHistoryRepository;
    private final WatchlistRepository watchlistRepository;
    private final WatchlistItemRepository watchlistItemRepository;

    public VideoService(
            VideoRepository videoRepository,
            CategoryRepository categoryRepository,
            AccessTierRepository accessTierRepository,
            ContentCreatorRepository contentCreatorRepository,
            UserRepository userRepository,
            RegisteredViewerRepository registeredViewerRepository,
            VideoLikeRepository videoLikeRepository,
            CommentRepository commentRepository,
            WatchHistoryRepository watchHistoryRepository,
            WatchlistRepository watchlistRepository,
            WatchlistItemRepository watchlistItemRepository) {
        this.videoRepository = videoRepository;
        this.categoryRepository = categoryRepository;
        this.accessTierRepository = accessTierRepository;
        this.contentCreatorRepository = contentCreatorRepository;
        this.userRepository = userRepository;
        this.registeredViewerRepository = registeredViewerRepository;
        this.videoLikeRepository = videoLikeRepository;
        this.commentRepository = commentRepository;
        this.watchHistoryRepository = watchHistoryRepository;
        this.watchlistRepository = watchlistRepository;
        this.watchlistItemRepository = watchlistItemRepository;
    }

    public List<CategoryResponse> getCategories() {
        List<Category> categories = categoryRepository.findAll();
        if (categories.isEmpty()) {
            List<String> defaultCategories = List.of(
                    "Tech & Coding", "Gaming", "Music", "Entertainment", "Education", "News & Documentaries"
            );
            for (String catName : defaultCategories) {
                Category cat = new Category();
                cat.setCategoryName(catName);
                cat.setCategoryDesc(catName + " videos");
                categoryRepository.save(cat);
            }
            categories = categoryRepository.findAll();
        }

        return categories.stream()
                .map(c -> new CategoryResponse(c.getId(), c.getCategoryName()))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<VideoResponse> getVideos(String search, Long categoryId, String access, String scope, Long creatorId, Long viewerId) {
        Long filterCreatorId = "mine".equalsIgnoreCase(scope) ? creatorId : null;
        String filterStatus = filterCreatorId == null ? "PUBLISHED" : null;

        List<Video> videos = videoRepository.searchVideos(
                (search != null && !search.isBlank()) ? search.trim() : null,
                categoryId,
                (access != null && (access.equalsIgnoreCase("FREE") || access.equalsIgnoreCase("PREMIUM"))) ? access : null,
                filterCreatorId,
                filterStatus
        );

        return videos.stream()
                .map(v -> mapToVideoResponse(v, viewerId))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public VideoResponse getVideoById(Long videoId, Long viewerId) {
        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new IllegalArgumentException("Video not found"));
        return mapToVideoResponse(video, viewerId);
    }

    public VideoResponse createVideo(CreateVideoRequest request, MultipartFile videoFile, MultipartFile thumbnailFile, Long creatorId) {
        ContentCreator creator = getOrCreateCreator(creatorId);

        Long catId = request.getCategoryId() != null ? request.getCategoryId() : 1L;
        Category category = categoryRepository.findById(catId)
                .orElseGet(() -> {
                    List<Category> categories = categoryRepository.findAll();
                    if (!categories.isEmpty()) return categories.get(0);
                    Category newCat = new Category();
                    newCat.setCategoryName("General");
                    return categoryRepository.save(newCat);
                });

        String requestedTier = request.getAccessType() != null ? request.getAccessType() : "FREE";
        AccessTier tier = accessTierRepository.findByTierNameIgnoreCase(requestedTier)
                .orElseGet(() -> {
                    AccessTier newTier = new AccessTier();
                    newTier.setTierName(requestedTier.toUpperCase());
                    return accessTierRepository.save(newTier);
                });

        String finalVideoUrl = request.getVideoUrl();
        if (videoFile != null && !videoFile.isEmpty()) {
            finalVideoUrl = saveUploadedFile(videoFile, true);
        }
        if (finalVideoUrl == null || finalVideoUrl.isBlank()) {
            throw new IllegalArgumentException("Video file or URL is required");
        }

        String finalThumbnailUrl = request.getThumbnailUrl();
        if (thumbnailFile != null && !thumbnailFile.isEmpty()) {
            finalThumbnailUrl = saveUploadedFile(thumbnailFile, false);
        }
        if (finalThumbnailUrl == null || finalThumbnailUrl.isBlank()) {
            throw new IllegalArgumentException("Thumbnail file or URL is required");
        }

        Video video = new Video();
        video.setCreator(creator);
        video.setCategory(category);
        video.setAccessTier(tier);
        video.setTitle(request.getTitle() != null ? request.getTitle().trim() : "Untitled Video");
        video.setDescription(request.getDescription() != null ? request.getDescription().trim() : "");
        video.setDuration(request.getDurationSeconds() != null ? request.getDurationSeconds() : 0);
        video.setVideoStatus(request.getStatus() != null ? request.getStatus().toUpperCase() : "PUBLISHED");
        video.setVideoUrl(finalVideoUrl);
        video.setThumbnailUrl(finalThumbnailUrl);
        video.setViewCount(0L);

        Video saved = videoRepository.save(video);
        try {
            creator.setTotalUploads((creator.getTotalUploads() != null ? creator.getTotalUploads() : 0) + 1);
            contentCreatorRepository.save(creator);
        } catch (Exception ignored) {}

        return mapToVideoResponse(saved, creatorId);
    }

    public VideoResponse updateVideo(Long videoId, UpdateVideoRequest request, Long creatorId) {
        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new IllegalArgumentException("Video not found"));

        if (request.getTitle() != null && !request.getTitle().isBlank()) {
            video.setTitle(request.getTitle().trim());
        }
        if (request.getDescription() != null) {
            video.setDescription(request.getDescription().trim());
        }
        if (request.getCategoryId() != null) {
            categoryRepository.findById(request.getCategoryId()).ifPresent(video::setCategory);
        }
        if (request.getAccessType() != null && !request.getAccessType().isBlank()) {
            accessTierRepository.findByTierNameIgnoreCase(request.getAccessType())
                    .ifPresent(video::setAccessTier);
        }
        if (request.getStatus() != null && !request.getStatus().isBlank()) {
            video.setVideoStatus(request.getStatus().toUpperCase());
        }
        if (request.getVideoUrl() != null && !request.getVideoUrl().isBlank()) {
            video.setVideoUrl(request.getVideoUrl().trim());
        }
        if (request.getThumbnailUrl() != null && !request.getThumbnailUrl().isBlank()) {
            video.setThumbnailUrl(request.getThumbnailUrl().trim());
        }

        Video updated = videoRepository.save(video);
        return mapToVideoResponse(updated, creatorId);
    }

    public boolean deleteVideo(Long videoId, Long creatorId) {
        Optional<Video> videoOpt = videoRepository.findById(videoId);
        if (videoOpt.isPresent()) {
            videoRepository.delete(videoOpt.get());
            return true;
        }
        return false;
    }

    public Map<String, Object> toggleLike(Long videoId, Long userId) {
        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new IllegalArgumentException("Video not found"));
        User user = getOrCreateUser(userId);

        VideoLikeId likeId = new VideoLikeId(user.getId(), video.getId());
        boolean active;
        if (videoLikeRepository.existsById(likeId)) {
            videoLikeRepository.deleteById(likeId);
            active = false;
        } else {
            VideoLike like = new VideoLike();
            like.setId(likeId);
            like.setUser(user);
            like.setVideo(video);
            videoLikeRepository.save(like);
            active = true;
        }

        long count = videoLikeRepository.countByIdVideoId(videoId);
        Map<String, Object> response = new HashMap<>();
        response.put("active", active);
        response.put("count", count);
        return response;
    }

    public Map<String, Object> toggleSaved(Long videoId, Long viewerId) {
        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new IllegalArgumentException("Video not found"));

        RegisteredViewer viewer = getOrCreateViewer(viewerId);
        Watchlist watchlist = watchlistRepository.findFirstByViewerId(viewer.getId())
                .orElseGet(() -> {
                    Watchlist wl = new Watchlist();
                    wl.setViewer(viewer);
                    wl.setListName("My Watchlist");
                    return watchlistRepository.save(wl);
                });

        WatchlistItemId itemId = new WatchlistItemId(watchlist.getId(), video.getId());
        boolean active;
        if (watchlistItemRepository.existsById(itemId)) {
            watchlistItemRepository.deleteById(itemId);
            active = false;
        } else {
            WatchlistItem item = new WatchlistItem();
            item.setId(itemId);
            item.setWatchlist(watchlist);
            item.setVideo(video);
            watchlistItemRepository.save(item);
            active = true;
        }

        Map<String, Object> response = new HashMap<>();
        response.put("active", active);
        return response;
    }

    public void incrementViewCount(Long videoId) {
        videoRepository.findById(videoId).ifPresent(v -> {
            v.setViewCount((v.getViewCount() != null ? v.getViewCount() : 0L) + 1);
            videoRepository.save(v);
        });
    }

    public void saveProgress(Long videoId, Long viewerId, Integer position, Boolean completed) {
        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new IllegalArgumentException("Video not found"));
        RegisteredViewer viewer = getOrCreateViewer(viewerId);

        WatchHistoryId id = new WatchHistoryId(viewer.getId(), video.getId());
        WatchHistory history = watchHistoryRepository.findById(id)
                .orElseGet(() -> {
                    WatchHistory h = new WatchHistory();
                    h.setId(id);
                    h.setViewer(viewer);
                    h.setVideo(video);
                    return h;
                });

        history.setLastPosition(position != null ? Math.max(0, position) : 0);
        history.setIsCompleted(Boolean.TRUE.equals(completed));
        history.setWatchedDatetime(LocalDateTime.now());
        watchHistoryRepository.save(history);
    }

    @Transactional(readOnly = true)
    public List<CommentResponse> getComments(Long videoId) {
        return commentRepository.findByVideoIdAndCommentStatusOrderByPostedDatetimeDesc(videoId, "VISIBLE").stream()
                .map(c -> {
                    Long commentUserId = null;
                    String displayName = "Viewer";
                    try {
                        if (c.getViewer() != null) {
                            commentUserId = c.getViewer().getId();
                            displayName = c.getViewer().getDisplayName() != null ? c.getViewer().getDisplayName() : c.getViewer().getUsername();
                        }
                    } catch (Exception ignored) {}

                    Long parentId = null;
                    try {
                        if (c.getParentComment() != null) {
                            parentId = c.getParentComment().getId();
                        }
                    } catch (Exception ignored) {}

                    return CommentResponse.builder()
                            .id(c.getId())
                            .text(c.getCommentText())
                            .postedAt(c.getPostedDatetime() != null ? c.getPostedDatetime().toInstant(ZoneOffset.UTC).toString() : "")
                            .parentId(parentId)
                            .userId(commentUserId)
                            .displayName(displayName != null ? displayName : "Viewer")
                            .avatarUrl("https://i.pravatar.cc/160?img=33")
                            .build();
                })
                .collect(Collectors.toList());
    }

    public CommentResponse addComment(Long videoId, Long viewerId, CreateCommentRequest request) {
        if (request.getText() == null || request.getText().isBlank()) {
            throw new IllegalArgumentException("Comment text is required");
        }
        String text = request.getText().trim();
        if (text.length() > 1000) {
            throw new IllegalArgumentException("Comment must be 1000 characters or fewer");
        }

        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new IllegalArgumentException("Video not found"));
        RegisteredViewer viewer = getOrCreateViewer(viewerId);

        Comment comment = new Comment();
        comment.setVideo(video);
        comment.setViewer(viewer);
        comment.setCommentText(text);
        comment.setCommentStatus("VISIBLE");

        if (request.getParentId() != null) {
            commentRepository.findById(request.getParentId()).ifPresent(comment::setParentComment);
        }

        Comment saved = commentRepository.save(comment);

        return CommentResponse.builder()
                .id(saved.getId())
                .text(saved.getCommentText())
                .postedAt(saved.getPostedDatetime() != null ? saved.getPostedDatetime().toInstant(ZoneOffset.UTC).toString() : LocalDateTime.now().toInstant(ZoneOffset.UTC).toString())
                .parentId(saved.getParentComment() != null ? saved.getParentComment().getId() : null)
                .userId(viewer.getId())
                .displayName(viewer.getDisplayName() != null ? viewer.getDisplayName() : viewer.getUsername())
                .avatarUrl("https://i.pravatar.cc/160?img=33")
                .build();
    }

    public boolean deleteComment(Long commentId, Long viewerId) {
        Optional<Comment> commentOpt = commentRepository.findById(commentId);
        if (commentOpt.isPresent()) {
            Comment comment = commentOpt.get();
            try {
                if (comment.getViewer() != null && comment.getViewer().getId().equals(viewerId)) {
                    comment.setCommentStatus("DELETED");
                    comment.setCommentText("");
                    commentRepository.save(comment);
                    return true;
                }
            } catch (Exception e) {
                comment.setCommentStatus("DELETED");
                commentRepository.save(comment);
                return true;
            }
        }
        return false;
    }

    @Transactional(readOnly = true)
    public List<WatchHistoryResponse> getHistory(Long viewerId) {
        return watchHistoryRepository.findByIdViewerIdOrderByWatchedDatetimeDesc(viewerId).stream()
                .map(h -> {
                    Video v = h.getVideo();
                    String catName = "General";
                    try {
                        if (v.getCategory() != null) {
                            catName = v.getCategory().getCategoryName();
                        }
                    } catch (Exception ignored) {}

                    return WatchHistoryResponse.builder()
                            .id(v != null ? v.getId() : null)
                            .title(v != null ? v.getTitle() : "Video")
                            .thumbnailUrl(v != null ? v.getThumbnailUrl() : "")
                            .durationSeconds(v != null ? v.getDuration() : 0)
                            .viewCount(v != null ? v.getViewCount() : 0L)
                            .lastPosition(h.getLastPosition())
                            .completed(h.getIsCompleted())
                            .watchedAt(h.getWatchedDatetime() != null ? h.getWatchedDatetime().toInstant(ZoneOffset.UTC).toString() : "")
                            .category(catName)
                            .build();
                })
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<WatchlistResponse> getWatchlist(Long viewerId) {
        Optional<Watchlist> watchlistOpt = watchlistRepository.findFirstByViewerId(viewerId);
        if (watchlistOpt.isEmpty()) {
            return Collections.emptyList();
        }

        return watchlistItemRepository.findByIdWatchlistIdOrderByAddedDateDesc(watchlistOpt.get().getId()).stream()
                .map(item -> {
                    Video v = item.getVideo();
                    String catName = "General";
                    try {
                        if (v.getCategory() != null) {
                            catName = v.getCategory().getCategoryName();
                        }
                    } catch (Exception ignored) {}

                    return WatchlistResponse.builder()
                            .id(v != null ? v.getId() : null)
                            .title(v != null ? v.getTitle() : "Video")
                            .thumbnailUrl(v != null ? v.getThumbnailUrl() : "")
                            .durationSeconds(v != null ? v.getDuration() : 0)
                            .viewCount(v != null ? v.getViewCount() : 0L)
                            .category(catName)
                            .addedAt(item.getAddedDate() != null ? item.getAddedDate().toInstant(ZoneOffset.UTC).toString() : "")
                            .build();
                })
                .collect(Collectors.toList());
    }

    private VideoResponse mapToVideoResponse(Video v, Long viewerId) {
        long likeCount = 0L;
        try {
            likeCount = videoLikeRepository.countByIdVideoId(v.getId());
        } catch (Exception ignored) {}

        boolean liked = false;
        boolean saved = false;
        int lastPosition = 0;

        if (viewerId != null) {
            try {
                liked = videoLikeRepository.existsById(new VideoLikeId(viewerId, v.getId()));
            } catch (Exception ignored) {}

            try {
                Optional<Watchlist> wlOpt = watchlistRepository.findFirstByViewerId(viewerId);
                if (wlOpt.isPresent()) {
                    saved = watchlistItemRepository.existsById(new WatchlistItemId(wlOpt.get().getId(), v.getId()));
                }
            } catch (Exception ignored) {}

            try {
                Optional<WatchHistory> historyOpt = watchHistoryRepository.findById(new WatchHistoryId(viewerId, v.getId()));
                if (historyOpt.isPresent()) {
                    lastPosition = historyOpt.get().getLastPosition() != null ? historyOpt.get().getLastPosition() : 0;
                }
            } catch (Exception ignored) {}
        }

        Long creatorId = null;
        String creatorName = "Creator";
        try {
            ContentCreator creator = v.getCreator();
            if (creator != null) {
                creatorId = creator.getId();
                if (creator.getChannelName() != null && !creator.getChannelName().isBlank()) {
                    creatorName = creator.getChannelName();
                } else if (creator.getUsername() != null) {
                    creatorName = creator.getUsername();
                }
            }
        } catch (Exception ignored) {}

        Long categoryId = null;
        String categoryName = "General";
        try {
            if (v.getCategory() != null) {
                categoryId = v.getCategory().getId();
                categoryName = v.getCategory().getCategoryName() != null ? v.getCategory().getCategoryName() : "General";
            }
        } catch (Exception ignored) {}

        String accessType = "FREE";
        try {
            if (v.getAccessTier() != null && v.getAccessTier().getTierName() != null) {
                accessType = v.getAccessTier().getTierName();
            }
        } catch (Exception ignored) {}

        return VideoResponse.builder()
                .id(v.getId())
                .title(v.getTitle())
                .description(v.getDescription())
                .videoUrl(v.getVideoUrl())
                .thumbnailUrl(v.getThumbnailUrl())
                .durationSeconds(v.getDuration() != null ? v.getDuration() : 0)
                .viewCount(v.getViewCount() != null ? v.getViewCount() : 0L)
                .accessType(accessType)
                .status(v.getVideoStatus() != null ? v.getVideoStatus() : "PUBLISHED")
                .uploadedAt(v.getUploadDate() != null ? v.getUploadDate().toInstant(ZoneOffset.UTC).toString() : "")
                .categoryId(categoryId)
                .category(categoryName)
                .creatorId(creatorId)
                .creatorName(creatorName)
                .creatorAvatar("https://i.pravatar.cc/160?img=12")
                .likeCount(likeCount)
                .liked(liked)
                .saved(saved)
                .lastPosition(lastPosition)
                .build();
    }

    private ContentCreator getOrCreateCreator(Long creatorId) {
        return contentCreatorRepository.findById(creatorId)
                .orElseGet(() -> {
                    List<ContentCreator> creators = contentCreatorRepository.findAll();
                    if (!creators.isEmpty()) return creators.get(0);
                    ContentCreator newCreator = new ContentCreator();
                    newCreator.setUsername("creator_" + System.currentTimeMillis());
                    newCreator.setEmail("creator" + System.currentTimeMillis() + "@skopia.com");
                    newCreator.setPasswordHash("password");
                    newCreator.setChannelName("Skopia Creator");
                    newCreator.setIsVerified(true);
                    return contentCreatorRepository.save(newCreator);
                });
    }

    private RegisteredViewer getOrCreateViewer(Long viewerId) {
        return registeredViewerRepository.findById(viewerId)
                .orElseGet(() -> {
                    List<RegisteredViewer> viewers = registeredViewerRepository.findAll();
                    if (!viewers.isEmpty()) return viewers.get(0);
                    RegisteredViewer viewer = new RegisteredViewer();
                    viewer.setUsername("viewer_" + System.currentTimeMillis());
                    viewer.setEmail("viewer" + System.currentTimeMillis() + "@skopia.com");
                    viewer.setPasswordHash("password");
                    viewer.setDisplayName("Nethmi");
                    return registeredViewerRepository.save(viewer);
                });
    }

    private User getOrCreateUser(Long userId) {
        return userRepository.findById(userId)
                .orElseGet(() -> {
                    List<User> users = userRepository.findAll();
                    if (!users.isEmpty()) return users.get(0);
                    User user = new User();
                    user.setUsername("user_" + System.currentTimeMillis());
                    user.setEmail("user" + System.currentTimeMillis() + "@skopia.com");
                    user.setPasswordHash("password");
                    return userRepository.save(user);
                });
    }

    private String saveUploadedFile(MultipartFile file, boolean isVideo) {
        try {
            Files.createDirectories(UPLOAD_DIR);
            String originalFilename = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase() : "";
            String[] allowed = isVideo ? new String[]{".mp4", ".webm", ".ogg", ".mov"} : new String[]{".jpg", ".jpeg", ".png", ".webp"};

            String extension = "";
            for (String ext : allowed) {
                if (originalFilename.endsWith(ext)) {
                    extension = ext;
                    break;
                }
            }
            if (extension.isEmpty()) {
                extension = isVideo ? ".mp4" : ".jpg";
            }

            String fileName = UUID.randomUUID().toString() + extension;
            Path targetPath = UPLOAD_DIR.resolve(fileName);
            Files.copy(file.getInputStream(), targetPath);
            return "/uploads/" + fileName;
        } catch (IOException e) {
            throw new RuntimeException("Failed to save uploaded file", e);
        }
    }
}
