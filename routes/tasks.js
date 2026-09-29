const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { cleanInput, sanitizeString } = require('../middleware/security');

// Create Task
router.post('/', authenticateToken, async (req, res) => {
  try {
    let { project_id, column_id, title, description, priority, due_date, cover_color, assignees, tags, subtasks } = req.body;

    if (!project_id || !column_id || !title || !title.trim()) {
      return res.status(400).json({ error: 'Project ID, Column ID, and Title are required.' });
    }

    // Check membership
    const member = await db.get(
      'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
      [project_id, req.user.id]
    );
    if (!member || member.role === 'Viewer') {
      return res.status(403).json({ error: 'You do not have permission to create tasks in this project.' });
    }

    title = cleanInput(title);
    description = description ? cleanInput(description) : '';
    priority = ['low', 'medium', 'high', 'urgent'].includes(priority) ? priority : 'medium';

    // Determine order_index
    const maxOrder = await db.get(
      'SELECT COALESCE(MAX(order_index), -1) as max_order FROM tasks WHERE column_id = ?',
      [column_id]
    );
    const orderIndex = maxOrder.max_order + 1;

    const taskResult = await db.run(
      `INSERT INTO tasks (project_id, column_id, title, description, priority, due_date, order_index, created_by, cover_color)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [project_id, column_id, title, description, priority, due_date || null, orderIndex, req.user.id, cover_color || '']
    );

    const taskId = taskResult.lastID;

    // Handle Assignees
    if (Array.isArray(assignees)) {
      for (const userId of assignees) {
        await db.run('INSERT OR IGNORE INTO task_assignees (task_id, user_id) VALUES (?, ?)', [taskId, userId]);
        if (userId !== req.user.id) {
          const project = await db.get('SELECT name FROM projects WHERE id = ?', [project_id]);
          await db.run(
            `INSERT INTO notifications (user_id, type, title, message, project_id, task_id)
             VALUES (?, 'task_assigned', 'Assigned to Task', ?, ?, ?)`,
            [userId, `${req.user.name} assigned you to "${title}" in "${project.name}"`, project_id, taskId]
          );
        }
      }
    }

    // Handle Tags
    if (Array.isArray(tags)) {
      for (const tag of tags) {
        const tagName = typeof tag === 'string' ? tag : tag.name;
        const tagColor = typeof tag === 'object' && tag.color ? tag.color : '#8b5cf6';
        if (tagName && tagName.trim()) {
          await db.run('INSERT INTO task_tags (task_id, name, color) VALUES (?, ?, ?)', [taskId, cleanInput(tagName), tagColor]);
        }
      }
    }

    // Handle Subtasks
    if (Array.isArray(subtasks)) {
      for (let i = 0; i < subtasks.length; i++) {
        const st = subtasks[i];
        const stTitle = typeof st === 'string' ? st : st.title;
        if (stTitle && stTitle.trim()) {
          await db.run(
            'INSERT INTO subtasks (task_id, title, is_completed, order_index) VALUES (?, ?, 0, ?)',
            [taskId, cleanInput(stTitle), i]
          );
        }
      }
    }

    // Activity Log
    await db.run(
      `INSERT INTO activity_logs (project_id, task_id, user_id, action, details)
       VALUES (?, ?, ?, 'created_task', ?)`,
      [project_id, taskId, req.user.id, `Created task "${title}"`]
    );

    const task = await getFullTask(taskId);
    res.status(201).json({ task });
  } catch (err) {
    console.error('Create task error:', err);
    res.status(500).json({ error: 'Failed to create task.' });
  }
});

// Helper to fetch full task details
async function getFullTask(taskId) {
  const task = await db.get(
    `SELECT t.*, u.name as creator_name, u.avatar as creator_avatar,
            c.name as column_name,
            (SELECT COUNT(*) FROM subtasks WHERE task_id = t.id) as subtask_count,
            (SELECT COUNT(*) FROM subtasks WHERE task_id = t.id AND is_completed = 1) as completed_subtasks_count,
            (SELECT COUNT(*) FROM comments WHERE task_id = t.id) as comment_count
     FROM tasks t
     LEFT JOIN users u ON t.created_by = u.id
     LEFT JOIN columns c ON t.column_id = c.id
     WHERE t.id = ?`,
    [taskId]
  );

  if (!task) return null;

  task.assignees = await db.all(
    `SELECT u.id, u.name, u.email, u.avatar, u.color, u.role
     FROM task_assignees ta
     JOIN users u ON ta.user_id = u.id
     WHERE ta.task_id = ?`,
    [taskId]
  );

  task.tags = await db.all('SELECT id, name, color FROM task_tags WHERE task_id = ?', [taskId]);
  task.subtasks = await db.all('SELECT * FROM subtasks WHERE task_id = ? ORDER BY order_index ASC', [taskId]);
  task.comments = await db.all(
    `SELECT cm.*, u.name as user_name, u.avatar as user_avatar, u.color as user_color
     FROM comments cm
     JOIN users u ON cm.user_id = u.id
     WHERE cm.task_id = ?
     ORDER BY cm.created_at ASC`,
    [taskId]
  );

  // Parse comment reactions safely
  task.comments.forEach(c => {
    try {
      c.reactions = JSON.parse(c.reactions || '{}');
    } catch {
      c.reactions = {};
    }
  });

  return task;
}

// Get Single Task Details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const taskId = req.params.id;
    const task = await getFullTask(taskId);

    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const member = await db.get(
      'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
      [task.project_id, req.user.id]
    );
    if (!member) {
      return res.status(403).json({ error: 'You do not have access to this project.' });
    }

    res.json({ task });
  } catch (err) {
    console.error('Get task error:', err);
    res.status(500).json({ error: 'Failed to fetch task.' });
  }
});

// Update Task
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const taskId = req.params.id;
    const existing = await db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!existing) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const member = await db.get(
      'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
      [existing.project_id, req.user.id]
    );
    if (!member || member.role === 'Viewer') {
      return res.status(403).json({ error: 'Insufficient permissions.' });
    }

    let { title, description, priority, due_date, cover_color, column_id } = req.body;

    title = title !== undefined ? cleanInput(title) : existing.title;
    description = description !== undefined ? cleanInput(description) : existing.description;
    priority = priority && ['low', 'medium', 'high', 'urgent'].includes(priority) ? priority : existing.priority;
    due_date = due_date !== undefined ? due_date : existing.due_date;
    cover_color = cover_color !== undefined ? cover_color : existing.cover_color;
    column_id = column_id !== undefined ? column_id : existing.column_id;

    await db.run(
      `UPDATE tasks
       SET title = ?, description = ?, priority = ?, due_date = ?, cover_color = ?, column_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [title, description, priority, due_date, cover_color, column_id, taskId]
    );

    const updated = await getFullTask(taskId);
    res.json({ task: updated });
  } catch (err) {
    console.error('Update task error:', err);
    res.status(500).json({ error: 'Failed to update task.' });
  }
});

// Move Task (Drag & Drop column or reorder)
router.post('/move', authenticateToken, async (req, res) => {
  try {
    const { task_id, target_column_id, new_order_index, project_id } = req.body;

    if (!task_id || !target_column_id) {
      return res.status(400).json({ error: 'Task ID and target column ID are required.' });
    }

    const task = await db.get('SELECT * FROM tasks WHERE id = ?', [task_id]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const member = await db.get(
      'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
      [task.project_id, req.user.id]
    );
    if (!member || member.role === 'Viewer') {
      return res.status(403).json({ error: 'Insufficient permissions.' });
    }

    const oldColumn = await db.get('SELECT name FROM columns WHERE id = ?', [task.column_id]);
    const newColumn = await db.get('SELECT name FROM columns WHERE id = ?', [target_column_id]);

    await db.run(
      `UPDATE tasks SET column_id = ?, order_index = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [target_column_id, new_order_index || 0, task_id]
    );

    // If column changed, log activity & check completed status
    if (task.column_id !== target_column_id) {
      const isDone = newColumn.name.toLowerCase().includes('done');
      await db.run(
        `INSERT INTO activity_logs (project_id, task_id, user_id, action, details)
         VALUES (?, ?, ?, 'moved_task', ?)`,
        [task.project_id, task_id, req.user.id, `Moved "${task.title}" to ${newColumn.name}`]
      );

      // Notify other assignees
      const assignees = await db.all('SELECT user_id FROM task_assignees WHERE task_id = ?', [task_id]);
      for (const a of assignees) {
        if (a.user_id !== req.user.id) {
          await db.run(
            `INSERT INTO notifications (user_id, type, title, message, project_id, task_id)
             VALUES (?, 'status_changed', 'Task Status Updated', ?, ?, ?)`,
            [a.user_id, `${req.user.name} moved "${task.title}" to ${newColumn.name}`, task.project_id, task_id]
          );
        }
      }
    }

    const updatedTask = await getFullTask(task_id);
    res.json({
      message: 'Task moved successfully.',
      task: updatedTask,
      isDone: newColumn && newColumn.name.toLowerCase().includes('done')
    });
  } catch (err) {
    console.error('Move task error:', err);
    res.status(500).json({ error: 'Failed to move task.' });
  }
});

// Assign / Unassign User from Task
router.post('/:id/assignees', authenticateToken, async (req, res) => {
  try {
    const taskId = req.params.id;
    const { user_id } = req.body;
    const targetUserId = parseInt(user_id, 10);

    if (!targetUserId) {
      return res.status(400).json({ error: 'Valid user_id is required.' });
    }

    const task = await db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) return res.status(404).json({ error: 'Task not found.' });

    const member = await db.get(
      'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
      [task.project_id, req.user.id]
    );
    const project = await db.get('SELECT * FROM projects WHERE id = ?', [task.project_id]);
    const isOwner = project && project.owner_id === req.user.id;

    if (!member && !isOwner && task.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Insufficient permissions.' });
    }

    const existing = await db.get('SELECT * FROM task_assignees WHERE task_id = ? AND user_id = ?', [taskId, targetUserId]);
    if (existing) {
      // Unassign
      await db.run('DELETE FROM task_assignees WHERE task_id = ? AND user_id = ?', [taskId, targetUserId]);
    } else {
      // Ensure target user is a member of the project
      const targetMember = await db.get('SELECT id FROM project_members WHERE project_id = ? AND user_id = ?', [task.project_id, targetUserId]);
      if (!targetMember) {
        await db.run('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)', [task.project_id, targetUserId, 'Member']);
      }

      // Assign
      await db.run('INSERT INTO task_assignees (task_id, user_id) VALUES (?, ?)', [taskId, targetUserId]);
      if (targetUserId !== req.user.id) {
        await db.run(
          `INSERT INTO notifications (user_id, type, title, message, project_id, task_id)
           VALUES (?, 'task_assigned', 'Assigned to Task', ?, ?, ?)`,
          [targetUserId, `${req.user.name} assigned you to "${task.title}"`, task.project_id, taskId]
        );
      }
    }

    const updated = await getFullTask(taskId);
    res.json({ task: updated });
  } catch (err) {
    console.error('Toggle assignee error:', err);
    res.status(500).json({ error: 'Failed to update assignees.' });
  }
});

// Subtasks: Add Subtask
router.post('/:id/subtasks', authenticateToken, async (req, res) => {
  try {
    const taskId = req.params.id;
    let { title } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Subtask title is required.' });
    }

    title = cleanInput(title);
    const maxOrder = await db.get('SELECT COALESCE(MAX(order_index), -1) as max_order FROM subtasks WHERE task_id = ?', [taskId]);

    const result = await db.run(
      'INSERT INTO subtasks (task_id, title, is_completed, order_index) VALUES (?, ?, 0, ?)',
      [taskId, title, maxOrder.max_order + 1]
    );

    const subtask = await db.get('SELECT * FROM subtasks WHERE id = ?', [result.lastID]);
    res.status(201).json({ subtask });
  } catch (err) {
    console.error('Add subtask error:', err);
    res.status(500).json({ error: 'Failed to add subtask.' });
  }
});

// Subtasks: Toggle Subtask Completion
router.put('/subtasks/:subtaskId/toggle', authenticateToken, async (req, res) => {
  try {
    const subtaskId = req.params.subtaskId;
    const subtask = await db.get('SELECT * FROM subtasks WHERE id = ?', [subtaskId]);
    if (!subtask) {
      return res.status(404).json({ error: 'Subtask not found.' });
    }

    const newStatus = subtask.is_completed === 1 ? 0 : 1;
    await db.run('UPDATE subtasks SET is_completed = ? WHERE id = ?', [newStatus, subtaskId]);

    const updated = await db.get('SELECT * FROM subtasks WHERE id = ?', [subtaskId]);
    res.json({ subtask: updated });
  } catch (err) {
    console.error('Toggle subtask error:', err);
    res.status(500).json({ error: 'Failed to toggle subtask.' });
  }
});

// Subtasks: Delete Subtask
router.delete('/subtasks/:subtaskId', authenticateToken, async (req, res) => {
  try {
    const subtaskId = req.params.subtaskId;
    await db.run('DELETE FROM subtasks WHERE id = ?', [subtaskId]);
    res.json({ message: 'Subtask deleted.' });
  } catch (err) {
    console.error('Delete subtask error:', err);
    res.status(500).json({ error: 'Failed to delete subtask.' });
  }
});

// Tags: Add Tag to Task
router.post('/:id/tags', authenticateToken, async (req, res) => {
  try {
    const taskId = req.params.id;
    let { name, color } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Tag name is required.' });
    }

    name = cleanInput(name);
    color = color || '#8b5cf6';

    const result = await db.run('INSERT INTO task_tags (task_id, name, color) VALUES (?, ?, ?)', [taskId, name, color]);
    const tag = await db.get('SELECT * FROM task_tags WHERE id = ?', [result.lastID]);

    res.status(201).json({ tag });
  } catch (err) {
    console.error('Add tag error:', err);
    res.status(500).json({ error: 'Failed to add tag.' });
  }
});

// Tags: Delete Tag
router.delete('/tags/:tagId', authenticateToken, async (req, res) => {
  try {
    const tagId = req.params.tagId;
    await db.run('DELETE FROM task_tags WHERE id = ?', [tagId]);
    res.json({ message: 'Tag removed.' });
  } catch (err) {
    console.error('Delete tag error:', err);
    res.status(500).json({ error: 'Failed to delete tag.' });
  }
});

// Delete Task
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const taskId = req.params.id;
    const task = await db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const member = await db.get(
      'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
      [task.project_id, req.user.id]
    );
    if (!member || member.role === 'Viewer') {
      return res.status(403).json({ error: 'Insufficient permissions.' });
    }

    await db.run('DELETE FROM tasks WHERE id = ?', [taskId]);

    // Activity Log
    await db.run(
      `INSERT INTO activity_logs (project_id, task_id, user_id, action, details)
       VALUES (?, ?, ?, 'deleted_task', ?)`,
      [task.project_id, taskId, req.user.id, `Deleted task "${task.title}"`]
    );

    res.json({ message: 'Task deleted successfully.' });
  } catch (err) {
    console.error('Delete task error:', err);
    res.status(500).json({ error: 'Failed to delete task.' });
  }
});

module.exports = router;
