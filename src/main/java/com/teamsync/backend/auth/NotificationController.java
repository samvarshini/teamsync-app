package com.teamsync.backend.auth;

import com.teamsync.backend.model.Notification;
import com.teamsync.backend.repository.NotificationRepository;
import com.teamsync.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:3000")
public class NotificationController {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;

    private Long getUserIdFromToken(String authHeader) {
        String token = authHeader.replace("Bearer ", "");
        String email = jwtUtil.extractEmail(token);
        return userRepository.findByEmail(email).get().getId();
    }

    @GetMapping
    public ResponseEntity<?> getNotifications(
            @RequestHeader("Authorization") String authHeader) {
        Long userId = getUserIdFromToken(authHeader);
        List<Notification> notifications = notificationRepository
                .findByUserIdOrderByCreatedAtDesc(userId);
        return ResponseEntity.ok(notifications);
    }

    @GetMapping("/unread-count")
    public ResponseEntity<?> getUnreadCount(
            @RequestHeader("Authorization") String authHeader) {
        Long userId = getUserIdFromToken(authHeader);
        long count = notificationRepository.countByUserIdAndIsRead(userId, false);
        return ResponseEntity.ok(Map.of("count", count));
    }

    @PatchMapping("/{id}/read")
    public ResponseEntity<?> markAsRead(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable Long id) {
        Notification notification = notificationRepository.findById(id).orElse(null);
        if (notification == null) return ResponseEntity.notFound().build();
        notification.setIsRead(true);
        notificationRepository.save(notification);
        return ResponseEntity.ok(notification);
    }

    @PatchMapping("/read-all")
    public ResponseEntity<?> markAllAsRead(
            @RequestHeader("Authorization") String authHeader) {
        Long userId = getUserIdFromToken(authHeader);
        List<Notification> unread = notificationRepository
                .findByUserIdAndIsRead(userId, false);
        unread.forEach(n -> n.setIsRead(true));
        notificationRepository.saveAll(unread);
        return ResponseEntity.ok("All marked as read");
    }

    @PostMapping("/create")
    public ResponseEntity<?> createNotification(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody Notification notification) {
        Notification saved = notificationRepository.save(notification);
        return ResponseEntity.ok(saved);
    }
}