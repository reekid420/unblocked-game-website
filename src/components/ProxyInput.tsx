import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ProxyInput: React.FC = () => {
  const [url, setUrl] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      // In a real app, encode and validate the URL
      const encodedUrl = encodeURIComponent(url);
      navigate(`/service/${encodedUrl}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ margin: '2rem 0', display: 'flex', gap: '0.5rem' }}>
      <input
        type="text"
        placeholder="Enter URL to proxy..."
        value={url}
        onChange={e => setUrl(e.target.value)}
        style={{ flex: 1, padding: '0.5rem' }}
      />
      <button type="submit" style={{ padding: '0.5rem 1rem' }}>Proxy</button>
    </form>
  );
};

export default ProxyInput;
