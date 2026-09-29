const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { authenticateToken, requireProjectMember } = require('../middleware/auth');
const { cleanInput } = require('../middleware/security');

// Create Column
router.post('/', authenticateToken, requireProjectMember('Member'), async (req, res) => {
  try {
    let { project_id, name, color } = req.body;

    if (!project_id || !name || !name.trim()) {
      return res.status(400).json({ error: 'Project ID and column name are required.' });
    }

    name = cleanInput(name);
    color = color || '#8b5cf6';

    const maxOrder = await db.get(
      'SELECT COALESCE(MAX(order_index), -1) as max_order FROM columns WHERE project_id = ?',
      [project_id]
    );
    const orderIndex = maxOrder.max_order + 1;

    const result = await db.run(
      `INSERT INTO columns (project_id, name, order_index, color) VALUES (?, ?, ?, ?)`,
      [project_id, name, orderIndex, color]
    );

    const newColumn = await db.get('SELECT * FROM columns WHERE id = ?', [result.lastID]);

    // Activity Log
    await db.run(
      `INSERT INTO activity_logs (project_id, user_id, action, details) VALUES (?, ?, 'created_column', ?)`,
      [project_id, req.user.id, `Added column "${name}"`]
    );

    res.status(201).json({ column: newColumn });
  } catch (err) {
    console.error('Create column error:', err);
    res.status(500).json({ error: 'Failed to create column.' });
  }
});

// Update Column (Rename or Change Color)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const columnId = req.params.id;
    let { name, color } = req.body;

    const column = await db.get('SELECT * FROM columns WHERE id = ?', [columnId]);
    if (!column) {
      return res.status(404).json({ error: 'Column not found.' });
    }

    // Verify member permissions
    const member = await db.get(
      'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
      [column.project_id, req.user.id]
    );
    if (!member || member.role === 'Viewer') {
      return res.status(403).json({ error: 'Insufficient permissions.' });
    }

    name = name ? cleanInput(name) : column.name;
    color = color || column.color;

    await db.run('UPDATE columns SET name = ?, color = ? WHERE id = ?', [name, color, columnId]);
    const updated = await db.get('SELECT * FROM columns WHERE id = ?', [columnId]);

    res.json({ column: updated });
  } catch (err) {
    console.error('Update column error:', err);
    res.status(500).json({ error: 'Failed to update column.' });
  }
});

// Reorder Columns
router.put('/reorder/all', authenticateToken, async (req, res) => {
  try {
    const { project_id, column_ids } = req.body;

    if (!project_id || !Array.isArray(column_ids)) {
      return res.status(400).json({ error: 'Project ID and column_ids array are required.' });
    }

    const member = await db.get(
      'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
      [project_id, req.user.id]
    );
    if (!member || member.role === 'Viewer') {
      return res.status(403).json({ error: 'Insufficient permissions.' });
    }

    for (let i = 0; i < column_ids.length; i++) {
      await db.run('UPDATE columns SET order_index = ? WHERE id = ? AND project_id = ?', [i, column_ids[i], project_id]);
    }

    res.json({ message: 'Columns reordered successfully.' });
  } catch (err) {
    console.error('Reorder columns error:', err);
    res.status(500).json({ error: 'Failed to reorder columns.' });
  }
});

// Delete Column (with options to delete or move tasks)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const columnId = req.params.id;
    const column = await db.get('SELECT * FROM columns WHERE id = ?', [columnId]);
    if (!column) {
      return res.status(404).json({ error: 'Column not found.' });
    }

    const member = await db.get(
      'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
      [column.project_id, req.user.id]
    );
    if (!member || !['Owner', 'Admin'].includes(member.role)) {
      return res.status(403).json({ error: 'Only Owners and Admins can delete columns.' });
    }

    // Delete tasks or cascade
    await db.run('DELETE FROM tasks WHERE column_id = ?', [columnId]);
    await db.run('DELETE FROM columns WHERE id = ?', [columnId]);

    // Activity Log
    await db.run(
      `INSERT INTO activity_logs (project_id, user_id, action, details) VALUES (?, ?, 'deleted_column', ?)`,
      [column.project_id, req.user.id, `Deleted column "${column.name}"`]
    );

    res.json({ message: 'Column deleted successfully.' });
  } catch (err) {
    console.error('Delete column error:', err);
    res.status(500).json({ error: 'Failed to delete column.' });
  }
});

module.exports = router;
