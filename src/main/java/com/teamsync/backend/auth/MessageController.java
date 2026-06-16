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
        // Save message
        Message message = new Message();
        message.setTeamId(chatMessage.getTeamId());
        message.setSenderId(chatMessage.getSenderId());
        message.setContent(chatMessage.getContent());
        message.setSentAt(LocalDateTime.now());
        messageRepository.save(message);

        chatMessage.setSentAt(message.getSentAt().toString());

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
            notification.setMessage("💬 " + chatMessage.getSenderName() +
                " sent a message in " + teamName + ": \"" +
                chatMessage.getContent().substring(0, Math.min(30, chatMessage.getContent().length())) +
                (chatMessage.getContent().length() > 30 ? "..." : "") + "\"");
            notificationRepository.save(notification);

            // Send real-time notification
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