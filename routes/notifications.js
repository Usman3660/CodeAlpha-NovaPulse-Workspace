const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

// Get all notifications for current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const notifications = await db.all(
      `SELECT n.*, p.name as project_name, t.title as task_title
       FROM notifications n
       LEFT JOIN projects p ON n.project_id = p.id
       LEFT JOIN tasks t ON n.task_id = t.id
       WHERE n.user_id = ?
       ORDER BY n.created_at DESC
       LIMIT 30`,
      [req.user.id]
    );

    const unreadCount = await db.get(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
      [req.user.id]
    );

    res.json({
      notifications,
      unreadCount: parseInt(unreadCount?.count || 0, 10)
    });
  } catch (err) {
    console.error('Fetch notifications error:', err);
    res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
});

// Mark single notification as read
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    const notifId = req.params.id;
    await db.run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [notifId, req.user.id]);
    res.json({ message: 'Notification marked as read.' });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ error: 'Failed to update notification.' });
  }
});

// Mark all as read
router.put('/read-all', authenticateToken, async (req, res) => {
  try {
    await db.run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
    res.json({ message: 'All notifications marked as read.' });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ error: 'Failed to update notifications.' });
  }
});

// Clear all notifications
router.delete('/clear', authenticateToken, async (req, res) => {
  try {
    await db.run('DELETE FROM notifications WHERE user_id = ?', [req.user.id]);
    res.json({ message: 'Notifications cleared.' });
  } catch (err) {
    console.error('Clear notifications error:', err);
    res.status(500).json({ error: 'Failed to clear notifications.' });
  }
});

module.exports = router;
