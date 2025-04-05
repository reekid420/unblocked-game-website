// Bare Server implementation for Ultraviolet proxy with Express for API endpoints
const { createBareServer } = require('@tomphttp/bare-server-node');
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('./db/prisma');
const { Server } = require('socket.io');
const { generateChatResponse, cleanupOldSessions } = require('./api/gemini');

// Create Express app
const app = express();

// Middleware for JSON parsing
app.use(express.json());

// Create a Bare server instance
const bareServer = createBareServer('/bare/');

// Define the port (use environment variable or default to 8080)
const port = process.env.PORT || 8080;

// Create an HTTP server that uses Express for API routes and bare-server for proxy
const server = http.createServer((req, res) => {
  // Handle bare server requests
  if (bareServer.shouldRoute(req)) {
    console.log(`[Bare Server] Handling request: ${req.url}`);
    bareServer.routeRequest(req, res);
    return;
  }

  // Pass to Express for API endpoints
  app(req, res);
});

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  // Join a chat room
  socket.on('join-room', (roomId) => {
    console.log(`User ${socket.id} joined room ${roomId}`);
    socket.join(roomId);
    io.to(roomId).emit('user-joined', { 
      message: 'A new user has joined the chat',
      userId: socket.id,
      timestamp: new Date()
    });
  });
  
  // Handle new chat messages
  socket.on('send-message', async (data) => {
    console.log('New message:', data);
    
    // If the message has a roomId, it's a group chat message
    if (data.roomId) {
      // If user is authenticated, store the message in the database
      if (data.token) {
        try {
          const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
          
          // Store message in database
          await prisma.chatMessage.create({
            data: {
              content: data.message,
              chatId: data.roomId,
              userId: decoded.userId
            }
          });
        } catch (error) {
          console.error('Error storing message:', error);
        }
      }
      
      // Broadcast message to all users in the room
      io.to(data.roomId).emit('chat-message', {
        message: data.message,
        username: data.username || 'Anonymous',
        userId: socket.id,
        timestamp: new Date()
      });
    }
  });
  
  // Handle AI chat messages
  socket.on('ai-message', async (data) => {
    console.log('AI chat message:', data.message);
    
    try {
      // Generate a unique user ID if not authenticated
      let userId = 'anon-' + socket.id;
      
      // If user is authenticated, use their actual ID
      if (data.token) {
        try {
          const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
          userId = decoded.userId;
        } catch (error) {
          console.error('Invalid token in AI chat:', error);
        }
      }
      
      // Send the message to the Gemini API
      const aiResponse = await generateChatResponse(userId, data.message);
      
      // Send the response back to the user
      socket.emit('ai-response', {
        message: aiResponse,
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error('Error in AI chat:', error);
      socket.emit('ai-response', {
        message: "I'm sorry, I couldn't process your request at this time.",
        timestamp: new Date()
      });
    }
  });
  
  // Handle typing indicator
  socket.on('typing', (data) => {
    if (data.roomId) {
      socket.to(data.roomId).emit('user-typing', {
        username: data.username || 'Someone',
        isTyping: data.isTyping
      });
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Setup security middleware
app.use((req, res, next) => {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// ----- API ENDPOINTS -----

// Gemini AI Chat API
app.post('/api/ai-chat', authenticate, async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Call the Gemini API
    const response = await generateChatResponse(req.user.id, message);
    
    res.json({ response });
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({ error: 'Failed to generate AI response' });
  }
});

// Authentication Middleware
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, username: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

// User Routes
// Register a new user
app.post('/api/users/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { username }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create the user
    const user = await prisma.user.create({
      data: {
        username,
        passwordHash
      }
    });

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id }, 
      process.env.JWT_SECRET, 
      { expiresIn: '8h' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        username: user.username
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login user
app.post('/api/users/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user by username
    const user = await prisma.user.findUnique({
      where: { username }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id }, 
      process.env.JWT_SECRET, 
      { expiresIn: '8h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user profile
app.get('/api/users/profile', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        createdAt: true
      }
    });

    res.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Chat Routes
// Get all chats
app.get('/api/chats', authenticate, async (req, res) => {
  try {
    const chats = await prisma.chat.findMany({
      include: {
        participants: {
          select: {
            id: true,
            username: true
          }
        },
        _count: {
          select: { messages: true }
        }
      }
    });

    res.json(chats);
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new chat
app.post('/api/chats', authenticate, async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Chat name is required' });
    }

    const chat = await prisma.chat.create({
      data: {
        name,
        description,
        participants: {
          connect: { id: req.user.id }
        }
      },
      include: {
        participants: {
          select: {
            id: true,
            username: true
          }
        }
      }
    });

    res.status(201).json(chat);
  } catch (error) {
    console.error('Create chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get chat messages
app.get('/api/chats/:chatId/messages', authenticate, async (req, res) => {
  try {
    const { chatId } = req.params;

    // Check if chat exists
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: { participants: true }
    });

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Check if user is a participant
    const isParticipant = chat.participants.some(p => p.id === req.user.id);
    if (!isParticipant) {
      return res.status(403).json({ error: 'You are not a participant in this chat' });
    }

    // Get messages
    const messages = await prisma.chatMessage.findMany({
      where: { chatId },
      include: {
        user: {
          select: {
            id: true,
            username: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json(messages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send a chat message
app.post('/api/chats/:chatId/messages', authenticate, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    // Check if chat exists and user is a participant
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: { participants: true }
    });

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const isParticipant = chat.participants.some(p => p.id === req.user.id);
    if (!isParticipant) {
      return res.status(403).json({ error: 'You are not a participant in this chat' });
    }

    // Create message
    const message = await prisma.chatMessage.create({
      data: {
        content,
        chatId,
        userId: req.user.id
      },
      include: {
        user: {
          select: {
            id: true,
            username: true
          }
        }
      }
    });

    res.status(201).json(message);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Game Save Data Routes
// Get game saves for a user
app.get('/api/game-saves', authenticate, async (req, res) => {
  try {
    // Get all unique game IDs for the user
    const gameIds = await prisma.gameSaveData.findMany({
      where: { userId: req.user.id },
      select: { gameId: true },
      distinct: ['gameId']
    });

    // For each game, get the latest save
    const gameList = await Promise.all(
      gameIds.map(async ({ gameId }) => {
        const latestSave = await prisma.gameSaveData.findFirst({
          where: { 
            gameId, 
            userId: req.user.id 
          },
          orderBy: { updatedAt: 'desc' }
        });
        return latestSave;
      })
    );

    res.json(gameList);
  } catch (error) {
    console.error('Get game saves error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific game save data
app.get('/api/game-saves/:gameId', authenticate, async (req, res) => {
  try {
    const { gameId } = req.params;

    const gameSave = await prisma.gameSaveData.findFirst({
      where: { 
        gameId, 
        userId: req.user.id 
      },
      orderBy: { updatedAt: 'desc' }
    });

    if (!gameSave) {
      return res.status(404).json({ error: 'Game save not found' });
    }

    res.json(gameSave);
  } catch (error) {
    console.error('Get game save error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Save game data
app.post('/api/game-saves/:gameId', authenticate, async (req, res) => {
  try {
    const { gameId } = req.params;
    const { saveData } = req.body;

    if (!saveData) {
      return res.status(400).json({ error: 'Save data is required' });
    }

    // Create a new save
    const gameSave = await prisma.gameSaveData.create({
      data: {
        gameId,
        saveData,
        userId: req.user.id
      }
    });

    res.status(201).json(gameSave);
  } catch (error) {
    console.error('Save game error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Proxy URL Tracking
// Log a proxied URL
app.post('/api/proxy-log', authenticate, async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    await prisma.proxiedUrl.create({
      data: {
        url,
        userId: req.user.id
      }
    });

    res.status(201).json({ message: 'URL logged successfully' });
  } catch (error) {
    console.error('Log proxy URL error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get recent proxied URLs for a user
app.get('/api/proxy-history', authenticate, async (req, res) => {
  try {
    const proxyHistory = await prisma.proxiedUrl.findMany({
      where: { userId: req.user.id },
      orderBy: { timestamp: 'desc' },
      take: 20
    });

    res.json(proxyHistory);
  } catch (error) {
    console.error('Get proxy history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ----- STATIC FILE SERVING -----

// Serve static files from the current directory
app.use(express.static(path.join(__dirname)));

// Handle requests for HTML pages for client-side routing
app.get('*', (req, res) => {
  // Security: Normalize and validate the path to prevent path traversal attacks
  let requestPath = req.path.split('?')[0]; // Remove query parameters
  
  // Ensure the path doesn't contain path traversal attempts
  if (requestPath.includes('..') || requestPath.includes('%2e%2e') || 
      requestPath.includes('./') || requestPath.includes('%2e/')) {
    console.log(`[Security] Blocked potential path traversal attack: ${requestPath}`);
    return res.status(403).send('Forbidden: Invalid path');
  }
  
  // Get the file path with proper normalization
  const safePath = path.normalize(requestPath).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(__dirname, safePath === '/' ? 'index.html' : safePath);
  
  // Additional security: Ensure the path is within the project directory
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(path.resolve(__dirname))) {
    console.log(`[Security] Blocked directory traversal attempt: ${filePath}`);
    return res.status(403).send('Forbidden');
  }
  
  // Check if the file exists
  if (fs.existsSync(filePath)) {
    // If the file has no extension, serve index.html
    if (!path.extname(filePath)) {
      filePath = path.join(__dirname, 'index.html');
    }
  } else {
    // If file doesn't exist, serve index.html for client-side routing
    filePath = path.join(__dirname, 'index.html');
  }

  res.sendFile(filePath);
});

// Handle WebSocket connections
server.on('upgrade', (req, socket, head) => {
  if (bareServer.shouldRoute(req)) {
    console.log(`[Bare Server] Handling WebSocket upgrade: ${req.url}`);
    bareServer.routeUpgrade(req, socket, head);
  } else {
    // Pass the upgrade request to Socket.io
    io.engine.handleUpgrade(req, socket, head);
  }
});

// Start the server
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
  console.log(`Bare Server available at http://localhost:${port}/bare/`);
  console.log(`API available at http://localhost:${port}/api/`);
  console.log(`WebSocket server for chat is running`);
  
  // Set up periodic cleanup of old AI chat sessions (every 30 minutes)
  setInterval(() => {
    cleanupOldSessions(30);
  }, 30 * 60 * 1000);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  await prisma.$disconnect();
  process.exit(0);
}); 