import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import API from '../services/api';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function Dashboard() {
  const { user, logoutUser } = useAuth();
  const navigate = useNavigate();
  const [teamStats, setTeamStats] = useState([]);
  const [overallStats, setOverallStats] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef(null);
  const clientRef = useRef(null);

  useEffect(() => {
    loadOverallStats();
    loadTeamStats();
    loadNotifications();
    connectNotifications();
    const interval = setInterval(loadUnreadCount, 10000);
    return () => {
      clearInterval(interval);
      if (clientRef.current) clientRef.current.deactivate();
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target))
        setShowNotifications(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const authHeader = { headers: { Authorization: `Bearer ${user.token}` } };

  const connectNotifications = () => {
    const client = new Client({
      webSocketFactory: () => new SockJS('https://teamsync-app-6guk.onrender.com/ws'),
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe(`/topic/notifications/${user.id}`, (message) => {
          const notification = JSON.parse(message.body);
          setNotifications(prev => [notification, ...prev]);
          setUnreadCount(prev => prev + 1);
        });
      },
    });
    client.activate();
    clientRef.current = client;
  };

  const loadOverallStats = async () => {
    try {
      const res = await API.get('/stats/dashboard', authHeader);
      setOverallStats(res.data);
    } catch (err) { console.error('Failed to load stats'); }
  };

  const loadTeamStats = async () => {
    try {
      const teamsRes = await API.get('/teams/my', authHeader);
      const teams = teamsRes.data;
      const statsPromises = teams.map(async (team) => {
        const statsRes = await API.get(`/stats/team/${team.id}`, authHeader);
        return { ...statsRes.data, teamName: team.name, teamId: team.id };
      });
      const allStats = await Promise.all(statsPromises);
      setTeamStats(allStats);
    } catch (err) { console.error('Failed to load team stats'); }
  };

  const loadNotifications = async () => {
    try {
      const res = await API.get('/notifications', authHeader);
      setNotifications(res.data);
      setUnreadCount(res.data.filter(n => !n.isRead).length);
    } catch (err) { console.error('Failed to load notifications'); }
  };

  const loadUnreadCount = async () => {
    try {
      const res = await API.get('/notifications/unread-count', authHeader);
      setUnreadCount(res.data.count);
    } catch (err) { console.error('Failed to load unread count'); }
  };

  const markAllRead = async () => {
    try {
      await API.patch('/notifications/read-all', {}, authHeader);
      loadNotifications();
    } catch (err) { console.error('Failed to mark all read'); }
  };

  const markRead = async (id) => {
    try {
      await API.patch(`/notifications/${id}/read`, {}, authHeader);
      loadNotifications();
    } catch (err) { console.error('Failed to mark read'); }
  };

  const handleLogout = () => { logoutUser(); navigate('/login'); };

  return (
    <div style={styles.container}>
      {/* Navbar */}
      <div style={styles.navbar}>
        <h1 style={styles.logo}>TeamSync</h1>
        <div style={styles.navRight}>
          <span style={styles.welcome}>👋 Welcome, {user?.name}!</span>
          <div style={styles.notifWrapper} ref={notifRef}>
            <button style={styles.bellBtn} onClick={() => setShowNotifications(!showNotifications)}>
              🔔
              {unreadCount > 0 && <span style={styles.badge}>{unreadCount}</span>}
            </button>
            {showNotifications && (
              <div style={styles.notifDropdown}>
                <div style={styles.notifHeader}>
                  <span style={styles.notifTitle}>Notifications</span>
                  {unreadCount > 0 && <button style={styles.markAllBtn} onClick={markAllRead}>Mark all read</button>}
                </div>
                {notifications.length === 0 ? (
                  <p style={styles.noNotif}>No notifications yet!</p>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} style={{ ...styles.notifItem, background: n.isRead ? 'white' : '#f0f0ff' }} onClick={() => markRead(n.id)}>
                      <p style={styles.notifMsg}>{n.message}</p>
                      <p style={styles.notifTime}>{new Date(n.createdAt).toLocaleString()}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          <button style={styles.logoutBtn} onClick={handleLogout}>Logout</button>
        </div>
      </div>

      <div style={styles.content}>
        <h2 style={styles.heading}>Your Dashboard</h2>

        {/* Overall Stats */}
        <div style={styles.statsRow}>
          <div style={styles.statCard}>
            <h3 style={styles.statNum}>{overallStats?.totalTeams || 0}</h3>
            <p style={styles.statLabel}>👥 Teams</p>
          </div>
          <div style={styles.statCard}>
            <h3 style={styles.statNum}>{overallStats?.totalTasks || 0}</h3>
            <p style={styles.statLabel}>📋 Total Tasks</p>
          </div>
          <div style={styles.statCard}>
            <h3 style={styles.statNum}>{overallStats?.doneTasks || 0}</h3>
            <p style={styles.statLabel}>✅ Completed</p>
          </div>
          <div style={{ ...styles.statCard, background: '#4f46e5' }}>
            <h3 style={{ ...styles.statNum, color: 'white' }}>{overallStats?.completionRate || 0}%</h3>
            <p style={{ ...styles.statLabel, color: 'rgba(255,255,255,0.8)' }}>🎯 Overall Rate</p>
          </div>
        </div>

        {/* Per Team Stats */}
        {teamStats.length > 0 && (
          <>
            <h3 style={styles.sectionTitle}>📊 Stats Per Team</h3>
            <div style={styles.teamStatsGrid}>
              {teamStats.map((ts) => (
                <div key={ts.teamId} style={styles.teamStatCard}>
                  <h3 style={styles.teamName}>👥 {ts.teamName}</h3>
                  <div style={styles.teamStatRow}>
                    <div style={styles.miniStat}>
                      <span style={styles.miniNum}>{ts.totalTasks}</span>
                      <span style={styles.miniLabel}>Total</span>
                    </div>
                    <div style={styles.miniStat}>
                      <span style={{ ...styles.miniNum, color: '#6b7280' }}>{ts.todoTasks}</span>
                      <span style={styles.miniLabel}>To Do</span>
                    </div>
                    <div style={styles.miniStat}>
                      <span style={{ ...styles.miniNum, color: '#f59e0b' }}>{ts.inProgressTasks}</span>
                      <span style={styles.miniLabel}>In Progress</span>
                    </div>
                    <div style={styles.miniStat}>
                      <span style={{ ...styles.miniNum, color: '#10b981' }}>{ts.doneTasks}</span>
                      <span style={styles.miniLabel}>Done</span>
                    </div>
                  </div>
                  {ts.totalTasks > 0 && (
                    <>
                      <div style={styles.progressBar}>
                        <div style={{ ...styles.progressFill, width: `${ts.completionRate}%` }} />
                      </div>
                      <p style={styles.progressLabel}>{ts.completionRate}% Complete</p>
                      <div style={{ width: '140px', margin: '12px auto 0' }}>
                        <Doughnut
                          data={{
                            labels: ['To Do', 'In Progress', 'Done'],
                            datasets: [{
                              data: [ts.todoTasks, ts.inProgressTasks, ts.doneTasks],
                              backgroundColor: ['#6b7280', '#f59e0b', '#10b981'],
                              borderWidth: 0,
                            }]
                          }}
                          options={{ plugins: { legend: { display: false } } }}
                        />
                      </div>
                    </>
                  )}
                  {ts.totalTasks === 0 && (
                    <p style={styles.noTasks}>No tasks yet!</p>
                  )}
                  <button
                    style={styles.goBtn}
                    onClick={() => navigate('/tasks')}>
                    View Tasks →
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Navigation Cards */}
        <div style={styles.cards}>
          <div style={styles.card} onClick={() => navigate('/teams')}>
            <h3>👥 My Teams</h3>
            <p>Create or join a team</p>
            <button style={styles.cardBtn}>Go to Teams →</button>
          </div>
          <div style={styles.card} onClick={() => navigate('/tasks')}>
            <h3>✅ Task Board</h3>
            <p>Manage your tasks</p>
            <button style={styles.cardBtn}>Go to Tasks →</button>
          </div>
          <div style={styles.card} onClick={() => navigate('/chat')}>
            <h3>💬 Team Chat</h3>
            <p>Chat with your team</p>
            <button style={styles.cardBtn}>Go to Chat →</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: '#f0f2f5' },
  navbar: { background: 'white', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
  logo: { color: '#4f46e5', margin: 0 },
  navRight: { display: 'flex', alignItems: 'center', gap: '16px' },
  welcome: { color: '#333', fontSize: '16px' },
  logoutBtn: { padding: '8px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' },
  notifWrapper: { position: 'relative' },
  bellBtn: { background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', position: 'relative', padding: '4px' },
  badge: { position: 'absolute', top: '-4px', right: '-4px', background: '#ef4444', color: 'white', borderRadius: '50%', width: '18px', height: '18px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  notifDropdown: { position: 'absolute', right: 0, top: '40px', width: '320px', background: 'white', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 1000, maxHeight: '400px', overflowY: 'auto' },
  notifHeader: { padding: '16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  notifTitle: { fontWeight: 'bold', color: '#333' },
  markAllBtn: { background: 'none', border: 'none', color: '#4f46e5', cursor: 'pointer', fontSize: '12px' },
  notifItem: { padding: '12px 16px', borderBottom: '1px solid #f0f0f0', cursor: 'pointer' },
  notifMsg: { margin: '0 0 4px 0', color: '#333', fontSize: '14px' },
  notifTime: { margin: 0, color: '#9ca3af', fontSize: '11px' },
  noNotif: { padding: '24px', textAlign: 'center', color: '#9ca3af' },
  content: { padding: '32px' },
  heading: { color: '#333', marginBottom: '24px' },
  sectionTitle: { color: '#333', marginBottom: '16px', marginTop: '8px' },
  statsRow: { display: 'flex', gap: '16px', marginBottom: '32px', flexWrap: 'wrap' },
  statCard: { background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', flex: 1, minWidth: '150px', textAlign: 'center' },
  statNum: { fontSize: '36px', fontWeight: 'bold', color: '#4f46e5', margin: '0 0 8px 0' },
  statLabel: { color: '#666', margin: 0, fontSize: '14px' },
  teamStatsGrid: { display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '32px' },
  teamStatCard: { background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', flex: 1, minWidth: '250px', textAlign: 'center' },
  teamName: { color: '#4f46e5', marginTop: 0, marginBottom: '16px', fontSize: '16px' },
  teamStatRow: { display: 'flex', justifyContent: 'space-around', marginBottom: '12px' },
  miniStat: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  miniNum: { fontSize: '24px', fontWeight: 'bold', color: '#4f46e5' },
  miniLabel: { fontSize: '11px', color: '#9ca3af', marginTop: '2px' },
  progressBar: { background: '#f0f0f0', borderRadius: '8px', height: '8px', margin: '8px 0 4px' },
  progressFill: { background: '#10b981', borderRadius: '8px', height: '8px', transition: 'width 0.3s ease' },
  progressLabel: { color: '#10b981', fontSize: '12px', fontWeight: 'bold', margin: '0' },
  noTasks: { color: '#9ca3af', fontSize: '14px', margin: '16px 0' },
  goBtn: { marginTop: '16px', padding: '8px 16px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' },
  cards: { display: 'flex', gap: '24px', flexWrap: 'wrap', marginTop: '32px' },
  card: { background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', minWidth: '200px', flex: 1, cursor: 'pointer' },
  cardBtn: { marginTop: '12px', padding: '8px 16px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' },
};