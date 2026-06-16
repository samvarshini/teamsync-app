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

    @Column(name = "message_type")
    private String messageType = "TEXT";

    @Lob
    @Column(name = "audio_data_url", columnDefinition = "TEXT")
    private String audioDataUrl;

    @Column(name = "audio_duration_seconds")
    private Integer audioDurationSeconds;

    @Column(name = "media_mime_type")
    private String mediaMimeType;

    @Column(name = "call_id")
    private String callId;

    @Column(name = "call_status")
    private String callStatus;

    @Column(name = "call_media_type")
    private String callMediaType;

    @Column(name = "call_initiator_id")
    private Long callInitiatorId;

    @Column(name = "call_duration_seconds")
    private Integer callDurationSeconds;

    @Column(name = "sent_at")
    private LocalDateTime sentAt = LocalDateTime.now();
}
