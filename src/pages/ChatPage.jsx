import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { getMyTeams } from '../services/teamService';
import API from '../services/api';
import ThemeToggle from '../components/ThemeToggle';

const CHAT_NOTIFICATION_SOUND = 'data:audio/wav;base64,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';

const formatMessageTime = (sentAt) => {
  if (!sentAt) return '';

  const timestamp = typeof sentAt === 'string' && !/(Z|[+-]\d{2}:?\d{2})$/.test(sentAt)
    ? `${sentAt}Z`
    : sentAt;
  const date = new Date(timestamp);

  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString();
};

export default function ChatPage() {
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const clientRef = useRef(null);
  const bottomRef = useRef(null);
  const notificationAudioRef = useRef(null);
  const playedMessageKeysRef = useRef(new Set());
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    const audio = new Audio(CHAT_NOTIFICATION_SOUND);
    audio.preload = 'auto';
    notificationAudioRef.current = audio;

    return () => {
      notificationAudioRef.current = null;
    };
  }, []);

  useEffect(() => {
    loadTeams();
  }, []);

  useEffect(() => {
    if (selectedTeam) {
      loadMessages(selectedTeam.id);
      connectWebSocket(selectedTeam.id);
    }
    return () => {
      if (clientRef.current) clientRef.current.deactivate();
    };
  }, [selectedTeam]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadTeams = async () => {
    try {
      const res = await getMyTeams();
      setTeams(res.data);
      if (res.data.length > 0) setSelectedTeam(res.data[0]);
    } catch (err) {
      console.error('Failed to load teams');
    }
  };

  const loadMessages = async (teamId) => {
    try {
      const res = await API.get(`/messages/${teamId}`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      setMessages(res.data.map(m => ({
        teamId: m.teamId,
        senderId: m.senderId,
        senderName: m.senderId === user.id ? user.name : 'Teammate',
        content: m.content,
        sentAt: m.sentAt,
      })));
    } catch (err) {
      console.error('Failed to load messages');
    }
  };

  const getMessageSoundKey = (msg) => [
    msg.teamId,
    msg.senderId,
    msg.sentAt,
    msg.content,
  ].map(value => value ?? '').join('|');

  const playIncomingMessageSound = (msg) => {
    if (String(msg.senderId) === String(user.id)) return;

    const key = getMessageSoundKey(msg);
    if (playedMessageKeysRef.current.has(key)) return;
    playedMessageKeysRef.current.add(key);

    const audio = notificationAudioRef.current;
    if (!audio) return;

    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise?.catch) playPromise.catch(() => {});
  };

  const connectWebSocket = (teamId) => {
    if (clientRef.current) clientRef.current.deactivate();

    const client = new Client({
      webSocketFactory: () => new SockJS('https://teamsync-app-6guk.onrender.com/ws'),
      reconnectDelay: 5000,
      onConnect: () => {
        setConnected(true);
        client.subscribe(`/topic/team/${teamId}`, (message) => {
          const msg = JSON.parse(message.body);
          playIncomingMessageSound(msg);
          setMessages((prev) => [...prev, msg]);
        });
      },
      onDisconnect: () => {
        setConnected(false);
      },
      onStompError: () => {
        setConnected(false);
      }
    });

    client.activate();
    clientRef.current = client;
  };

  const sendMessage = () => {
    if (!input.trim() || !clientRef.current?.connected) return;

    const msg = {
      teamId: selectedTeam.id,
      senderId: user.id,
      senderName: user.name,
      content: input,
    };

    clientRef.current.publish({
      destination: `/app/chat/${selectedTeam.id}`,
      body: JSON.stringify(msg),
    });

    setInput('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') sendMessage();
  };

  return (
    <div style={styles.container}>
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <h3 style={styles.sidebarTitle}>💬 Chats</h3>
          <button style={styles.backBtn} onClick={() => navigate('/dashboard')}>← Back</button>
        </div>
        {teams.map(team => (
          <div
            key={team.id}
            style={{ ...styles.teamItem, background: selectedTeam?.id === team.id ? 'linear-gradient(135deg, rgba(var(--primary-accent-rgb),0.24), rgba(var(--secondary-accent-rgb),0.26))' : 'transparent' }}
            onClick={() => setSelectedTeam(team)}>
            <span style={{ color: selectedTeam?.id === team.id ? 'white' : 'var(--text-secondary)' }}>
              👥 {team.name}
            </span>
          </div>
        ))}
      </div>

      <div style={styles.chatArea}>
        <div style={styles.chatHeader}>
          <h3 style={styles.chatTitle}>
            {selectedTeam ? `# ${selectedTeam.name}` : 'Select a team'}
          </h3>
          <div style={styles.headerActions}>
            <span style={{ ...styles.status, color: connected ? 'var(--success)' : 'var(--error)' }}>
              {connected ? '🟢 Connected' : '🔴 Connecting...'}
            </span>
            <ThemeToggle />
          </div>
        </div>

        <div style={styles.messages}>
          {messages.length === 0 && (
            <p style={styles.empty}>No messages yet. Say hello! 👋</p>
          )}
          {messages.map((msg, i) => {
            const isMe = msg.senderId === user.id;
            return (
              <div key={i} style={{ ...styles.msgRow, justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                <div style={{ ...styles.msgBubble, background: isMe ? 'linear-gradient(135deg, var(--primary-accent), var(--secondary-accent))' : 'var(--glass-bg)', color: isMe ? 'white' : 'var(--text-primary)' }}>
                  {!isMe && <p style={styles.senderName}>{msg.senderName}</p>}
                  <p style={styles.msgContent}>{msg.content}</p>
                  <p style={{ ...styles.msgTime, color: isMe ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}>
                    {formatMessageTime(msg.sentAt)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <div style={styles.inputArea}>
          <input
            style={styles.input}
            placeholder={connected ? "Type a message... (Enter to send)" : "Connecting to chat..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={!connected}
          />
          <button
            style={{ ...styles.sendBtn, opacity: connected ? 1 : 0.5 }}
            onClick={sendMessage}
            disabled={!connected}>
            Send 🚀
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { display: 'flex', height: '100vh', background: 'transparent', padding: '20px', gap: '20px' },
  sidebar: { width: '280px', background: 'var(--glass-bg)', backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)', border: '1px solid var(--border-color)', borderRadius: '24px', boxShadow: 'var(--shadow-soft)', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  sidebarHeader: { padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  sidebarTitle: { margin: 0, color: 'var(--text-primary)' },
  backBtn: { padding: '8px 12px', background: 'var(--glass-bg-soft)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 },
  teamItem: { padding: '13px 16px', cursor: 'pointer', borderRadius: '16px', margin: '6px 10px', border: '1px solid var(--border-color)', transition: 'background 220ms ease, transform 220ms ease' },
  chatArea: { flex: 1, display: 'flex', flexDirection: 'column' },
  chatHeader: { padding: '18px 24px', background: 'var(--glass-bg)', backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)', border: '1px solid var(--border-color)', borderRadius: '22px 22px 0 0', boxShadow: 'var(--shadow-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  chatTitle: { margin: 0, color: 'var(--text-primary)' },
  headerActions: { display: 'flex', alignItems: 'center', gap: '12px' },
  status: { fontSize: '14px' },
  messages: { flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--glass-bg-soft)', borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)' },
  empty: { textAlign: 'center', color: 'var(--text-muted)', marginTop: '48px' },
  msgRow: { display: 'flex' },
  msgBubble: { maxWidth: '62%', padding: '13px 16px', borderRadius: '18px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-soft)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' },
  senderName: { margin: '0 0 4px 0', fontSize: '11px', fontWeight: 'bold', color: 'var(--primary-accent)' },
  msgContent: { margin: 0, fontSize: '14px' },
  msgTime: { margin: '4px 0 0 0', fontSize: '10px', textAlign: 'right' },
  inputArea: { padding: '16px 24px', background: 'var(--glass-bg)', backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)', border: '1px solid var(--border-color)', borderRadius: '0 0 22px 22px', display: 'flex', gap: '12px', boxShadow: 'var(--shadow-soft)' },
  input: { flex: 1, padding: '13px 15px', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: '14px' },
  sendBtn: { padding: '12px 24px', background: 'linear-gradient(135deg, var(--primary-accent), var(--secondary-accent))', color: 'white', border: '1px solid var(--border-color)', borderRadius: '16px', cursor: 'pointer', fontSize: '14px', fontWeight: 700 },
};
