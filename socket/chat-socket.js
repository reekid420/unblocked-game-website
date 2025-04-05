const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const prisma = require('../db/prisma');
const { generateChatResponse } = require('../api/gemini');

/**
 * Initialize Socket.io server
 * @param {Object} server - HTTP server instance
 * @returns {Object} Socket.io server instance
 */
function initSocketServer(server) {
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
  
  return io;
}

module.exports = { initSocketServer }; 