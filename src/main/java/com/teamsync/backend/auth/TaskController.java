package com.teamsync.backend.auth;

import com.teamsync.backend.model.Task;
import com.teamsync.backend.repository.TaskRepository;
import com.teamsync.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:3000")
public class TaskController {

    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;

    private Long getUserIdFromToken(String authHeader) {
        String token = authHeader.replace("Bearer ", "");
        String email = jwtUtil.extractEmail(token);
        return userRepository.findByEmail(email).get().getId();
    }

    @PostMapping("/create")
    public ResponseEntity<?> createTask(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody Task task) {
        Long userId = getUserIdFromToken(authHeader);
        task.setCreatedBy(userId);
        Task saved = taskRepository.save(task);
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/team/{teamId}")
    public ResponseEntity<?> getTasksByTeam(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable Long teamId) {
        List<Task> tasks = taskRepository.findByTeamId(teamId);
        return ResponseEntity.ok(tasks);
    }

    @PatchMapping("/{taskId}/status")
    public ResponseEntity<?> updateStatus(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable Long taskId,
            @RequestBody Map<String, String> body) {
        Task task = taskRepository.findById(taskId).orElse(null);
        if (task == null) return ResponseEntity.notFound().build();
        task.setStatus(body.get("status"));
        taskRepository.save(task);
        return ResponseEntity.ok(task);
    }

    @DeleteMapping("/{taskId}")
    public ResponseEntity<?> deleteTask(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable Long taskId) {
        taskRepository.deleteById(taskId);
        return ResponseEntity.ok("Task deleted");
    }

    @PutMapping("/{taskId}")
    public ResponseEntity<?> updateTask(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable Long taskId,
            @RequestBody Task updatedTask) {
        Task task = taskRepository.findById(taskId).orElse(null);
        if (task == null) return ResponseEntity.notFound().build();
        task.setTitle(updatedTask.getTitle());
        task.setDescription(updatedTask.getDescription());
        task.setPriority(updatedTask.getPriority());
        task.setAssignedTo(updatedTask.getAssignedTo());
        task.setDeadline(updatedTask.getDeadline());
        taskRepository.save(task);
        return ResponseEntity.ok(task);
    }
}