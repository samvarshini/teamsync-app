package com.teamsync.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "team_members")
public class TeamMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "team_id")
    private Long teamId;

    @Column(name = "user_id")
    private Long userId;

    private String role = "member";

    @Column(name = "joined_at")
    private LocalDateTime joinedAt = LocalDateTime.now();
}