const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');
const { db } = require('../db/database');

function initSocket(io) {
  // Store connected users mapping: socket.id -> user
  const activeSockets = new Map();
  // Store room occupants: projectId -> Set of user objects
  const projectPresence = new Map();

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error('Authentication required for WebSocket connection.'));
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) return next(new Error('Invalid token.'));
      socket.user = decoded;
      next();
    });
  });

  io.on('connection', (socket) => {
    const user = socket.user;
    activeSockets.set(socket.id, user);

    // Join personal user room for direct notifications
    socket.join(`user_${user.id}`);

    // Join a Project Board Room
    socket.on('join_project', async (projectId) => {
      if (!projectId) return;
      const roomName = `project_${projectId}`;
      socket.join(roomName);

      if (!projectPresence.has(projectId)) {
        projectPresence.set(projectId, new Map());
      }
      projectPresence.get(projectId).set(user.id, {
        id: user.id,
        name: user.name,
        email: user.email,
        socketId: socket.id
      });

      // Broadcast updated online presence to this project room
      const onlineMembers = Array.from(projectPresence.get(projectId).values());
      io.to(roomName).emit('presence_update', {
        projectId,
        onlineMembers
      });
    });

    // Leave a Project Board Room
    socket.on('leave_project', (projectId) => {
      if (!projectId) return;
      const roomName = `project_${projectId}`;
      socket.leave(roomName);

      if (projectPresence.has(projectId)) {
        projectPresence.get(projectId).delete(user.id);
        const onlineMembers = Array.from(projectPresence.get(projectId).values());
        io.to(roomName).emit('presence_update', {
          projectId,
          onlineMembers
        });
      }
    });

    // Task & Board Broadcast Events from Client (for instantaneous sync across all active tabs/users)
    socket.on('broadcast_task_event', ({ projectId, eventType, data }) => {
      if (!projectId) return;
      // Broadcast to other users in the room
      socket.to(`project_${projectId}`).emit('board_sync_event', {
        eventType,
        data,
        sender: {
          id: user.id,
          name: user.name
        },
        timestamp: new Date().toISOString()
      });
    });

    // Live Typing Indicator inside Task Comments
    socket.on('task_typing', ({ projectId, taskId, isTyping }) => {
      if (!projectId || !taskId) return;
      socket.to(`project_${projectId}`).emit('user_typing_event', {
        taskId,
        user: { id: user.id, name: user.name },
        isTyping
      });
    });

    // Disconnect cleanup
    socket.on('disconnect', () => {
      activeSockets.delete(socket.id);

      // Clean from all presence rooms
      for (const [projectId, members] of projectPresence.entries()) {
        if (members.has(user.id)) {
          members.delete(user.id);
          io.to(`project_${projectId}`).emit('presence_update', {
            projectId,
            onlineMembers: Array.from(members.values())
          });
        }
      }
    });
  });
}

module.exports = { initSocket };
