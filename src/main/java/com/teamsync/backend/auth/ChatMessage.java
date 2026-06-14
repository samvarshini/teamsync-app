package com.teamsync.backend.auth;

import lombok.Data;

@Data
public class ChatMessage {
    private Long teamId;
    private Long senderId;
    private String senderName;
    private String content;
    private String sentAt;
}