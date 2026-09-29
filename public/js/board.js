// ==========================================================================
// Board & Kanban Controller (Drag & Drop, Column & Card Renderers)
// ==========================================================================

const BoardController = {
  draggedTaskId: null,
  draggedCardElement: null,

  init() {
    state.on('project_data_changed', (projectData) => {
      this.render();
    });

    state.on('filters_changed', () => {
      this.render();
    });

    state.on('view_changed', (view) => {
      this.handleViewSwitch(view);
    });

    this.bindGlobalEvents();
  },

  handleViewSwitch(view) {
    const boardContainer = document.getElementById('board-view-section');
    const listViewContainer = document.getElementById('list-view-section');
    const analyticsViewContainer = document.getElementById('analytics-view-section');

    if (boardContainer) boardContainer.style.display = view === 'board' ? 'flex' : 'none';
    if (listViewContainer) listViewContainer.style.display = view === 'list' ? 'block' : 'none';
    if (analyticsViewContainer) analyticsViewContainer.style.display = view === 'analytics' ? 'flex' : 'none';

    if (view === 'board' || view === 'list') {
      this.render();
    } else if (view === 'analytics' && window.AnalyticsController) {
      window.AnalyticsController.render();
    }
  },

  bindGlobalEvents() {
    // Add Column Modal Trigger
    const addColumnBtn = document.getElementById('add-column-card-btn');
    if (addColumnBtn) {
      addColumnBtn.addEventListener('click', () => {
        window.modalManager.openModal('create-column-modal');
      });
    }

    // Add Column Form Submit
    const addColumnForm = document.getElementById('create-column-form');
    if (addColumnForm) {
      addColumnForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('col-name-input').value;
        const color = document.getElementById('col-color-input').value;

        try {
          const res = await API.createColumn({
            project_id: state.currentProject.project.id,
            name,
            color
          });

          // Refresh Project
          const updated = await API.getProject(state.currentProject.project.id);
          state.setCurrentProject(updated);

          socketManager.broadcastEvent(state.currentProject.project.id, 'column_created', res.column);
          window.modalManager.closeModal('create-column-modal');
          window.showToast(`Column "${name}" created!`, 'success');
          addColumnForm.reset();
        } catch (err) {
          window.showToast(err.message, 'danger');
        }
      });
    }

    // Quick Task Create Form
    const createTaskForm = document.getElementById('create-task-form');
    if (createTaskForm) {
      createTaskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('task-title-input').value;
        const description = document.getElementById('task-desc-input').value;
        const priority = document.getElementById('task-priority-input').value;
        const dueDate = document.getElementById('task-due-date-input').value;
        const columnId = document.getElementById('task-column-select').value;
        const coverColor = document.getElementById('task-cover-color-input').value;

        // Collect Assignees
        const assigneeCheckboxes = document.querySelectorAll('#task-assignees-picker input:checked');
        const assignees = Array.from(assigneeCheckboxes).map(cb => parseInt(cb.value));

        try {
          const res = await API.createTask({
            project_id: state.currentProject.project.id,
            column_id: parseInt(columnId),
            title,
            description,
            priority,
            due_date: dueDate || null,
            cover_color: coverColor,
            assignees
          });

          // Refresh Project
          const updated = await API.getProject(state.currentProject.project.id);
          state.setCurrentProject(updated);

          socketManager.broadcastEvent(state.currentProject.project.id, 'task_created', res.task);
          window.modalManager.closeModal('create-task-modal');
          window.showToast(`Task "${title}" created!`, 'success');
          createTaskForm.reset();
        } catch (err) {
          window.showToast(err.message, 'danger');
        }
      });
    }
  },

  render() {
    if (!state.currentProject) return;

    if (state.currentView === 'board') {
      this.renderKanbanBoard();
    } else if (state.currentView === 'list') {
      this.renderListView();
    }
  },

  renderKanbanBoard() {
    const boardContainer = document.getElementById('kanban-board');
    if (!boardContainer) return;

    const { columns } = state.currentProject;
    boardContainer.innerHTML = '';

    columns.forEach(column => {
      const columnTasks = state.getFilteredTasks(column.id);

      const colEl = document.createElement('div');
      colEl.className = 'kanban-column';
      colEl.dataset.columnId = column.id;

      colEl.innerHTML = `
        <div class="column-header">
          <div class="column-title-group">
            <span class="column-color-indicator" style="background-color: ${column.color || '#8b5cf6'}"></span>
            <h3 class="column-title">${this.escapeHTML(column.name)}</h3>
            <span class="column-count">${columnTasks.length}</span>
          </div>
          <button class="column-actions-btn" data-col-id="${column.id}" title="Column options">
            <i data-lucide="more-horizontal"></i>
          </button>
        </div>

        <div class="column-cards" data-column-id="${column.id}">
          <!-- Task cards will render here -->
        </div>

        <button class="column-add-task-btn" data-column-id="${column.id}">
          <i data-lucide="plus" style="width: 16px; height: 16px;"></i>
          <span>Add Task</span>
        </button>
      `;

      const cardsContainer = colEl.querySelector('.column-cards');

      // Drag and drop events on column container
      cardsContainer.addEventListener('dragover', (e) => this.handleDragOver(e, colEl));
      cardsContainer.addEventListener('dragleave', (e) => this.handleDragLeave(e, colEl));
      cardsContainer.addEventListener('drop', (e) => this.handleDrop(e, column.id, colEl));

      // Render Cards
      columnTasks.forEach(task => {
        const cardEl = this.createCardElement(task);
        cardsContainer.appendChild(cardEl);
      });

      // Quick add task button listener
      colEl.querySelector('.column-add-task-btn').addEventListener('click', () => {
        this.openCreateTaskModal(column.id);
      });

      boardContainer.appendChild(colEl);
    });

    // Append Add Column Card
    const addColWrapper = document.createElement('div');
    addColWrapper.className = 'add-column-card';
    addColWrapper.id = 'add-column-card-btn';
    addColWrapper.innerHTML = `
      <i data-lucide="plus-circle" style="width: 28px; height: 28px; color: var(--primary);"></i>
      <span>Add New Column</span>
    `;
    addColWrapper.addEventListener('click', () => {
      window.modalManager.openModal('create-column-modal');
    });
    boardContainer.appendChild(addColWrapper);

    // Initialize Lucide Icons & 3D Tilt
    if (window.lucide) lucide.createIcons();
    if (window.CardTilt3D) CardTilt3D.applyAll('.task-card');
  },

  createCardElement(task) {
    const card = document.createElement('div');
    card.className = 'task-card tilt-card-3d';
    card.draggable = true;
    card.dataset.taskId = task.id;

    // Subtasks stats
    const subtaskTotal = task.subtask_count || 0;
    const subtaskCompleted = task.completed_subtasks_count || 0;
    const subtaskPercent = subtaskTotal > 0 ? Math.round((subtaskCompleted / subtaskTotal) * 100) : 0;

    // Due date check
    let dueDateHTML = '';
    if (task.due_date) {
      const isOverdue = new Date(task.due_date) < new Date() && !task.column_name?.toLowerCase().includes('done');
      const dateFormatted = new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      dueDateHTML = `
        <div class="card-due-date ${isOverdue ? 'overdue' : ''}" title="${isOverdue ? 'Overdue' : 'Due date'}">
          <i data-lucide="calendar" style="width: 13px; height: 13px;"></i>
          <span>${dateFormatted}</span>
        </div>
      `;
    }

    // Assignees HTML
    let assigneesHTML = '<div class="card-assignees">';
    if (task.assignees && task.assignees.length > 0) {
      task.assignees.slice(0, 3).forEach(a => {
        assigneesHTML += `<img src="${a.avatar}" class="card-assignee-avatar" title="${this.escapeHTML(a.name)}" alt="${this.escapeHTML(a.name)}" />`;
      });
      if (task.assignees.length > 3) {
        assigneesHTML += `<span class="card-assignee-avatar" style="background: var(--bg-surface-solid); font-size: 0.65rem; display:flex; align-items:center; justify-content:center;">+${task.assignees.length - 3}</span>`;
      }
    }
    assigneesHTML += '</div>';

    // Tags HTML
    let tagsHTML = '';
    if (task.tags && task.tags.length > 0) {
      tagsHTML = '<div class="card-tags">';
      task.tags.forEach(t => {
        tagsHTML += `<span class="tag-badge" style="background: ${t.color}22; color: ${t.color}; border: 1px solid ${t.color}44;">${this.escapeHTML(t.name)}</span>`;
      });
      tagsHTML += '</div>';
    }

    card.innerHTML = `
      <div class="card-shine"></div>
      ${task.cover_color ? `<div class="card-cover-bar" style="background-color: ${task.cover_color};"></div>` : ''}
      ${tagsHTML}
      <h4 class="card-title">${this.escapeHTML(task.title)}</h4>
      ${task.description ? `<p class="card-desc-snippet">${this.escapeHTML(task.description)}</p>` : ''}
      
      ${subtaskTotal > 0 ? `
        <div class="card-subtasks-progress">
          <i data-lucide="check-square" style="width: 13px; height: 13px;"></i>
          <span>${subtaskCompleted}/${subtaskTotal}</span>
          <div class="progress-bar-track">
            <div class="progress-bar-fill" style="width: ${subtaskPercent}%"></div>
          </div>
        </div>
      ` : ''}

      <div class="card-footer">
        <div class="card-meta-left">
          <span class="priority-badge priority-${task.priority}">${task.priority}</span>
          ${dueDateHTML}
          ${task.comment_count > 0 ? `
            <div class="card-comments-count">
              <i data-lucide="message-square" style="width: 13px; height: 13px;"></i>
              <span>${task.comment_count}</span>
            </div>
          ` : ''}
        </div>
        ${assigneesHTML}
      </div>
    `;

    // Click to Inspect Task
    card.addEventListener('click', (e) => {
      // Prevent click if we were dragging
      if (this.draggedTaskId) return;
      if (window.AsanaApp && typeof window.AsanaApp.openDrawer === 'function') {
        window.AsanaApp.openDrawer(task.id);
      }
    });

    // Drag Events
    card.addEventListener('dragstart', (e) => this.handleDragStart(e, task.id, card));
    card.addEventListener('dragend', (e) => this.handleDragEnd(e, card));

    return card;
  },

  handleDragStart(e, taskId, cardEl) {
    this.draggedTaskId = taskId;
    this.draggedCardElement = cardEl;
    cardEl.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
  },

  handleDragEnd(e, cardEl) {
    cardEl.classList.remove('dragging');
    this.draggedTaskId = null;
    this.draggedCardElement = null;
    document.querySelectorAll('.kanban-column').forEach(c => c.classList.remove('drag-over'));
  },

  handleDragOver(e, columnEl) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    columnEl.classList.add('drag-over');
  },

  handleDragLeave(e, columnEl) {
    columnEl.classList.remove('drag-over');
  },

  async handleDrop(e, targetColumnId, columnEl) {
    e.preventDefault();
    columnEl.classList.remove('drag-over');

    const taskId = this.draggedTaskId || e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    try {
      const res = await API.moveTask({
        task_id: parseInt(taskId),
        target_column_id: targetColumnId,
        new_order_index: 0,
        project_id: state.currentProject.project.id
      });

      // Broadcast move event
      socketManager.broadcastEvent(state.currentProject.project.id, 'task_moved', {
        task_id: taskId,
        target_column_id: targetColumnId,
        project_id: state.currentProject.project.id
      });

      // If task moved to Done column, trigger confetti & completion sound
      if (res.isDone) {
        if (window.soundManager) window.soundManager.playCompletionSound();
        this.triggerConfetti();
        window.showToast('🎉 Task completed! Awesome work!', 'success');
      }

      // Refresh project state
      const updated = await API.getProject(state.currentProject.project.id);
      state.setCurrentProject(updated);
    } catch (err) {
      window.showToast(err.message, 'danger');
    }
  },

  triggerConfetti() {
    if (typeof confetti === 'function') {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.7 },
        colors: ['#6366f1', '#8b5cf6', '#ec4899', '#06b6d4', '#10b981']
      });
    }
  },

  openCreateTaskModal(columnId) {
    const colSelect = document.getElementById('task-column-select');
    if (colSelect && state.currentProject) {
      colSelect.innerHTML = state.currentProject.columns.map(c => `
        <option value="${c.id}" ${c.id === columnId ? 'selected' : ''}>${this.escapeHTML(c.name)}</option>
      `).join('');
    }

    // Populate Member Checkboxes for Assignees
    const assigneesPicker = document.getElementById('task-assignees-picker');
    if (assigneesPicker) {
      const defaultMembers = [
        { id: 1, name: 'Usman', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' },
        { id: 2, name: 'Ali', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150' },
        { id: 3, name: 'Ahmad', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150' }
      ];
      const members = (state.currentProject && state.currentProject.members && state.currentProject.members.length > 0) 
        ? state.currentProject.members 
        : defaultMembers;

      assigneesPicker.innerHTML = members.map(m => `
        <label style="display:inline-flex; align-items:center; gap:6px; padding:4px 10px; background:var(--asana-sidebar-bg); border:1px solid var(--asana-border); border-radius:var(--radius-full); font-size:0.82rem; font-weight:600; cursor:pointer; user-select:none;">
          <input type="checkbox" value="${m.id}" style="cursor:pointer;" />
          <img src="${m.avatar}" style="width:18px; height:18px; border-radius:50%; object-fit:cover;" />
          <span>${this.escapeHTML(m.name)}</span>
        </label>
      `).join('');
    }

    window.modalManager.openModal('create-task-modal');
  },

  renderListView() {
    const tableBody = document.getElementById('list-tasks-tbody');
    if (!tableBody || !state.currentProject) return;

    const filteredTasks = state.getFilteredTasks();
    tableBody.innerHTML = '';

    if (filteredTasks.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:32px;">No tasks match your filters.</td></tr>`;
      return;
    }

    filteredTasks.forEach(task => {
      const tr = document.createElement('tr');
      const col = state.currentProject.columns.find(c => c.id === task.column_id);
      const colName = col ? col.name : 'Unknown';

      const assigneesStr = (task.assignees || []).map(a => a.name).join(', ') || 'Unassigned';

      tr.innerHTML = `
        <td style="font-weight:700;">${this.escapeHTML(task.title)}</td>
        <td><span class="column-count" style="border-color:${col?.color || '#8b5cf6'}">${this.escapeHTML(colName)}</span></td>
        <td><span class="priority-badge priority-${task.priority}">${task.priority}</span></td>
        <td style="color:var(--text-muted); font-size:0.85rem;">${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No date'}</td>
        <td style="font-size:0.85rem;">${this.escapeHTML(assigneesStr)}</td>
        <td>
          <button class="btn-icon" style="width:30px; height:30px;" title="View Details">
            <i data-lucide="arrow-up-right" style="width:14px; height:14px;"></i>
          </button>
        </td>
      `;

      tr.addEventListener('click', () => {
        if (window.AsanaApp && typeof window.AsanaApp.openDrawer === 'function') {
          window.AsanaApp.openDrawer(task.id);
        }
      });

      tableBody.appendChild(tr);
    });

    if (window.lucide) lucide.createIcons();
  },

  escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }
};

window.BoardController = BoardController;
