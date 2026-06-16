import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginUser } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await login(form);
      loginUser(res.data);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.themeSpot}>
        <ThemeToggle />
      </div>
      <div style={styles.card}>
        <h1 style={styles.logo}>TeamSync</h1>
        <h2 style={styles.title}>Welcome Back</h2>
        {error && <p style={styles.error}>{error}</p>}
        <form onSubmit={handleSubmit}>
          <input
            style={styles.input}
            type="email"
            name="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            required
          />
          <input
            style={styles.input}
            type="password"
            name="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            required
          />
          <button style={styles.button} type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <p style={styles.link}>
          Don't have an account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    background: 'transparent',
    position: 'relative',
  },
  themeSpot: {
    position: 'absolute',
    top: '24px',
    right: '24px',
  },
  card: {
    background: 'var(--glass-bg)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    padding: '42px',
    borderRadius: '24px',
    border: '1px solid var(--border-color)',
    boxShadow: 'var(--shadow-strong), inset 0 1px 0 rgba(255,255,255,0.10)',
    width: '100%',
    maxWidth: '400px',
    animation: 'fadeIn 260ms ease',
  },
  logo: {
    textAlign: 'center',
    color: 'var(--text-primary)',
    marginBottom: '8px',
    fontSize: '32px',
    letterSpacing: '0',
  },
  title: {
    textAlign: 'center',
    color: 'var(--text-secondary)',
    marginBottom: '24px',
    fontSize: '18px',
    fontWeight: 500,
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    marginBottom: '16px',
    borderRadius: '16px',
    border: '1px solid var(--border-color)',
    background: 'var(--input-bg)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  button: {
    width: '100%',
    padding: '14px',
    background: 'linear-gradient(135deg, var(--primary-accent), var(--secondary-accent))',
    color: 'white',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
    fontSize: '16px',
    cursor: 'pointer',
    marginTop: '8px',
    fontWeight: 700,
    boxShadow: '0 16px 32px rgba(var(--primary-accent-rgb),0.24)',
  },
  error: {
    color: 'var(--error)',
    background: 'rgba(var(--error-rgb),0.12)',
    border: '1px solid rgba(var(--error-rgb),0.24)',
    borderRadius: '14px',
    padding: '10px 12px',
    textAlign: 'center',
    marginBottom: '16px',
  },
  link: {
    textAlign: 'center',
    marginTop: '16px',
    color: 'var(--text-secondary)',
  },
};
