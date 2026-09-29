// ==========================================================================
// Authentication & User Profile Controller
// ==========================================================================

const AuthController = {
  init() {
    this.bindEvents();
  },

  bindEvents() {
    // Auth Form Toggle (Login / Register)
    const tabLogin = document.getElementById('tab-auth-login');
    const tabRegister = document.getElementById('tab-auth-register');
    const loginFormWrap = document.getElementById('login-form-wrap');
    const registerFormWrap = document.getElementById('register-form-wrap');

    if (tabLogin && tabRegister && loginFormWrap && registerFormWrap) {
      tabLogin.addEventListener('click', () => {
        loginFormWrap.style.display = 'block';
        registerFormWrap.style.display = 'none';
        tabLogin.style.borderBottomColor = 'var(--asana-coral)';
        tabLogin.style.color = 'var(--asana-coral)';
        tabLogin.style.fontWeight = '700';
        tabRegister.style.borderBottomColor = 'transparent';
        tabRegister.style.color = 'var(--text-secondary)';
        tabRegister.style.fontWeight = '600';
      });

      tabRegister.addEventListener('click', () => {
        loginFormWrap.style.display = 'none';
        registerFormWrap.style.display = 'block';
        tabRegister.style.borderBottomColor = 'var(--asana-coral)';
        tabRegister.style.color = 'var(--asana-coral)';
        tabRegister.style.fontWeight = '700';
        tabLogin.style.borderBottomColor = 'transparent';
        tabLogin.style.color = 'var(--text-secondary)';
        tabLogin.style.fontWeight = '600';
      });
    }

    // Login Form Submit
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
          const res = await API.login(email, password);
          API.setToken(res.token);
          state.setCurrentUser(res.user);
          document.getElementById('auth-overlay').style.display = 'none';
          window.showToast(`Welcome back, ${res.user.name}!`, 'success');
          window.app.loadInitialData();
        } catch (err) {
          window.showToast(err.message, 'danger');
        }
      });
    }

    // Register Form Submit
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
      registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;
        const role = document.getElementById('reg-role').value;

        try {
          const res = await API.register({ name, email, password, role });
          API.setToken(res.token);
          state.setCurrentUser(res.user);
          document.getElementById('auth-overlay').style.display = 'none';
          window.showToast(`Account created! Welcome to NovaPulse, ${res.user.name}!`, 'success');
          window.app.loadInitialData();
        } catch (err) {
          window.showToast(err.message, 'danger');
        }
      });
    }

    // Quick Demo Persona Buttons
    document.querySelectorAll('.demo-user-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const email = btn.dataset.email;
        try {
          const res = await API.demoLogin(email);
          API.setToken(res.token);
          state.setCurrentUser(res.user);
          document.getElementById('auth-overlay').style.display = 'none';
          window.showToast(`Switched to demo persona: ${res.user.name}`, 'success');
          window.app.loadInitialData();
        } catch (err) {
          window.showToast(err.message, 'danger');
        }
      });
    });

    // Profile Settings Form Submit & Interactivity
    this.bindProfileModalInteractions();

    // Logout Handler
    const handleLogout = () => {
      API.setToken(null);
      state.setCurrentUser(null);
      state.setCurrentProject(null);
      if (typeof socketManager !== 'undefined' && socketManager.socket) {
        socketManager.socket.disconnect();
      }
      if (window.modalManager) window.modalManager.closeAll();
      if (window.AsanaApp && typeof window.AsanaApp.closeDrawer === 'function') {
        window.AsanaApp.closeDrawer();
      }
      const overlay = document.getElementById('auth-overlay');
      if (overlay) overlay.style.display = 'flex';
      window.showToast('Logged out successfully.', 'info');
    };

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    const quickLogoutBtn = document.getElementById('logout-quick-btn');
    if (quickLogoutBtn) quickLogoutBtn.addEventListener('click', handleLogout);

    // Listen for expired auth token
    window.addEventListener('auth_expired', () => {
      handleLogout();
      window.showToast('Session expired. Please log in again.', 'danger');
    });
  },

  populateProfileModal() {
    const user = state.currentUser;
    if (!user) return;

    const nameInput = document.getElementById('profile-name');
    const roleInput = document.getElementById('profile-role');
    const bioInput = document.getElementById('profile-bio');
    const avatarInput = document.getElementById('profile-avatar');
    const avatarPreview = document.getElementById('profile-avatar-preview');
    const colorInput = document.getElementById('profile-color');
    const emailDisplay = document.getElementById('profile-email-display');

    if (nameInput) nameInput.value = user.name || '';
    if (roleInput) roleInput.value = user.role || '';
    if (bioInput) bioInput.value = user.bio || '';
    if (avatarInput) avatarInput.value = user.avatar || '';
    if (avatarPreview) avatarPreview.src = user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';
    if (colorInput) colorInput.value = user.color || '#f06a6a';
    if (emailDisplay) emailDisplay.textContent = user.email || '';

    // Highlight preset avatar if matching
    document.querySelectorAll('.profile-preset-avatar').forEach(img => {
      if (img.dataset.avatar === user.avatar) {
        img.style.borderColor = 'var(--asana-coral)';
        img.style.transform = 'scale(1.15)';
      } else {
        img.style.borderColor = 'transparent';
        img.style.transform = 'scale(1)';
      }
    });

    if (window.lucide) lucide.createIcons();
  },

  bindProfileModalInteractions() {
    const avatarInput = document.getElementById('profile-avatar');
    const avatarPreview = document.getElementById('profile-avatar-preview');
    const fileInput = document.getElementById('profile-photo-input');
    const profileForm = document.getElementById('profile-form');

    // 1. Live preview on custom URL input
    if (avatarInput && avatarPreview) {
      avatarInput.addEventListener('input', (e) => {
        const url = e.target.value.trim();
        if (url) {
          avatarPreview.src = url;
        } else if (state.currentUser) {
          avatarPreview.src = state.currentUser.avatar || '';
        }
      });
    }

    // 2. Local photo file upload (FileReader to Base64 data URL)
    if (fileInput && avatarPreview && avatarInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        if (file.size > 8 * 1024 * 1024) {
          window.showToast('Image file is too large (max 8MB).', 'danger');
          return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target.result;
          avatarPreview.src = dataUrl;
          avatarInput.value = dataUrl;
          window.showToast('Photo selected! Click "Save Changes" to apply.', 'info');
        };
        reader.readAsDataURL(file);
      });
    }

    // 3. Preset avatar selection
    document.querySelectorAll('.profile-preset-avatar').forEach(img => {
      img.addEventListener('click', () => {
        const selectedUrl = img.dataset.avatar;
        if (avatarInput) avatarInput.value = selectedUrl;
        if (avatarPreview) avatarPreview.src = selectedUrl;

        document.querySelectorAll('.profile-preset-avatar').forEach(i => {
          i.style.borderColor = (i === img) ? 'var(--asana-coral)' : 'transparent';
          i.style.transform = (i === img) ? 'scale(1.15)' : 'scale(1)';
        });
      });
    });

    // 4. Submit Profile Form
    if (profileForm) {
      profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('profile-name')?.value;
        const role = document.getElementById('profile-role')?.value;
        const bio = document.getElementById('profile-bio')?.value || '';
        const avatar = document.getElementById('profile-avatar')?.value;
        const color = document.getElementById('profile-color')?.value;

        if (!name || name.trim() === '') {
          window.showToast('Name cannot be empty.', 'danger');
          return;
        }

        try {
          const res = await API.updateProfile({ name, role, bio, avatar, color });
          state.setCurrentUser(res.user);

          // Update in system users list if present
          if (state.allUsers) {
            const idx = state.allUsers.findIndex(u => u.id === res.user.id);
            if (idx !== -1) {
              state.allUsers[idx] = { ...state.allUsers[idx], ...res.user };
            }
          }

          // Broadcast presence update if socket connected
          if (typeof socketManager !== 'undefined' && socketManager.socket && state.currentProject) {
            socketManager.socket.emit('join_project', state.currentProject.project.id);
          }

          window.modalManager.closeModal('profile-modal');
          window.showToast('Profile updated successfully!', 'success');
        } catch (err) {
          window.showToast(err.message || 'Failed to update profile', 'danger');
        }
      });
    }
  }
};

window.AuthController = AuthController;

window.openProfileModal = function() {
  if (window.AuthController && typeof window.AuthController.populateProfileModal === 'function') {
    window.AuthController.populateProfileModal();
  }
  if (window.modalManager) {
    window.modalManager.openModal('profile-modal');
  } else {
    const modal = document.getElementById('profile-modal');
    if (modal) modal.classList.add('open');
  }
  if (window.lucide) lucide.createIcons();
};
