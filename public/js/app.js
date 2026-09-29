// ==========================================================================
// NovaPulse Main Application Coordinator
// ==========================================================================

// Global Toast System
window.showToast = function(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let iconName = 'info';
  if (type === 'success') iconName = 'check-circle-2';
  if (type === 'danger') iconName = 'alert-circle';

  toast.innerHTML = `
    <i data-lucide="${iconName}" style="width: 20px; height: 20px; flex-shrink: 0;"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  if (window.lucide) lucide.createIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(40px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
};

// Global Modal Manager
window.modalManager = {
  openModal(modalId) {
    if (modalId === 'profile-modal' && window.AuthController && typeof window.AuthController.populateProfileModal === 'function') {
      window.AuthController.populateProfileModal();
    }
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('open');
    if (window.lucide) lucide.createIcons();
  },
  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('open');
  },
  closeAll() {
    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
  }
};

class App {
  async init() {
    try {
      this.bindGlobalInteractions();
    } catch (e) {
      console.warn('bindGlobalInteractions error:', e);
    }

    try {
      if (typeof AuthController !== 'undefined' && AuthController.init) AuthController.init();
      if (typeof BoardController !== 'undefined' && BoardController.init) BoardController.init();
      if (typeof AsanaApp !== 'undefined' && AsanaApp.init) AsanaApp.init();
    } catch (e) {
      console.warn('Controller init error:', e);
    }

    // Check if authenticated via stored JWT token
    const token = API.getToken();
    const overlay = document.getElementById('auth-overlay');

    if (token) {
      try {
        const res = await API.getMe();
        state.setCurrentUser(res.user);
        if (overlay) overlay.style.display = 'none';
        await this.loadInitialData();
      } catch (err) {
        console.warn('Session expired or invalid, clearing token:', err);
        API.setToken(null);
        state.setCurrentUser(null);
        if (overlay) overlay.style.display = 'flex';
      }
    } else {
      // User is not logged in: display Login / Sign Up screen
      if (overlay) overlay.style.display = 'flex';
    }
  }

  async loadInitialData() {
    try {
      socketManager.connect();

      // Fetch Projects
      const { projects } = await API.getProjects();
      state.setProjects(projects);

      if (projects.length > 0) {
        await this.selectProject(projects[0].id);
      }

      // Fetch Notifications
      this.refreshNotifications();

      // Fetch All System Users
      const { users } = await API.getUsers();
      state.allUsers = users;
    } catch (err) {
      window.showToast('Failed to load initial workspace data.', 'danger');
    }
  }

  async selectProject(projectId) {
    try {
      if (state.currentProject) {
        socketManager.leaveProject(state.currentProject.project.id);
      }

      const projectData = await API.getProject(projectId);
      state.setCurrentProject(projectData);
      socketManager.joinProject(projectId);

      this.updateProjectHeaderUI(projectData);
    } catch (err) {
      window.showToast(err.message, 'danger');
    }
  }

  updateProjectHeaderUI({ project, members, metrics }) {
    // Sub-header title
    const titleEl = document.getElementById('project-name-heading');
    if (titleEl) titleEl.textContent = project.name;

    // Invite code badge
    const inviteCodeEl = document.getElementById('invite-code-btn');
    if (inviteCodeEl) {
      inviteCodeEl.innerHTML = `<i data-lucide="key" style="width: 13px; height: 13px;"></i> Invite: ${project.invite_code}`;
      inviteCodeEl.onclick = () => {
        navigator.clipboard.writeText(project.invite_code);
        window.showToast(`Invite code "${project.invite_code}" copied to clipboard!`, 'success');
      };
    }

    // Dropdown selector button label
    const selectorBtn = document.getElementById('current-project-label');
    if (selectorBtn) selectorBtn.textContent = project.name;

    // Render Project Dropdown Menu
    const dropdownList = document.getElementById('project-dropdown-list');
    if (dropdownList) {
      dropdownList.innerHTML = state.projects.map(p => `
        <div class="project-dropdown-item ${p.id === project.id ? 'active' : ''}" data-project-id="${p.id}" style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; cursor:pointer; border-radius:var(--radius-sm); margin-bottom:4px; font-weight:600; font-size:0.9rem;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="width:10px; height:10px; border-radius:50%; background:${p.color};"></span>
            <span>${p.name}</span>
          </div>
          <span style="font-size:0.75rem; color:var(--text-muted);">${p.task_count} tasks</span>
        </div>
      `).join('');

      dropdownList.querySelectorAll('.project-dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
          this.selectProject(parseInt(item.dataset.projectId));
          document.getElementById('project-popover').classList.remove('open');
        });
      });
    }

    // Render Online Presence
    this.renderPresence(state.onlineMembers);

    if (window.lucide) lucide.createIcons();
  }

  async refreshNotifications() {
    try {
      const res = await API.getNotifications();
      state.setNotifications(res.notifications, res.unreadCount);

      const badge = document.getElementById('notification-badge');
      if (badge) {
        badge.style.display = res.unreadCount > 0 ? 'block' : 'none';
        badge.textContent = res.unreadCount;
      }

      const listContainer = document.getElementById('notification-items-list');
      if (listContainer) {
        if (res.notifications.length === 0) {
          listContainer.innerHTML = `<div style="padding:24px; text-align:center; color:var(--text-muted); font-size:0.85rem;">No notifications.</div>`;
        } else {
          listContainer.innerHTML = res.notifications.map(n => `
            <div class="notification-item ${n.is_read ? '' : 'unread'}" data-notif-id="${n.id}">
              <div class="notification-icon-wrapper" style="background:var(--primary-glow); color:var(--primary);">
                <i data-lucide="${n.type === 'task_assigned' ? 'check-square' : (n.type === 'comment_added' ? 'message-circle' : 'bell')}" style="width:16px; height:16px;"></i>
              </div>
              <div style="flex:1;">
                <div style="font-size:0.85rem; font-weight:700;">${n.title}</div>
                <div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">${n.message}</div>
                <div style="font-size:0.72rem; color:var(--text-dim); margin-top:4px;">${new Date(n.created_at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</div>
              </div>
            </div>
          `).join('');

          listContainer.querySelectorAll('.notification-item').forEach(item => {
            item.addEventListener('click', async () => {
              await API.markNotificationRead(item.dataset.notifId);
              item.classList.remove('unread');
              this.refreshNotifications();
            });
          });
        }
      }

      if (window.lucide) lucide.createIcons();
    } catch (e) {
      console.warn('Notification fetch error:', e);
    }
  }

  renderPresence(members) {
    const container = document.getElementById('presence-avatars-container');
    const countEl = document.getElementById('presence-count-text');
    if (!container) return;

    if (!members || members.length === 0) {
      container.innerHTML = state.currentUser ? `<img src="${state.currentUser.avatar}" class="presence-avatar" title="${state.currentUser.name} (You)" />` : '';
      if (countEl) countEl.textContent = '1 online';
      return;
    }

    container.innerHTML = members.slice(0, 4).map(m => `
      <img src="${m.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}" class="presence-avatar" title="${m.name}" alt="${m.name}" />
    `).join('');

    if (countEl) countEl.textContent = `${members.length} online`;
  }

  bindGlobalInteractions() {
    // Modal Closer Triggers
    document.querySelectorAll('.modal-close-btn, .modal-cancel-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = btn.closest('.modal-backdrop');
        if (modal) modal.classList.remove('open');
      });
    });

    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('open');
      });
    });

    // Project Dropdown Toggle
    const projDropdownBtn = document.getElementById('project-select-trigger');
    const projPopover = document.getElementById('project-popover');
    if (projDropdownBtn && projPopover) {
      projDropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        projPopover.classList.toggle('open');
      });
    }

    // Notifications Popover Toggle
    const notifBtn = document.getElementById('notifications-btn');
    const notifPopover = document.getElementById('notifications-popover');
    if (notifBtn && notifPopover) {
      notifBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        notifPopover.classList.toggle('open');
      });
    }

    // Mark All Read Button
    const markAllReadBtn = document.getElementById('mark-all-read-btn');
    if (markAllReadBtn) {
      markAllReadBtn.addEventListener('click', async () => {
        await API.markAllNotificationsRead();
        this.refreshNotifications();
        window.showToast('All notifications marked as read.', 'info');
      });
    }

    // Profile Settings Modal Trigger
    const profileBtn = document.getElementById('user-profile-btn');
    if (profileBtn) {
      profileBtn.addEventListener('click', () => {
        if (state.currentUser) {
          document.getElementById('profile-name').value = state.currentUser.name;
          document.getElementById('profile-role').value = state.currentUser.role || '';
          document.getElementById('profile-bio').value = state.currentUser.bio || '';
          document.getElementById('profile-avatar').value = state.currentUser.avatar || '';
        }
        window.modalManager.openModal('profile-modal');
      });
    }

    // Create Project Modal Trigger
    const newProjectBtn = document.getElementById('new-project-btn');
    if (newProjectBtn) {
      newProjectBtn.addEventListener('click', () => {
        window.modalManager.openModal('create-project-modal');
        if (projPopover) projPopover.classList.remove('open');
      });
    }

    // Create Project Form Submit
    const createProjectForm = document.getElementById('create-project-form');
    if (createProjectForm) {
      createProjectForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('proj-name-input').value;
        const description = document.getElementById('proj-desc-input').value;
        const color = document.getElementById('proj-color-input').value;

        try {
          const res = await API.createProject({ name, description, color });
          const { projects } = await API.getProjects();
          state.setProjects(projects);
          await this.selectProject(res.project.id);
          window.modalManager.closeModal('create-project-modal');
          window.showToast(`Workspace "${name}" created!`, 'success');
          createProjectForm.reset();
        } catch (err) {
          window.showToast(err.message, 'danger');
        }
      });
    }

    // Join Project Modal Trigger & Form Submit
    const joinProjectBtn = document.getElementById('join-project-btn');
    if (joinProjectBtn) {
      joinProjectBtn.addEventListener('click', () => {
        window.modalManager.openModal('join-project-modal');
        if (projPopover) projPopover.classList.remove('open');
      });
    }

    const joinProjectForm = document.getElementById('join-project-form');
    if (joinProjectForm) {
      joinProjectForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = document.getElementById('join-code-input').value;

        try {
          const res = await API.joinProject(code);
          const { projects } = await API.getProjects();
          state.setProjects(projects);
          await this.selectProject(res.project.id);
          window.modalManager.closeModal('join-project-modal');
          window.showToast(res.message, 'success');
          joinProjectForm.reset();
        } catch (err) {
          window.showToast(err.message, 'danger');
        }
      });
    }

    // Invite Member Modal Trigger
    const inviteMemberBtn = document.getElementById('invite-member-btn');
    if (inviteMemberBtn) {
      inviteMemberBtn.addEventListener('click', () => {
        window.modalManager.openModal('invite-member-modal');
      });
    }

    // Invite Member Form Submit
    const inviteMemberForm = document.getElementById('invite-member-form');
    if (inviteMemberForm) {
      inviteMemberForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('invite-email-input').value;
        const role = document.getElementById('invite-role-select').value;

        try {
          const res = await API.addMember(state.currentProject.project.id, email, role);
          const updated = await API.getProject(state.currentProject.project.id);
          state.setCurrentProject(updated);
          window.modalManager.closeModal('invite-member-modal');
          window.showToast(res.message, 'success');
          inviteMemberForm.reset();
        } catch (err) {
          window.showToast(err.message, 'danger');
        }
      });
    }

    // Global Click to close popovers
    document.addEventListener('click', () => {
      if (projPopover) projPopover.classList.remove('open');
      if (notifPopover) notifPopover.classList.remove('open');
    });

    // Update User UI when user changes
    state.on('user_changed', (user) => {
      if (user) {
        const nameEl = document.getElementById('user-header-name');
        const imgEl = document.getElementById('user-header-img');
        if (nameEl) nameEl.textContent = user.name;
        if (imgEl) imgEl.src = user.avatar;
      }
    });

    state.on('presence_changed', (members) => {
      this.renderPresence(members);
    });
  }
}

window.app = new App();

window.addEventListener('DOMContentLoaded', () => {
  window.app.init();
});
