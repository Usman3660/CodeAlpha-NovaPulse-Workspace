// ==========================================================================
// Central State Management Store
// ==========================================================================

class AppState {
  constructor() {
    this.currentUser = null;
    this.projects = [];
    this.currentProject = null;
    this.allUsers = [];
    this.notifications = [];
    this.unreadNotificationsCount = 0;
    this.onlineMembers = [];
    this.currentView = 'board'; // 'board', 'list', 'analytics'
    this.searchQuery = '';
    this.priorityFilter = 'all';
    this.assigneeFilter = 'all';
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => cb(data));
    }
  }

  setCurrentUser(user) {
    this.currentUser = user;
    this.emit('user_changed', user);
  }

  setProjects(projects) {
    this.projects = projects;
    this.emit('projects_changed', projects);
  }

  setCurrentProject(projectData) {
    this.currentProject = projectData;
    this.emit('project_data_changed', projectData);
  }

  setOnlineMembers(members) {
    this.onlineMembers = members;
    this.emit('presence_changed', members);
  }

  setNotifications(notifications, unreadCount) {
    this.notifications = notifications;
    this.unreadNotificationsCount = unreadCount;
    this.emit('notifications_changed', { notifications, unreadCount });
  }

  setView(view) {
    this.currentView = view;
    this.emit('view_changed', view);
  }

  setFilters(filters = {}) {
    if (filters.search !== undefined) this.searchQuery = filters.search.toLowerCase();
    if (filters.priority !== undefined) this.priorityFilter = filters.priority;
    if (filters.assignee !== undefined) this.assigneeFilter = filters.assignee;
    this.emit('filters_changed', {
      search: this.searchQuery,
      priority: this.priorityFilter,
      assignee: this.assigneeFilter
    });
  }

  // Filter tasks in current project based on active filters
  getFilteredTasks(columnId) {
    if (!this.currentProject || !this.currentProject.tasks) return [];
    return this.currentProject.tasks.filter(task => {
      if (columnId && task.column_id !== columnId) return false;

      // Search Query filter
      if (this.searchQuery) {
        const titleMatch = task.title.toLowerCase().includes(this.searchQuery);
        const descMatch = (task.description || '').toLowerCase().includes(this.searchQuery);
        const tagMatch = (task.tags || []).some(t => t.name.toLowerCase().includes(this.searchQuery));
        if (!titleMatch && !descMatch && !tagMatch) return false;
      }

      // Priority filter
      if (this.priorityFilter !== 'all' && task.priority !== this.priorityFilter) {
        return false;
      }

      // Assignee filter
      if (this.assigneeFilter !== 'all') {
        const hasAssignee = (task.assignees || []).some(a => String(a.id) === String(this.assigneeFilter));
        if (!hasAssignee) return false;
      }

      return true;
    });
  }
}

window.state = new AppState();
