import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTeam, joinTeam, getMyTeams } from '../services/teamService';

export default function TeamPage() {
  const [teams, setTeams] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '' });
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = async () => {
    try {
      const res = await getMyTeams();
      setTeams(res.data);
    } catch (err) {
      console.error('Failed to load teams');
    }
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
    } catch (err) {
      setError(err.response?.data || 'Failed to create team');
    }
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
    } catch (err) {
      setError(err.response?.data || 'Failed to join team');
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>My Teams</h2>
        <div style={styles.btnGroup}>
          <button style={styles.btnPrimary} onClick={() => { setShowCreate(true); setShowJoin(false); }}>
            + Create Team
          </button>
          <button style={styles.btnSecondary} onClick={() => { setShowJoin(true); setShowCreate(false); }}>
            Join Team
          </button>
          <button style={styles.btnBack} onClick={() => navigate('/dashboard')}>
            ← Back
          </button>
        </div>
      </div>

      {error && <p style={styles.error}>{error}</p>}
      {success && <p style={styles.success}>{success}</p>}

      {showCreate && (
        <div style={styles.formCard}>
          <h3>Create New Team</h3>
          <form onSubmit={handleCreate}>
            <input
              style={styles.input}
              placeholder="Team Name"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              required
            />
            <input
              style={styles.input}
              placeholder="Description (optional)"
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
            />
            <button style={styles.btnPrimary} type="submit">Create</button>
          </form>
        </div>
      )}

      {showJoin && (
        <div style={styles.formCard}>
          <h3>Join a Team</h3>
          <form onSubmit={handleJoin}>
            <input
              style={styles.input}
              placeholder="Enter Invite Code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              required
            />
            <button style={styles.btnPrimary} type="submit">Join</button>
          </form>
        </div>
      )}

      <div style={styles.teamGrid}>
        {teams.length === 0 ? (
          <p style={styles.empty}>No teams yet. Create or join one!</p>
        ) : (
          teams.map((team) => (
            <div key={team.id} style={styles.teamCard}>
              <h3 style={styles.teamName}>{team.name}</h3>
              <p style={styles.teamDesc}>{team.description || 'No description'}</p>
              <div style={styles.inviteBox}>
                <span style={styles.inviteLabel}>Invite Code:</span>
                <span style={styles.inviteCode}>{team.inviteCode}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { padding: '32px', background: '#f0f2f5', minHeight: '100vh' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  title: { color: '#333', margin: 0 },
  btnGroup: { display: 'flex', gap: '12px' },
  btnPrimary: { padding: '10px 20px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' },
  btnSecondary: { padding: '10px 20px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' },
  btnBack: { padding: '10px 20px', background: '#6b7280', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' },
  formCard: { background: 'white', padding: '24px', borderRadius: '12px', marginBottom: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
  input: { width: '100%', padding: '12px', marginBottom: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', boxSizing: 'border-box' },
  teamGrid: { display: 'flex', flexWrap: 'wrap', gap: '24px' },
  teamCard: { background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', minWidth: '250px', flex: 1 },
  teamName: { color: '#4f46e5', marginTop: 0 },
  teamDesc: { color: '#666', fontSize: '14px' },
  inviteBox: { background: '#f0f2f5', padding: '12px', borderRadius: '8px', marginTop: '12px' },
  inviteLabel: { color: '#666', fontSize: '12px', display: 'block', marginBottom: '4px' },
  inviteCode: { color: '#4f46e5', fontWeight: 'bold', fontSize: '18px', letterSpacing: '2px' },
  error: { color: 'red', marginBottom: '16px' },
  success: { color: 'green', marginBottom: '16px' },
  empty: { color: '#666', fontSize: '16px' },
};