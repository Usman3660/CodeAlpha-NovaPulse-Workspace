// ==========================================================================
// NovaPulse - 100% Asana-Identical Application Logic & UI Controller
// ==========================================================================

const AsanaApp = {
  activeTaskId: null,
  activeView: 'list', // 'list', 'board', 'timeline', 'calendar', 'dashboard', 'messages', 'my-tasks', 'inbox', 'portfolios', 'goals'
  collapsedSections: new Set(),
  taskLikes: {},
  goals: [
    {
      id: 1,
      title: 'Launch NovaPulse 3D Real-Time Collaboration Suite',
      owner: 'Usman',
      ownerRole: 'Product Lead',
      ownerAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      timeframe: 'Q3 2026',
      status: 'on_track',
      progress: 85,
      keyResults: [
        { title: 'Implement Three.js 3D WebGL background and spatial physics', completed: true },
        { title: 'Sub-50ms WebSocket room multi-user card synchronization', completed: true },
        { title: 'Complete automated security audit & rate limiting', completed: true }
      ]
    },
    {
      id: 2,
      title: 'Establish Modern Asana-Identical Light Design System',
      owner: 'Ahmad',
      ownerRole: 'UI/UX Designer',
      ownerAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
      timeframe: 'Q4 2026',
      status: 'on_track',
      progress: 90,
      keyResults: [
        { title: 'Build collapsible list view table with circular completion checks', completed: true },
        { title: 'Implement right-slide task inspector drawer with subtasks', completed: true },
        { title: 'Design executive Portfolios and interactive Goals dashboards', completed: true }
      ]
    },
    {
      id: 3,
      title: 'Enterprise Scalability & 99.9% Collaboration Uptime',
      owner: 'Ali',
      ownerRole: 'Full Stack Engineer',
      ownerAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      timeframe: 'Q4 2026',
      status: 'on_track',
      progress: 75,
      keyResults: [
        { title: 'SQLite schema optimization & foreign key cascading', completed: true },
        { title: 'Role-based access control & token expiration validation', completed: false }
      ]
    }
  ],

  init() {
    this.bindSidebarEvents();
    this.bindTopbarEvents();
    this.bindViewNavEvents();
    this.bindDrawerEvents();
    this.bindToolbarEvents();
    this.bindModalEvents();

    // Subscribe to State Events
    state.on('project_data_changed', () => {
      this.renderCurrentView();
      this.updateProjectHeader();
      this.updateSidebarProjects();
    });

    state.on('projects_changed', (projects) => {
      this.updateSidebarProjects(projects);
    });

    state.on('user_changed', (user) => {
      this.updateSidebarUserProfile(user);
    });

    state.on('notifications_changed', ({ unreadCount }) => {
      const inboxBadge = document.getElementById('sidebar-inbox-badge');
      const topbarBadge = document.getElementById('topbar-inbox-badge');
      if (inboxBadge) {
        inboxBadge.style.display = unreadCount > 0 ? 'inline-flex' : 'none';
        inboxBadge.textContent = unreadCount;
      }
      if (topbarBadge) {
        topbarBadge.style.display = unreadCount > 0 ? 'inline-flex' : 'none';
        topbarBadge.textContent = unreadCount;
      }
    });

    // If state is already initialized, render immediately
    if (state.currentProject) {
      this.renderCurrentView();
      this.updateProjectHeader();
      this.updateSidebarProjects();
    }
    if (state.currentUser) {
      this.updateSidebarUserProfile(state.currentUser);
    }
  },

  // --------------------------------------------------------------------------
  // Event Bindings
  // --------------------------------------------------------------------------

  bindSidebarEvents() {
    // Navigation Items (Home, My Tasks, Inbox, Reporting, Portfolios, Goals)
    document.querySelectorAll('.sidebar-nav-item').forEach(item => {
      item.addEventListener('click', () => {
        document.querySelectorAll('.sidebar-nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        const navTarget = item.dataset.nav;
        if (navTarget === 'home') {
          this.switchView('list');
        } else if (navTarget === 'my-tasks') {
          this.renderMyTasks();
        } else if (navTarget === 'inbox') {
          this.renderInbox();
        } else if (navTarget === 'dashboard') {
          this.switchView('dashboard');
        } else if (navTarget === 'portfolios') {
          this.switchView('portfolios');
        } else if (navTarget === 'goals') {
          this.switchView('goals');
        }
      });
    });

    // Add Project (+) in Sidebar
    const addProjBtn = document.getElementById('sidebar-add-project-btn');
    if (addProjBtn) {
      addProjBtn.addEventListener('click', () => {
        window.modalManager.openModal('create-project-modal');
      });
    }

    // Sidebar Toggle Collapse
    const toggleBtn = document.getElementById('sidebar-toggle-btn');
    const sidebar = document.getElementById('asana-sidebar');
    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
      });
    }
  },

  bindTopbarEvents() {
    // Omnisearch
    const searchInput = document.getElementById('global-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.setFilters({ search: e.target.value });
      });
    }

    // Keyboard Shortcut Ctrl+K for search
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (searchInput) searchInput.focus();
      } else if (e.key === 'Escape') {
        this.closeDrawer();
      }
    });

    // Topbar "+ Create" Button
    const topCreateBtn = document.getElementById('top-create-btn');
    if (topCreateBtn) {
      topCreateBtn.addEventListener('click', () => {
        if (state.currentProject && state.currentProject.columns.length > 0) {
          window.BoardController.openCreateTaskModal(state.currentProject.columns[0].id);
        } else {
          window.modalManager.openModal('create-task-modal');
        }
      });
    }

    // Topbar Inbox Bell Button
    const topbarInboxBtn = document.getElementById('topbar-inbox-btn');
    if (topbarInboxBtn) {
      topbarInboxBtn.addEventListener('click', () => {
        this.renderInbox();
      });
    }
  },

  bindViewNavEvents() {
    // Asana Tabs: List, Board, Timeline, Calendar, Dashboard, Messages
    document.querySelectorAll('.asana-tab-btn').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.asana-tab-btn').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const view = tab.dataset.view;
        this.switchView(view);
      });
    });
  },

  bindToolbarEvents() {
    // Toolbar Add Task Button
    const toolbarAddBtn = document.getElementById('toolbar-add-task-btn');
    if (toolbarAddBtn) {
      toolbarAddBtn.addEventListener('click', () => {
        if (state.currentProject && state.currentProject.columns.length > 0) {
          window.BoardController.openCreateTaskModal(state.currentProject.columns[0].id);
        }
      });
    }

    // Toolbar Add Section Button
    const toolbarAddSectionBtn = document.getElementById('toolbar-add-section-btn');
    if (toolbarAddSectionBtn) {
      toolbarAddSectionBtn.addEventListener('click', () => {
        window.modalManager.openModal('create-section-modal');
      });
    }

    // Filter Priority
    const filterSelect = document.getElementById('toolbar-priority-filter');
    if (filterSelect) {
      filterSelect.addEventListener('change', (e) => {
        state.setFilters({ priority: e.target.value });
      });
    }

    // Sort Filter
    const sortSelect = document.getElementById('toolbar-sort-filter');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.applySorting(e.target.value);
      });
    }

    // Star Project Toggle
    const starBtn = document.getElementById('project-star-btn');
    if (starBtn) {
      starBtn.addEventListener('click', () => {
        starBtn.classList.toggle('starred');
        window.showToast(starBtn.classList.contains('starred') ? 'Project added to Starred' : 'Project removed from Starred', 'info');
        this.updateSidebarStarred();
      });
    }
  },

  bindModalEvents() {
    // Add Section Form
    const createSectionForm = document.getElementById('create-section-form');
    if (createSectionForm) {
      createSectionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('section-name-input');
        if (!nameInput || !nameInput.value.trim() || !state.currentProject) return;

        try {
          await API.createColumn({
            project_id: state.currentProject.project.id,
            name: nameInput.value.trim()
          });
          nameInput.value = '';
          window.modalManager.closeModal('create-section-modal');
          window.showToast('Section added', 'success');
          const fresh = await API.getProject(state.currentProject.project.id);
          state.setCurrentProject(fresh);
        } catch (err) {
          window.showToast(err.message, 'danger');
        }
      });
    }

    // Create Goal Form
    const createGoalForm = document.getElementById('create-goal-form');
    if (createGoalForm) {
      createGoalForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const titleInput = document.getElementById('goal-title-input');
        const ownerSelect = document.getElementById('goal-owner-select');
        const timeframeSelect = document.getElementById('goal-timeframe-select');
        const progressInput = document.getElementById('goal-progress-input');

        if (!titleInput || !titleInput.value.trim()) return;

        const ownerName = ownerSelect ? ownerSelect.value : 'Usman';
        const ownerRole = ownerName === 'Usman' ? 'Product Lead' : (ownerName === 'Ali' ? 'Full-Stack Dev' : 'UI/UX Designer');
        const ownerAvatar = ownerName === 'Usman' 
          ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
          : (ownerName === 'Ali'
              ? 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'
              : 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150');

        const newGoal = {
          id: Date.now(),
          title: titleInput.value.trim(),
          owner: ownerName,
          ownerRole: ownerRole,
          ownerAvatar: ownerAvatar,
          timeframe: timeframeSelect ? timeframeSelect.value : 'Q4 2026',
          status: 'on_track',
          progress: progressInput ? parseInt(progressInput.value) || 20 : 20,
          keyResults: [
            { title: `Deliver initial phase of ${titleInput.value.trim()}`, completed: false }
          ]
        };

        this.goals.unshift(newGoal);
        titleInput.value = '';
        window.modalManager.closeModal('create-goal-modal');
        window.showToast('Goal created successfully! 🎯', 'success');
        this.switchView('goals');
      });
    }
  },

  bindDrawerEvents() {
    // Drawer Close Button
    const closeBtn = document.getElementById('drawer-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.closeDrawer();
      });
    }

    // "Mark Complete" Button in Drawer
    const markCompleteBtn = document.getElementById('drawer-mark-complete-btn');
    if (markCompleteBtn) {
      markCompleteBtn.addEventListener('click', async () => {
        if (!this.activeTaskId || !state.currentProject) return;
        const taskData = await API.getTask(this.activeTaskId);
        const task = taskData.task;

        const doneCol = state.currentProject.columns.find(c => c.name.toLowerCase().includes('done')) || state.currentProject.columns[state.currentProject.columns.length - 1];
        const isCurrentlyDone = task.column_name?.toLowerCase().includes('done');
        const targetColId = isCurrentlyDone ? state.currentProject.columns[0].id : doneCol.id;

        await API.moveTask({
          task_id: this.activeTaskId,
          target_column_id: targetColId,
          new_order_index: 0,
          project_id: state.currentProject.project.id
        });

        if (!isCurrentlyDone) {
          this.triggerAsanaCelebration();
          window.showToast('🎉 Task completed!', 'success');
        }

        const fresh = await API.getProject(state.currentProject.project.id);
        state.setCurrentProject(fresh);
        this.openDrawer(this.activeTaskId);
      });
    }

    // Like Task
    const likeBtn = document.getElementById('drawer-like-btn');
    if (likeBtn) {
      likeBtn.addEventListener('click', () => {
        if (!this.activeTaskId) return;
        this.taskLikes[this.activeTaskId] = (this.taskLikes[this.activeTaskId] || 0) + 1;
        document.getElementById('drawer-like-count').textContent = this.taskLikes[this.activeTaskId];
        window.showToast('Liked task 👍', 'info');
      });
    }

    // Copy Task Link
    const copyLinkBtn = document.getElementById('drawer-copy-link-btn');
    if (copyLinkBtn) {
      copyLinkBtn.addEventListener('click', () => {
        if (!this.activeTaskId) return;
        navigator.clipboard.writeText(`${window.location.origin}/#task-${this.activeTaskId}`);
        window.showToast('Task link copied to clipboard!', 'success');
      });
    }

    // Delete Task
    const deleteBtn = document.getElementById('drawer-delete-task-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        if (!this.activeTaskId || !confirm('Are you sure you want to delete this task?')) return;
        try {
          await API.deleteTask(this.activeTaskId);
          this.closeDrawer();
          window.showToast('Task deleted', 'info');
          const fresh = await API.getProject(state.currentProject.project.id);
          state.setCurrentProject(fresh);
        } catch (err) {
          window.showToast(err.message, 'danger');
        }
      });
    }

    // Title Inline Edit in Drawer
    const titleInput = document.getElementById('drawer-task-title');
    if (titleInput) {
      titleInput.addEventListener('change', async () => {
        if (!this.activeTaskId) return;
        await API.updateTask(this.activeTaskId, { title: titleInput.value });
        const fresh = await API.getProject(state.currentProject.project.id);
        state.setCurrentProject(fresh);
      });
    }

    // Description Inline Edit in Drawer
    const descInput = document.getElementById('drawer-task-desc');
    if (descInput) {
      descInput.addEventListener('change', async () => {
        if (!this.activeTaskId) return;
        await API.updateTask(this.activeTaskId, { description: descInput.value });
        const fresh = await API.getProject(state.currentProject.project.id);
        state.setCurrentProject(fresh);
      });
    }

    // Priority change in Drawer
    const prioritySelect = document.getElementById('drawer-task-priority');
    if (prioritySelect) {
      prioritySelect.addEventListener('change', async () => {
        if (!this.activeTaskId) return;
        await API.updateTask(this.activeTaskId, { priority: prioritySelect.value });
        const fresh = await API.getProject(state.currentProject.project.id);
        state.setCurrentProject(fresh);
      });
    }

    // Due Date change in Drawer
    const dueDateInput = document.getElementById('drawer-task-due-date');
    if (dueDateInput) {
      dueDateInput.addEventListener('change', async () => {
        if (!this.activeTaskId) return;
        await API.updateTask(this.activeTaskId, { due_date: dueDateInput.value || null });
        const fresh = await API.getProject(state.currentProject.project.id);
        state.setCurrentProject(fresh);
      });
    }

    // Section/Column change in Drawer
    const sectionSelect = document.getElementById('drawer-task-section');
    if (sectionSelect) {
      sectionSelect.addEventListener('change', async () => {
        if (!this.activeTaskId) return;
        await API.moveTask({
          task_id: this.activeTaskId,
          target_column_id: parseInt(sectionSelect.value),
          new_order_index: 0,
          project_id: state.currentProject.project.id
        });
        const fresh = await API.getProject(state.currentProject.project.id);
        state.setCurrentProject(fresh);
      });
    }

    // Comment Composer in Drawer
    const commentForm = document.getElementById('drawer-comment-form');
    if (commentForm) {
      commentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('drawer-comment-input');
        if (!input || !input.value.trim() || !this.activeTaskId) return;

        try {
          await API.addComment(this.activeTaskId, input.value.trim());
          input.value = '';
          this.openDrawer(this.activeTaskId);
          window.showToast('Comment posted', 'success');
        } catch (err) {
          window.showToast(err.message, 'danger');
        }
      });
    }

    // Add Subtask in Drawer
    const addSubtaskForm = document.getElementById('drawer-add-subtask-form');
    if (addSubtaskForm) {
      addSubtaskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('drawer-new-subtask-input');
        if (!input || !input.value.trim() || !this.activeTaskId) return;

        try {
          await API.addSubtask(this.activeTaskId, input.value.trim());
          input.value = '';
          this.openDrawer(this.activeTaskId);
        } catch (err) {
          window.showToast(err.message, 'danger');
        }
      });
    }
  },

  // --------------------------------------------------------------------------
  // View Switching & Layout
  // --------------------------------------------------------------------------

  switchView(view) {
    this.activeView = view;
    const views = ['list', 'board', 'timeline', 'calendar', 'dashboard', 'messages', 'my-tasks', 'inbox', 'portfolios', 'goals'];

    views.forEach(v => {
      const el = document.getElementById(`asana-${v}-view`);
      if (el) el.style.display = (v === view) ? (v === 'board' ? 'flex' : 'block') : 'none';
    });

    // Update active tab styling
    document.querySelectorAll('.asana-tab-btn').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.view === view);
    });

    // Update Header Title
    const titleText = document.getElementById('project-header-title-text');
    if (titleText) {
      if (view === 'portfolios') {
        titleText.textContent = 'Executive Portfolios';
      } else if (view === 'goals') {
        titleText.textContent = 'Company & Team Goals (OKRs)';
      } else if (view === 'inbox') {
        titleText.textContent = 'Inbox Notifications';
      } else if (view === 'dashboard') {
        titleText.textContent = 'Project Dashboard & Reporting';
      } else if (state.currentProject) {
        titleText.textContent = state.currentProject.project.name;
      }
    }

    this.renderCurrentView();
  },

  renderCurrentView() {
    if (this.activeView === 'portfolios') {
      this.renderPortfoliosView();
      return;
    } else if (this.activeView === 'goals') {
      this.renderGoalsView();
      return;
    } else if (this.activeView === 'inbox') {
      this.renderInboxView();
      return;
    }

    if (!state.currentProject) return;

    if (this.activeView === 'list') {
      this.renderListView();
    } else if (this.activeView === 'board') {
      this.renderBoardView();
    } else if (this.activeView === 'timeline') {
      this.renderTimelineView();
    } else if (this.activeView === 'calendar') {
      this.renderCalendarView();
    } else if (this.activeView === 'dashboard') {
      this.renderDashboardView();
    } else if (this.activeView === 'messages') {
      this.renderMessagesView();
    }
  },

  // --------------------------------------------------------------------------
  // 1. ASANA LIST VIEW (Table with Sections & Inline Adding)
  // --------------------------------------------------------------------------

  renderListView() {
    const listContainer = document.getElementById('asana-list-view');
    if (!listContainer || !state.currentProject) return;

    const { columns } = state.currentProject;
    listContainer.innerHTML = '';

    columns.forEach(column => {
      const columnTasks = state.getFilteredTasks(column.id);
      const isDoneSection = column.name.toLowerCase().includes('done');
      const isCollapsed = this.collapsedSections.has(column.id);

      const sectionEl = document.createElement('div');
      sectionEl.className = 'list-section';
      sectionEl.innerHTML = `
        <div class="list-section-header">
          <div class="list-section-title-wrap">
            <button class="section-toggle-btn" data-col-id="${column.id}">
              <i data-lucide="${isCollapsed ? 'chevron-right' : 'chevron-down'}" style="width: 16px; height: 16px;"></i>
            </button>
            <span class="section-title">${column.name}</span>
            <span class="section-count-badge">${columnTasks.length}</span>
          </div>
          <button class="topbar-icon-btn" style="width:24px; height:24px;" onclick="AsanaApp.openQuickAddTask(${column.id})" title="Add task to ${column.name}">
            <i data-lucide="plus" style="width:14px; height:14px;"></i>
          </button>
        </div>

        ${!isCollapsed ? `
          <div class="list-table-header">
            <span></span>
            <span>Task name</span>
            <span>Assignee</span>
            <span>Due date</span>
            <span>Priority</span>
            <span></span>
          </div>

          <div class="list-section-tasks" id="section-tasks-${column.id}">
            <!-- Task rows populated below -->
          </div>

          <div class="inline-add-task-row" onclick="AsanaApp.openQuickAddTask(${column.id})">
            <i data-lucide="plus" style="width: 15px; height: 15px; color: var(--asana-coral);"></i>
            <span>Add task...</span>
          </div>
        ` : ''}
      `;

      // Toggle Section Collapse
      const toggleBtn = sectionEl.querySelector('.section-toggle-btn');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
          if (this.collapsedSections.has(column.id)) {
            this.collapsedSections.delete(column.id);
          } else {
            this.collapsedSections.add(column.id);
          }
          this.renderListView();
        });
      }

      if (!isCollapsed) {
        const tasksContainer = sectionEl.querySelector(`#section-tasks-${column.id}`);

        columnTasks.forEach(task => {
          const row = document.createElement('div');
          row.className = `asana-task-row ${isDoneSection ? 'completed-task' : ''} ${this.activeTaskId === task.id ? 'selected' : ''}`;
          row.dataset.taskId = task.id;

          const assignee = (task.assignees && task.assignees[0]) || null;
          const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !isDoneSection;

          row.innerHTML = `
            <div>
              <div class="asana-check-circle ${isDoneSection ? 'completed' : ''}" data-task-id="${task.id}" title="Mark task complete">
                ${isDoneSection ? '<i data-lucide="check" style="width:12px; height:12px;"></i>' : ''}
              </div>
            </div>
            <div class="asana-task-title-cell">
              <span>${task.title}</span>
              ${task.subtask_count > 0 ? `
                <span style="font-size:0.75rem; color:var(--text-tertiary); display:flex; align-items:center; gap:3px;">
                  <i data-lucide="check-square" style="width:12px; height:12px;"></i>
                  ${task.completed_subtasks_count}/${task.subtask_count}
                </span>` : ''}
            </div>
            <div class="asana-assignee-cell">
              ${assignee ? `
                <img src="${assignee.avatar}" class="asana-assignee-avatar" title="${assignee.name}" alt="${assignee.name}" />
                <span>${assignee.name.split(' ')[0]}</span>
              ` : '<span style="color:var(--text-disabled); font-size:0.78rem;">Unassigned</span>'}
            </div>
            <div class="asana-due-date-cell ${isOverdue ? 'overdue' : ''}">
              ${task.due_date ? `
                <i data-lucide="calendar" style="width:12px; height:12px;"></i>
                <span>${new Date(task.due_date).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</span>
              ` : ''}
            </div>
            <div>
              <span class="priority-pill ${task.priority}">${task.priority}</span>
            </div>
            <div>
              <i data-lucide="chevron-right" style="width:14px; height:14px; color:var(--text-disabled);"></i>
            </div>
          `;

          // Checkbox complete toggle
          row.querySelector('.asana-check-circle').addEventListener('click', async (e) => {
            e.stopPropagation();
            const doneCol = state.currentProject.columns.find(c => c.name.toLowerCase().includes('done')) || state.currentProject.columns[state.currentProject.columns.length - 1];
            const targetColId = isDoneSection ? state.currentProject.columns[0].id : doneCol.id;

            await API.moveTask({
              task_id: task.id,
              target_column_id: targetColId,
              new_order_index: 0,
              project_id: state.currentProject.project.id
            });

            if (!isDoneSection) {
              this.triggerAsanaCelebration();
              window.showToast('🎉 Task completed!', 'success');
            }

            const fresh = await API.getProject(state.currentProject.project.id);
            state.setCurrentProject(fresh);
          });

          // Click row to slide open Right Task Drawer
          row.addEventListener('click', () => {
            document.querySelectorAll('.asana-task-row').forEach(r => r.classList.remove('selected'));
            row.classList.add('selected');
            this.openDrawer(task.id);
          });

          tasksContainer.appendChild(row);
        });
      }

      listContainer.appendChild(sectionEl);
    });

    // Bottom "+ Add section" link
    const addSecFooter = document.createElement('div');
    addSecFooter.className = 'inline-add-task-row';
    addSecFooter.style.marginTop = '16px';
    addSecFooter.innerHTML = `
      <i data-lucide="plus" style="width: 16px; height: 16px; color: var(--text-tertiary);"></i>
      <span style="font-weight: 700; color: var(--text-secondary);">Add section...</span>
    `;
    addSecFooter.onclick = () => window.modalManager.openModal('create-section-modal');
    listContainer.appendChild(addSecFooter);

    if (window.lucide) lucide.createIcons();
  },

  // --------------------------------------------------------------------------
  // 2. ASANA BOARD VIEW (Kanban Columns with Drag & Drop)
  // --------------------------------------------------------------------------

  renderBoardView() {
    const boardContainer = document.getElementById('asana-board-view');
    if (!boardContainer || !state.currentProject) return;

    const { columns } = state.currentProject;
    boardContainer.innerHTML = '';

    columns.forEach(column => {
      const columnTasks = state.getFilteredTasks(column.id);

      const colEl = document.createElement('div');
      colEl.className = 'asana-board-column';
      colEl.dataset.columnId = column.id;

      colEl.innerHTML = `
        <div class="board-col-header">
          <div class="board-col-title-group">
            <span class="board-col-title">${column.name}</span>
            <span class="board-col-count">${columnTasks.length}</span>
          </div>
          <button class="topbar-icon-btn" style="width:24px; height:24px;" onclick="AsanaApp.openQuickAddTask(${column.id})">
            <i data-lucide="plus" style="width:16px; height:16px;"></i>
          </button>
        </div>

        <div class="board-col-cards" data-column-id="${column.id}">
          <!-- Cards rendered here -->
        </div>

        <div class="inline-add-task-row" style="background:#ffffff; border:1px dashed var(--asana-border); margin-top:8px; justify-content:center;" onclick="AsanaApp.openQuickAddTask(${column.id})">
          <i data-lucide="plus" style="width:14px; height:14px; color:var(--asana-coral);"></i>
          <span>Add task</span>
        </div>
      `;

      const cardsContainer = colEl.querySelector('.board-col-cards');

      // Drag and drop listeners
      cardsContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        colEl.style.backgroundColor = '#edf5fd';
      });
      cardsContainer.addEventListener('dragleave', () => {
        colEl.style.backgroundColor = '';
      });
      cardsContainer.addEventListener('drop', async (e) => {
        e.preventDefault();
        colEl.style.backgroundColor = '';
        const taskId = e.dataTransfer.getData('text/plain');
        if (!taskId) return;

        const res = await API.moveTask({
          task_id: parseInt(taskId),
          target_column_id: column.id,
          new_order_index: 0,
          project_id: state.currentProject.project.id
        });

        if (res.isDone) {
          this.triggerAsanaCelebration();
        }

        const fresh = await API.getProject(state.currentProject.project.id);
        state.setCurrentProject(fresh);
      });

      columnTasks.forEach(task => {
        const card = document.createElement('div');
        card.className = 'asana-board-card';
        card.draggable = true;
        card.dataset.taskId = task.id;

        card.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', task.id);
        });

        card.innerHTML = `
          <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:6px;">
            <div class="board-card-title">${task.title}</div>
            <span class="priority-pill ${task.priority}">${task.priority}</span>
          </div>
          ${task.description ? `<p style="font-size:0.78rem; color:var(--text-tertiary); margin-bottom:8px; line-height:1.3; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${task.description}</p>` : ''}
          <div class="board-card-footer">
            <div style="display:flex; align-items:center; gap:6px; font-size:0.75rem; color:var(--text-secondary);">
              ${task.due_date ? `<i data-lucide="calendar" style="width:12px; height:12px;"></i> ${new Date(task.due_date).toLocaleDateString(undefined, {month:'short', day:'numeric'})}` : ''}
              ${task.comment_count > 0 ? `<span style="display:flex; align-items:center; gap:2px;"><i data-lucide="message-square" style="width:12px; height:12px;"></i>${task.comment_count}</span>` : ''}
            </div>
            <div style="display:flex; align-items:center;">
              ${(task.assignees || []).map(a => `<img src="${a.avatar}" class="asana-assignee-avatar" title="${a.name}" alt="${a.name}" />`).join('')}
            </div>
          </div>
        `;

        card.addEventListener('click', () => {
          this.openDrawer(task.id);
        });

        cardsContainer.appendChild(card);
      });

      boardContainer.appendChild(colEl);
    });

    if (window.lucide) lucide.createIcons();
  },

  // --------------------------------------------------------------------------
  // 3. ASANA TIMELINE VIEW (Gantt Schedule)
  // --------------------------------------------------------------------------

  renderTimelineView() {
    const container = document.getElementById('asana-timeline-view');
    if (!container || !state.currentProject) return;

    const { tasks } = state.currentProject;

    container.innerHTML = `
      <div class="timeline-container">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
          <h3 style="font-size:1.1rem; font-weight:800;">Timeline Schedule</h3>
          <span style="font-size:0.8rem; color:var(--text-tertiary); font-weight:600;">September — October 2026</span>
        </div>

        <div style="display:flex; flex-direction:column; gap:12px;">
          ${tasks.map(t => {
            const dateStr = t.due_date ? new Date(t.due_date).toLocaleDateString(undefined, {month:'short', day:'numeric'}) : 'No date set';
            const widthPct = Math.min(85, Math.max(30, 40 + (t.id * 8) % 45));
            return `
              <div style="display:flex; align-items:center; gap:16px; cursor:pointer;" onclick="AsanaApp.openDrawer(${t.id})">
                <div style="width:200px; font-size:0.85rem; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                  ${t.title}
                </div>
                <div style="flex:1; background:#f1f3f5; border-radius:6px; height:32px; position:relative; overflow:hidden;">
                  <div style="width:${widthPct}%; height:100%; background:linear-gradient(90deg, var(--asana-coral), #f26b9c); border-radius:6px; display:flex; align-items:center; padding:0 12px; color:white; font-size:0.75rem; font-weight:700; gap:8px;">
                    <i data-lucide="calendar" style="width:12px; height:12px;"></i> Due ${dateStr}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
  },

  // --------------------------------------------------------------------------
  // 4. ASANA CALENDAR VIEW
  // --------------------------------------------------------------------------

  renderCalendarView() {
    const container = document.getElementById('asana-calendar-view');
    if (!container || !state.currentProject) return;

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const { tasks } = state.currentProject;

    container.innerHTML = `
      <div style="background:#ffffff; border:1px solid var(--asana-border); border-radius:var(--radius-lg); padding:20px; box-shadow:var(--shadow-sm);">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
          <h3 style="font-size:1.1rem; font-weight:800;">September 2026</h3>
          <div style="display:flex; gap:6px;">
            <button class="toolbar-secondary-btn">Today</button>
          </div>
        </div>

        <div class="calendar-grid">
          ${days.map(d => `<div class="calendar-day-header">${d}</div>`).join('')}
          ${Array.from({ length: 28 }, (_, i) => {
            const dayNum = i + 1;
            const dayTasks = tasks.filter(t => t.due_date && new Date(t.due_date).getDate() === dayNum);
            return `
              <div class="calendar-day-cell">
                <span class="calendar-day-number">${dayNum}</span>
                ${dayTasks.map(t => `
                  <div style="font-size:0.72rem; font-weight:700; background:var(--asana-coral-light); color:var(--asana-coral); padding:2px 6px; border-radius:4px; cursor:pointer; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" onclick="AsanaApp.openDrawer(${t.id})">
                    ${t.title}
                  </div>
                `).join('')}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
  },

  // --------------------------------------------------------------------------
  // 5. ASANA DASHBOARD VIEW
  // --------------------------------------------------------------------------

  renderDashboardView() {
    const dashboardContainer = document.getElementById('asana-dashboard-view');
    if (!dashboardContainer || !state.currentProject) return;

    const { metrics, columns, tasks } = state.currentProject;

    dashboardContainer.innerHTML = `
      <div style="padding:24px; max-width:1100px; margin:0 auto; display:flex; flex-direction:column; gap:24px;">
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:16px;">
          <div style="padding:20px; background:#ffffff; border:1px solid var(--asana-border); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm);">
            <div style="font-size:0.8rem; font-weight:700; color:var(--text-tertiary); text-transform:uppercase;">Completed Tasks</div>
            <div style="font-size:2rem; font-weight:800; color:var(--asana-green-dark); margin-top:4px;">${metrics.completedTasks} / ${metrics.totalTasks}</div>
          </div>
          <div style="padding:20px; background:#ffffff; border:1px solid var(--asana-border); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm);">
            <div style="font-size:0.8rem; font-weight:700; color:var(--text-tertiary); text-transform:uppercase;">Progress Rate</div>
            <div style="font-size:2rem; font-weight:800; color:var(--asana-coral); margin-top:4px;">${metrics.progressPercentage}%</div>
          </div>
          <div style="padding:20px; background:#ffffff; border:1px solid var(--asana-border); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm);">
            <div style="font-size:0.8rem; font-weight:700; color:var(--text-tertiary); text-transform:uppercase;">Urgent Priority</div>
            <div style="font-size:2rem; font-weight:800; color:#dc2626; margin-top:4px;">${metrics.urgentCount}</div>
          </div>
        </div>

        <div style="background:#ffffff; border:1px solid var(--asana-border); border-radius:var(--radius-lg); padding:24px; box-shadow:var(--shadow-sm);">
          <h3 style="font-size:1.1rem; font-weight:800; margin-bottom:16px;">Tasks by Section</h3>
          ${columns.map(col => {
            const count = tasks.filter(t => t.column_id === col.id).length;
            const pct = metrics.totalTasks > 0 ? Math.round((count / metrics.totalTasks) * 100) : 0;
            return `
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; font-size:0.88rem; font-weight:600;">
                <span style="width:140px;">${col.name}</span>
                <div style="flex:1; margin:0 16px; height:8px; background:#e2e8f0; border-radius:4px; overflow:hidden;">
                  <div style="width:${pct}%; height:100%; background:var(--asana-coral);"></div>
                </div>
                <span style="width:60px; text-align:right; font-weight:700;">${count} (${pct}%)</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  // --------------------------------------------------------------------------
  // 6. ASANA MESSAGES VIEW
  // --------------------------------------------------------------------------

  renderMessagesView() {
    const container = document.getElementById('asana-messages-view');
    if (!container || !state.currentProject) return;

    container.innerHTML = `
      <div style="padding:24px; max-width:800px; margin:0 auto;">
        <h3 style="font-size:1.2rem; font-weight:800; margin-bottom:16px;">Project Discussion</h3>
        <div style="display:flex; flex-direction:column; gap:14px;">
          <div style="display:flex; gap:12px; padding:14px; background:#ffffff; border:1px solid var(--asana-border); border-radius:var(--radius-md);">
            <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150" style="width:32px; height:32px; border-radius:50%; object-fit:cover;" />
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:0.86rem; font-weight:700;">Usman</span>
                <span style="font-size:0.75rem; color:var(--text-tertiary);">Today at 9:30 AM</span>
              </div>
              <p style="font-size:0.86rem; color:var(--text-primary); margin-top:4px;">
                Sprint milestone is tracking well! Let's prioritize the mobile navigation and QA reviews before the Friday demo.
              </p>
            </div>
          </div>

          <div style="display:flex; gap:12px; padding:14px; background:#ffffff; border:1px solid var(--asana-border); border-radius:var(--radius-md);">
            <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150" style="width:32px; height:32px; border-radius:50%; object-fit:cover;" />
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:0.86rem; font-weight:700;">Ali</span>
                <span style="font-size:0.75rem; color:var(--text-tertiary);">Today at 10:15 AM</span>
              </div>
              <p style="font-size:0.86rem; color:var(--text-primary); margin-top:4px;">
                WebSocket real-time sync is now hooked up! Tested drag-and-drop between columns across multiple browser sessions.
              </p>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // --------------------------------------------------------------------------
  // 7. ASANA PORTFOLIOS VIEW (Executive Overview)
  // --------------------------------------------------------------------------

  renderPortfoliosView() {
    const container = document.getElementById('asana-portfolios-view');
    if (!container) return;

    const projects = state.projects || [];
    const totalProjects = projects.length;
    const activeProject = state.currentProject;
    
    let totalTasks = 0;
    let completedTasks = 0;
    if (activeProject && activeProject.metrics) {
      totalTasks += activeProject.metrics.totalTasks || 0;
      completedTasks += activeProject.metrics.completedTasks || 0;
    }
    const overallRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 80;

    container.innerHTML = `
      <div style="padding: 28px 32px; max-width: 1200px; margin: 0 auto;">
        <!-- Header Banner -->
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
          <div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: var(--radius-md); background: #f3effc; color: var(--asana-purple);">
                <i data-lucide="layers" style="width: 18px; height: 18px;"></i>
              </span>
              <h2 style="font-size: 1.45rem; font-weight: 800; color: var(--text-primary);">Executive Portfolios</h2>
            </div>
            <p style="font-size: 0.88rem; color: var(--text-secondary); margin-top: 4px;">
              Multi-project status reports, workload distribution, and executive initiative health.
            </p>
          </div>
          <div style="display: flex; gap: 10px;">
            <button class="modal-btn-primary" onclick="window.modalManager.openModal('create-project-modal')" style="display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; font-size: 0.88rem; font-weight: 700;">
              <i data-lucide="plus" style="width: 15px; height: 15px;"></i>
              <span>Add Project</span>
            </button>
          </div>
        </div>

        <!-- Top Metric KPI Cards -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 28px;">
          <div style="background: #ffffff; border: 1px solid var(--asana-border); border-radius: var(--radius-lg); padding: 18px 20px; box-shadow: var(--shadow-sm);">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="font-size: 0.76rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px;">Active Initiatives</span>
              <i data-lucide="briefcase" style="width: 16px; height: 16px; color: var(--asana-blue);"></i>
            </div>
            <div style="font-size: 1.85rem; font-weight: 800; color: var(--text-primary); margin-top: 6px;">${totalProjects} Projects</div>
            <div style="font-size: 0.78rem; color: var(--asana-green-dark); font-weight: 600; margin-top: 4px; display: flex; align-items: center; gap: 4px;">
              <i data-lucide="check-circle" style="width: 13px; height: 13px;"></i> All systems operational
            </div>
          </div>

          <div style="background: #ffffff; border: 1px solid var(--asana-border); border-radius: var(--radius-lg); padding: 18px 20px; box-shadow: var(--shadow-sm);">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="font-size: 0.76rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px;">Portfolio Health</span>
              <i data-lucide="activity" style="width: 16px; height: 16px; color: var(--asana-green);"></i>
            </div>
            <div style="font-size: 1.85rem; font-weight: 800; color: var(--asana-green-dark); margin-top: 6px;">100% On Track</div>
            <div style="font-size: 0.78rem; color: var(--text-tertiary); font-weight: 600; margin-top: 4px;">
              0 at risk &bull; 0 blocked
            </div>
          </div>

          <div style="background: #ffffff; border: 1px solid var(--asana-border); border-radius: var(--radius-lg); padding: 18px 20px; box-shadow: var(--shadow-sm);">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="font-size: 0.76rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px;">Sprint Workload</span>
              <i data-lucide="check-square" style="width: 16px; height: 16px; color: var(--asana-coral);"></i>
            </div>
            <div style="font-size: 1.85rem; font-weight: 800; color: var(--text-primary); margin-top: 6px;">${totalTasks || 12} Tasks</div>
            <div style="font-size: 0.78rem; color: var(--text-tertiary); font-weight: 600; margin-top: 4px;">
              ${completedTasks || 8} completed (${overallRate}%)
            </div>
          </div>

          <div style="background: #ffffff; border: 1px solid var(--asana-border); border-radius: var(--radius-lg); padding: 18px 20px; box-shadow: var(--shadow-sm);">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="font-size: 0.76rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px;">Target Delivery</span>
              <i data-lucide="calendar" style="width: 16px; height: 16px; color: var(--asana-purple);"></i>
            </div>
            <div style="font-size: 1.85rem; font-weight: 800; color: var(--asana-purple); margin-top: 6px;">Q3-Q4 2026</div>
            <div style="font-size: 0.78rem; color: var(--text-tertiary); font-weight: 600; margin-top: 4px;">
              Milestone demo on schedule
            </div>
          </div>
        </div>

        <!-- Initiatives Table Card -->
        <div style="background: #ffffff; border: 1px solid var(--asana-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); overflow: hidden;">
          <div style="padding: 16px 20px; border-bottom: 1px solid var(--asana-border); display: flex; align-items: center; justify-content: space-between; background: var(--asana-sidebar-bg);">
            <h3 style="font-size: 0.95rem; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
              <i data-lucide="layout-grid" style="width: 16px; height: 16px;"></i> All Portfolio Projects
            </h3>
            <span style="font-size: 0.8rem; color: var(--text-tertiary); font-weight: 600;">${projects.length} workspace projects synced</span>
          </div>

          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.86rem;">
              <thead>
                <tr style="border-bottom: 1px solid var(--asana-border); color: var(--text-tertiary); font-weight: 700; text-transform: uppercase; font-size: 0.72rem; letter-spacing: 0.5px;">
                  <th style="padding: 12px 20px;">Project Name</th>
                  <th style="padding: 12px 16px;">Status</th>
                  <th style="padding: 12px 16px;">Lead / Team</th>
                  <th style="padding: 12px 16px;">Progress</th>
                  <th style="padding: 12px 16px;">Dates</th>
                  <th style="padding: 12px 20px; text-align: right;">Action</th>
                </tr>
              </thead>
              <tbody>
                ${projects.map((proj, idx) => {
                  const leadName = idx % 3 === 0 ? 'Usman' : (idx % 3 === 1 ? 'Ali' : 'Ahmad');
                  const leadRole = idx % 3 === 0 ? 'Product Lead' : (idx % 3 === 1 ? 'Full-Stack Dev' : 'UI/UX Designer');
                  const leadAvatar = idx % 3 === 0 
                    ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' 
                    : (idx % 3 === 1 
                        ? 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150' 
                        : 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150');
                  const isCurrent = state.currentProject && state.currentProject.project.id === proj.id;
                  const projProgress = isCurrent && state.currentProject.metrics ? state.currentProject.metrics.progressPercentage : (80 - idx * 10);

                  return `
                    <tr style="border-bottom: 1px solid var(--asana-border); transition: background var(--transition-fast);" onmouseover="this.style.background='var(--asana-hover-bg)'" onmouseout="this.style.background='transparent'">
                      <td style="padding: 16px 20px;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                          <span style="display: inline-block; width: 14px; height: 14px; border-radius: 4px; background: ${proj.color || 'var(--asana-coral)'}; flex-shrink: 0;"></span>
                          <div>
                            <span style="font-weight: 700; color: var(--text-primary); font-size: 0.92rem; display: block;">${proj.name}</span>
                            <span style="font-size: 0.76rem; color: var(--text-tertiary);">${proj.description || 'Enterprise collaboration workflow'}</span>
                          </div>
                        </div>
                      </td>
                      <td style="padding: 16px 16px;">
                        <span style="display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: var(--radius-full); font-size: 0.76rem; font-weight: 700; background: #e6f9f3; color: var(--asana-green-dark);">
                          <span style="width: 6px; height: 6px; border-radius: 50%; background: var(--asana-green);"></span> On Track
                        </span>
                      </td>
                      <td style="padding: 16px 16px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                          <img src="${leadAvatar}" alt="${leadName}" style="width: 26px; height: 26px; border-radius: 50%; object-fit: cover;" />
                          <div>
                            <span style="font-weight: 700; color: var(--text-primary); font-size: 0.82rem; display: block;">${leadName}</span>
                            <span style="font-size: 0.72rem; color: var(--text-tertiary);">${leadRole}</span>
                          </div>
                        </div>
                      </td>
                      <td style="padding: 16px 16px; width: 180px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; font-size: 0.78rem; font-weight: 700;">
                          <span>${projProgress}%</span>
                        </div>
                        <div style="height: 6px; width: 100%; background: #e2e8f0; border-radius: 3px; overflow: hidden;">
                          <div style="height: 100%; width: ${projProgress}%; background: var(--asana-coral); border-radius: 3px;"></div>
                        </div>
                      </td>
                      <td style="padding: 16px 16px; color: var(--text-secondary); font-size: 0.82rem; font-weight: 600;">
                        Q3 - Q4 2026
                      </td>
                      <td style="padding: 16px 20px; text-align: right;">
                        <button class="toolbar-secondary-btn" style="padding: 6px 12px; font-size: 0.8rem; font-weight: 700;" onclick="window.app.selectProject(${proj.id}); AsanaApp.switchView('list');">
                          Open Project ➔
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
  },

  // --------------------------------------------------------------------------
  // 8. ASANA GOALS VIEW (Company & Team OKRs)
  // --------------------------------------------------------------------------

  renderGoalsView() {
    const container = document.getElementById('asana-goals-view');
    if (!container) return;

    const goals = this.goals || [];
    const totalGoals = goals.length;
    const onTrackGoals = goals.filter(g => g.status === 'on_track').length;
    const avgProgress = totalGoals > 0 ? Math.round(goals.reduce((acc, g) => acc + (g.progress || 0), 0) / totalGoals) : 0;

    container.innerHTML = `
      <div style="padding: 28px 32px; max-width: 1200px; margin: 0 auto;">
        <!-- Header Banner -->
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
          <div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: var(--radius-md); background: #fef9e7; color: var(--asana-yellow-dark);">
                <i data-lucide="target" style="width: 18px; height: 18px;"></i>
              </span>
              <h2 style="font-size: 1.45rem; font-weight: 800; color: var(--text-primary);">Company & Team Goals (OKRs)</h2>
            </div>
            <p style="font-size: 0.88rem; color: var(--text-secondary); margin-top: 4px;">
              Connect top-level strategic objectives with cross-functional execution and key results.
            </p>
          </div>
          <div style="display: flex; gap: 10px;">
            <button class="modal-btn-primary" onclick="window.modalManager.openModal('create-goal-modal')" style="display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; font-size: 0.88rem; font-weight: 700;">
              <i data-lucide="plus" style="width: 15px; height: 15px;"></i>
              <span>Create Goal</span>
            </button>
          </div>
        </div>

        <!-- Goal KPI Summary Cards -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 28px;">
          <div style="background: #ffffff; border: 1px solid var(--asana-border); border-radius: var(--radius-lg); padding: 18px 20px; box-shadow: var(--shadow-sm);">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="font-size: 0.76rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px;">Total Goals (OKRs)</span>
              <i data-lucide="target" style="width: 16px; height: 16px; color: var(--asana-coral);"></i>
            </div>
            <div style="font-size: 1.85rem; font-weight: 800; color: var(--text-primary); margin-top: 6px;">${totalGoals} Objectives</div>
            <div style="font-size: 0.78rem; color: var(--text-tertiary); font-weight: 600; margin-top: 4px;">
              Across Product, Engineering & Design
            </div>
          </div>

          <div style="background: #ffffff; border: 1px solid var(--asana-border); border-radius: var(--radius-lg); padding: 18px 20px; box-shadow: var(--shadow-sm);">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="font-size: 0.76rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px;">Goal Health</span>
              <i data-lucide="trending-up" style="width: 16px; height: 16px; color: var(--asana-green);"></i>
            </div>
            <div style="font-size: 1.85rem; font-weight: 800; color: var(--asana-green-dark); margin-top: 6px;">${onTrackGoals}/${totalGoals} On Track</div>
            <div style="font-size: 0.78rem; color: var(--asana-green-dark); font-weight: 600; margin-top: 4px;">
              100% on delivery pace
            </div>
          </div>

          <div style="background: #ffffff; border: 1px solid var(--asana-border); border-radius: var(--radius-lg); padding: 18px 20px; box-shadow: var(--shadow-sm);">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="font-size: 0.76rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px;">Average Completion</span>
              <i data-lucide="percent" style="width: 16px; height: 16px; color: var(--asana-blue);"></i>
            </div>
            <div style="font-size: 1.85rem; font-weight: 800; color: var(--asana-blue); margin-top: 6px;">${avgProgress}%</div>
            <div style="font-size: 0.78rem; color: var(--text-tertiary); font-weight: 600; margin-top: 4px;">
              Overall OKR progression
            </div>
          </div>
        </div>

        <!-- Goals Cards Grid -->
        <div style="display: flex; flex-direction: column; gap: 18px;">
          ${goals.map(goal => `
            <div style="background: #ffffff; border: 1px solid var(--asana-border); border-radius: var(--radius-lg); padding: 22px 24px; box-shadow: var(--shadow-sm); transition: box-shadow var(--transition-fast);">
              <!-- Top Row -->
              <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 16px; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 260px;">
                  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                    <span style="padding: 3px 8px; border-radius: var(--radius-xs); font-size: 0.72rem; font-weight: 700; background: var(--asana-sidebar-bg); border: 1px solid var(--asana-border); color: var(--text-secondary);">
                      ${goal.timeframe || 'Q4 2026'}
                    </span>
                    <span style="display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: var(--radius-full); font-size: 0.72rem; font-weight: 700; background: #e6f9f3; color: var(--asana-green-dark);">
                      <span style="width: 6px; height: 6px; border-radius: 50%; background: var(--asana-green);"></span> On Track
                    </span>
                  </div>
                  <h3 style="font-size: 1.12rem; font-weight: 800; color: var(--text-primary); line-height: 1.35;">${goal.title}</h3>
                </div>

                <!-- Owner & Actions -->
                <div style="display: flex; align-items: center; gap: 14px;">
                  <div style="display: flex; align-items: center; gap: 8px; background: var(--asana-sidebar-bg); padding: 4px 10px 4px 6px; border-radius: var(--radius-full); border: 1px solid var(--asana-border);">
                    <img src="${goal.ownerAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}" alt="${goal.owner}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;" />
                    <span style="font-size: 0.82rem; font-weight: 700; color: var(--text-primary);">${goal.owner}</span>
                    <span style="font-size: 0.74rem; color: var(--text-tertiary);">(${goal.ownerRole || 'Lead'})</span>
                  </div>
                  <button class="topbar-icon-btn" onclick="AsanaApp.deleteGoal(${goal.id})" title="Delete Goal" style="color: #ef4444; width: 28px; height: 28px;">
                    <i data-lucide="trash-2" style="width: 15px; height: 15px;"></i>
                  </button>
                </div>
              </div>

              <!-- Progress Bar & Adjuster -->
              <div style="margin-bottom: 20px;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; font-size: 0.84rem; font-weight: 700;">
                  <span style="color: var(--text-secondary);">Goal Progress</span>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <button class="toolbar-secondary-btn" style="padding: 2px 8px; font-size: 0.72rem;" onclick="AsanaApp.adjustGoalProgress(${goal.id}, -10)">-10%</button>
                    <span style="color: var(--asana-coral); font-size: 0.96rem; font-weight: 800;">${goal.progress}%</span>
                    <button class="toolbar-secondary-btn" style="padding: 2px 8px; font-size: 0.72rem;" onclick="AsanaApp.adjustGoalProgress(${goal.id}, 10)">+10%</button>
                  </div>
                </div>
                <div style="height: 8px; width: 100%; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
                  <div style="height: 100%; width: ${goal.progress}%; background: linear-gradient(90deg, var(--asana-coral), #37c5ab); border-radius: 4px; transition: width var(--transition-normal);"></div>
                </div>
              </div>

              <!-- Key Results Breakdown -->
              <div style="background: var(--asana-sidebar-bg); border: 1px solid var(--asana-border); border-radius: var(--radius-md); padding: 14px 16px;">
                <div style="font-size: 0.78rem; font-weight: 800; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;">
                  <span>Key Results (${(goal.keyResults || []).filter(kr => kr.completed).length}/${(goal.keyResults || []).length})</span>
                  <span style="font-size: 0.74rem; font-weight: 600; color: var(--asana-blue); cursor: pointer;" onclick="AsanaApp.promptAddKeyResult(${goal.id})">+ Add Key Result</span>
                </div>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  ${(goal.keyResults || []).map((kr, kIdx) => `
                    <div style="display: flex; align-items: center; gap: 10px; font-size: 0.85rem;">
                      <div class="asana-check-circle ${kr.completed ? 'completed' : ''}" style="width: 18px; height: 18px; cursor: pointer; flex-shrink: 0;" onclick="AsanaApp.toggleGoalKeyResult(${goal.id}, ${kIdx})">
                        ${kr.completed ? '<i data-lucide="check" style="width:12px; height:12px;"></i>' : ''}
                      </div>
                      <span style="flex: 1; ${kr.completed ? 'text-decoration: line-through; color: var(--text-disabled);' : 'color: var(--text-primary); font-weight: 500;'}">
                        ${kr.title}
                      </span>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
  },

  toggleGoalKeyResult(goalId, krIndex) {
    const goal = this.goals.find(g => g.id === goalId);
    if (!goal || !goal.keyResults || !goal.keyResults[krIndex]) return;
    
    goal.keyResults[krIndex].completed = !goal.keyResults[krIndex].completed;
    const completedCount = goal.keyResults.filter(kr => kr.completed).length;
    goal.progress = Math.round((completedCount / goal.keyResults.length) * 100);
    
    if (goal.progress === 100) {
      this.triggerAsanaCelebration();
      window.showToast('🎯 Goal 100% Achieved! Fantastic work!', 'success');
    }
    this.renderGoalsView();
  },

  adjustGoalProgress(goalId, delta) {
    const goal = this.goals.find(g => g.id === goalId);
    if (!goal) return;
    goal.progress = Math.max(0, Math.min(100, (goal.progress || 0) + delta));
    if (goal.progress === 100) {
      this.triggerAsanaCelebration();
      window.showToast('🎯 Goal 100% Achieved!', 'success');
    }
    this.renderGoalsView();
  },

  promptAddKeyResult(goalId) {
    const title = prompt('Enter new Key Result for this objective:');
    if (!title || !title.trim()) return;
    const goal = this.goals.find(g => g.id === goalId);
    if (!goal) return;
    if (!goal.keyResults) goal.keyResults = [];
    goal.keyResults.push({ title: title.trim(), completed: false });
    const completedCount = goal.keyResults.filter(kr => kr.completed).length;
    goal.progress = Math.round((completedCount / goal.keyResults.length) * 100);
    this.renderGoalsView();
    window.showToast('Key Result added', 'success');
  },

  deleteGoal(goalId) {
    if (!confirm('Are you sure you want to delete this Goal objective?')) return;
    this.goals = this.goals.filter(g => g.id !== goalId);
    this.renderGoalsView();
    window.showToast('Goal deleted', 'info');
  },

  // --------------------------------------------------------------------------
  // 9. MY TASKS & INBOX VIEWS
  // --------------------------------------------------------------------------

  renderMyTasks() {
    this.switchView('list');
    document.getElementById('project-header-title-text').textContent = 'My Tasks';
    state.setFilters({ assignee: state.currentUser ? state.currentUser.id : 'all' });
  },

  renderInbox() {
    this.switchView('inbox');
  },

  async renderInboxView() {
    const container = document.getElementById('asana-inbox-view');
    if (!container) return;

    container.innerHTML = `
      <div style="padding: 28px 32px; max-width: 900px; margin: 0 auto;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 24px; flex-wrap:wrap; gap:12px;">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="display:inline-flex; align-items:center; justify-content:center; width:30px; height:30px; border-radius:var(--radius-md); background:var(--asana-coral-light); color:var(--asana-coral);">
                <i data-lucide="bell" style="width:16px; height:16px;"></i>
              </span>
              <h2 style="font-size: 1.45rem; font-weight: 800; color: var(--text-primary);">Inbox Notifications</h2>
            </div>
            <p style="font-size: 0.86rem; color: var(--text-secondary); margin-top: 4px;">Stay updated on tasks assigned to you, team comments, and project milestones.</p>
          </div>
          <div style="display:flex; gap: 8px;">
            <button class="toolbar-secondary-btn" id="inbox-mark-all-read-btn" style="padding: 6px 12px; font-size: 0.82rem; font-weight: 700;">
              ✓ Mark All Read
            </button>
            <button class="toolbar-secondary-btn" id="inbox-clear-all-btn" style="padding: 6px 12px; font-size: 0.82rem; font-weight: 700; color: #ef4444;">
              Clear All
            </button>
          </div>
        </div>

        <div id="inbox-notifications-list" style="display: flex; flex-direction: column; gap: 10px;">
          <div style="padding: 32px; text-align: center; color: var(--text-tertiary);">Loading notifications...</div>
        </div>
      </div>
    `;

    try {
      const res = await API.getNotifications();
      const notifications = res.notifications || [];
      state.setNotifications(notifications, res.unreadCount || 0);

      const listEl = document.getElementById('inbox-notifications-list');
      if (!listEl) return;

      if (notifications.length === 0) {
        listEl.innerHTML = `
          <div style="background: #ffffff; border: 1px solid var(--asana-border); border-radius: var(--radius-lg); padding: 48px 24px; text-align: center; box-shadow: var(--shadow-sm);">
            <div style="font-size: 2.5rem; margin-bottom: 12px;">🎉</div>
            <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text-primary); margin-bottom: 6px;">You're all caught up!</h3>
            <p style="font-size: 0.86rem; color: var(--text-tertiary); max-width: 400px; margin: 0 auto;">No new notifications right now. When team members assign tasks or leave comments, they'll appear here.</p>
          </div>
        `;
        if (window.lucide) lucide.createIcons();
        return;
      }

      listEl.innerHTML = notifications.map(n => {
        let icon = 'bell';
        let iconBg = '#e8f6fd';
        let iconColor = 'var(--asana-blue)';

        if (n.type === 'task_assigned') {
          icon = 'user-check';
          iconBg = '#fef9e7';
          iconColor = 'var(--asana-yellow-dark)';
        } else if (n.type === 'comment_added') {
          icon = 'message-square';
          iconBg = '#e6f9f3';
          iconColor = 'var(--asana-green-dark)';
        } else if (n.type === 'status_changed') {
          icon = 'arrow-right-circle';
          iconBg = '#f3effc';
          iconColor = 'var(--asana-purple)';
        } else if (n.type === 'project_invite') {
          icon = 'folder-plus';
          iconBg = '#fff0f0';
          iconColor = 'var(--asana-coral)';
        }

        const dateStr = new Date(n.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

        return `
          <div class="inbox-item-card ${n.is_read ? 'read' : 'unread'}" style="background: ${n.is_read ? '#ffffff' : '#fafffd'}; border: 1px solid ${n.is_read ? 'var(--asana-border)' : 'var(--asana-green)'}; border-radius: var(--radius-md); padding: 16px 20px; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; transition: box-shadow var(--transition-fast); box-shadow: var(--shadow-sm);">
            <div style="display: flex; gap: 14px; align-items: flex-start; flex: 1;">
              <span style="display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 50%; background: ${iconBg}; color: ${iconColor}; flex-shrink: 0; margin-top: 2px;">
                <i data-lucide="${icon}" style="width: 17px; height: 17px;"></i>
              </span>
              <div style="flex: 1;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                  <span style="font-size: 0.88rem; font-weight: 800; color: var(--text-primary);">${n.title}</span>
                  ${!n.is_read ? '<span style="width: 7px; height: 7px; border-radius: 50%; background: var(--asana-coral); display: inline-block;"></span>' : ''}
                  <span style="font-size: 0.74rem; color: var(--text-tertiary); margin-left: auto;">${dateStr}</span>
                </div>
                <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.4;">${n.message}</p>
                ${(n.project_name || n.task_title) ? `
                  <div style="margin-top: 8px; display: flex; gap: 8px; align-items: center; font-size: 0.78rem;">
                    ${n.project_name ? `<span style="background: var(--asana-sidebar-bg); border: 1px solid var(--asana-border); padding: 2px 8px; border-radius: var(--radius-xs); font-weight: 600; color: var(--text-secondary);"><i data-lucide="folder" style="width:11px; height:11px; display:inline-block; vertical-align:middle;"></i> ${n.project_name}</span>` : ''}
                    ${n.task_id ? `<span style="color: var(--asana-coral); font-weight: 700; cursor: pointer;" onclick="AsanaApp.openDrawer(${n.task_id})">Open Task ➔</span>` : ''}
                  </div>
                ` : ''}
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
              ${!n.is_read ? `
                <button class="topbar-icon-btn inbox-mark-read-btn" data-notif-id="${n.id}" title="Mark as read" style="width: 28px; height: 28px; color: var(--text-secondary);">
                  <i data-lucide="check" style="width: 14px; height: 14px;"></i>
                </button>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');

      // Attach Mark Read Buttons
      listEl.querySelectorAll('.inbox-mark-read-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const notifId = btn.dataset.notifId;
          await API.markNotificationRead(notifId);
          this.renderInboxView();
          window.showToast('Marked as read', 'info');
        });
      });

      // Mark All Read
      const markAllBtn = document.getElementById('inbox-mark-all-read-btn');
      if (markAllBtn) {
        markAllBtn.addEventListener('click', async () => {
          await API.markAllNotificationsRead();
          this.renderInboxView();
          window.showToast('All notifications marked as read', 'success');
        });
      }

      // Clear All
      const clearAllBtn = document.getElementById('inbox-clear-all-btn');
      if (clearAllBtn) {
        clearAllBtn.addEventListener('click', async () => {
          if (!confirm('Clear all notifications from your inbox?')) return;
          await API.clearNotifications();
          this.renderInboxView();
          window.showToast('Notifications cleared', 'info');
        });
      }

      if (window.lucide) lucide.createIcons();
    } catch (err) {
      console.error('Failed to render inbox:', err);
    }
  },

  // --------------------------------------------------------------------------
  // 8. RIGHT-SLIDE TASK INSPECTOR DRAWER
  // --------------------------------------------------------------------------

  async openDrawer(taskId) {
    this.activeTaskId = taskId;
    const drawer = document.getElementById('asana-task-drawer');
    if (!drawer) return;

    drawer.classList.add('open');

    try {
      const res = await API.getTask(taskId);
      const task = res.task;

      // Populate Inputs
      document.getElementById('drawer-task-title').value = task.title;
      document.getElementById('drawer-task-desc').value = task.description || '';
      document.getElementById('drawer-task-priority').value = task.priority;
      document.getElementById('drawer-task-due-date').value = task.due_date ? task.due_date.split('T')[0] : '';

      // Section Select Options
      const sectionSelect = document.getElementById('drawer-task-section');
      if (sectionSelect && state.currentProject) {
        sectionSelect.innerHTML = state.currentProject.columns.map(c => `
          <option value="${c.id}" ${c.id === task.column_id ? 'selected' : ''}>${c.name}</option>
        `).join('');
      }

      // Mark Complete button state
      const isDone = task.column_name?.toLowerCase().includes('done');
      const markBtn = document.getElementById('drawer-mark-complete-btn');
      if (markBtn) {
        markBtn.classList.toggle('completed', isDone);
        markBtn.innerHTML = isDone 
          ? `<i data-lucide="check" style="width:16px; height:16px;"></i> Completed`
          : `<i data-lucide="check" style="width:16px; height:16px;"></i> Mark Complete`;
      }

      // Render Interactive Assignee Selector
      const assigneeWrap = document.getElementById('drawer-assignee-wrap');
      if (assigneeWrap) {
        const defaultMembers = [
          { id: 1, name: 'Usman', role: 'Product Lead', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' },
          { id: 2, name: 'Ali', role: 'Full Stack Engineer', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150' },
          { id: 3, name: 'Ahmad', role: 'UI/UX Designer', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150' }
        ];
        const allMembers = (state.currentProject && state.currentProject.members && state.currentProject.members.length > 0)
          ? state.currentProject.members
          : defaultMembers;

        const currentAssigneeIds = new Set((task.assignees || []).map(a => a.id));

        assigneeWrap.innerHTML = `
          <div style="display:flex; flex-direction:column; gap:6px; width:100%;">
            <div style="display:flex; flex-wrap:wrap; gap:6px; align-items:center;">
              ${(task.assignees && task.assignees.length > 0) ? task.assignees.map(a => `
                <span class="drawer-assignee-chip" style="display:inline-flex; align-items:center; gap:6px; padding:3px 8px; background:var(--asana-sidebar-bg); border:1px solid var(--asana-border); border-radius:var(--radius-full); font-size:0.82rem; font-weight:600;">
                  <img src="${a.avatar}" class="asana-assignee-avatar" style="width:18px; height:18px; margin:0;" />
                  <span>${a.name}</span>
                  <button type="button" class="drawer-remove-assignee-btn" data-user-id="${a.id}" style="background:none; border:none; cursor:pointer; color:var(--text-disabled); padding:0; display:flex; align-items:center; font-size:0.75rem; margin-left:2px;" title="Remove">✕</button>
                </span>
              `).join('') : '<span style="color:var(--text-tertiary); font-size:0.82rem;">Unassigned</span>'}
            </div>
            <select id="drawer-assignee-picker-select" style="width:100%; padding:5px 8px; border:1px solid var(--asana-border); border-radius:var(--radius-sm); font-size:0.82rem; font-weight:600; background:#ffffff; cursor:pointer; margin-top:2px;">
              <option value="">+ Assign or toggle member...</option>
              ${allMembers.map(m => `
                <option value="${m.id}" ${currentAssigneeIds.has(m.id) ? 'selected' : ''}>
                  ${currentAssigneeIds.has(m.id) ? '✓ ' : '+ '}${m.name} (${m.role || 'Member'})
                </option>
              `).join('')}
            </select>
          </div>
        `;

        // Attach Remove Buttons
        assigneeWrap.querySelectorAll('.drawer-remove-assignee-btn').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const uId = parseInt(btn.dataset.userId, 10);
            try {
              await API.toggleAssignee(taskId, uId);
              const fresh = await API.getProject(state.currentProject.project.id);
              state.setCurrentProject(fresh);
              this.openDrawer(taskId);
              window.showToast('Assignee removed', 'info');
            } catch (err) {
              window.showToast(err.message, 'danger');
            }
          });
        });

        // Attach Select Dropdown
        const selectEl = document.getElementById('drawer-assignee-picker-select');
        if (selectEl) {
          selectEl.addEventListener('change', async (e) => {
            if (!e.target.value) return;
            const uId = parseInt(e.target.value, 10);
            try {
              await API.toggleAssignee(taskId, uId);
              const fresh = await API.getProject(state.currentProject.project.id);
              state.setCurrentProject(fresh);
              this.openDrawer(taskId);
              const assignedMember = allMembers.find(m => m.id === uId);
              const isNowAssigned = !currentAssigneeIds.has(uId);
              window.showToast(isNowAssigned ? `Assigned ${assignedMember ? assignedMember.name : 'member'} to task!` : `Removed assignee`, 'success');
            } catch (err) {
              window.showToast(err.message, 'danger');
            }
          });
        }
      }

      // Render Subtasks
      const subtasksContainer = document.getElementById('drawer-subtasks-container');
      const subtaskCounter = document.getElementById('drawer-subtask-counter');
      if (subtasksContainer) {
        const subtasks = task.subtasks || [];
        const completedCount = subtasks.filter(s => s.is_completed).length;
        if (subtaskCounter) subtaskCounter.textContent = `${completedCount}/${subtasks.length}`;

        subtasksContainer.innerHTML = subtasks.map(st => `
          <div class="drawer-subtask-item">
            <div class="drawer-subtask-left">
              <div class="asana-check-circle ${st.is_completed ? 'completed' : ''}" data-subtask-id="${st.id}">
                ${st.is_completed ? '<i data-lucide="check" style="width:12px; height:12px;"></i>' : ''}
              </div>
              <span style="font-size:0.86rem; ${st.is_completed ? 'text-decoration:line-through; color:var(--text-disabled);' : ''}">${st.title}</span>
            </div>
            <button class="drawer-del-subtask topbar-icon-btn" data-subtask-id="${st.id}" style="width:20px; height:20px; color:var(--text-disabled);">
              <i data-lucide="x" style="width:14px; height:14px;"></i>
            </button>
          </div>
        `).join('');

        subtasksContainer.querySelectorAll('.asana-check-circle').forEach(circle => {
          circle.addEventListener('click', async (e) => {
            e.stopPropagation();
            await API.toggleSubtask(circle.dataset.subtaskId);
            this.openDrawer(taskId);
            const fresh = await API.getProject(state.currentProject.project.id);
            state.setCurrentProject(fresh);
          });
        });

        subtasksContainer.querySelectorAll('.drawer-del-subtask').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await API.deleteSubtask(btn.dataset.subtaskId);
            this.openDrawer(taskId);
          });
        });
      }

      // Render Comments Stream
      const commentsContainer = document.getElementById('drawer-comments-stream');
      if (commentsContainer) {
        commentsContainer.innerHTML = (task.comments || []).map(c => `
          <div style="display:flex; gap:10px; margin-bottom:12px;">
            <img src="${c.user_avatar}" style="width:28px; height:28px; border-radius:50%; object-fit:cover;" />
            <div style="flex:1;">
              <div style="display:flex; align-items:center; gap:6px;">
                <span style="font-size:0.84rem; font-weight:700;">${c.user_name}</span>
                <span style="font-size:0.72rem; color:var(--text-tertiary);">${new Date(c.created_at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</span>
              </div>
              <p style="font-size:0.86rem; color:var(--text-primary); margin-top:2px;">${c.content}</p>
            </div>
          </div>
        `).join('');
      }

      if (window.lucide) lucide.createIcons();
    } catch (err) {
      window.showToast(err.message, 'danger');
    }
  },

  closeDrawer() {
    this.activeTaskId = null;
    const drawer = document.getElementById('asana-task-drawer');
    if (drawer) drawer.classList.remove('open');
    document.querySelectorAll('.asana-task-row').forEach(r => r.classList.remove('selected'));
  },

  openQuickAddTask(columnId) {
    if (window.BoardController) {
      window.BoardController.openCreateTaskModal(columnId);
    }
  },

  // --------------------------------------------------------------------------
  // Celebrations & Helpers
  // --------------------------------------------------------------------------

  triggerAsanaCelebration() {
    if (window.soundManager) window.soundManager.playCompletionSound();
    
    // Confetti particles
    if (window.confetti) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f06a6a', '#37c5ab', '#14aaf5', '#f8df72', '#8f63de']
      });
    }

    // Flying Unicorn / Narwhal Creature Banner
    const container = document.getElementById('asana-celebration-container');
    if (container) {
      const creatures = ['🦄', '🐬', '🚀', '🌟', '🎯'];
      const randomCreature = creatures[Math.floor(Math.random() * creatures.length)];
      const creatureEl = document.createElement('div');
      creatureEl.className = 'celebration-creature';
      creatureEl.textContent = randomCreature;
      container.appendChild(creatureEl);

      setTimeout(() => {
        creatureEl.remove();
      }, 3200);
    }
  },

  applySorting(criteria) {
    if (!state.currentProject) return;
    if (criteria === 'priority') {
      const priorityOrder = { urgent: 1, high: 2, medium: 3, low: 4 };
      state.currentProject.tasks.sort((a, b) => (priorityOrder[a.priority] || 5) - (priorityOrder[b.priority] || 5));
    } else if (criteria === 'due_date') {
      state.currentProject.tasks.sort((a, b) => new Date(a.due_date || '9999-12-31') - new Date(b.due_date || '9999-12-31'));
    } else if (criteria === 'title') {
      state.currentProject.tasks.sort((a, b) => a.title.localeCompare(b.title));
    }
    this.renderCurrentView();
  },

  updateProjectHeader() {
    if (!state.currentProject) return;
    const { project } = state.currentProject;

    const titleText = document.getElementById('project-header-title-text');
    if (titleText) titleText.textContent = project.name;

    const shareBtn = document.getElementById('project-share-btn');
    if (shareBtn) {
      shareBtn.innerHTML = `<i data-lucide="key" style="width:14px; height:14px;"></i> Invite: ${project.invite_code}`;
      shareBtn.onclick = () => {
        navigator.clipboard.writeText(project.invite_code);
        window.showToast(`Invite code "${project.invite_code}" copied to clipboard!`, 'success');
      };
    }
  },

  updateSidebarProjects(projects = state.projects) {
    const list = document.getElementById('sidebar-projects-list');
    if (!list || !projects) return;

    list.innerHTML = projects.map(p => `
      <li class="sidebar-project-item ${state.currentProject && state.currentProject.project.id === p.id ? 'active' : ''}" data-project-id="${p.id}">
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="project-color-dot" style="background-color:${p.color || '#f06a6a'};"></span>
          <span>${p.name}</span>
        </div>
      </li>
    `).join('');

    list.querySelectorAll('.sidebar-project-item').forEach(item => {
      item.addEventListener('click', () => {
        window.app.selectProject(parseInt(item.dataset.projectId));
      });
    });

    this.updateSidebarStarred(projects);
  },

  updateSidebarStarred(projects = state.projects) {
    const starredList = document.getElementById('sidebar-starred-list');
    if (!starredList || !projects) return;

    const starredProjects = projects.slice(0, 2); // Star top projects by default
    starredList.innerHTML = starredProjects.map(p => `
      <li class="sidebar-project-item ${state.currentProject && state.currentProject.project.id === p.id ? 'active' : ''}" data-project-id="${p.id}">
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="project-color-dot" style="background-color:${p.color || '#f06a6a'};"></span>
          <span>${p.name}</span>
        </div>
      </li>
    `).join('');

    starredList.querySelectorAll('.sidebar-project-item').forEach(item => {
      item.addEventListener('click', () => {
        window.app.selectProject(parseInt(item.dataset.projectId));
      });
    });
  },

  updateSidebarUserProfile(user) {
    if (!user) return;
    const nameEl = document.getElementById('sidebar-user-name');
    const roleEl = document.getElementById('sidebar-user-role');
    const avatarEl = document.getElementById('sidebar-user-avatar');
    const footerAvatarEl = document.getElementById('sidebar-footer-avatar');
    const composerAvatar = document.getElementById('drawer-composer-avatar');

    if (nameEl) nameEl.textContent = user.name;
    if (roleEl) roleEl.textContent = user.role || 'Member';
    if (avatarEl) avatarEl.src = user.avatar;
    if (footerAvatarEl) footerAvatarEl.src = user.avatar;
    if (composerAvatar) composerAvatar.src = user.avatar;
  }
};

window.AsanaApp = AsanaApp;

window.addEventListener('DOMContentLoaded', () => {
  window.AsanaApp.init();
});
