const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const prisma = require('../db/prisma');
const { generateChatResponse } = require('../api/gemini');

/**
 * Initialize Socket.io server
 * @param {Object} server - HTTP server instance
 * @returns {Object} Socket.io server instance
 */
function initSocketServer(io) {
  // We now receive the io instance directly from server.js
  // This prevents creating a duplicate Socket.IO server that could cause conflicts
  
  // Configure Socket.IO for better stability and error handling
  io.engine.opts.transports = ['websocket', 'polling']; // Ensure both transports are available
  io.engine.opts.allowUpgrades = true; // Allow transport upgrades
  io.engine.opts.pingTimeout = 60000; // Increase ping timeout for better stability
  io.engine.opts.pingInterval = 25000; // Optimal ping interval
  io.engine.opts.maxHttpBufferSize = 5e6; // Increase buffer size
  
  // Set up error handling for the Socket.IO server
  // Detailed connection error logging
  io.engine.on('connection_error', (err) => {
    console.error('[Socket.IO] Connection error:', err);
  });
  
  // Better handling for XML parsing errors in polling responses
  io.engine.on('transport_error', (err) => {
    console.error('[Socket.IO] Transport error:', err);
  });
  
  // Set up special handling for proxied connections
  io.engine.on('initial_headers', (headers, req) => {
    // Add headers that help with proxied WebSocket connections
    headers['X-Socket-Version'] = 'socket.io@4';
    headers['X-Accel-Buffering'] = 'no'; // Prevent buffering in Nginx
    
    // Allow credentials and set proper CORS headers
    headers['Access-Control-Allow-Credentials'] = 'true';
    headers['Access-Control-Allow-Origin'] = '*';
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    
    // Log headers for debugging
    console.log(`[Socket.IO] Setting headers for ${req.url}`);
    
    // Fix content type issues for polling responses
    if (req.url.includes('transport=polling')) {
      // Ensure proper JSON content type for polling
      headers['Content-Type'] = 'application/json; charset=UTF-8';
    }
  });
  
  // Handle JSON parsing errors for polling transport
  io.engine.on('packet', (packet, transport) => {
    if (transport.name === 'polling') {
      try {
        // This helps detect XML parsing issues
        // console.log(`[Socket.IO] Packet received via polling: ${JSON.stringify(packet).substring(0, 100)}...`);
      } catch (err) {
        console.error('[Socket.IO] Error processing polling packet:', err);
      }
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
            const decoded = jwt.verify(data.token, process.env.JWT_SECRET || 'fallback_secret_key_for_development');
            
            // Store message in database
            try {
              await prisma.chatMessage.create({
                data: {
                  content: data.message,
                  chatId: data.roomId,
                  userId: decoded.userId
                }
              });
              console.log(`Message stored in database for room ${data.roomId}`);
            } catch (dbError) {
              console.error('Error storing message in database:', dbError);
              // Continue with broadcasting even if DB storage fails
            }
          } catch (error) {
            console.error('Error verifying token:', error);
          }
        }
        
        try {
          // Broadcast message to all users in the room
          io.to(data.roomId).emit('chat-message', {
            message: data.message,
            username: data.username || 'Anonymous',
            userId: socket.id,
            timestamp: new Date(),
            messageId: data.messageId || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          });
          console.log(`Message broadcast to room ${data.roomId}`);
          
          // Acknowledge receipt to sender
          socket.emit('message-received', {
            messageId: data.messageId || null,
            roomId: data.roomId,
            status: 'delivered'
          });
        } catch (emitError) {
          console.error('Error broadcasting message:', emitError);
          // Notify sender of failure
          socket.emit('message-error', {
            messageId: data.messageId || null,
            error: 'Failed to deliver message'
          });
        }
      } else {
        console.warn('Message received without roomId');
        socket.emit('message-error', {
          messageId: data.messageId || null,
          error: 'Missing roomId'
        });
      }
    });
    
    // Handle AI chat messages
    socket.on('ai-message', async (data) => {
      console.log('AI chat message received:', data.message);
      
      try {
        // Generate a unique user ID if not authenticated
        let userId = 'anon-' + socket.id;
        
        // If user is authenticated, use their actual ID
        if (data.token) {
          try {
            const decoded = jwt.verify(data.token, process.env.JWT_SECRET || 'fallback_secret_key_for_development');
            userId = decoded.userId;
          } catch (error) {
            console.error('Invalid token in AI chat:', error);
          }
        }
        
        // Send the message to the Gemini API
        console.log(`Processing AI request for user ${userId}`);
        
        // Wrap in try/catch to handle API errors gracefully
        let aiResponse;
        try {
          aiResponse = await generateChatResponse(userId, data.message);
          console.log('AI response generated:', typeof aiResponse === 'object' ? 'Object response' : 
                     (aiResponse ? aiResponse.substring(0, 50) + '...' : 'Empty response'));
        } catch (apiError) {
          console.error('Error calling AI API:', apiError);
          aiResponse = { error: true, errorType: 'api_error', text: null };
        }
        
        // Handle null or undefined responses
        if (!aiResponse) {
          aiResponse = { error: true, errorType: 'empty_response', text: null };
        }
        
        // Check if response is an object or string and handle accordingly
        let responseMessage = aiResponse;
        if (typeof aiResponse === 'object') {
          // Make sure getFallbackResponse exists or provide a default implementation
          const getFallbackResponse = (type) => {
            const fallbacks = {
              'api_error': "I'm having trouble connecting to my knowledge service right now.",
              'empty_response': "I didn't get a proper response from the AI service.",
              'default': "I'm sorry, I couldn't generate a proper response."
            };
            return fallbacks[type] || fallbacks.default;
          };
          
          responseMessage = aiResponse.text || (aiResponse.error ? 
            getFallbackResponse(aiResponse.errorType) : 
            "I'm sorry, I couldn't generate a proper response.");
        }
        
        // Send the response back to the user with acknowledgement
        console.log('Emitting AI response to client');
        socket.emit('ai-response', {
          message: responseMessage,
          timestamp: new Date(),
          requestId: data.requestId || null // Echo back requestId if provided
        }, (ackData) => {
          if (ackData && ackData.received) {
            console.log(`[Socket.IO] Client acknowledged AI response receipt`);
          }
        });
        
      } catch (error) {
        console.error('Error in AI chat:', error);
        socket.emit('ai-response', {
          message: "I'm sorry, I couldn't process your request at this time.",
          timestamp: new Date(),
          error: true
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
  
  // Add server-wide event listeners for better debugging
  io.on('connect_error', (err) => {
    console.error('[Socket.IO] Client connect error:', err.message);
  });

  io.on('reconnect_attempt', (attempt) => {
    console.log(`[Socket.IO] Client reconnect attempt: ${attempt}`);
  });

  io.on('error', (err) => {
    console.error('[Socket.IO] Server error:', err.message);
  });
  
  // Enhanced middleware to address WebSocket connection refused errors
  io.use((socket, next) => {
    const req = socket.request;
    
    // Generate unique connection ID for tracking
    const connId = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
    socket.connId = connId;
    
    // Log connection details for debugging
    console.log(`[Socket.IO] New connection attempt ${connId}: transport=${socket.conn.transport.name}`);
    
    // Handle reconnection attempts more gracefully
    socket.conn.on('packet', (packet) => {
      if (packet.type === 'ping') {
        // console.log(`[Socket.IO] Ping received for connection ${connId}`);
      }
    });
    
    // Add error handler to socket connection
    socket.conn.on('error', (err) => {
      console.error(`[Socket.IO] Transport error for ${connId}:`, err.message);
    });
    
    // Special handling for proxied connections
    if (req.headers['x-forwarded-for']) {
      console.log(`[Socket.IO] Proxied connection ${connId} from: ${req.headers['x-forwarded-for']}`);
      
      // Set custom properties for proxied connections
      socket.proxied = true;
      socket.realIp = req.headers['x-forwarded-for'].split(',')[0].trim();
      
      // In proxied environment, ensure transport works properly
      if (socket.conn.transport.name === 'polling') {
        console.log(`[Socket.IO] Client ${connId} connecting via polling (proxied)`);
        
        // Modify transport parameters for better stability in polling mode
        socket.conn.transport.supportsBinary = true;
        socket.conn.transport.writable = true;
        
        // Monitor polling errors
        socket.conn.transport.on('error', (pollErr) => {
          console.error(`[Socket.IO] Polling transport error for ${connId}:`, pollErr.message);
        });
      }
    }
    
    // Allow connection to proceed
    next();
  });
  
  // Enhanced namespace event logging and error recovery
  const mainNsp = io.of('/');
  
  // Better connection tracking and error handling in the main namespace
  mainNsp.on('connection', (socket) => {
    const connId = socket.connId || 'unknown';
    console.log(`[Socket.IO] Client connected to main namespace: ${socket.id} (${connId})`);
    
    // Update online user count for all clients
    try {
      const count = mainNsp.sockets.size;
      mainNsp.emit('user-count-update', { count });
      console.log(`[Socket.IO] User count updated: ${count} users online`);
    } catch (countErr) {
      console.error(`[Socket.IO] Error updating user count:`, countErr);
    }
    
    // Handle client disconnections with proper cleanup
    socket.on('disconnect', (reason) => {
      console.log(`[Socket.IO] Client disconnected from main namespace: ${socket.id} (${connId}), reason: ${reason}`);
      
      // Update user count on disconnect
      try {
        const count = mainNsp.sockets.size;
        mainNsp.emit('user-count-update', { count });
      } catch (countErr) {
        console.error(`[Socket.IO] Error updating user count after disconnect:`, countErr);
      }
    });
    
    // Enhanced error handling
    socket.on('error', (error) => {
      console.error(`[Socket.IO] Socket error in main namespace: ${socket.id} (${connId}):`, error);
      
      // Attempt to recover the connection if possible
      try {
        socket.emit('reconnect-attempt', { message: 'Connection error detected, attempting to recover' });
      } catch (emitErr) {
        console.error(`[Socket.IO] Cannot send recovery message:`, emitErr);
      }
    });
  });
  
  // Handle namespace errors at the global level
  mainNsp.on('error', (error) => {
    console.error(`[Socket.IO] Namespace error:`, error);
  });

  // Return the configured io instance
  return io;
}

module.exports = { initSocketServer }; 