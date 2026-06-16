import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import API from '../services/api';
import ThemeToggle from '../components/ThemeToggle';

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
          <ThemeToggle />
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
                    <div key={n.id} style={{ ...styles.notifItem, background: n.isRead ? 'var(--hover-bg)' : 'rgba(var(--primary-accent-rgb),0.18)' }} onClick={() => markRead(n.id)}>
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
          <div style={{ ...styles.statCard, background: 'linear-gradient(135deg, rgba(var(--primary-accent-rgb),0.26), rgba(var(--secondary-accent-rgb),0.26))' }}>
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
                      <span style={{ ...styles.miniNum, color: 'var(--text-secondary)' }}>{ts.todoTasks}</span>
                      <span style={styles.miniLabel}>To Do</span>
                    </div>
                    <div style={styles.miniStat}>
                      <span style={{ ...styles.miniNum, color: 'var(--warning)' }}>{ts.inProgressTasks}</span>
                      <span style={styles.miniLabel}>In Progress</span>
                    </div>
                    <div style={styles.miniStat}>
                      <span style={{ ...styles.miniNum, color: 'var(--success)' }}>{ts.doneTasks}</span>
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
                              backgroundColor: ['#CBD5E1', '#F59E0B', '#22C55E'],
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
  container: { minHeight: '100vh', background: 'transparent' },
  navbar: { background: 'var(--glass-bg)', backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)', padding: '18px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', boxShadow: 'var(--shadow-soft)', position: 'sticky', top: 0, zIndex: 20 },
  logo: { color: 'var(--text-primary)', margin: 0, fontSize: '26px', letterSpacing: '0' },
  navRight: { display: 'flex', alignItems: 'center', gap: '16px' },
  welcome: { color: 'var(--text-secondary)', fontSize: '15px' },
  logoutBtn: { padding: '9px 16px', background: 'rgba(var(--error-rgb),0.16)', color: 'var(--error)', border: '1px solid rgba(var(--error-rgb),0.24)', borderRadius: '14px', cursor: 'pointer', fontWeight: 700 },
  notifWrapper: { position: 'relative' },
  bellBtn: { background: 'var(--glass-bg-soft)', border: '1px solid var(--border-color)', borderRadius: '14px', fontSize: '22px', cursor: 'pointer', position: 'relative', padding: '8px 10px', color: 'var(--text-primary)' },
  badge: { position: 'absolute', top: '-6px', right: '-6px', background: 'var(--error)', color: 'white', borderRadius: '50%', minWidth: '20px', height: '20px', padding: '0 5px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)' },
  notifDropdown: { position: 'absolute', right: 0, top: '48px', width: '340px', background: 'var(--glass-bg-strong)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid var(--border-color)', borderRadius: '20px', boxShadow: 'var(--shadow-strong)', zIndex: 1000, maxHeight: '420px', overflowY: 'auto' },
  notifHeader: { padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  notifTitle: { fontWeight: 'bold', color: 'var(--text-primary)' },
  markAllBtn: { background: 'rgba(var(--primary-accent-rgb),0.12)', border: '1px solid rgba(var(--primary-accent-rgb),0.22)', color: 'var(--primary-accent)', cursor: 'pointer', fontSize: '12px', borderRadius: '999px', padding: '6px 10px' },
  notifItem: { padding: '12px 16px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer' },
  notifMsg: { margin: '0 0 4px 0', color: 'var(--text-primary)', fontSize: '14px' },
  notifTime: { margin: 0, color: 'var(--text-muted)', fontSize: '11px' },
  noNotif: { padding: '24px', textAlign: 'center', color: 'var(--text-muted)' },
  content: { padding: '36px', maxWidth: '1280px', margin: '0 auto' },
  heading: { color: 'var(--text-primary)', marginBottom: '24px', fontSize: '30px' },
  sectionTitle: { color: 'var(--text-primary)', marginBottom: '16px', marginTop: '8px' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '18px', marginBottom: '34px' },
  statCard: { background: 'var(--glass-bg)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', padding: '24px', borderRadius: '22px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-soft)', flex: 1, minWidth: '150px', textAlign: 'center', transition: 'transform 220ms ease, box-shadow 220ms ease' },
  statNum: { fontSize: '38px', fontWeight: '800', color: 'var(--primary-accent)', margin: '0 0 8px 0' },
  statLabel: { color: 'var(--text-secondary)', margin: 0, fontSize: '14px' },
  teamStatsGrid: { display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '32px' },
  teamStatCard: { background: 'var(--glass-bg)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', padding: '24px', borderRadius: '22px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-soft)', flex: 1, minWidth: '250px', textAlign: 'center' },
  teamName: { color: 'var(--primary-accent)', marginTop: 0, marginBottom: '16px', fontSize: '16px' },
  teamStatRow: { display: 'flex', justifyContent: 'space-around', marginBottom: '12px' },
  miniStat: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  miniNum: { fontSize: '24px', fontWeight: 'bold', color: 'var(--primary-accent)' },
  miniLabel: { fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' },
  progressBar: { background: 'var(--hover-bg)', borderRadius: '999px', height: '9px', margin: '8px 0 4px', overflow: 'hidden' },
  progressFill: { background: 'linear-gradient(90deg, var(--primary-accent), var(--success))', borderRadius: '999px', height: '9px', transition: 'width 0.3s ease' },
  progressLabel: { color: 'var(--success)', fontSize: '12px', fontWeight: 'bold', margin: '0' },
  noTasks: { color: 'var(--text-muted)', fontSize: '14px', margin: '16px 0' },
  goBtn: { marginTop: '16px', padding: '9px 16px', background: 'linear-gradient(135deg, var(--primary-accent), var(--secondary-accent))', color: 'white', border: '1px solid var(--border-color)', borderRadius: '14px', cursor: 'pointer', fontSize: '13px', fontWeight: 700 },
  cards: { display: 'flex', gap: '24px', flexWrap: 'wrap', marginTop: '32px' },
  card: { background: 'var(--glass-bg)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', color: 'var(--text-primary)', padding: '24px', borderRadius: '22px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-soft)', minWidth: '200px', flex: 1, cursor: 'pointer', transition: 'transform 220ms ease, box-shadow 220ms ease' },
  cardBtn: { marginTop: '12px', padding: '9px 16px', background: 'linear-gradient(135deg, var(--primary-accent), var(--secondary-accent))', color: 'white', border: '1px solid var(--border-color)', borderRadius: '14px', cursor: 'pointer', fontWeight: 700 },
};
