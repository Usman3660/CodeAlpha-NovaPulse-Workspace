// ==========================================================================
// Centralized REST API Client
// ==========================================================================

const API = {
  baseURL: '/api',

  getToken() {
    return localStorage.getItem('novapulse_token');
  },

  setToken(token) {
    if (token) localStorage.setItem('novapulse_token', token);
    else localStorage.removeItem('novapulse_token');
  },

  async request(endpoint, options = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401) {
          this.setToken(null);
          window.dispatchEvent(new CustomEvent('auth_expired'));
        }
        throw new Error(data.error || `Request failed with status ${response.status}`);
      }

      return data;
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err);
      throw err;
    }
  },

  // Auth
  login: (email, password) => API.request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (payload) => API.request('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  demoLogin: (email) => API.request('/auth/demo-login', { method: 'POST', body: JSON.stringify({ email }) }),
  getMe: () => API.request('/auth/me'),
  updateProfile: (payload) => API.request('/auth/profile', { method: 'PUT', body: JSON.stringify(payload) }),
  getUsers: () => API.request('/auth/users'),

  // Projects
  getProjects: () => API.request('/projects'),
  createProject: (payload) => API.request('/projects', { method: 'POST', body: JSON.stringify(payload) }),
  getProject: (id) => API.request(`/projects/${id}`),
  updateProject: (id, payload) => API.request(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteProject: (id) => API.request(`/projects/${id}`, { method: 'DELETE' }),
  joinProject: (inviteCode) => API.request('/projects/join', { method: 'POST', body: JSON.stringify({ inviteCode }) }),
  addMember: (projectId, email, role) => API.request(`/projects/${projectId}/members`, { method: 'POST', body: JSON.stringify({ email, role }) }),
  updateMemberRole: (projectId, userId, role) => API.request(`/projects/${projectId}/members/${userId}`, { method: 'PUT', body: JSON.stringify({ role }) }),
  removeMember: (projectId, userId) => API.request(`/projects/${projectId}/members/${userId}`, { method: 'DELETE' }),
  getProjectActivity: (projectId) => API.request(`/projects/${projectId}/activity`),

  // Columns
  createColumn: (payload) => API.request('/columns', { method: 'POST', body: JSON.stringify(payload) }),
  updateColumn: (id, payload) => API.request(`/columns/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  reorderColumns: (projectId, columnIds) => API.request('/columns/reorder/all', { method: 'PUT', body: JSON.stringify({ project_id: projectId, column_ids: columnIds }) }),
  deleteColumn: (id) => API.request(`/columns/${id}`, { method: 'DELETE' }),

  // Tasks
  createTask: (payload) => API.request('/tasks', { method: 'POST', body: JSON.stringify(payload) }),
  getTask: (id) => API.request(`/tasks/${id}`),
  updateTask: (id, payload) => API.request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  moveTask: (payload) => API.request('/tasks/move', { method: 'POST', body: JSON.stringify(payload) }),
  deleteTask: (id) => API.request(`/tasks/${id}`, { method: 'DELETE' }),
  toggleAssignee: (taskId, userId) => API.request(`/tasks/${taskId}/assignees`, { method: 'POST', body: JSON.stringify({ user_id: userId }) }),
  addSubtask: (taskId, title) => API.request(`/tasks/${taskId}/subtasks`, { method: 'POST', body: JSON.stringify({ title }) }),
  toggleSubtask: (subtaskId) => API.request(`/tasks/subtasks/${subtaskId}/toggle`, { method: 'PUT' }),
  deleteSubtask: (subtaskId) => API.request(`/tasks/subtasks/${subtaskId}`, { method: 'DELETE' }),
  addTag: (taskId, name, color) => API.request(`/tasks/${taskId}/tags`, { method: 'POST', body: JSON.stringify({ name, color }) }),
  deleteTag: (tagId) => API.request(`/tasks/tags/${tagId}`, { method: 'DELETE' }),

  // Comments
  addComment: (taskId, content) => API.request('/comments', { method: 'POST', body: JSON.stringify({ task_id: taskId, content }) }),
  reactComment: (commentId, emoji) => API.request(`/comments/${commentId}/react`, { method: 'POST', body: JSON.stringify({ emoji }) }),
  deleteComment: (commentId) => API.request(`/comments/${commentId}`, { method: 'DELETE' }),

  // Notifications
  getNotifications: () => API.request('/notifications'),
  markNotificationRead: (id) => API.request(`/notifications/${id}/read`, { method: 'PUT' }),
  markAllNotificationsRead: () => API.request('/notifications/read-all', { method: 'PUT' }),
  clearNotifications: () => API.request('/notifications/clear', { method: 'DELETE' })
};

window.API = API;
