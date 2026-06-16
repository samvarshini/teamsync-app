package com.teamsync.backend.auth;

import lombok.Data;

@Data
public class ChatMessage {
    private Long id;
    private Long teamId;
    private Long senderId;
    private String senderName;
    private String content;
    private String clientMessageId;
    private String messageType;
    private String audioDataUrl;
    private Integer audioDurationSeconds;
    private String mediaMimeType;
    private String attachmentDataUrl;
    private String attachmentFileName;
    private Long attachmentFileSize;
    private String deliveryStatus;
    private String callId;
    private String callStatus;
    private String callMediaType;
    private Long callInitiatorId;
    private Integer callDurationSeconds;
    private String sentAt;
}
