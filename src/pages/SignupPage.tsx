import React from 'react';
import NavBar from '../components/NavBar';
import SignupForm from '../components/SignupForm';

const SignupPage: React.FC = () => {
  return (
    <>
      <NavBar />
      <main style={{ maxWidth: 400, margin: '2rem auto', padding: '2rem', background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px #eee' }}>
        <SignupForm />
      </main>
      <footer style={{ textAlign: 'center', marginTop: '2rem', color: '#888' }}>
        <p>&copy; 2023 Study Resources Center. All rights reserved.</p>
      </footer>
    </>
  );
};

export default SignupPage;
