const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db/database');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');
const { authLimiter, sanitizeString, cleanInput, isValidEmail } = require('../middleware/security');

// Generate JWT helper
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// User Registration
router.post('/register', authLimiter, async (req, res) => {
  try {
    let { name, email, password, role, bio, color } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    name = cleanInput(name);
    email = email.trim().toLowerCase();

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    // Check if user already exists
    const existing = await db.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Default avatars using stylish UI dicebear or unsplash
    const avatar = req.body.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`;
    const userRole = cleanInput(role || 'Product Designer');
    const userBio = cleanInput(bio || '');
    const userColor = color || '#8b5cf6';

    const result = await db.run(
      `INSERT INTO users (name, email, password_hash, avatar, role, bio, color)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, email, password_hash, avatar, userRole, userBio, userColor]
    );

    const newUser = await db.get('SELECT id, name, email, avatar, role, bio, color FROM users WHERE id = ?', [result.lastID]);

    // Automatically create a default welcome project for the new user
    const inviteCode = 'NOVA-' + Math.floor(1000 + Math.random() * 9000);
    const projResult = await db.run(
      `INSERT INTO projects (name, description, color, icon, owner_id, invite_code)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['My First Workspace', 'Welcome to NovaPulse! Start managing your team tasks and projects here.', '#8b5cf6', 'sparkles', newUser.id, inviteCode]
    );

    await db.run(
      `INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'Owner')`,
      [projResult.lastID, newUser.id]
    );

    // Create default starter columns
    const col1 = await db.run(`INSERT INTO columns (project_id, name, order_index, color) VALUES (?, 'To Do', 0, '#6366f1')`, [projResult.lastID]);
    const col2 = await db.run(`INSERT INTO columns (project_id, name, order_index, color) VALUES (?, 'In Progress', 1, '#f59e0b')`, [projResult.lastID]);
    const col3 = await db.run(`INSERT INTO columns (project_id, name, order_index, color) VALUES (?, 'Done', 2, '#10b981')`, [projResult.lastID]);

    // Starter task
    const defaultDueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const startTask = await db.run(
      `INSERT INTO tasks (project_id, column_id, title, description, priority, due_date, order_index, created_by, cover_color)
       VALUES (?, ?, 'Explore NovaPulse 3D Features & Boards', 'Try dragging this card to In Progress or Done, adding a comment, or inviting team members!', 'high', ?, 0, ?, '#8b5cf6')`,
      [projResult.lastID, col1.lastID, defaultDueDate, newUser.id]
    );
    await db.run(`INSERT INTO task_assignees (task_id, user_id) VALUES (?, ?)`, [startTask.lastID, newUser.id]);
    await db.run(`INSERT INTO subtasks (task_id, title, is_completed, order_index) VALUES (?, 'Test 3D Card Tilt', 1, 0), (?, 'Add a subtask', 0, 1)`, [startTask.lastID, startTask.lastID]);

    const token = generateToken(newUser);

    res.status(201).json({
      message: 'Account created successfully!',
      token,
      user: newUser
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Failed to create account.' });
  }
});

// User Login
router.post('/login', authLimiter, async (req, res) => {
  try {
    let { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    email = email.trim().toLowerCase();

    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      bio: user.bio,
      color: user.color
    };

    const token = generateToken(userData);

    res.json({
      message: 'Logged in successfully!',
      token,
      user: userData
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Failed to authenticate user.' });
  }
});

// Quick Demo Login (allows instant testing as different team members)
router.post('/demo-login', async (req, res) => {
  try {
    const { email } = req.body;
    const targetEmail = email ? email.trim().toLowerCase() : 'usman@example.com';

    const user = await db.get('SELECT id, name, email, avatar, role, bio, color FROM users WHERE email = ?', [targetEmail]);
    if (!user) {
      return res.status(404).json({ error: 'Demo user not found.' });
    }

    const token = generateToken(user);

    res.json({
      message: `Switched to demo account: ${user.name}`,
      token,
      user
    });
  } catch (err) {
    console.error('Demo login error:', err);
    res.status(500).json({ error: 'Failed to switch demo account.' });
  }
});

// Get Current Logged-in User
router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// Update Profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    let { name, avatar, role, bio, color } = req.body;

    name = name ? cleanInput(name) : req.user.name;
    avatar = (avatar !== undefined && avatar !== null && avatar.trim() !== '') ? avatar.trim() : req.user.avatar;
    role = role !== undefined ? cleanInput(role) : (req.user.role || '');
    bio = bio !== undefined ? cleanInput(bio) : (req.user.bio || '');
    color = color || req.user.color || '#f06a6a';

    await db.run(
      `UPDATE users SET name = ?, avatar = ?, role = ?, bio = ?, color = ? WHERE id = ?`,
      [name, avatar, role, bio, color, req.user.id]
    );

    const updatedUser = await db.get(
      'SELECT id, name, email, avatar, role, bio, color FROM users WHERE id = ?',
      [req.user.id]
    );

    res.json({
      message: 'Profile updated successfully!',
      user: updatedUser
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// List all system users (for assignee selectors)
router.get('/users', authenticateToken, async (req, res) => {
  try {
    const users = await db.all('SELECT id, name, email, avatar, role, color FROM users ORDER BY name ASC');
    res.json({ users });
  } catch (err) {
    console.error('Fetch users error:', err);
    res.status(500).json({ error: 'Failed to fetch team users.' });
  }
});

module.exports = router;
