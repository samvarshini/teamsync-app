package com.teamsync.backend.auth;

import com.teamsync.backend.model.Team;
import com.teamsync.backend.model.TeamMember;
import com.teamsync.backend.repository.TeamMemberRepository;
import com.teamsync.backend.repository.TeamRepository;
import com.teamsync.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/teams")
@RequiredArgsConstructor
@CrossOrigin(origins = {"http://localhost:3000", "https://n-six-tan.vercel.app", "https://*.vercel.app"})
public class TeamController {

    private final TeamRepository teamRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;

    private Long getUserIdFromToken(String authHeader) {
        String token = authHeader.replace("Bearer ", "");
        String email = jwtUtil.extractEmail(token);
        return userRepository.findByEmail(email).get().getId();
    }

    @PostMapping("/create")
    public ResponseEntity<?> createTeam(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody Team team) {
        Long userId = getUserIdFromToken(authHeader);
        team.setCreatedBy(userId);
        team.setInviteCode(UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        Team saved = teamRepository.save(team);

        TeamMember member = new TeamMember();
        member.setTeamId(saved.getId());
        member.setUserId(userId);
        member.setRole("admin");
        teamMemberRepository.save(member);

        return ResponseEntity.ok(saved);
    }

    @PostMapping("/join")
    public ResponseEntity<?> joinTeam(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody Map<String, String> body) {
        Long userId = getUserIdFromToken(authHeader);
        String inviteCode = body.get("inviteCode");

        Team team = teamRepository.findByInviteCode(inviteCode).orElse(null);
        if (team == null) return ResponseEntity.badRequest().body("Invalid invite code");

        if (teamMemberRepository.existsByTeamIdAndUserId(team.getId(), userId)) {
            return ResponseEntity.badRequest().body("Already a member");
        }

        TeamMember member = new TeamMember();
        member.setTeamId(team.getId());
        member.setUserId(userId);
        member.setRole("member");
        teamMemberRepository.save(member);

        return ResponseEntity.ok(team);
    }

    @GetMapping("/my")
    public ResponseEntity<?> getMyTeams(
            @RequestHeader("Authorization") String authHeader) {
        Long userId = getUserIdFromToken(authHeader);
        List<TeamMember> memberships = teamMemberRepository.findByUserId(userId);

        List<Map<String, Object>> teamsWithCount = memberships.stream()
                .map(m -> {
                    Team team = teamRepository.findById(m.getTeamId()).orElse(null);
                    if (team == null) return null;
                    int memberCount = teamMemberRepository.findByTeamId(team.getId()).size();
                    boolean isAdmin = "admin".equals(m.getRole());
                    Map<String, Object> teamData = new HashMap<>();
                    teamData.put("id", team.getId());
                    teamData.put("name", team.getName());
                    teamData.put("description", team.getDescription());
                    teamData.put("inviteCode", team.getInviteCode());
                    teamData.put("createdBy", team.getCreatedBy());
                    teamData.put("memberCount", memberCount);
                    teamData.put("isAdmin", isAdmin);
                    return teamData;
                })
                .filter(t -> t != null)
                .toList();

        return ResponseEntity.ok(teamsWithCount);
    }

    @GetMapping("/{teamId}/members")
    public ResponseEntity<?> getTeamMembers(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable Long teamId) {
        List<TeamMember> members = teamMemberRepository.findByTeamId(teamId);
        List<Map<String, Object>> memberDetails = members.stream()
                .map(m -> {
                    Map<String, Object> detail = new HashMap<>();
                    detail.put("userId", m.getUserId());
                    detail.put("role", m.getRole());
                    userRepository.findById(m.getUserId()).ifPresent(u -> {
                        detail.put("name", u.getName());
                        detail.put("email", u.getEmail());
                    });
                    return detail;
                })
                .toList();
        return ResponseEntity.ok(memberDetails);
    }

    @DeleteMapping("/{teamId}")
    public ResponseEntity<?> deleteTeam(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable Long teamId) {
        Long userId = getUserIdFromToken(authHeader);
        Team team = teamRepository.findById(teamId).orElse(null);
        if (team == null) return ResponseEntity.notFound().build();

        if (!team.getCreatedBy().equals(userId)) {
            return ResponseEntity.badRequest().body("Only the team creator can delete this team");
        }

        teamMemberRepository.findByTeamId(teamId)
                .forEach(m -> teamMemberRepository.delete(m));
        teamRepository.delete(team);

        return ResponseEntity.ok("Team deleted successfully");
    }

    @DeleteMapping("/{teamId}/leave")
    public ResponseEntity<?> leaveTeam(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable Long teamId) {
        Long userId = getUserIdFromToken(authHeader);
        TeamMember member = teamMemberRepository
                .findByTeamIdAndUserId(teamId, userId).orElse(null);
        if (member == null) return ResponseEntity.badRequest().body("Not a member");
        teamMemberRepository.delete(member);
        return ResponseEntity.ok("Left team successfully");
    }
}