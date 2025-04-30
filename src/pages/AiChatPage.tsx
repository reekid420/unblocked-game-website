import React, { useRef, useState } from 'react';
import NavBar from '../components/NavBar';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
}

const SUGGESTED_TOPICS = [
  { label: 'Math: Pythagorean Theorem', prompt: 'Explain the Pythagorean theorem in simple terms.' },
  { label: 'History: World War II', prompt: 'What were the main causes of World War II?' },
  { label: 'Biology: Photosynthesis', prompt: 'Explain the process of photosynthesis.' },
  { label: 
'Physics: Newton\'s Laws', prompt: 'What is Newton\'s third law of motion?' },
  { label: 'English: Essay Writing', prompt: 'How do I write a good essay introduction?' },
];

function getUsername() {
  return localStorage.getItem('username') || 'Anonymous';
}

const AiSidebar: React.FC<{ onTopicClick: (prompt: string) => void }> = ({ onTopicClick }) => (
  <aside className="ai-sidebar">
    <div className="ai-info">
      <h3>Gemini AI</h3>
      <p>Powered by Google\'s advanced AI model</p>
    </div>
    <div className="ai-topics">
      <h4>Suggested Topics</h4>
      <ul>
        {SUGGESTED_TOPICS.map((topic) => (
          <li key={topic.label}>
            <button className="topic-btn" type="button" onClick={() => onTopicClick(topic.prompt)}>{topic.label}</button>
          </li>
        ))}
      </ul>
    </div>
  </aside>
);

const ChatMessages: React.FC<{ messages: Message[] }> = ({ messages }) => {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  return (
    <div className="chat-messages" id="chatMessages">
      {messages.map((msg) => (
        <div key={msg.id} className={`message ${msg.sender === 'ai' ? 'ai-message' : 'user-message'}`}>{msg.text}</div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
};

const ChatForm: React.FC<{
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
}> = ({ value, onChange, onSubmit, loading }) => (
  <form id="aiChatForm" className="chat-form" onSubmit={onSubmit} autoComplete="off">
    <input
      id="messageInput"
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder="Type your question..."
      autoComplete="off"
      disabled={loading}
      required
    />
    <button type="submit" disabled={loading || !value.trim()}>
      {loading ? 'AI is thinking...' : <i className="fas fa-paper-plane" />}
    </button>
  </form>
);

const AiChatPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);


  function handleTopic(prompt: string) {
    setInput(prompt);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    const userMsg: Message = {
      id: Math.random().toString(36).slice(2),
      sender: 'user',
      text: `You: ${input}`,
    };
    setMessages(msgs => [...msgs, userMsg]);
    setInput('');
    setLoading(true);
    // Simulate AI response (replace with real API call later)
    setTimeout(() => {
      setLoading(false);
      const aiResponses = [
        "I'm an AI assistant, how can I help you?",
        "That's an interesting question. Let me think about that.",
        "Here's some information that might help you.",
        "I'm sorry, I don't have that information.",
        "Could you provide more details about your question?"
      ];
      const randomResponse = aiResponses[Math.floor(Math.random() * aiResponses.length)];
      const aiMsg: Message = {
        id: Math.random().toString(36).slice(2),
        sender: 'ai',
        text: `AI: ${randomResponse}`,
      };
      setMessages(msgs => [...msgs, aiMsg]);
    }, 1000);
  }

  return (
    <>
      <NavBar />
      <main>
        <h2>Gemini AI Chat</h2>
        <p>Chat with our AI assistant powered by Google's Gemini. Ask questions, get help, or just chat!</p>
        <div className="chat-container">
          <AiSidebar onTopicClick={handleTopic} />
          <div className="chat-main">
            <ChatMessages messages={messages} />
            {loading && <div className="message ai-message loading">AI is thinking...</div>}
            <ChatForm value={input} onChange={setInput} onSubmit={handleSubmit} loading={loading} />
          </div>
        </div>
      </main>
      <footer style={{ textAlign: 'center', marginTop: '2rem', color: '#888' }}>
        <p>&copy; 2023 Study Resources Center. All rights reserved.</p>
      </footer>
    </>
  );
};

export default AiChatPage;
