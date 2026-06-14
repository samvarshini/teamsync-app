package com.teamsync.backend.auth;

import com.teamsync.backend.model.Message;
import com.teamsync.backend.repository.MessageRepository;
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
@CrossOrigin(origins = "http://localhost:3000")
public class MessageController {

    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final JwtUtil jwtUtil;

    @MessageMapping("/chat/{teamId}")
    public void sendMessage(@Payload ChatMessage chatMessage) {
        Message message = new Message();
        message.setTeamId(chatMessage.getTeamId());
        message.setSenderId(chatMessage.getSenderId());
        message.setContent(chatMessage.getContent());
        message.setSentAt(LocalDateTime.now());
        messageRepository.save(message);

        chatMessage.setSentAt(message.getSentAt().toString());
        messagingTemplate.convertAndSend(
            "/topic/team/" + chatMessage.getTeamId(),
            chatMessage
        );
    }

    @GetMapping("/api/messages/{teamId}")
    public ResponseEntity<?> getMessages(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable Long teamId) {
        List<Message> messages = messageRepository.findByTeamIdOrderBySentAtAsc(teamId);
        return ResponseEntity.ok(messages);
    }
}