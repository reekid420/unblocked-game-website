import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const SignupForm: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (password !== confirmPassword) {
      setError('Passwords do not match!');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    setLoading(true);
    try {
      // Register user using apiClient
      const response = await import('../api/apiClient').then(mod => mod.register(username, password));
      if (response && response.user) {
        setSuccess(true);
        await login(username, password); // auto-login after signup
        window.location.href = '/';
      } else {
        setError('Failed to create account. Username may already exist.');
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="form-container" onSubmit={handleSubmit}>
      <h2>Create Account</h2>
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
        <small>Password must be at least 8 characters long</small>
      </div>
      <div className="form-group">
        <label htmlFor="confirmPassword">Confirm Password</label>
        <input
          type="password"
          id="confirmPassword"
          name="confirmPassword"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          required
        />
      </div>
      {error && <div className="error" style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
      {success && <div className="success" style={{ color: 'green', marginBottom: 8 }}>Account created successfully!</div>}
      <button type="submit" className="btn" disabled={loading}>
        {loading ? 'Signing up...' : 'Sign Up'}
      </button>
      <p>Already have an account? <a href="/login">Login here</a></p>
    </form>
  );
};

export default SignupForm;
