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
import org.gp14.skopia.billing.BillingService;
import org.springframework.stereotype.Service;
import org.gp14.skopia.security.TokenService;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
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

    private final VideoAccessService access;
    private final TokenService tokens;
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
    private final BillingService billing;

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
            WatchlistItemRepository watchlistItemRepository, VideoAccessService access, TokenService tokens, BillingService billing) {
        this.access = access;
        this.tokens = tokens;
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
        this.billing = billing;
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
                .filter(v -> this.access.canSee(v, viewerId))
                .map(v -> {
                    VideoResponse result = mapToVideoResponse(v, viewerId);
                    if (!this.access.isPublished(v) || (v.getAccessTier() != null && "PREMIUM".equalsIgnoreCase(v.getAccessTier().getTierName())))
                        result.setVideoUrl(null);
                    return result;
                })
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public VideoResponse getVideoById(Long videoId, Long viewerId) {
        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new IllegalArgumentException("Video not found"));
        access.requireVisible(video, viewerId);
        return mapToVideoResponse(video, viewerId);
    }

    public VideoResponse createVideo(CreateVideoRequest request, MultipartFile videoFile, MultipartFile thumbnailFile, Long creatorId) {
        if (creatorId == null) throw new AccessDeniedException("Authentication required");
        ContentCreator creator = contentCreatorRepository.findById(creatorId)
                .orElseThrow(() -> new AccessDeniedException("Creator account required"));

        Long catId = request.getCategoryId() != null ? request.getCategoryId() : 1L;
        Category category = categoryRepository.findById(catId)
                .orElseGet(() -> {
                    List<Category> categories = categoryRepository.findAll();
                    if (!categories.isEmpty()) return categories.get(0);
                    Category newCat = new Category();
                    newCat.setCategoryName("General");
                    return categoryRepository.save(newCat);
                });

        String requestedTier = normalizedTier(request.getAccessType());
        requirePremiumPass(requestedTier, creatorId);
        AccessTier tier = resolveTier(requestedTier);

        String finalVideoUrl = checkedExternalUrl(request.getVideoUrl());
        if (videoFile != null && !videoFile.isEmpty()) {
            finalVideoUrl = saveUploadedFile(videoFile, true);
        }
        if (finalVideoUrl == null || finalVideoUrl.isBlank()) {
            throw new IllegalArgumentException("Video file or URL is required");
        }

        String finalThumbnailUrl = checkedExternalUrl(request.getThumbnailUrl());
        if (thumbnailFile != null && !thumbnailFile.isEmpty()) {
            finalThumbnailUrl = saveUploadedFile(thumbnailFile, false);
        }
        if (finalThumbnailUrl == null || finalThumbnailUrl.isBlank()) {
            finalThumbnailUrl = "/uploads/default-thumbnail.jpg";
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
        requireCreatorOwnership(video, creatorId);

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
            String requestedTier = normalizedTier(request.getAccessType());
            requirePremiumPass(requestedTier, creatorId);
            video.setAccessTier(resolveTier(requestedTier));
        }
        if (request.getStatus() != null && !request.getStatus().isBlank()) {
            video.setVideoStatus(request.getStatus().toUpperCase());
        }
        if (request.getVideoUrl() != null && !request.getVideoUrl().isBlank()) {
            video.setVideoUrl(checkedExternalUrl(request.getVideoUrl()));
        }
        if (request.getThumbnailUrl() != null && !request.getThumbnailUrl().isBlank()) {
            video.setThumbnailUrl(checkedExternalUrl(request.getThumbnailUrl()));
        }

        Video updated = videoRepository.save(video);
        return mapToVideoResponse(updated, creatorId);
    }

    public VideoResponse moderateVideoStatus(Long videoId, String status, Long viewerId) {
        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new IllegalArgumentException("Video not found"));
        video.setVideoStatus(status.toUpperCase());
        return mapToVideoResponse(videoRepository.save(video), viewerId);
    }

    @Transactional(readOnly = true)
    public ContentCreator getVideoCreator(Long videoId) {
        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new IllegalArgumentException("Video not found"));
        if (video.getCreator() == null) {
            throw new IllegalStateException("Video has no creator");
        }
        return video.getCreator();
    }

    public boolean deleteVideo(Long videoId, Long creatorId) {
        Optional<Video> videoOpt = videoRepository.findById(videoId);
        if (videoOpt.isPresent()) {
            requireCreatorOwnership(videoOpt.get(), creatorId);
            videoRepository.delete(videoOpt.get());
            return true;
        }
        return false;
    }

    public Map<String, Object> toggleLike(Long videoId, Long userId) {
        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new IllegalArgumentException("Video not found"));
        access.requireVisible(video, userId);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AccessDeniedException("Authentication required"));

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

        access.requireVisible(video, viewerId);
        RegisteredViewer viewer = registeredViewerRepository.findById(viewerId)
                .orElseThrow(() -> new AccessDeniedException("Viewer account required"));
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

    public void incrementViewCount(Long videoId, Long viewerId) {
        videoRepository.findById(videoId).ifPresent(v -> {
            access.requirePlayback(v, viewerId);
            v.setViewCount((v.getViewCount() != null ? v.getViewCount() : 0L) + 1);
            videoRepository.save(v);
        });
    }

    public void saveProgress(Long videoId, Long viewerId, Integer position, Boolean completed) {
        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new IllegalArgumentException("Video not found"));
        access.requireVisible(video, viewerId);
        access.requirePlayback(video, viewerId);
        RegisteredViewer viewer = registeredViewerRepository.findById(viewerId)
                .orElseThrow(() -> new AccessDeniedException("Viewer account required"));

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
    public List<CommentResponse> getComments(Long videoId, Long viewerId) {
        Video video = videoRepository.findById(videoId).orElseThrow(() -> new IllegalArgumentException("Video not found"));
        access.requireVisible(video, viewerId);
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

                    Boolean isPrem = false;
                    try {
                        if (c.getViewer() != null && c.getViewer().getIsPremium() != null) {
                            isPrem = c.getViewer().getIsPremium();
                        }
                    } catch (Exception ignored) {}

                    return CommentResponse.builder()
                            .id(c.getId())
                            .text(c.getCommentText())
                            .postedAt(c.getPostedDatetime() != null ? c.getPostedDatetime().toInstant(ZoneOffset.UTC).toString() : "")
                            .parentId(parentId)
                            .userId(commentUserId)
                            .displayName(displayName != null ? displayName : "Viewer")
                            .avatarUrl("https://i.pravatar.cc/160?img=" + (Math.abs((c.getId() != null ? c.getId().hashCode() : 1) % 50) + 1))
                            .badge(isPrem ? "Music Pass" : null)
                            .likeCount(0)
                            .isPinned(false)
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
        access.requireVisible(video, viewerId);
        RegisteredViewer viewer = registeredViewerRepository.findById(viewerId)
                .orElseThrow(() -> new AccessDeniedException("Viewer account required"));

        Comment comment = new Comment();
        comment.setVideo(video);
        comment.setViewer(viewer);
        comment.setCommentText(text);
        comment.setCommentStatus("VISIBLE");

        if (request.getParentId() != null) {
            Comment parent = commentRepository.findById(request.getParentId())
                    .orElseThrow(() -> new IllegalArgumentException("Parent comment not found"));
            if (!"VISIBLE".equals(parent.getCommentStatus()) || parent.getVideo() == null
                    || !videoId.equals(parent.getVideo().getId()))
                throw new IllegalArgumentException("Parent comment must be visible on this video");
            comment.setParentComment(parent);
        }

        Comment saved = commentRepository.save(comment);

        String author = viewer.getDisplayName() != null ? viewer.getDisplayName() : viewer.getUsername();
        String avatar = "https://i.pravatar.cc/160?img=" + (Math.abs((saved.getId() != null ? saved.getId().hashCode() : 1) % 50) + 1);

        return CommentResponse.builder()
                .id(saved.getId())
                .text(saved.getCommentText())
                .postedAt(saved.getPostedDatetime() != null ? saved.getPostedDatetime().toInstant(ZoneOffset.UTC).toString() : LocalDateTime.now().toInstant(ZoneOffset.UTC).toString())
                .parentId(saved.getParentComment() != null ? saved.getParentComment().getId() : null)
                .userId(viewer.getId())
                .displayName(author)
                .avatarUrl(avatar)
                .badge(viewer.getIsPremium() ? "Music Pass" : null)
                .likeCount(0)
                .isPinned(false)
                .build();
    }

    public CommentResponse editComment(Long commentId, Long viewerId, CreateCommentRequest request) {
        Comment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        requireCommentOwner(comment, viewerId);
        if (comment.getVideo() == null) throw new AccessDeniedException("Video is not available");
        access.requireVisible(comment.getVideo(), viewerId);
        if (request == null || request.getText() == null || request.getText().isBlank()
                || request.getText().trim().length() > 1000)
            throw new IllegalArgumentException("Comment must contain 1 to 1000 characters");
        comment.setCommentText(request.getText().trim());
        commentRepository.save(comment);
        return CommentResponse.builder().id(comment.getId()).text(comment.getCommentText())
                .parentId(comment.getParentComment() == null ? null : comment.getParentComment().getId())
                .userId(viewerId)
                .displayName(comment.getViewer().getDisplayName() != null ? comment.getViewer().getDisplayName() : comment.getViewer().getUsername())
                .postedAt(comment.getPostedDatetime() == null ? "" : comment.getPostedDatetime().toInstant(ZoneOffset.UTC).toString())
                .avatarUrl("https://i.pravatar.cc/160?img=" + (Math.abs(commentId.hashCode() % 50) + 1))
                .badge(Boolean.TRUE.equals(comment.getViewer().getIsPremium()) ? "Music Pass" : null)
                .likeCount(0).isPinned(false).build();
    }

    public boolean deleteComment(Long commentId, Long viewerId) {
        Optional<Comment> commentOpt = commentRepository.findById(commentId);
        if (commentOpt.isEmpty()) return false;
        Comment comment = commentOpt.get();
        requireCommentOwner(comment, viewerId);
        if (comment.getVideo() == null) throw new AccessDeniedException("Video is not available");
        access.requireVisible(comment.getVideo(), viewerId);
        comment.setCommentStatus("DELETED");
        comment.setCommentText("");
        commentRepository.save(comment);
        return true;
    }

    private void requireCommentOwner(Comment comment, Long viewerId) {
        if (viewerId == null || comment.getViewer() == null || !viewerId.equals(comment.getViewer().getId())
                || !"VISIBLE".equals(comment.getCommentStatus()))
            throw new AccessDeniedException("Only the comment author can change a visible comment");
    }

    private void requireCreatorOwnership(Video video, Long creatorId) {
        Long ownerId = video.getCreator() == null ? null : video.getCreator().getId();
        if (creatorId == null || !creatorId.equals(ownerId)) {
            throw new AccessDeniedException("Only the video's creator can change it");
        }
    }

    @Transactional(readOnly = true)
    public List<WatchHistoryResponse> getHistory(Long viewerId) {
        return watchHistoryRepository.findByIdViewerIdOrderByWatchedDatetimeDesc(viewerId).stream()
                .filter(h -> h.getVideo() != null && access.canSee(h.getVideo(), viewerId))
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
                            .thumbnailUrl(v != null ? thumbnailUrl(v, viewerId) : "")
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
                .filter(item -> item.getVideo() != null && access.canSee(item.getVideo(), viewerId))
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
                            .thumbnailUrl(v != null ? thumbnailUrl(v, viewerId) : "")
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
                .videoUrl(playbackUrl(v, viewerId))
                .thumbnailUrl(thumbnailUrl(v, viewerId))
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

    private String thumbnailUrl(Video video, Long viewerId) {
        String url = video.getThumbnailUrl();
        if (url == null || url.isBlank() || url.contains("default-thumbnail.jpg"))
            return "https://picsum.photos/seed/" + (video.getId() == null ? 1 : video.getId()) + "/640/360";
        if (!access.isPublished(video) && url.startsWith("/uploads/") && viewerId != null)
            return url + "?access=" + tokens.issueMedia(video.getId(), url.substring("/uploads/".length()), viewerId);
        return url;
    }

    private String playbackUrl(Video video, Long viewerId) {
        if (!access.canPlay(video, viewerId)) return null;
        String url = video.getVideoUrl();
        if (url != null && url.startsWith("/uploads/") &&
                (!access.isPublished(video) || (video.getAccessTier() != null &&
                        "PREMIUM".equalsIgnoreCase(video.getAccessTier().getTierName())))) {
            String filename = url.substring("/uploads/".length());
            return url + "?access=" + tokens.issueMedia(video.getId(), filename, viewerId);
        }
        return url;
    }

    private String normalizedTier(String requested) {
        String tier = requested == null || requested.isBlank() ? "FREE" : requested.trim().toUpperCase(Locale.ROOT);
        if (!"FREE".equals(tier) && !"PREMIUM".equals(tier))
            throw new IllegalArgumentException("Access type must be FREE or PREMIUM");
        return tier;
    }

    private void requirePremiumPass(String tier, Long creatorId) {
        if ("PREMIUM".equals(tier) && !billing.hasActivePremium(creatorId))
            throw new AccessDeniedException("An active premium pass is required to publish premium video");
    }

    private AccessTier resolveTier(String tierName) {
        return accessTierRepository.findByTierNameIgnoreCase(tierName).orElseGet(() -> {
            AccessTier tier = new AccessTier();
            tier.setTierName(tierName);
            return accessTierRepository.save(tier);
        });
    }

    private String checkedExternalUrl(String url) {
        if (url == null || url.isBlank()) return url;
        String trimmed = url.trim();
        if (!trimmed.matches("(?i)^https?://[^\\s]+$"))
            throw new IllegalArgumentException("Only HTTP(S) external URLs may be supplied; local uploads must be uploaded as files");
        return trimmed;
    }

    private String saveUploadedFile(MultipartFile file, boolean isVideo) {
        try {
            String extension = UploadValidator.validate(file, isVideo);
            Files.createDirectories(UPLOAD_DIR);
            String fileName = UUID.randomUUID().toString() + extension;
            Path targetPath = UPLOAD_DIR.resolve(fileName);
            Files.copy(file.getInputStream(), targetPath, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            return "/uploads/" + fileName;
        } catch (IOException e) {
            throw new RuntimeException("Failed to save uploaded file", e);
        }
    }
}
