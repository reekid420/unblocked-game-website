import React from 'react';
import NavBar from '../components/NavBar';
import RandomFact from '../components/RandomFact';

const HomePage: React.FC = () => {
  return (
    <>
      <NavBar />
      <main>
        <section className="hero">
          <h1 id="title">Study Resources Center</h1>
          <h2 id="sub">Access educational resources from anywhere!</h2>
          <RandomFact />
          <div className="proxy-container">
            <h3>Web Proxy</h3>
            <p className="proxy-description">Access educational websites through our secure proxy</p>
            <form id="searchForm" className="proxy-form" onSubmit={e => { e.preventDefault(); }}>
              <input id="searchbar" type="text" placeholder="Search the web or enter a URL" className="proxy-input" />
              <button type="submit" className="proxy-button"><i className="fas fa-search"></i> Go</button>
            </form>
          </div>
          <p>Games, chat rooms, and AI chat - all in one place that bypasses restrictions!</p>
        </section>
        <section className="games-section">
          <h2>Featured Games</h2>
          <div className="games-grid">
            <div className="game-card">
              <div className="game-img placeholder"></div>
              <h3>Snake Game</h3>
              <a href="/activities/logic_puzzle.html" className="play-btn">Play Now</a>
            </div>
            <div className="game-card">
              <div className="game-img placeholder"></div>
              <h3>Coming Soon</h3>
            </div>
            {/* Add more game cards as needed */}
          </div>
        </section>
      </main>
      <footer>
        <p>&copy; 2023 Study Resources Center. All rights reserved.</p>
      </footer>
    </>
  );
};

export default HomePage;
