// ==========================================================================
// Project Analytics & Productivity Insights Controller
// ==========================================================================

const AnalyticsController = {
  render() {
    if (!state.currentProject) return;

    const { project, tasks, columns, members, metrics } = state.currentProject;

    // Total stats
    const totalEl = document.getElementById('stat-total-tasks');
    const completedEl = document.getElementById('stat-completed-tasks');
    const rateEl = document.getElementById('stat-completion-rate');
    const urgentEl = document.getElementById('stat-urgent-tasks');

    if (totalEl) totalEl.textContent = metrics.totalTasks;
    if (completedEl) completedEl.textContent = metrics.completedTasks;
    if (rateEl) rateEl.textContent = `${metrics.progressPercentage}%`;
    if (urgentEl) urgentEl.textContent = metrics.urgentCount;

    // Progress bar fill
    const progressFill = document.getElementById('analytics-progress-fill');
    if (progressFill) progressFill.style.width = `${metrics.progressPercentage}%`;

    // Tasks by Column Breakdown
    const columnBreakdownContainer = document.getElementById('analytics-column-breakdown');
    if (columnBreakdownContainer) {
      columnBreakdownContainer.innerHTML = columns.map(col => {
        const count = tasks.filter(t => t.column_id === col.id).length;
        const pct = metrics.totalTasks > 0 ? Math.round((count / metrics.totalTasks) * 100) : 0;
        return `
          <div class="chart-bar-item">
            <span style="display:flex; align-items:center; gap:8px;">
              <span style="width:10px; height:10px; border-radius:50%; background:${col.color};"></span>
              ${this.escapeHTML(col.name)}
            </span>
            <div style="display:flex; align-items:center; gap:12px; width:55%;">
              <div class="progress-bar-track">
                <div class="progress-bar-fill" style="width:${pct}%; background:${col.color};"></div>
              </div>
              <span style="font-weight:700; width:45px; text-align:right;">${count} (${pct}%)</span>
            </div>
          </div>
        `;
      }).join('');
    }

    // Workload Distribution by Member
    const memberWorkloadContainer = document.getElementById('analytics-member-workload');
    if (memberWorkloadContainer) {
      memberWorkloadContainer.innerHTML = members.map(m => {
        const assignedCount = tasks.filter(t => (t.assignees || []).some(a => a.id === m.id)).length;
        const pct = metrics.totalTasks > 0 ? Math.round((assignedCount / metrics.totalTasks) * 100) : 0;
        return `
          <div class="chart-bar-item">
            <span style="display:flex; align-items:center; gap:8px;">
              <img src="${m.avatar}" style="width:24px; height:24px; border-radius:50%; object-fit:cover;" />
              ${this.escapeHTML(m.name)}
            </span>
            <div style="display:flex; align-items:center; gap:12px; width:55%;">
              <div class="progress-bar-track">
                <div class="progress-bar-fill" style="width:${pct}%; background:var(--primary);"></div>
              </div>
              <span style="font-weight:700; width:45px; text-align:right;">${assignedCount} tasks</span>
            </div>
          </div>
        `;
      }).join('');
    }

    if (window.lucide) lucide.createIcons();
  },

  escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }
};

window.AnalyticsController = AnalyticsController;
