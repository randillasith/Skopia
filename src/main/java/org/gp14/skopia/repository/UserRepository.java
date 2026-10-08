package org.gp14.skopia.repository;

import org.gp14.skopia.model.user.User;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);
    Optional<User> findByEmail(String email);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.email = :email")
    Optional<User> findByEmailForPasswordReset(@Param("email") String email);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.id = :id")
    Optional<User> findByIdForPasswordReset(@Param("id") Long id);
    boolean existsByUsername(String username);
    boolean existsByEmail(String email);

    List<User> findByAccountStatus(String accountStatus);

    @Query("SELECT u FROM User u WHERE " +
           "(:status IS NULL OR LOWER(u.accountStatus) = LOWER(:status)) AND " +
           "(:query IS NULL OR LOWER(u.username) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           " LOWER(u.email) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           " LOWER(u.firstName) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           " LOWER(u.lastName) LIKE LOWER(CONCAT('%', :query, '%')))")
    List<User> searchUsers(@Param("query") String query, @Param("status") String status);

    long countByAccountStatus(String accountStatus);
}

