import { useEffect, useState } from 'react';

const getInitialTheme = () => localStorage.getItem('teamsync-theme') || 'dark';

export default function ThemeToggle() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('teamsync-theme', theme);
  }, [theme]);

  const isLight = theme === 'light';

  return (
    <button
      type="button"
      aria-label={`Switch to ${isLight ? 'dark' : 'light'} theme`}
      title={`Switch to ${isLight ? 'dark' : 'light'} theme`}
      onClick={() => setTheme(isLight ? 'dark' : 'light')}
      style={styles.toggle}
    >
      <span style={{ ...styles.thumb, transform: isLight ? 'translateX(26px)' : 'translateX(0)' }}>
        {isLight ? '☀' : '☾'}
      </span>
    </button>
  );
}

const styles = {
  toggle: {
    width: '58px',
    minWidth: '58px',
    height: '32px',
    minHeight: '32px',
    padding: '3px',
    borderRadius: '999px',
    border: '1px solid var(--border-color)',
    background: 'var(--glass-bg)',
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-soft)',
  },
  thumb: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, var(--primary-accent), var(--secondary-accent))',
    color: '#FFFFFF',
    fontSize: '14px',
    lineHeight: 1,
    transition: 'transform 220ms ease',
  },
};
