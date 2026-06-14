package com.teamsync.backend.auth;

import com.teamsync.backend.model.Team;
import com.teamsync.backend.model.TeamMember;
import com.teamsync.backend.repository.TeamMemberRepository;
import com.teamsync.backend.repository.TeamRepository;
import com.teamsync.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/teams")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:3000")
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
            @RequestBody java.util.Map<String, String> body) {

        Long userId = getUserIdFromToken(authHeader);
        String inviteCode = body.get("inviteCode");

        Team team = teamRepository.findByInviteCode(inviteCode).orElse(null);
        if (team == null) {
            return ResponseEntity.badRequest().body("Invalid invite code");
        }

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

        List<Team> teams = memberships.stream()
                .map(m -> teamRepository.findById(m.getTeamId()).orElse(null))
                .filter(t -> t != null)
                .toList();

        return ResponseEntity.ok(teams);
    }

    @GetMapping("/{teamId}/members")
    public ResponseEntity<?> getTeamMembers(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable Long teamId) {

        List<TeamMember> members = teamMemberRepository.findByTeamId(teamId);
        return ResponseEntity.ok(members);
    }
}