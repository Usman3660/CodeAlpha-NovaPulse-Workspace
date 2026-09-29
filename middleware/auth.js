const jwt = require('jsonwebtoken');
const { db } = require('../db/database');

const JWT_SECRET = process.env.JWT_SECRET || 'novapulse-super-secret-key-2026-secure';

// Authenticate JWT Token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  jwt.verify(token, JWT_SECRET, async (err, userPayload) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }

    try {
      // Fetch fresh user from DB to ensure they still exist and have updated info
      const user = await db.get('SELECT id, name, email, avatar, role, bio, color FROM users WHERE id = ?', [userPayload.id]);
      if (!user) {
        return res.status(404).json({ error: 'User no longer exists.' });
      }

      req.user = user;
      next();
    } catch (dbErr) {
      console.error('Auth DB error:', dbErr);
      return res.status(500).json({ error: 'Internal server error during authentication.' });
    }
  });
}

// Middleware to check project membership & role
function requireProjectMember(minRole = 'Viewer') {
  const roleHierarchy = {
    'Viewer': 1,
    'Member': 2,
    'Admin': 3,
    'Owner': 4
  };

  return async (req, res, next) => {
    try {
      const projectId = req.params.projectId || req.params.id || req.body.project_id;
      if (!projectId) {
        return res.status(400).json({ error: 'Project ID is required.' });
      }

      // Check if project exists and user is member
      const member = await db.get(
        'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
        [projectId, req.user.id]
      );

      if (!member) {
        return res.status(403).json({ error: 'You are not a member of this project.' });
      }

      const userLevel = roleHierarchy[member.role] || 0;
      const requiredLevel = roleHierarchy[minRole] || 1;

      if (userLevel < requiredLevel) {
        return res.status(403).json({ error: `Insufficient permissions. Requires '${minRole}' role.` });
      }

      req.projectRole = member.role;
      next();
    } catch (err) {
      console.error('Project member check error:', err);
      res.status(500).json({ error: 'Failed to verify project permissions.' });
    }
  };
}

module.exports = {
  JWT_SECRET,
  authenticateToken,
  requireProjectMember
};
