package com.teamsync.backend.auth;

import lombok.Data;

@Data
public class ChatMessage {
    private Long teamId;
    private Long senderId;
    private String senderName;
    private String content;
    private String messageType;
    private String audioDataUrl;
    private Integer audioDurationSeconds;
    private String mediaMimeType;
    private String callId;
    private String callStatus;
    private String callMediaType;
    private Long callInitiatorId;
    private Integer callDurationSeconds;
    private String sentAt;
}
