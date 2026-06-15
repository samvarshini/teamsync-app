import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { getMyTeams } from '../services/teamService';
import API from '../services/api';

export default function ChatPage() {
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const clientRef = useRef(null);
  const bottomRef = useRef(null);
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user'));

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

  const connectWebSocket = (teamId) => {
    if (clientRef.current) clientRef.current.deactivate();

    const client = new Client({
      webSocketFactory: () => new SockJS('https://teamsync-app-6guk.onrender.com/ws'),
      onConnect: () => {
        setConnected(true);
        client.subscribe(`/topic/team/${teamId}`, (message) => {
          const msg = JSON.parse(message.body);
          setMessages((prev) => [...prev, msg]);
        });
      },
      onDisconnect: () => setConnected(false),
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
            style={{ ...styles.teamItem, background: selectedTeam?.id === team.id ? '#4f46e5' : 'transparent' }}
            onClick={() => setSelectedTeam(team)}>
            <span style={{ color: selectedTeam?.id === team.id ? 'white' : '#333' }}>
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
          <span style={{ ...styles.status, color: connected ? '#10b981' : '#ef4444' }}>
            {connected ? '🟢 Connected' : '🔴 Disconnected'}
          </span>
        </div>

        <div style={styles.messages}>
          {messages.length === 0 && (
            <p style={styles.empty}>No messages yet. Say hello! 👋</p>
          )}
          {messages.map((msg, i) => {
            const isMe = msg.senderId === user.id;
            return (
              <div key={i} style={{ ...styles.msgRow, justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                <div style={{ ...styles.msgBubble, background: isMe ? '#4f46e5' : 'white', color: isMe ? 'white' : '#333' }}>
                  {!isMe && <p style={styles.senderName}>{msg.senderName}</p>}
                  <p style={styles.msgContent}>{msg.content}</p>
                  <p style={{ ...styles.msgTime, color: isMe ? 'rgba(255,255,255,0.7)' : '#9ca3af' }}>
                    {msg.sentAt ? new Date(msg.sentAt).toLocaleTimeString() : ''}
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
            placeholder="Type a message... (Enter to send)"
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
  container: { display: 'flex', height: '100vh', background: '#f0f2f5' },
  sidebar: { width: '250px', background: 'white', boxShadow: '2px 0 8px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column' },
  sidebarHeader: { padding: '16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  sidebarTitle: { margin: 0, color: '#333' },
  backBtn: { padding: '6px 12px', background: '#6b7280', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
  teamItem: { padding: '12px 16px', cursor: 'pointer', borderRadius: '8px', margin: '4px 8px' },
  chatArea: { flex: 1, display: 'flex', flexDirection: 'column' },
  chatHeader: { padding: '16px 24px', background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  chatTitle: { margin: 0, color: '#333' },
  status: { fontSize: '14px' },
  messages: { flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: '48px' },
  msgRow: { display: 'flex' },
  msgBubble: { maxWidth: '60%', padding: '12px 16px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  senderName: { margin: '0 0 4px 0', fontSize: '11px', fontWeight: 'bold', color: '#4f46e5' },
  msgContent: { margin: 0, fontSize: '14px' },
  msgTime: { margin: '4px 0 0 0', fontSize: '10px', textAlign: 'right' },
  inputArea: { padding: '16px 24px', background: 'white', display: 'flex', gap: '12px', boxShadow: '0 -2px 8px rgba(0,0,0,0.1)' },
  input: { flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' },
  sendBtn: { padding: '12px 24px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
};