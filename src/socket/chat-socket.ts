import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
// @ts-ignore
import prisma from '../db/prisma.ts';
import axios from 'axios';

/**
 * Initialize Socket.io server
 * @param io - Socket.IO server instance
 * @returns Socket.IO server instance
 */
export function initSocketServer(io: Server) {
  // Configure Socket.IO for better stability and error handling
  io.engine.opts.transports = ['websocket', 'polling'];
  io.engine.opts.allowUpgrades = true;
  io.engine.opts.pingTimeout = 60000;
  io.engine.opts.pingInterval = 25000;
  io.engine.opts.maxHttpBufferSize = 5e6;

  io.engine.on('connection_error', (err: any) => {
    console.error('[Socket.IO] Connection error:', err);
  });
  io.engine.on('transport_error', (err: any) => {
    console.error('[Socket.IO] Transport error:', err);
  });
  io.engine.on('initial_headers', (headers: any, req: any) => {
    headers['X-Socket-Version'] = 'socket.io@4';
    headers['X-Accel-Buffering'] = 'no';
    headers['Access-Control-Allow-Credentials'] = 'true';
    headers['Access-Control-Allow-Origin'] = '*';
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    if (req.url.includes('transport=polling')) {
      headers['Content-Type'] = 'application/json; charset=UTF-8';
    }
  });
  io.engine.on('packet', (packet: any, transport: any) => {
    if (transport.name === 'polling') {
      try {
        // Optionally log polling packets
      } catch (err) {
        console.error('[Socket.IO] Error processing polling packet:', err);
      }
    }
  });

  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    socket.on('join-room', (roomId: string) => {
      console.log(`User ${socket.id} joined room ${roomId}`);
      socket.join(roomId);
      io.to(roomId).emit('user-joined', {
        message: 'A new user has joined the chat',
        userId: socket.id,
        timestamp: new Date()
      });
    });

    // Handle new chat messages
    socket.on('send-message', async (data: any) => {
      console.log('New message:', data);
      if (data.roomId) {
        if (data.token) {
          try {
            const decoded = jwt.verify(data.token, process.env.JWT_SECRET || 'fallback_secret_key_for_development') as any;
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
            }
          } catch (error) {
            console.error('Error verifying token:', error);
          }
        }
        try {
          io.to(data.roomId).emit('chat-message', {
            message: data.message,
            username: data.username || 'Anonymous',
            userId: socket.id,
            timestamp: new Date(),
            messageId: data.messageId || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          });
          console.log(`Message broadcast to room ${data.roomId}`);
          socket.emit('message-received', {
            messageId: data.messageId || null,
            roomId: data.roomId,
            status: 'delivered'
          });
        } catch (emitError) {
          console.error('Error broadcasting message:', emitError);
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

    // Handle AI chat messages (proxy to Python backend)
    socket.on('ai-message', async (data: any) => {
      console.log('AI chat message received:', data.message);
      let userId = 'anon-' + socket.id;
      if (data.token) {
        try {
          const decoded = jwt.verify(data.token, process.env.JWT_SECRET || 'fallback_secret_key_for_development') as any;
          userId = decoded.userId;
        } catch (error) {
          console.error('Invalid token in AI chat:', error);
        }
      }
      try {
        // Proxy AI request to Python FastAPI backend
        const response = await axios.post(
          process.env.PYTHON_PROXY_URL + '/ai/ai-chat',
          {
            message: data.message,
            conversation_id: data.conversationId,
            system_prompt: data.systemPrompt,
            model: data.model,
            temperature: data.temperature,
            top_k: data.top_k,
            top_p: data.top_p,
            max_output_tokens: data.max_output_tokens
          },
          {
            headers: {
              'Authorization': data.token ? `Bearer ${data.token}` : '',
              'Content-Type': 'application/json'
            }
          }
        );
        const aiResponse = response.data.response || response.data.text || response.data;
        socket.emit('ai-response', {
          message: aiResponse,
          error: response.data.error || null,
          errorType: response.data.errorType || null
        });
      } catch (apiError: any) {
        console.error('Error proxying AI API:', apiError);
        socket.emit('ai-response', {
          message: null,
          error: 'Failed to contact AI backend',
          errorType: 'api_error'
        });
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });

  return io;
}
