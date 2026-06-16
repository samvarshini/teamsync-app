import { useEffect, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { useAuth } from '../context/AuthContext';

const NOTIFICATION_SOUND = 'data:audio/wav;base64,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';

const getNotificationKey = (notification) => [
  notification.id,
  notification.userId,
  notification.createdAt,
  notification.message,
].map(value => value ?? '').join('|');

const getNotificationText = (notification) => notification.message || 'New TeamSync notification';

const getNotificationSender = (message) => {
  const chatMatch = message.match(/^💬\s(.+?)\ssent a message/);
  return chatMatch?.[1] || 'TeamSync';
};

const getNotificationPreview = (message) => {
  const previewMatch = message.match(/: "(.+)"$/);
  return previewMatch?.[1] || message;
};

export default function GlobalNotificationListener() {
  const { user } = useAuth();
  const audioRef = useRef(null);
  const clientRef = useRef(null);
  const processedKeysRef = useRef(new Set());

  useEffect(() => {
    const audio = new Audio(NOTIFICATION_SOUND);
    audio.preload = 'auto';
    audioRef.current = audio;

    const unlockAudio = () => {
      audio.muted = true;
      audio.play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.muted = false;
        })
        .catch(() => {
          audio.muted = false;
        });
    };

    document.addEventListener('pointerdown', unlockAudio, { once: true });
    document.addEventListener('keydown', unlockAudio, { once: true });

    return () => {
      document.removeEventListener('pointerdown', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return undefined;

    const playSound = () => {
      const audio = audioRef.current;
      if (!audio) return;

      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise?.catch) playPromise.catch(() => {});
    };

    const showDesktopNotification = (notification) => {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;

      const message = getNotificationText(notification);
      new Notification(getNotificationSender(message), {
        body: getNotificationPreview(message),
        icon: '/logo192.png',
      });
    };

    const client = new Client({
      webSocketFactory: () => new SockJS('https://teamsync-app-6guk.onrender.com/ws'),
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe(`/topic/notifications/${user.id}`, (message) => {
          const notification = JSON.parse(message.body);
          const key = getNotificationKey(notification);
          if (processedKeysRef.current.has(key)) return;

          processedKeysRef.current.add(key);
          playSound();
          showDesktopNotification(notification);
        });
      },
    });

    client.activate();
    clientRef.current = client;

    return () => {
      client.deactivate();
      if (clientRef.current === client) clientRef.current = null;
    };
  }, [user?.id]);

  return null;
}
