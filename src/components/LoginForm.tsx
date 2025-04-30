import React, { useState } from 'react';

interface LoginFormProps {
  onLogin?: (username: string, password: string) => Promise<void>;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (onLogin) {
        await onLogin(username, password);
      } else {
        // TODO: Replace with real API call
        if (username === 'admin' && password === 'password') {
          window.location.href = '/';
        } else {
          throw new Error('Invalid username or password');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="form-container" onSubmit={handleSubmit}>
      <h2>Login</h2>
      <div className="form-group">
        <label htmlFor="username">Username</label>
        <input
          type="text"
          id="username"
          name="username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          required
        />
      </div>
      <div className="form-group">
        <label htmlFor="password">Password</label>
        <input
          type="password"
          id="password"
          name="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
      </div>
      <button type="submit" className="btn" disabled={loading}>
        {loading ? 'Logging in...' : 'Login'}
      </button>
      {error && <div className="error" style={{ color: 'red', marginTop: '1rem' }}>{error}</div>}
      <p style={{ marginTop: '1rem' }}>
        Don't have an account? <a href="/signup">Sign up here</a>
      </p>
    </form>
  );
};

export default LoginForm;
