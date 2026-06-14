package com.teamsync.backend.repository;

import com.teamsync.backend.model.Team;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface TeamRepository extends JpaRepository<Team, Long> {
    Optional<Team> findByInviteCode(String inviteCode);
    List<Team> findByCreatedBy(Long userId);
}