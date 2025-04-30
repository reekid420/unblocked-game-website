import React from 'react';

const NavBar: React.FC = () => (
  <header>
    <div className="logo">
      <h1>Study Resources Center</h1>
    </div>
    <nav>
      <ul>
        <li><a href="/" className="nav-link"><i className="fas fa-home"></i> Activities</a></li>
        <li><a href="/chat" className="nav-link"><i className="fas fa-comments"></i> Study Groups</a></li>
        <li><a href="/ai-chat" className="nav-link"><i className="fas fa-robot"></i> Homework Help</a></li>
        <li><a href="/login" id="loginBtn" className="nav-link"><i className="fas fa-sign-in-alt"></i> Login</a></li>
        <li><a href="/signup" id="signupBtn" className="nav-link"><i className="fas fa-user-plus"></i> Sign Up</a></li>
      </ul>
    </nav>
  </header>
);

export default NavBar;
