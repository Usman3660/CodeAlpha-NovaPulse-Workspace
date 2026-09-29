const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { authenticateToken, requireProjectMember } = require('../middleware/auth');
const { cleanInput, sanitizeString } = require('../middleware/security');

// Get all projects user belongs to
router.get('/', authenticateToken, async (req, res) => {
  try {
    const projects = await db.all(
      `SELECT p.id, p.name, p.description, p.color, p.icon, p.owner_id, p.invite_code, p.created_at,
              pm.role as my_role,
              (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count,
              (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
              (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND column_id IN (SELECT id FROM columns WHERE project_id = p.id AND LOWER(name) LIKE '%done%')) as completed_task_count
       FROM projects p
       JOIN project_members pm ON p.id = pm.project_id
       WHERE pm.user_id = ?
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );

    res.json({ projects });
  } catch (err) {
    console.error('Fetch projects error:', err);
    res.status(500).json({ error: 'Failed to fetch projects.' });
  }
});

// Create new project
router.post('/', authenticateToken, async (req, res) => {
  try {
    let { name, description, color, icon } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Project name is required.' });
    }

    name = cleanInput(name);
    description = description ? cleanInput(description) : '';
    color = color || '#8b5cf6';
    icon = icon || 'folder-kanban';

    const inviteCode = 'NOVA-' + Math.floor(1000 + Math.random() * 9000);

    const result = await db.run(
      `INSERT INTO projects (name, description, color, icon, owner_id, invite_code)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, description, color, icon, req.user.id, inviteCode]
    );

    const projectId = result.lastID;

    // Add creator as Owner
    await db.run(
      `INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'Owner')`,
      [projectId, req.user.id]
    );

    // Create default board columns
    await db.run(`INSERT INTO columns (project_id, name, order_index, color) VALUES (?, 'To Do', 0, '#6366f1')`, [projectId]);
    await db.run(`INSERT INTO columns (project_id, name, order_index, color) VALUES (?, 'In Progress', 1, '#f59e0b')`, [projectId]);
    await db.run(`INSERT INTO columns (project_id, name, order_index, color) VALUES (?, 'Done', 2, '#10b981')`, [projectId]);

    // Log activity
    await db.run(
      `INSERT INTO activity_logs (project_id, user_id, action, details) VALUES (?, ?, 'created_project', ?)`,
      [projectId, req.user.id, `Created project "${name}"`]
    );

    const newProject = await db.get(
      `SELECT p.*, 'Owner' as my_role FROM projects p WHERE p.id = ?`,
      [projectId]
    );

    res.status(201).json({
      message: 'Project created successfully!',
      project: newProject
    });
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ error: 'Failed to create project.' });
  }
});

// Join project by invite code
router.post('/join', authenticateToken, async (req, res) => {
  try {
    let { inviteCode } = req.body;
    if (!inviteCode || !inviteCode.trim()) {
      return res.status(400).json({ error: 'Invite code is required.' });
    }

    inviteCode = inviteCode.trim().toUpperCase();

    const project = await db.get('SELECT * FROM projects WHERE invite_code = ?', [inviteCode]);
    if (!project) {
      return res.status(404).json({ error: 'Invalid invite code. Project not found.' });
    }

    const existingMember = await db.get(
      'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?',
      [project.id, req.user.id]
    );

    if (existingMember) {
      return res.status(400).json({ error: 'You are already a member of this project.', project });
    }

    await db.run(
      `INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'Member')`,
      [project.id, req.user.id]
    );

    // Notify project owner
    await db.run(
      `INSERT INTO notifications (user_id, type, title, message, project_id)
       VALUES (?, 'project_invite', 'New Member Joined', ?, ?)`,
      [project.owner_id, `${req.user.name} joined project "${project.name}"`, project.id]
    );

    // Log activity
    await db.run(
      `INSERT INTO activity_logs (project_id, user_id, action, details) VALUES (?, ?, 'joined_project', ?)`,
      [project.id, req.user.id, `Joined the project`]
    );

    res.json({
      message: `Successfully joined ${project.name}!`,
      project
    });
  } catch (err) {
    console.error('Join project error:', err);
    res.status(500).json({ error: 'Failed to join project.' });
  }
});

// Get Single Project Details (with columns, tasks, members, statistics)
router.get('/:projectId', authenticateToken, requireProjectMember('Viewer'), async (req, res) => {
  try {
    const projectId = req.params.projectId;

    const project = await db.get(
      `SELECT p.*, pm.role as my_role
       FROM projects p
       JOIN project_members pm ON p.id = pm.project_id
       WHERE p.id = ? AND pm.user_id = ?`,
      [projectId, req.user.id]
    );

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    // Get members
    const members = await db.all(
      `SELECT u.id, u.name, u.email, u.avatar, u.color, pm.role, pm.joined_at
       FROM project_members pm
       JOIN users u ON pm.user_id = u.id
       WHERE pm.project_id = ?
       ORDER BY pm.role = 'Owner' DESC, pm.role = 'Admin' DESC, u.name ASC`,
      [projectId]
    );

    // Get columns
    const columns = await db.all(
      `SELECT * FROM columns WHERE project_id = ? ORDER BY order_index ASC`,
      [projectId]
    );

    // Get tasks with assignees, tag count, subtask count
    const tasks = await db.all(
      `SELECT t.*, u.name as creator_name, u.avatar as creator_avatar,
              (SELECT COUNT(*) FROM subtasks WHERE task_id = t.id) as subtask_count,
              (SELECT COUNT(*) FROM subtasks WHERE task_id = t.id AND is_completed = 1) as completed_subtasks_count,
              (SELECT COUNT(*) FROM comments WHERE task_id = t.id) as comment_count
       FROM tasks t
       LEFT JOIN users u ON t.created_by = u.id
       WHERE t.project_id = ?
       ORDER BY t.order_index ASC`,
      [projectId]
    );

    // Attach assignees & tags to tasks
    for (const task of tasks) {
      task.assignees = await db.all(
        `SELECT u.id, u.name, u.avatar, u.color, u.role
         FROM task_assignees ta
         JOIN users u ON ta.user_id = u.id
         WHERE ta.task_id = ?`,
        [task.id]
      );

      task.tags = await db.all(
        `SELECT id, name, color FROM task_tags WHERE task_id = ?`,
        [task.id]
      );
    }

    // Calculate analytics / metrics
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => {
      const col = columns.find(c => c.id === t.column_id);
      return col && col.name.toLowerCase().includes('done');
    }).length;

    const metrics = {
      totalTasks,
      completedTasks,
      progressPercentage: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      urgentCount: tasks.filter(t => t.priority === 'urgent').length,
      highCount: tasks.filter(t => t.priority === 'high').length
    };

    res.json({
      project,
      members,
      columns,
      tasks,
      metrics
    });
  } catch (err) {
    console.error('Get project details error:', err);
    res.status(500).json({ error: 'Failed to load project details.' });
  }
});

// Update Project
router.put('/:projectId', authenticateToken, requireProjectMember('Admin'), async (req, res) => {
  try {
    const projectId = req.params.projectId;
    let { name, description, color, icon } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Project name is required.' });
    }

    name = cleanInput(name);
    description = description ? cleanInput(description) : '';

    await db.run(
      `UPDATE projects SET name = ?, description = ?, color = ?, icon = ? WHERE id = ?`,
      [name, description, color || '#8b5cf6', icon || 'folder-kanban', projectId]
    );

    res.json({ message: 'Project updated successfully!' });
  } catch (err) {
    console.error('Update project error:', err);
    res.status(500).json({ error: 'Failed to update project.' });
  }
});

// Delete Project
router.delete('/:projectId', authenticateToken, requireProjectMember('Owner'), async (req, res) => {
  try {
    const projectId = req.params.projectId;
    await db.run('DELETE FROM projects WHERE id = ?', [projectId]);
    res.json({ message: 'Project deleted successfully.' });
  } catch (err) {
    console.error('Delete project error:', err);
    res.status(500).json({ error: 'Failed to delete project.' });
  }
});

// Add member by email or user ID
router.post('/:projectId/members', authenticateToken, requireProjectMember('Admin'), async (req, res) => {
  try {
    const projectId = req.params.projectId;
    let { email, role } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'User email is required.' });
    }

    email = email.trim().toLowerCase();
    const user = await db.get('SELECT id, name, email, avatar, color FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(404).json({ error: 'User not found with this email.' });
    }

    const memberRole = ['Admin', 'Member', 'Viewer'].includes(role) ? role : 'Member';

    const existing = await db.get('SELECT id FROM project_members WHERE project_id = ? AND user_id = ?', [projectId, user.id]);
    if (existing) {
      return res.status(400).json({ error: 'User is already a project member.' });
    }

    await db.run(
      `INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)`,
      [projectId, user.id, memberRole]
    );

    const project = await db.get('SELECT name FROM projects WHERE id = ?', [projectId]);

    // Send notification to added user
    await db.run(
      `INSERT INTO notifications (user_id, type, title, message, project_id)
       VALUES (?, 'project_invite', 'Added to Project', ?, ?)`,
      [user.id, `You were added to "${project.name}" as a ${memberRole}.`, projectId]
    );

    res.status(201).json({
      message: `${user.name} added to project!`,
      member: { ...user, role: memberRole }
    });
  } catch (err) {
    console.error('Add member error:', err);
    res.status(500).json({ error: 'Failed to add member.' });
  }
});

// Update member role
router.put('/:projectId/members/:userId', authenticateToken, requireProjectMember('Owner'), async (req, res) => {
  try {
    const { projectId, userId } = req.params;
    const { role } = req.body;

    if (!['Admin', 'Member', 'Viewer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role.' });
    }

    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ error: 'Cannot change your own Owner role.' });
    }

    await db.run(
      `UPDATE project_members SET role = ? WHERE project_id = ? AND user_id = ?`,
      [role, projectId, userId]
    );

    res.json({ message: 'Member role updated.' });
  } catch (err) {
    console.error('Update member role error:', err);
    res.status(500).json({ error: 'Failed to update member role.' });
  }
});

// Remove member from project
router.delete('/:projectId/members/:userId', authenticateToken, requireProjectMember('Admin'), async (req, res) => {
  try {
    const { projectId, userId } = req.params;

    const targetMember = await db.get(
      'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
      [projectId, userId]
    );

    if (!targetMember) {
      return res.status(404).json({ error: 'Member not found in project.' });
    }

    if (targetMember.role === 'Owner') {
      return res.status(400).json({ error: 'Cannot remove project owner.' });
    }

    // Admins cannot remove other Admins or Owners unless they are Owner
    if (req.projectRole === 'Admin' && targetMember.role === 'Admin' && parseInt(userId) !== req.user.id) {
      return res.status(403).json({ error: 'Only Owners can remove Admins.' });
    }

    await db.run('DELETE FROM project_members WHERE project_id = ? AND user_id = ?', [projectId, userId]);
    // Also remove from task assignees in this project
    await db.run(
      `DELETE FROM task_assignees WHERE user_id = ? AND task_id IN (SELECT id FROM tasks WHERE project_id = ?)`,
      [userId, projectId]
    );

    res.json({ message: 'Member removed from project.' });
  } catch (err) {
    console.error('Remove member error:', err);
    res.status(500).json({ error: 'Failed to remove member.' });
  }
});

// Get Project Activity Log
router.get('/:projectId/activity', authenticateToken, requireProjectMember('Viewer'), async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const activities = await db.all(
      `SELECT a.*, u.name as user_name, u.avatar as user_avatar
       FROM activity_logs a
       JOIN users u ON a.user_id = u.id
       WHERE a.project_id = ?
       ORDER BY a.created_at DESC
       LIMIT 40`,
      [projectId]
    );
    res.json({ activities });
  } catch (err) {
    console.error('Fetch activity error:', err);
    res.status(500).json({ error: 'Failed to fetch activity logs.' });
  }
});

module.exports = router;
