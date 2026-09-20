package org.gp14.skopia.repository;

import org.gp14.skopia.model.interaction.Comment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CommentRepository extends JpaRepository<Comment, Long> {
    List<Comment> findByVideoIdAndCommentStatusOrderByPostedDatetimeDesc(Long videoId, String commentStatus);
}
