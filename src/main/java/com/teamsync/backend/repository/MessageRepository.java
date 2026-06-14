package com.teamsync.backend.repository;

import com.teamsync.backend.model.Message;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface MessageRepository extends JpaRepository<Message, Long> {
    List<Message> findByTeamIdOrderBySentAtAsc(Long teamId);
}