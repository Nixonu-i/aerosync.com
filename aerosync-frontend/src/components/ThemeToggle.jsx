import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import API from '../api/api';

export default function ThemeToggle() {
  const { user, updateUserTheme } = useContext(AuthContext);
  const [theme, setTheme] = useState('LIGHT');
  
  // Initialize theme from user profile or localStorage
  useEffect(() => {
    const userTheme = user?.theme_preference || localStorage.getItem('theme') || 'LIGHT';
    setTheme(userTheme);
    applyTheme(userTheme);
  }, [user]);
  
  const applyTheme = (themeName) => {
    const root = document.documentElement;
    if (themeName === 'DARK') {
      root.setAttribute('data-theme', 'dark');
    } else if (themeName === 'LIGHT') {
      root.setAttribute('data-theme', 'light');
    } else {
      // System default
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    }
    localStorage.setItem('theme', themeName);
  };
  
  const toggleTheme = async () => {
    const newTheme = theme === 'LIGHT' ? 'DARK' : 'LIGHT';
    setTheme(newTheme);
    applyTheme(newTheme);
    
    // Save to backend if logged in
    if (user) {
      try {
        await API.patch('auth/update-theme/', { theme_preference: newTheme });
        updateUserTheme(newTheme);
      } catch (err) {
        console.error('Failed to save theme preference:', err);
      }
    }
  };
  
  return (
    <button
      onClick={toggleTheme}
      style={{
        background: 'transparent',
        border: '1px solid var(--border)',
        color: 'var(--text-primary)',
        padding: '6px 12px',
        borderRadius: '6px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '14px',
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--background)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      {theme === 'DARK' ? (
        <>
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
            <circle cx="12" cy="12" r="5"/>
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span className="nav-toggle-label">Light</span>
        </>
      ) : (
        <>
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
          <span className="nav-toggle-label">Dark</span>
        </>
      )}
    </button>
  );
}
