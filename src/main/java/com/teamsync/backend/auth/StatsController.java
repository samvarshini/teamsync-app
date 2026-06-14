package com.teamsync.backend.auth;

import com.teamsync.backend.repository.TaskRepository;
import com.teamsync.backend.repository.TeamMemberRepository;
import com.teamsync.backend.repository.TeamRepository;
import com.teamsync.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/stats")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:3000")
public class StatsController {

    private final TaskRepository taskRepository;
    private final TeamRepository teamRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;

    private Long getUserIdFromToken(String authHeader) {
        String token = authHeader.replace("Bearer ", "");
        String email = jwtUtil.extractEmail(token);
        return userRepository.findByEmail(email).get().getId();
    }

    @GetMapping("/dashboard")
    public ResponseEntity<?> getDashboardStats(
            @RequestHeader("Authorization") String authHeader) {

        Long userId = getUserIdFromToken(authHeader);

        // Get user's teams
        var memberships = teamMemberRepository.findByUserId(userId);
        int totalTeams = memberships.size();

        // Get tasks across all teams
        long totalTasks = 0, todoTasks = 0, inProgressTasks = 0, doneTasks = 0;

        for (var membership : memberships) {
            var tasks = taskRepository.findByTeamId(membership.getTeamId());
            totalTasks += tasks.size();
            todoTasks += tasks.stream().filter(t -> "todo".equals(t.getStatus())).count();
            inProgressTasks += tasks.stream().filter(t -> "inprogress".equals(t.getStatus())).count();
            doneTasks += tasks.stream().filter(t -> "done".equals(t.getStatus())).count();
        }

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalTeams", totalTeams);
        stats.put("totalTasks", totalTasks);
        stats.put("todoTasks", todoTasks);
        stats.put("inProgressTasks", inProgressTasks);
        stats.put("doneTasks", doneTasks);
        stats.put("completionRate", totalTasks > 0 ? (doneTasks * 100 / totalTasks) : 0);

        return ResponseEntity.ok(stats);
    }

    @GetMapping("/team/{teamId}")
    public ResponseEntity<?> getTeamStats(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable Long teamId) {

        var tasks = taskRepository.findByTeamId(teamId);
        var members = teamMemberRepository.findByTeamId(teamId);

        long todo = tasks.stream().filter(t -> "todo".equals(t.getStatus())).count();
        long inProgress = tasks.stream().filter(t -> "inprogress".equals(t.getStatus())).count();
        long done = tasks.stream().filter(t -> "done".equals(t.getStatus())).count();

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalTasks", tasks.size());
        stats.put("todoTasks", todo);
        stats.put("inProgressTasks", inProgress);
        stats.put("doneTasks", done);
        stats.put("totalMembers", members.size());
        stats.put("completionRate", tasks.size() > 0 ? (done * 100 / tasks.size()) : 0);

        return ResponseEntity.ok(stats);
    }
}