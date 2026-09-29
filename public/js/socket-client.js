// ==========================================================================
// WebSocket Real-Time Client Manager (Socket.IO)
// ==========================================================================

class SocketManager {
  constructor() {
    this.socket = null;
    this.activeProjectId = null;
  }

  connect() {
    const token = API.getToken();
    if (!token) return;

    if (this.socket) {
      this.socket.disconnect();
    }

    if (typeof io === 'undefined') {
      console.warn('Socket.IO script not loaded');
      return;
    }

    this.socket = io({
      auth: { token }
    });

    this.socket.on('connect', () => {
      console.log('⚡ Connected to NovaPulse Real-Time Gateway!');
      if (this.activeProjectId) {
        this.joinProject(this.activeProjectId);
      }
    });

    // Real-time online members presence
    this.socket.on('presence_update', ({ projectId, onlineMembers }) => {
      if (this.activeProjectId === projectId) {
        state.setOnlineMembers(onlineMembers);
      }
    });

    // Real-time board sync (cards moved, created, edited by other team members)
    this.socket.on('board_sync_event', async ({ eventType, data, sender }) => {
      console.log('⚡ Board Sync Event Received:', eventType, data);

      if (window.soundManager) {
        window.soundManager.playNotificationChime();
      }

      // Re-fetch project to ensure full relational sync
      if (state.currentProject && state.currentProject.project.id === data.project_id) {
        try {
          const freshProject = await API.getProject(data.project_id);
          state.setCurrentProject(freshProject);
        } catch (e) {
          console.error('Failed to refresh project data on socket event:', e);
        }
      }

      // Show toast
      if (window.showToast) {
        let msg = `${sender.name} updated the board.`;
        if (eventType === 'task_moved') msg = `${sender.name} moved a task card.`;
        if (eventType === 'task_created') msg = `${sender.name} created a new task: "${data.title || 'Task'}"`;
        if (eventType === 'comment_added') msg = `${sender.name} posted a comment on a task.`;
        window.showToast(msg, 'info');
      }
    });

    // Real-time typing indicators in task modal
    this.socket.on('user_typing_event', ({ taskId, user, isTyping }) => {
      window.dispatchEvent(new CustomEvent('remote_user_typing', {
        detail: { taskId, user, isTyping }
      }));
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected.');
    });
  }

  joinProject(projectId) {
    this.activeProjectId = projectId;
    if (this.socket && this.socket.connected) {
      this.socket.emit('join_project', projectId);
    }
  }

  leaveProject(projectId) {
    if (this.socket && this.socket.connected && projectId) {
      this.socket.emit('leave_project', projectId);
    }
    if (this.activeProjectId === projectId) {
      this.activeProjectId = null;
    }
  }

  broadcastEvent(projectId, eventType, data) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('broadcast_task_event', {
        projectId,
        eventType,
        data
      });
    }
  }

  emitTyping(projectId, taskId, isTyping) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('task_typing', {
        projectId,
        taskId,
        isTyping
      });
    }
  }
}

window.socketManager = new SocketManager();
