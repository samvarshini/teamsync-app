package com.teamsync.backend.repository;

import com.teamsync.backend.model.Task;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface TaskRepository extends JpaRepository<Task, Long> {
    List<Task> findByTeamId(Long teamId);
    List<Task> findByAssignedTo(Long userId);
    List<Task> findByTeamIdAndStatus(Long teamId, String status);
}