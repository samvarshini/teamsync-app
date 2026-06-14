package com.teamsync.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "messages")
public class Message {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "team_id")
    private Long teamId;

    @Column(name = "sender_id")
    private Long senderId;

    private String content;

    @Column(name = "sent_at")
    private LocalDateTime sentAt = LocalDateTime.now();
}