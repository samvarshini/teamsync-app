package com.teamsync.backend.auth;

import com.teamsync.backend.model.Message;
import com.teamsync.backend.model.Notification;
import com.teamsync.backend.repository.MessageRepository;
import com.teamsync.backend.repository.NotificationRepository;
import com.teamsync.backend.repository.TeamMemberRepository;
import com.teamsync.backend.repository.TeamRepository;
import com.teamsync.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@CrossOrigin(origins = {"http://localhost:3000", "https://n-six-tan.vercel.app", "https://*.vercel.app"})
public class MessageController {

    private static final int MAX_MEDIA_DATA_URL_CHARS = 7_500_000;

    private final MessageRepository messageRepository;
    private final NotificationRepository notificationRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final TeamRepository teamRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final JwtUtil jwtUtil;

    @MessageMapping("/chat/{teamId}")
    public void sendMessage(@Payload ChatMessage chatMessage) {
        String messageType = chatMessage.getMessageType() == null ? "TEXT" : chatMessage.getMessageType();

        if (chatMessage.getClientMessageId() != null) {
            var existing = messageRepository.findByClientMessageId(chatMessage.getClientMessageId());
            if (existing.isPresent()) {
                messagingTemplate.convertAndSend(
                        "/topic/team/" + chatMessage.getTeamId(),
                        toChatMessage(existing.get())
                );
                return;
            }
        }

        if (!isValidMediaPayload(chatMessage, messageType)) {
            sendDeliveryStatus(chatMessage.getTeamId(), null, chatMessage.getClientMessageId(), "FAILED");
            return;
        }

        // Save message
        Message message = new Message();
        message.setTeamId(chatMessage.getTeamId());
        message.setSenderId(chatMessage.getSenderId());
        message.setContent(chatMessage.getContent());
        message.setClientMessageId(chatMessage.getClientMessageId());
        message.setMessageType(messageType);
        message.setAudioDataUrl(chatMessage.getAudioDataUrl());
        message.setAudioDurationSeconds(chatMessage.getAudioDurationSeconds());
        message.setMediaMimeType(chatMessage.getMediaMimeType());
        message.setAttachmentDataUrl(chatMessage.getAttachmentDataUrl());
        message.setAttachmentFileName(chatMessage.getAttachmentFileName());
        message.setAttachmentFileSize(chatMessage.getAttachmentFileSize());
        message.setDeliveryStatus("SENT");
        message.setCallId(chatMessage.getCallId());
        message.setCallStatus(chatMessage.getCallStatus());
        message.setCallMediaType(chatMessage.getCallMediaType());
        message.setCallInitiatorId(chatMessage.getCallInitiatorId());
        message.setCallDurationSeconds(chatMessage.getCallDurationSeconds());
        message.setSentAt(LocalDateTime.now());
        messageRepository.save(message);

        chatMessage.setId(message.getId());
        chatMessage.setSentAt(message.getSentAt().toString());
        chatMessage.setMessageType(messageType);
        chatMessage.setDeliveryStatus(message.getDeliveryStatus());

        // Broadcast to team
        messagingTemplate.convertAndSend(
            "/topic/team/" + chatMessage.getTeamId(),
            chatMessage
        );

        // Get team name
        String teamName = teamRepository.findById(chatMessage.getTeamId())
                .map(t -> t.getName()).orElse("your team");

        // Notify all team members except sender
        List<Long> memberIds = teamMemberRepository
                .findByTeamId(chatMessage.getTeamId())
                .stream()
                .map(m -> m.getUserId())
                .filter(id -> !id.equals(chatMessage.getSenderId()))
                .toList();

        for (Long memberId : memberIds) {
            Notification notification = new Notification();
            notification.setUserId(memberId);
            if ("VOICE".equalsIgnoreCase(messageType)) {
                notification.setMessage("🎙 " + chatMessage.getSenderName() +
                    " sent you a voice message in " + teamName);
            } else if ("ATTACHMENT".equalsIgnoreCase(messageType)) {
                notification.setMessage("📎 " + chatMessage.getSenderName() +
                    " sent an attachment in " + teamName);
            } else {
                String content = chatMessage.getContent() == null ? "" : chatMessage.getContent();
                notification.setMessage("💬 " + chatMessage.getSenderName() +
                    " sent a message in " + teamName + ": \"" +
                    content.substring(0, Math.min(30, content.length())) +
                    (content.length() > 30 ? "..." : "") + "\"");
            }
            notificationRepository.save(notification);

            // Send real-time notification
            messagingTemplate.convertAndSend(
                "/topic/notifications/" + memberId,
                notification
            );
        }
    }

    private boolean isValidMediaPayload(ChatMessage chatMessage, String messageType) {
        if ("VOICE".equalsIgnoreCase(messageType)) {
            return isDataUrl(chatMessage.getAudioDataUrl())
                    && isWithinMediaLimit(chatMessage.getAudioDataUrl());
        }

        if ("ATTACHMENT".equalsIgnoreCase(messageType)) {
            return isDataUrl(chatMessage.getAttachmentDataUrl())
                    && isWithinMediaLimit(chatMessage.getAttachmentDataUrl())
                    && chatMessage.getAttachmentFileName() != null
                    && chatMessage.getAttachmentFileSize() != null
                    && chatMessage.getAttachmentFileSize() > 0;
        }

        return true;
    }

    private boolean isDataUrl(String value) {
        return value != null && value.startsWith("data:") && value.contains(";base64,");
    }

    private boolean isWithinMediaLimit(String value) {
        return value != null && value.length() <= MAX_MEDIA_DATA_URL_CHARS;
    }

    private void sendDeliveryStatus(Long teamId, Long messageId, String clientMessageId, String deliveryStatus) {
        ChatMessage statusMessage = new ChatMessage();
        statusMessage.setId(messageId);
        statusMessage.setTeamId(teamId);
        statusMessage.setClientMessageId(clientMessageId);
        statusMessage.setDeliveryStatus(deliveryStatus);

        messagingTemplate.convertAndSend(
                "/topic/team/" + teamId + "/status",
                statusMessage
        );
    }

    @MessageMapping("/chat-status/{teamId}")
    public void updateMessageStatus(@Payload ChatMessage chatMessage) {
        if (chatMessage.getId() == null || chatMessage.getDeliveryStatus() == null) {
            return;
        }

        messageRepository.findById(chatMessage.getId()).ifPresent(message -> {
            if (!message.getTeamId().equals(chatMessage.getTeamId())
                    || message.getSenderId().equals(chatMessage.getSenderId())) {
                return;
            }

            String currentStatus = message.getDeliveryStatus() == null ? "SENT" : message.getDeliveryStatus();
            String nextStatus = normalizeStatus(chatMessage.getDeliveryStatus());
            if (statusRank(nextStatus) <= statusRank(currentStatus)) {
                return;
            }

            message.setDeliveryStatus(nextStatus);
            messageRepository.save(message);

            sendDeliveryStatus(chatMessage.getTeamId(), message.getId(), message.getClientMessageId(), nextStatus);
        });
    }

    @MessageMapping("/call/{teamId}")
    public void signalCall(@Payload CallSignal callSignal) {
        boolean senderIsMember = teamMemberRepository
                .findByTeamId(callSignal.getTeamId())
                .stream()
                .anyMatch(member -> member.getUserId().equals(callSignal.getSenderId()));

        if (!senderIsMember) {
            return;
        }

        logCallEventIfFinalized(callSignal);

        messagingTemplate.convertAndSend(
            "/topic/calls/" + callSignal.getTeamId(),
            callSignal
        );

        String type = callSignal.getType() == null ? "" : callSignal.getType();
        if (!type.equals("CALL_INVITE") && !type.equals("SCREEN_SHARE_INVITE")) {
            return;
        }

        String teamName = teamRepository.findById(callSignal.getTeamId())
                .map(t -> t.getName()).orElse("your team");

        List<Long> memberIds = teamMemberRepository
                .findByTeamId(callSignal.getTeamId())
                .stream()
                .map(m -> m.getUserId())
                .filter(id -> !id.equals(callSignal.getSenderId()))
                .filter(id -> callSignal.getTargetUserId() == null || id.equals(callSignal.getTargetUserId()))
                .toList();

        for (Long memberId : memberIds) {
            Notification notification = new Notification();
            notification.setUserId(memberId);
            if (type.equals("SCREEN_SHARE_INVITE")) {
                notification.setMessage("🖥 " + callSignal.getSenderName() +
                    " started screen sharing in " + teamName);
            } else {
                notification.setMessage("📹 " + callSignal.getSenderName() +
                    " started a video call in " + teamName);
            }
            notificationRepository.save(notification);

            messagingTemplate.convertAndSend(
                "/topic/notifications/" + memberId,
                notification
            );
        }
    }

    private void logCallEventIfFinalized(CallSignal callSignal) {
        Map<String, String> finalStatuses = Map.of(
                "CALL_ENDED", "ANSWERED",
                "CALL_MISSED", "MISSED",
                "CALL_REJECTED", "DECLINED",
                "CALL_CANCELLED", "CANCELLED"
        );

        String status = finalStatuses.get(callSignal.getType());
        if (status == null || callSignal.getCallId() == null) {
            return;
        }

        if (messageRepository.existsByTeamIdAndCallIdAndCallStatus(
                callSignal.getTeamId(),
                callSignal.getCallId(),
                status
        )) {
            return;
        }

        Long initiatorId = callSignal.getCallInitiatorId() == null
                ? callSignal.getSenderId()
                : callSignal.getCallInitiatorId();
        String mediaType = callSignal.getCallMediaType() == null
                ? "video"
                : callSignal.getCallMediaType().toLowerCase();

        Message message = new Message();
        message.setTeamId(callSignal.getTeamId());
        message.setSenderId(initiatorId);
        message.setContent(buildCallBadgeContent(status, mediaType, callSignal.getCallDurationSeconds()));
        message.setMessageType("CALL");
        message.setCallId(callSignal.getCallId());
        message.setCallStatus(status);
        message.setCallMediaType(mediaType);
        message.setCallInitiatorId(initiatorId);
        message.setCallDurationSeconds(callSignal.getCallDurationSeconds());
        message.setSentAt(LocalDateTime.now());
        messageRepository.save(message);

        ChatMessage chatMessage = toChatMessage(message);
        messagingTemplate.convertAndSend(
                "/topic/team/" + callSignal.getTeamId(),
                chatMessage
        );

        if ("MISSED".equals(status)) {
            createMissedCallNotifications(callSignal, mediaType, initiatorId);
        }
    }

    private String buildCallBadgeContent(String status, String mediaType, Integer durationSeconds) {
        return switch (status) {
            case "ANSWERED" -> "Call " + mediaType + " Duration: " + formatDuration(durationSeconds);
            case "MISSED" -> "Missed " + mediaType + " call";
            case "DECLINED" -> "Call declined";
            case "CANCELLED" -> "Call cancelled";
            default -> "Call event";
        };
    }

    private String formatDuration(Integer seconds) {
        int safeSeconds = seconds == null ? 0 : Math.max(0, seconds);
        int hours = safeSeconds / 3600;
        int minutes = (safeSeconds % 3600) / 60;
        int remainingSeconds = safeSeconds % 60;

        if (hours > 0) {
            return String.format("%dh %02dm", hours, minutes);
        }
        return String.format("%dm %02ds", minutes, remainingSeconds);
    }

    private void createMissedCallNotifications(CallSignal callSignal, String mediaType, Long initiatorId) {
        String teamName = teamRepository.findById(callSignal.getTeamId())
                .map(t -> t.getName()).orElse("your team");

        List<Long> memberIds = teamMemberRepository
                .findByTeamId(callSignal.getTeamId())
                .stream()
                .map(m -> m.getUserId())
                .filter(id -> !id.equals(initiatorId))
                .filter(id -> callSignal.getTargetUserId() == null || id.equals(callSignal.getTargetUserId()))
                .toList();

        for (Long memberId : memberIds) {
            Notification notification = new Notification();
            notification.setUserId(memberId);
            notification.setMessage("📞 Missed " + mediaType + " call from " +
                    callSignal.getSenderName() + " in " + teamName);
            notificationRepository.save(notification);

            messagingTemplate.convertAndSend(
                    "/topic/notifications/" + memberId,
                    notification
            );
        }
    }

    private ChatMessage toChatMessage(Message message) {
        ChatMessage chatMessage = new ChatMessage();
        chatMessage.setTeamId(message.getTeamId());
        chatMessage.setId(message.getId());
        chatMessage.setSenderId(message.getSenderId());
        chatMessage.setSenderName(userRepository.findById(message.getSenderId())
                .map(user -> user.getName())
                .orElse(""));
        chatMessage.setContent(message.getContent());
        chatMessage.setClientMessageId(message.getClientMessageId());
        chatMessage.setMessageType(message.getMessageType() == null ? "TEXT" : message.getMessageType());
        chatMessage.setAudioDataUrl(message.getAudioDataUrl());
        chatMessage.setAudioDurationSeconds(message.getAudioDurationSeconds());
        chatMessage.setMediaMimeType(message.getMediaMimeType());
        chatMessage.setAttachmentDataUrl(message.getAttachmentDataUrl());
        chatMessage.setAttachmentFileName(message.getAttachmentFileName());
        chatMessage.setAttachmentFileSize(message.getAttachmentFileSize());
        chatMessage.setDeliveryStatus(message.getDeliveryStatus() == null ? "SENT" : message.getDeliveryStatus());
        chatMessage.setCallId(message.getCallId());
        chatMessage.setCallStatus(message.getCallStatus());
        chatMessage.setCallMediaType(message.getCallMediaType());
        chatMessage.setCallInitiatorId(message.getCallInitiatorId());
        chatMessage.setCallDurationSeconds(message.getCallDurationSeconds());
        chatMessage.setSentAt(message.getSentAt().toString());
        return chatMessage;
    }

    private String normalizeStatus(String status) {
        String normalized = status.toUpperCase();
        return switch (normalized) {
            case "DELIVERED", "SEEN", "FAILED" -> normalized;
            default -> "SENT";
        };
    }

    private int statusRank(String status) {
        return switch (status) {
            case "SEEN" -> 3;
            case "DELIVERED" -> 2;
            case "SENT" -> 1;
            case "FAILED" -> -1;
            default -> 0;
        };
    }

    @GetMapping("/api/messages/{teamId}")
    public ResponseEntity<?> getMessages(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable Long teamId) {
        List<Message> messages = messageRepository.findByTeamIdOrderBySentAtAsc(teamId);
        return ResponseEntity.ok(messages.stream().map(this::toChatMessage).toList());
    }
}
