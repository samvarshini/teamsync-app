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

@RestController
@RequiredArgsConstructor
@CrossOrigin(origins = {"http://localhost:3000", "https://n-six-tan.vercel.app", "https://*.vercel.app"})
public class MessageController {

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

        // Save message
        Message message = new Message();
        message.setTeamId(chatMessage.getTeamId());
        message.setSenderId(chatMessage.getSenderId());
        message.setContent(chatMessage.getContent());
        message.setMessageType(messageType);
        message.setAudioDataUrl(chatMessage.getAudioDataUrl());
        message.setAudioDurationSeconds(chatMessage.getAudioDurationSeconds());
        message.setMediaMimeType(chatMessage.getMediaMimeType());
        message.setSentAt(LocalDateTime.now());
        messageRepository.save(message);

        chatMessage.setSentAt(message.getSentAt().toString());
        chatMessage.setMessageType(messageType);

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

    @MessageMapping("/call/{teamId}")
    public void signalCall(@Payload CallSignal callSignal) {
        boolean senderIsMember = teamMemberRepository
                .findByTeamId(callSignal.getTeamId())
                .stream()
                .anyMatch(member -> member.getUserId().equals(callSignal.getSenderId()));

        if (!senderIsMember) {
            return;
        }

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

    @GetMapping("/api/messages/{teamId}")
    public ResponseEntity<?> getMessages(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable Long teamId) {
        List<Message> messages = messageRepository.findByTeamIdOrderBySentAtAsc(teamId);
        return ResponseEntity.ok(messages);
    }
}
