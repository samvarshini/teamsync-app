import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement, Title,
} from 'chart.js';
import API from '../services/api';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

export default function Dashboard() {
  const { user, logoutUser } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef(null);

  useEffect(() => {
    loadStats();
    loadNotifications();
    const interval = setInterval(loadUnreadCount, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const authHeader = { headers: { Authorization: `Bearer ${user.token}` } };

  const loadStats = async () => {
    try {
      const res = await API.get('/stats/dashboard', authHeader);
      setStats(res.data);
    } catch (err) { console.error('Failed to load stats'); }
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

  const doughnutData = {
    labels: ['To Do', 'In Progress', 'Done'],
    datasets: [{ data: [stats?.todoTasks || 0, stats?.inProgressTasks || 0, stats?.doneTasks || 0], backgroundColor: ['#6b7280', '#f59e0b', '#10b981'], borderWidth: 0 }],
  };

  const barData = {
    labels: ['To Do', 'In Progress', 'Done'],
    datasets: [{ label: 'Tasks', data: [stats?.todoTasks || 0, stats?.inProgressTasks || 0, stats?.doneTasks || 0], backgroundColor: ['#6b7280', '#f59e0b', '#10b981'], borderRadius: 8 }],
  };

  return (
    <div style={styles.container}>
      <div style={styles.navbar}>
        <h1 style={styles.logo}>TeamSync</h1>
        <div style={styles.navRight}>
          <span style={styles.welcome}>👋 Welcome, {user?.name}!</span>

          {/* Notification Bell */}
          <div style={styles.notifWrapper} ref={notifRef}>
            <button style={styles.bellBtn} onClick={() => setShowNotifications(!showNotifications)}>
              🔔
              {unreadCount > 0 && (
                <span style={styles.badge}>{unreadCount}</span>
              )}
            </button>

            {showNotifications && (
              <div style={styles.notifDropdown}>
                <div style={styles.notifHeader}>
                  <span style={styles.notifTitle}>Notifications</span>
                  {unreadCount > 0 && (
                    <button style={styles.markAllBtn} onClick={markAllRead}>
                      Mark all read
                    </button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <p style={styles.noNotif}>No notifications yet!</p>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      style={{ ...styles.notifItem, background: n.isRead ? 'white' : '#f0f0ff' }}
                      onClick={() => markRead(n.id)}>
                      <p style={styles.notifMsg}>{n.message}</p>
                      <p style={styles.notifTime}>
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
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

        <div style={styles.statsRow}>
          <div style={styles.statCard}>
            <h3 style={styles.statNum}>{stats?.totalTeams || 0}</h3>
            <p style={styles.statLabel}>👥 Teams</p>
          </div>
          <div style={styles.statCard}>
            <h3 style={styles.statNum}>{stats?.totalTasks || 0}</h3>
            <p style={styles.statLabel}>📋 Total Tasks</p>
          </div>
          <div style={styles.statCard}>
            <h3 style={styles.statNum}>{stats?.doneTasks || 0}</h3>
            <p style={styles.statLabel}>✅ Completed</p>
          </div>
          <div style={{ ...styles.statCard, background: '#4f46e5' }}>
            <h3 style={{ ...styles.statNum, color: 'white' }}>{stats?.completionRate || 0}%</h3>
            <p style={{ ...styles.statLabel, color: 'rgba(255,255,255,0.8)' }}>🎯 Completion Rate</p>
          </div>
        </div>

        {stats && stats.totalTasks > 0 && (
          <div style={styles.chartsRow}>
            <div style={styles.chartCard}>
              <h3 style={styles.chartTitle}>Task Status Overview</h3>
              <div style={{ width: '250px', margin: '0 auto' }}>
                <Doughnut data={doughnutData} />
              </div>
            </div>
            <div style={styles.chartCard}>
              <h3 style={styles.chartTitle}>Tasks by Status</h3>
              <Bar data={barData} options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }} />
            </div>
          </div>
        )}

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
  statsRow: { display: 'flex', gap: '16px', marginBottom: '32px', flexWrap: 'wrap' },
  statCard: { background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', flex: 1, minWidth: '150px', textAlign: 'center' },
  statNum: { fontSize: '36px', fontWeight: 'bold', color: '#4f46e5', margin: '0 0 8px 0' },
  statLabel: { color: '#666', margin: 0, fontSize: '14px' },
  chartsRow: { display: 'flex', gap: '24px', marginBottom: '32px', flexWrap: 'wrap' },
  chartCard: { background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', flex: 1, minWidth: '300px' },
  chartTitle: { color: '#333', marginTop: 0, marginBottom: '16px' },
  cards: { display: 'flex', gap: '24px', flexWrap: 'wrap' },
  card: { background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', minWidth: '200px', flex: 1, cursor: 'pointer' },
  cardBtn: { marginTop: '12px', padding: '8px 16px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' },
};