import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTeam, joinTeam, getMyTeams, deleteTeam, leaveTeam, getTeamMembers } from '../services/teamService';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';

export default function TeamPage() {
  const [teams, setTeams] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '' });
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [showMembers, setShowMembers] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => { loadTeams(); }, []);

  const loadTeams = async () => {
    try {
      const res = await getMyTeams();
      setTeams(res.data);
    } catch (err) { console.error('Failed to load teams'); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await createTeam(createForm);
      setSuccess('Team created successfully!');
      setShowCreate(false);
      setCreateForm({ name: '', description: '' });
      loadTeams();
    } catch (err) { setError(err.response?.data || 'Failed to create team'); }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await joinTeam(inviteCode);
      setSuccess('Joined team successfully!');
      setShowJoin(false);
      setInviteCode('');
      loadTeams();
    } catch (err) { setError(err.response?.data || 'Failed to join team'); }
  };

  const handleDelete = async (teamId) => {
    if (!window.confirm('Are you sure you want to delete this team? This cannot be undone!')) return;
    try {
      await deleteTeam(teamId);
      setSuccess('Team deleted successfully!');
      loadTeams();
    } catch (err) { setError(err.response?.data || 'Failed to delete team'); }
  };

  const handleLeave = async (teamId) => {
    if (!window.confirm('Are you sure you want to leave this team?')) return;
    try {
      await leaveTeam(teamId);
      setSuccess('Left team successfully!');
      loadTeams();
    } catch (err) { setError(err.response?.data || 'Failed to leave team'); }
  };

  const handleViewMembers = async (team) => {
    try {
      const res = await getTeamMembers(team.id);
      setTeamMembers(res.data);
      setSelectedTeam(team);
      setShowMembers(true);
    } catch (err) { setError('Failed to load members'); }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>My Teams</h2>
        <div style={styles.btnGroup}>
          <ThemeToggle />
          <button style={styles.btnPrimary} onClick={() => { setShowCreate(true); setShowJoin(false); }}>+ Create Team</button>
          <button style={styles.btnSecondary} onClick={() => { setShowJoin(true); setShowCreate(false); }}>Join Team</button>
          <button style={styles.btnBack} onClick={() => navigate('/dashboard')}>← Back</button>
        </div>
      </div>

      {error && <p style={styles.error}>{error}</p>}
      {success && <p style={styles.success}>{success}</p>}

      {showCreate && (
        <div style={styles.formCard}>
          <h3>Create New Team</h3>
          <form onSubmit={handleCreate}>
            <input style={styles.input} placeholder="Team Name" value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} required />
            <input style={styles.input} placeholder="Description (optional)" value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button style={styles.btnPrimary} type="submit">Create</button>
              <button style={styles.btnBack} type="button" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {showJoin && (
        <div style={styles.formCard}>
          <h3>Join a Team</h3>
          <form onSubmit={handleJoin}>
            <input style={styles.input} placeholder="Enter Invite Code" value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)} required />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button style={styles.btnPrimary} type="submit">Join</button>
              <button style={styles.btnBack} type="button" onClick={() => setShowJoin(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Members Modal */}
      {showMembers && selectedTeam && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h3 style={{ margin: 0 }}>👥 {selectedTeam.name} — Members ({teamMembers.length})</h3>
              <button style={styles.closeBtn} onClick={() => setShowMembers(false)}>✕</button>
            </div>
            {teamMembers.map((m, i) => (
              <div key={i} style={styles.memberRow}>
                <div style={styles.avatar}>{m.name?.charAt(0).toUpperCase()}</div>
                <div>
                  <p style={styles.memberName}>{m.name}</p>
                  <p style={styles.memberEmail}>{m.email}</p>
                </div>
                <span style={{ ...styles.roleTag, background: m.role === 'admin' ? 'linear-gradient(135deg, var(--primary-accent), var(--secondary-accent))' : 'linear-gradient(135deg, var(--primary-accent), var(--success))' }}>
                  {m.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={styles.teamGrid}>
        {teams.length === 0 ? (
          <p style={styles.empty}>No teams yet. Create or join one!</p>
        ) : (
          teams.map((team) => (
            <div key={team.id} style={styles.teamCard}>
              <div style={styles.teamCardHeader}>
                <h3 style={styles.teamName}>{team.name}</h3>
                <span style={styles.memberCount}>👥 {team.memberCount} member{team.memberCount !== 1 ? 's' : ''}</span>
              </div>
              <p style={styles.teamDesc}>{team.description || 'No description'}</p>
              <div style={styles.inviteBox}>
                <span style={styles.inviteLabel}>Invite Code:</span>
                <span style={styles.inviteCode}>{team.inviteCode}</span>
              </div>
              <div style={styles.teamActions}>
                <button style={styles.btnSmall} onClick={() => handleViewMembers(team)}>
                  👥 View Members
                </button>
                {team.isAdmin ? (
                  <button style={{ ...styles.btnSmall, background: 'rgba(var(--error-rgb),0.16)', color: 'var(--error)', border: '1px solid rgba(var(--error-rgb),0.24)' }} onClick={() => handleDelete(team.id)}>
                    🗑️ Delete Team
                  </button>
                ) : (
                  <button style={{ ...styles.btnSmall, background: 'rgba(var(--warning-rgb),0.16)', color: 'var(--warning)', border: '1px solid rgba(var(--warning-rgb),0.24)' }} onClick={() => handleLeave(team.id)}>
                    🚪 Leave Team
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { padding: '32px', background: 'transparent', minHeight: '100vh' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '18px', marginBottom: '24px', background: 'var(--glass-bg)', backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)', border: '1px solid var(--border-color)', borderRadius: '22px', padding: '18px 20px', boxShadow: 'var(--shadow-soft)' },
  title: { color: 'var(--text-primary)', margin: 0, fontSize: '28px' },
  btnGroup: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' },
  btnPrimary: { padding: '11px 20px', background: 'linear-gradient(135deg, var(--primary-accent), var(--secondary-accent))', color: 'white', border: '1px solid var(--border-color)', borderRadius: '14px', cursor: 'pointer', fontWeight: 700, boxShadow: '0 14px 30px rgba(var(--primary-accent-rgb),0.24)' },
  btnSecondary: { padding: '11px 20px', background: 'rgba(var(--success-rgb),0.14)', color: 'var(--success)', border: '1px solid rgba(var(--success-rgb),0.24)', borderRadius: '14px', cursor: 'pointer', fontWeight: 700 },
  btnBack: { padding: '11px 20px', background: 'var(--glass-bg-soft)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '14px', cursor: 'pointer', fontWeight: 700 },
  btnSmall: { padding: '9px 14px', background: 'linear-gradient(135deg, var(--primary-accent), var(--secondary-accent))', color: 'white', border: '1px solid var(--border-color)', borderRadius: '13px', cursor: 'pointer', fontSize: '13px', fontWeight: 700 },
  formCard: { background: 'var(--glass-bg)', color: 'var(--text-primary)', backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)', padding: '24px', borderRadius: '22px', border: '1px solid var(--border-color)', marginBottom: '24px', boxShadow: 'var(--shadow-soft)' },
  input: { width: '100%', padding: '13px 15px', marginBottom: '12px', borderRadius: '14px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: '14px', boxSizing: 'border-box' },
  teamGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' },
  teamCard: { background: 'var(--glass-bg)', backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)', padding: '24px', borderRadius: '22px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-soft)', minWidth: '0', flex: 1, transition: 'transform 220ms ease, box-shadow 220ms ease' },
  teamCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '8px' },
  teamName: { color: 'var(--primary-accent)', margin: 0 },
  memberCount: { background: 'rgba(var(--primary-accent-rgb),0.12)', color: 'var(--primary-accent)', border: '1px solid rgba(var(--primary-accent-rgb),0.22)', padding: '5px 10px', borderRadius: '999px', fontSize: '13px', whiteSpace: 'nowrap' },
  teamDesc: { color: 'var(--text-secondary)', fontSize: '14px' },
  inviteBox: { background: 'var(--glass-bg-soft)', border: '1px solid var(--border-color)', padding: '13px', borderRadius: '16px', marginTop: '12px' },
  inviteLabel: { color: 'var(--text-muted)', fontSize: '12px', display: 'block', marginBottom: '4px' },
  inviteCode: { color: 'var(--primary-accent)', fontWeight: 'bold', fontSize: '18px', letterSpacing: '2px' },
  teamActions: { display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' },
  error: { color: 'var(--error)', background: 'rgba(var(--error-rgb),0.12)', border: '1px solid rgba(var(--error-rgb),0.24)', borderRadius: '14px', padding: '10px 12px', marginBottom: '16px' },
  success: { color: 'var(--success)', background: 'rgba(var(--success-rgb),0.12)', border: '1px solid rgba(var(--success-rgb),0.24)', borderRadius: '14px', padding: '10px 12px', marginBottom: '16px' },
  empty: { color: 'var(--text-secondary)', fontSize: '16px' },
  modal: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.62)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' },
  modalContent: { background: 'var(--glass-bg-strong)', color: 'var(--text-primary)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid var(--border-color)', borderRadius: '24px', padding: '24px', width: '90%', maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto', boxShadow: 'var(--shadow-strong)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  closeBtn: { background: 'var(--hover-bg)', border: '1px solid var(--border-color)', borderRadius: '999px', fontSize: '18px', cursor: 'pointer', color: 'var(--text-secondary)', width: '34px', height: '34px' },
  memberRow: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: '1px solid var(--border-color)' },
  avatar: { width: '42px', height: '42px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary-accent), var(--secondary-accent))', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0, boxShadow: '0 10px 24px rgba(var(--primary-accent-rgb),0.24)' },
  memberName: { margin: 0, fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '14px' },
  memberEmail: { margin: 0, color: 'var(--text-muted)', fontSize: '12px' },
  roleTag: { marginLeft: 'auto', padding: '5px 10px', borderRadius: '999px', color: 'white', fontSize: '12px', flexShrink: 0, fontWeight: 700 },
};
