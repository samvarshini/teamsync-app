package com.teamsync.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "tasks")
public class Task {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "team_id")
    private Long teamId;

    @Column(nullable = false)
    private String title;

    private String description;

    private String status = "todo";

    private String priority = "medium";

    @Column(name = "assigned_to")
    private Long assignedTo;

    @Column(name = "created_by")
    private Long createdBy;

    private LocalDate deadline;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();
}