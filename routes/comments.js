const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { cleanInput, sanitizeString } = require('../middleware/security');

// Add comment to task
router.post('/', authenticateToken, async (req, res) => {
  try {
    let { task_id, content } = req.body;

    if (!task_id || !content || !content.trim()) {
      return res.status(400).json({ error: 'Task ID and comment content are required.' });
    }

    const task = await db.get('SELECT * FROM tasks WHERE id = ?', [task_id]);
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

    content = cleanInput(content);

    const result = await db.run(
      'INSERT INTO comments (task_id, user_id, content, reactions) VALUES (?, ?, ?, ?)',
      [task_id, req.user.id, content, '{}']
    );

    const commentId = result.lastID;

    // Send notifications to assignees and creator
    const assignees = await db.all('SELECT user_id FROM task_assignees WHERE task_id = ?', [task_id]);
    const notifyUsers = new Set(assignees.map(a => a.user_id));
    if (task.created_by) notifyUsers.add(task.created_by);
    notifyUsers.delete(req.user.id); // don't notify self

    for (const uId of notifyUsers) {
      await db.run(
        `INSERT INTO notifications (user_id, type, title, message, project_id, task_id)
         VALUES (?, 'comment_added', 'New Task Comment', ?, ?, ?)`,
        [uId, `${req.user.name} commented on "${task.title}"`, task.project_id, task_id]
      );
    }

    // Activity Log
    await db.run(
      `INSERT INTO activity_logs (project_id, task_id, user_id, action, details)
       VALUES (?, ?, ?, 'commented', ?)`,
      [task.project_id, task_id, req.user.id, `Commented on "${task.title}"`]
    );

    const newComment = await db.get(
      `SELECT c.*, u.name as user_name, u.avatar as user_avatar, u.color as user_color
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.id = ?`,
      [commentId]
    );
    newComment.reactions = {};

    res.status(201).json({ comment: newComment });
  } catch (err) {
    console.error('Add comment error:', err);
    res.status(500).json({ error: 'Failed to add comment.' });
  }
});

// Toggle Reaction Emoji on comment
router.post('/:id/react', authenticateToken, async (req, res) => {
  try {
    const commentId = req.params.id;
    const { emoji } = req.body;

    if (!emoji) {
      return res.status(400).json({ error: 'Emoji is required.' });
    }

    const comment = await db.get('SELECT * FROM comments WHERE id = ?', [commentId]);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found.' });
    }

    let reactions = {};
    try {
      reactions = JSON.parse(comment.reactions || '{}');
    } catch {
      reactions = {};
    }

    if (!reactions[emoji]) {
      reactions[emoji] = [];
    }

    const userIdx = reactions[emoji].indexOf(req.user.id);
    if (userIdx > -1) {
      reactions[emoji].splice(userIdx, 1);
      if (reactions[emoji].length === 0) {
        delete reactions[emoji];
      }
    } else {
      reactions[emoji].push(req.user.id);
    }

    await db.run('UPDATE comments SET reactions = ? WHERE id = ?', [JSON.stringify(reactions), commentId]);

    res.json({ reactions });
  } catch (err) {
    console.error('Toggle reaction error:', err);
    res.status(500).json({ error: 'Failed to update reaction.' });
  }
});

// Delete Comment
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const commentId = req.params.id;
    const comment = await db.get('SELECT * FROM comments WHERE id = ?', [commentId]);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found.' });
    }

    if (comment.user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own comments.' });
    }

    await db.run('DELETE FROM comments WHERE id = ?', [commentId]);
    res.json({ message: 'Comment deleted.' });
  } catch (err) {
    console.error('Delete comment error:', err);
    res.status(500).json({ error: 'Failed to delete comment.' });
  }
});

module.exports = router;
