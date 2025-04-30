import React, { useEffect, useRef, useState } from 'react';
import NavBar from '../components/NavBar';
import io from 'socket.io-client';
import type { Socket } from 'socket.io-client';


interface Message {
  id: string;
  username: string;
  text: string;
  time: string;
  className: string; // 'user-message' | 'other-message' | 'system-message'
}

const DEFAULT_ROOMS = [
  { id: 'general', label: 'General Chat' },
  { id: 'math', label: 'Math Help' },
  { id: 'science', label: 'Science Discussion' },
  { id: 'history', label: 'History Group' },
  { id: 'languages', label: 'Languages' },
];

// TODO: Replace with real session-based user lookup. For now, use a hardcoded username from the User table for demo.
const getUsername = () => localStorage.getItem('username') || 'Anonymous';

const ChatPage: React.FC = () => {
  const [currentRoom, setCurrentRoom] = useState('general');
  const [messages, setMessages] = useState<Message[]>([]);
  const [userCount, setUserCount] = useState(0);
  const [typing, setTyping] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [rooms, setRooms] = useState(DEFAULT_ROOMS);
  const socketRef = useRef<Socket | null>(null);
  const chatMessagesRef = useRef<HTMLDivElement | null>(null);
  const username = getUsername();

  // Scroll to bottom on new message
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    // Connect to Socket.IO server
    const socket = io();
    socketRef.current = socket;

    // Join initial room
    socket.emit('join-room', currentRoom);

    // Handle incoming messages
    socket.on('chat-message', (data: any) => {
      const isCurrentUser = data.userId === socket.id;
      const time = new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages(msgs => [
        ...msgs,
        {
          id: data.messageId || Math.random().toString(),
          username: data.username,
          text: data.message,
          time,
          className: isCurrentUser ? 'user-message' : 'other-message',
        },
      ]);
    });

    // Handle system messages
    socket.on('system-message', (msg: string) => {
      setMessages(msgs => [
        ...msgs,
        {
          id: Math.random().toString(),
          username: '',
          text: msg,
          time: '',
          className: 'system-message',
        },
      ]);
    });

    // Typing indicator
    socket.on('user-typing', (data: any) => {
      setTyping(data.isTyping ? `${data.username} is typing...` : '');
    });

    // User count
    socket.on('user-count', (count: number) => setUserCount(count));

    // Room change
    socket.on('room-joined', (roomId: string) => {
      setCurrentRoom(roomId);
      setMessages([]);
      setTyping('');
    });

    // Cleanup
    return () => {
      socket.disconnect();
    };
  }, []);

  // Handle room switch
  const joinRoom = (roomId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('leave-room', currentRoom);
      socketRef.current.emit('join-room', roomId);
    }
    setCurrentRoom(roomId);
    setMessages([]);
    setTyping('');
  };

  // Handle message send
  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !socketRef.current) return;
    socketRef.current.emit('send-message', {
      message: messageInput,
      roomId: currentRoom,
      username,
      token: localStorage.getItem('authToken'),
    });
    setMessageInput('');
    // Stop typing
    socketRef.current.emit('typing', { roomId: currentRoom, username, isTyping: false });
  };

  // Typing event
  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);
    if (socketRef.current) {
      socketRef.current.emit('typing', { roomId: currentRoom, username, isTyping: !!e.target.value });
    }
  };

  // Handle new room creation
  const handleCreateRoom = () => {
    if (!newRoomName.trim()) return;
    const id = newRoomName.toLowerCase().replace(/\s+/g, '-');
    setRooms([...rooms, { id, label: newRoomName }]);
    setNewRoomName('');
    socketRef.current?.emit('create-room', id);
  };

  return (
    <>
      <NavBar />
      <main>
        <h2>Chat Room</h2>
        <p>Welcome to our chat room. Talk with friends, share game tips, and have fun!</p>
        <div className="chat-container">
          <div className="chat-rooms">
            <h3>Study Rooms</h3>
            <ul id="roomsList">
              {rooms.map(room => (
                <li
                  key={room.id}
                  className={room.id === currentRoom ? 'active' : ''}
                  data-room={room.id}
                  onClick={() => joinRoom(room.id)}
                >
                  {room.label}
                </li>
              ))}
            </ul>
            <div className="new-room">
              <input
                type="text"
                id="newRoomInput"
                placeholder="New room name"
                value={newRoomName}
                onChange={e => setNewRoomName(e.target.value)}
              />
              <button id="createRoomBtn" onClick={handleCreateRoom}>Create</button>
            </div>
          </div>
          <div className="chat-area">
            <div className="chat-header">
              <h3 id="currentRoom">{rooms.find(r => r.id === currentRoom)?.label || 'Chat'}</h3>
              <span id="userCount">{userCount} online</span>
            </div>
            <div className="chat-messages" id="chatMessages" ref={chatMessagesRef}>
              {messages.map(msg => (
                <div key={msg.id} className={`message ${msg.className}`}>
                  {msg.className === 'system-message' ? (
                    <em>{msg.text}</em>
                  ) : (
                    <>
                      <span className="msg-user">{msg.username}</span>
                      {msg.time && <span className="msg-time"> ({msg.time}): </span>}
                      {msg.text}
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="typing-indicator">{typing}</div>
            <form id="chatForm" className="chat-form" onSubmit={handleSend} autoComplete="off">
              <input
                type="text"
                id="messageInput"
                placeholder="Type your message..."
                autoComplete="off"
                value={messageInput}
                onChange={handleTyping}
              />
              <button type="submit">Send</button>
            </form>
          </div>
        </div>
      </main>
      <footer>
        <p>&copy; 2023 Study Resources Center. All rights reserved.</p>
      </footer>
    </>
  );
};

export default ChatPage;
