package com.teamsync.backend.auth;

import lombok.Data;

@Data
public class CallSignal {
    private String callId;
    private Long teamId;
    private Long senderId;
    private String senderName;
    private Long targetUserId;
    private String type;
    private String payload;
    private String participantName;
    private Boolean screenSharing;
    private Boolean controlRequested;
    private Boolean controlGranted;
}
