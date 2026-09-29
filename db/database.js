const path = require('path');
const bcrypt = require('bcryptjs');

let isPostgres = false;
let pool = null;
let rawSqlite = null;

// Determine connection mode from environment
const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (connectionString && connectionString.trim() !== '') {
  isPostgres = true;
  const { Pool } = require('pg');
  
  // Supabase PostgreSQL Pool config
  pool = new Pool({
    connectionString: connectionString.trim(),
    ssl: {
      rejectUnauthorized: false // Enables SSL connection for Supabase cloud
    },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 6000
  });

  pool.on('error', (err) => {
    console.error('Unexpected error on idle Supabase PostgreSQL client:', err);
  });
}

function initSqliteInstance() {
  if (!rawSqlite) {
    const sqlite3 = require('sqlite3').verbose();
    const dbPath = path.join(__dirname, 'novapulse.sqlite');
    rawSqlite = new sqlite3.Database(dbPath);
    rawSqlite.serialize(() => {
      rawSqlite.run('PRAGMA foreign_keys = ON');
    });
  }
}

// Convert SQLite parameterized query to PostgreSQL parameterized query
function translateQuery(sql, isRun = false) {
  if (!isPostgres) return { sql };

  let convertedSql = sql;

  // Convert INSERT OR IGNORE -> INSERT ... ON CONFLICT DO NOTHING
  convertedSql = convertedSql.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO');
  if (/INSERT\s+INTO\s+task_assignees/gi.test(sql) || /INSERT\s+INTO\s+project_members/gi.test(sql)) {
    if (!/ON\s+CONFLICT/gi.test(convertedSql)) {
      convertedSql = convertedSql + ' ON CONFLICT DO NOTHING';
    }
  }

  // Convert date('now', '+X days') / date('now', '-X days')
  convertedSql = convertedSql.replace(/date\('now',\s*'\+(\d+)\s*days'\)/gi, "(CURRENT_DATE + INTERVAL '$1 days')");
  convertedSql = convertedSql.replace(/date\('now',\s*'-(\d+)\s*days'\)/gi, "(CURRENT_DATE - INTERVAL '$1 days')");
  convertedSql = convertedSql.replace(/date\('now'\)/gi, "CURRENT_DATE");

  // Replace ? placeholders with $1, $2, $3...
  let paramIndex = 1;
  convertedSql = convertedSql.replace(/\?/g, () => `$${paramIndex++}`);

  // For INSERT operations in PostgreSQL, append RETURNING id if not already present
  if (isRun && /^\s*INSERT\s+INTO/i.test(convertedSql) && !/RETURNING/i.test(convertedSql)) {
    if (!/INSERT\s+INTO\s+task_assignees/i.test(convertedSql)) {
      convertedSql += ' RETURNING id';
    }
  }

  return { sql: convertedSql };
}

// Universal database interface
const db = {
  isPostgres: () => isPostgres,

  get: async (sql, params = []) => {
    if (isPostgres) {
      const { sql: psql } = translateQuery(sql, false);
      const res = await pool.query(psql, params);
      return res.rows[0] || null;
    } else {
      initSqliteInstance();
      return new Promise((resolve, reject) => {
        rawSqlite.get(sql, params, (err, row) => {
          if (err) reject(err);
          else resolve(row || null);
        });
      });
    }
  },

  all: async (sql, params = []) => {
    if (isPostgres) {
      const { sql: psql } = translateQuery(sql, false);
      const res = await pool.query(psql, params);
      return res.rows || [];
    } else {
      initSqliteInstance();
      return new Promise((resolve, reject) => {
        rawSqlite.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });
    }
  },

  run: async (sql, params = []) => {
    if (isPostgres) {
      const { sql: psql } = translateQuery(sql, true);
      const res = await pool.query(psql, params);
      const lastID = res.rows && res.rows[0] && res.rows[0].id ? res.rows[0].id : null;
      return { lastID, changes: res.rowCount };
    } else {
      initSqliteInstance();
      return new Promise((resolve, reject) => {
        rawSqlite.run(sql, params, function (err) {
          if (err) reject(err);
          else resolve({ lastID: this.lastID, changes: this.changes });
        });
      });
    }
  },

  exec: async (sql) => {
    if (isPostgres) {
      await pool.query(sql);
    } else {
      initSqliteInstance();
      return new Promise((resolve, reject) => {
        rawSqlite.exec(sql, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }
};

async function initDatabase() {
  if (isPostgres && pool) {
    try {
      // Test Supabase PostgreSQL connection
      await pool.query('SELECT 1');
      console.log('⚡ Database: Connected to Supabase (PostgreSQL Cloud Engine)');

      // Create PostgreSQL / Supabase Schema
      await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          avatar TEXT,
          role VARCHAR(100) DEFAULT 'Member',
          bio TEXT DEFAULT '',
          color VARCHAR(50) DEFAULT '#8b5cf6',
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS projects (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT DEFAULT '',
          color VARCHAR(50) DEFAULT '#6366f1',
          icon VARCHAR(50) DEFAULT 'folder-kanban',
          owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          invite_code VARCHAR(50) UNIQUE NOT NULL,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS project_members (
          id SERIAL PRIMARY KEY,
          project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role VARCHAR(50) DEFAULT 'Member',
          joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT uq_project_member UNIQUE (project_id, user_id)
        );

        CREATE TABLE IF NOT EXISTS columns (
          id SERIAL PRIMARY KEY,
          project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          order_index INTEGER NOT NULL DEFAULT 0,
          color VARCHAR(50) DEFAULT '#8b5cf6',
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS tasks (
          id SERIAL PRIMARY KEY,
          project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          column_id INTEGER NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
          title VARCHAR(500) NOT NULL,
          description TEXT DEFAULT '',
          priority VARCHAR(50) DEFAULT 'medium',
          due_date DATE,
          order_index INTEGER NOT NULL DEFAULT 0,
          created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          cover_color VARCHAR(50) DEFAULT '',
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS task_assignees (
          task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          assigned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (task_id, user_id)
        );

        CREATE TABLE IF NOT EXISTS task_tags (
          id SERIAL PRIMARY KEY,
          task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          name VARCHAR(100) NOT NULL,
          color VARCHAR(50) DEFAULT '#8b5cf6'
        );

        CREATE TABLE IF NOT EXISTS subtasks (
          id SERIAL PRIMARY KEY,
          task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          title VARCHAR(500) NOT NULL,
          is_completed INTEGER DEFAULT 0,
          order_index INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS comments (
          id SERIAL PRIMARY KEY,
          task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          reactions JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS notifications (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type VARCHAR(100) NOT NULL,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          project_id INTEGER,
          task_id INTEGER,
          is_read INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS activity_logs (
          id SERIAL PRIMARY KEY,
          project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          task_id INTEGER,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          action VARCHAR(100) NOT NULL,
          details TEXT DEFAULT '',
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Check if seed data is needed
      const userCountRes = await db.get('SELECT COUNT(*) as count FROM users');
      const count = userCountRes ? parseInt(userCountRes.count, 10) : 0;
      if (count === 0) {
        await seedDemoData();
      } else {
        await db.run(`UPDATE users SET name = 'Usman', email = 'usman@example.com' WHERE email = 'alex@example.com' OR name = 'Alex Rivera'`);
        await db.run(`UPDATE users SET name = 'Ali', email = 'ali@example.com' WHERE email = 'sarah@example.com' OR name = 'Sarah Chen'`);
        await db.run(`UPDATE users SET name = 'Ahmad', email = 'ahmad@example.com' WHERE email = 'marcus@example.com' OR name = 'Marcus Vance'`);
      }
      return;
    } catch (err) {
      console.warn('⚠️  Could not reach Supabase PostgreSQL host (' + err.message + ').');
      console.warn('💡 Tip: Supabase direct connection (port 5432) is IPv6-only. If on an IPv4 network, use the Supabase Connection Pooler URI (port 6543) from Supabase Dashboard > Project Settings > Database.');
      console.log('⚡ Gracefully falling back to Local SQLite Engine so the workspace stays online...');
      isPostgres = false;
    }
  }

  // SQLite Schema Creation & Initialization
  initSqliteInstance();
  console.log('⚡ Database: Running on Local SQLite Engine');

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      avatar TEXT,
      role TEXT DEFAULT 'Member',
      bio TEXT DEFAULT '',
      color TEXT DEFAULT '#8b5cf6',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      color TEXT DEFAULT '#6366f1',
      icon TEXT DEFAULT 'folder-kanban',
      owner_id INTEGER NOT NULL,
      invite_code TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT DEFAULT 'Member',
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(project_id, user_id),
      FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS columns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      color TEXT DEFAULT '#8b5cf6',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      column_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      priority TEXT DEFAULT 'medium',
      due_date DATE,
      order_index INTEGER NOT NULL DEFAULT 0,
      created_by INTEGER NOT NULL,
      cover_color TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
      FOREIGN KEY (column_id) REFERENCES columns (id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS task_assignees (
      task_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (task_id, user_id),
      FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS task_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#8b5cf6',
      FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS subtasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      is_completed INTEGER DEFAULT 0,
      order_index INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      reactions TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      project_id INTEGER,
      task_id INTEGER,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      task_id INTEGER,
      user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      details TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
  `);

  // Check if seed data is needed
  const userCountRes = await db.get('SELECT COUNT(*) as count FROM users');
  const count = userCountRes ? parseInt(userCountRes.count, 10) : 0;
  if (count === 0) {
    await seedDemoData();
  } else {
    await db.run(`UPDATE users SET name = 'Usman', email = 'usman@example.com' WHERE email = 'alex@example.com' OR name = 'Alex Rivera'`);
    await db.run(`UPDATE users SET name = 'Ali', email = 'ali@example.com' WHERE email = 'sarah@example.com' OR name = 'Sarah Chen'`);
    await db.run(`UPDATE users SET name = 'Ahmad', email = 'ahmad@example.com' WHERE email = 'marcus@example.com' OR name = 'Marcus Vance'`);
  }
}

async function seedDemoData() {
  console.log('Seeding demo data (Usman, Ali, Ahmad)...');
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('password123', salt);

  // 1. Create Demo Users
  const user1 = await db.run(
    `INSERT INTO users (name, email, password_hash, avatar, role, bio, color)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['Usman', 'usman@example.com', passwordHash, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', 'Product Lead', 'Passionate about seamless product experiences and design systems.', '#6366f1']
  );

  const user2 = await db.run(
    `INSERT INTO users (name, email, password_hash, avatar, role, bio, color)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['Ali', 'ali@example.com', passwordHash, 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80', 'Full Stack Engineer', 'Building robust APIs and smooth WebGL interfaces.', '#ec4899']
  );

  const user3 = await db.run(
    `INSERT INTO users (name, email, password_hash, avatar, role, bio, color)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['Ahmad', 'ahmad@example.com', passwordHash, 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80', 'UI/UX Designer', 'Crafting spatial interfaces and fluid micro-interactions.', '#10b981']
  );

  // 2. Create Projects
  const proj1 = await db.run(
    `INSERT INTO projects (name, description, color, icon, owner_id, invite_code)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ['NovaPulse Web App 2.0', 'Re-architecting our real-time collaboration suite with 3D canvas and spatial kanban boards.', '#8b5cf6', 'sparkles', user1.lastID, 'NOVA-8821']
  );

  const proj2 = await db.run(
    `INSERT INTO projects (name, description, color, icon, owner_id, invite_code)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ['Brand Identity & 3D Assets', 'Designing the futuristic brand guide, 3D icon sets, and interactive design system.', '#ec4899', 'palette', user3.lastID, 'BRAND-4402']
  );

  // 3. Add Members to Projects
  for (const uid of [user1.lastID, user2.lastID, user3.lastID]) {
    await db.run(
      `INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)`,
      [proj1.lastID, uid, uid === user1.lastID ? 'Owner' : (uid === user2.lastID ? 'Admin' : 'Member')]
    );
  }

  for (const uid of [user3.lastID, user1.lastID, user2.lastID]) {
    await db.run(
      `INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)`,
      [proj2.lastID, uid, uid === user3.lastID ? 'Owner' : 'Member']
    );
  }

  // 4. Create Columns for Project 1
  const colBacklog = await db.run(`INSERT INTO columns (project_id, name, order_index, color) VALUES (?, ?, ?, ?)`, [proj1.lastID, 'Backlog', 0, '#64748b']);
  const colTodo = await db.run(`INSERT INTO columns (project_id, name, order_index, color) VALUES (?, ?, ?, ?)`, [proj1.lastID, 'To Do', 1, '#6366f1']);
  const colProgress = await db.run(`INSERT INTO columns (project_id, name, order_index, color) VALUES (?, ?, ?, ?)`, [proj1.lastID, 'In Progress', 2, '#f59e0b']);
  const colReview = await db.run(`INSERT INTO columns (project_id, name, order_index, color) VALUES (?, ?, ?, ?)`, [proj1.lastID, 'In Review', 3, '#ec4899']);
  const colDone = await db.run(`INSERT INTO columns (project_id, name, order_index, color) VALUES (?, ?, ?, ?)`, [proj1.lastID, 'Done', 4, '#10b981']);

  const getIsoDate = (offsetDays) => new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // 5. Create Sample Tasks for Project 1
  // Task 1: In Progress
  const t1 = await db.run(
    `INSERT INTO tasks (project_id, column_id, title, description, priority, due_date, order_index, created_by, cover_color)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [proj1.lastID, colProgress.lastID, 'Implement WebGL 3D Hologram Hero and Ambient Particles', 'Integrate Three.js background with interactive pointer parallax, floating crystalline polyhedrons, and glowing dynamic lights.', 'urgent', getIsoDate(2), user1.lastID, '#8b5cf6']
  );
  await db.run(`INSERT INTO task_assignees (task_id, user_id) VALUES (?, ?)`, [t1.lastID, user2.lastID]);
  await db.run(`INSERT INTO task_assignees (task_id, user_id) VALUES (?, ?)`, [t1.lastID, user3.lastID]);
  await db.run(`INSERT INTO task_tags (task_id, name, color) VALUES (?, ?, ?)`, [t1.lastID, 'Frontend', '#8b5cf6']);
  await db.run(`INSERT INTO task_tags (task_id, name, color) VALUES (?, ?, ?)`, [t1.lastID, '3D Effects', '#ec4899']);
  await db.run(`INSERT INTO subtasks (task_id, title, is_completed, order_index) VALUES (?, ?, 1, 0)`, [t1.lastID, 'Setup Three.js scene and lighting']);
  await db.run(`INSERT INTO subtasks (task_id, title, is_completed, order_index) VALUES (?, ?, 1, 1)`, [t1.lastID, 'Create floating geometric particle meshes']);
  await db.run(`INSERT INTO subtasks (task_id, title, is_completed, order_index) VALUES (?, ?, 0, 2)`, [t1.lastID, 'Add mouse raycaster parallax physics']);
  await db.run(`INSERT INTO comments (task_id, user_id, content, reactions) VALUES (?, ?, ?, ?)`, [
    t1.lastID, user2.lastID, 'The 3D floating orb physics is running super smooth at 60 FPS! Tested on both Chrome and Safari.',
    JSON.stringify({ '🚀': [user1.lastID, user3.lastID], '🔥': [user1.lastID] })
  ]);
  await db.run(`INSERT INTO comments (task_id, user_id, content, reactions) VALUES (?, ?, ?, ?)`, [
    t1.lastID, user1.lastID, 'Looks incredible! Make sure to add the card tilt specular glow too.',
    JSON.stringify({ '✨': [user2.lastID] })
  ]);

  // Task 2: To Do
  const t2 = await db.run(
    `INSERT INTO tasks (project_id, column_id, title, description, priority, due_date, order_index, created_by, cover_color)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [proj1.lastID, colTodo.lastID, 'WebSocket Real-Time Multi-User Card Synchronization', 'Broadcast card drag-and-drop movements, new task creations, and column edits to all active board participants via Socket.IO rooms.', 'high', getIsoDate(4), user1.lastID, '#6366f1']
  );
  await db.run(`INSERT INTO task_assignees (task_id, user_id) VALUES (?, ?)`, [t2.lastID, user2.lastID]);
  await db.run(`INSERT INTO task_tags (task_id, name, color) VALUES (?, ?, ?)`, [t2.lastID, 'Backend', '#3b82f6']);
  await db.run(`INSERT INTO task_tags (task_id, name, color) VALUES (?, ?, ?)`, [t2.lastID, 'WebSockets', '#06b6d4']);
  await db.run(`INSERT INTO subtasks (task_id, title, is_completed, order_index) VALUES (?, ?, 1, 0)`, [t2.lastID, 'Define room event channels per project ID']);
  await db.run(`INSERT INTO subtasks (task_id, title, is_completed, order_index) VALUES (?, ?, 0, 1)`, [t2.lastID, 'Handle optimistic UI updates on card drop']);

  // Task 3: In Review
  const t3 = await db.run(
    `INSERT INTO tasks (project_id, column_id, title, description, priority, due_date, order_index, created_by, cover_color)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [proj1.lastID, colReview.lastID, 'Security Audit: Helmet Headers, Rate Limiting & Input Sanitization', 'Verify robust XSS protection, bcrypt password hashing with salt rounds, SQL parameterization, and JWT expiry verification.', 'high', getIsoDate(1), user2.lastID, '#10b981']
  );
  await db.run(`INSERT INTO task_assignees (task_id, user_id) VALUES (?, ?)`, [t3.lastID, user3.lastID]);
  await db.run(`INSERT INTO task_tags (task_id, name, color) VALUES (?, ?, ?)`, [t3.lastID, 'Security', '#10b981']);
  await db.run(`INSERT INTO subtasks (task_id, title, is_completed, order_index) VALUES (?, ?, 1, 0)`, [t3.lastID, 'Configure Helmet Content Security Policies']);
  await db.run(`INSERT INTO subtasks (task_id, title, is_completed, order_index) VALUES (?, ?, 1, 1)`, [t3.lastID, 'Add express-rate-limit to auth endpoints']);
  await db.run(`INSERT INTO subtasks (task_id, title, is_completed, order_index) VALUES (?, ?, 1, 2)`, [t3.lastID, 'Sanitize user markdown comments']);

  // Task 4: Done
  const t4 = await db.run(
    `INSERT INTO tasks (project_id, column_id, title, description, priority, due_date, order_index, created_by, cover_color)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [proj1.lastID, colDone.lastID, 'Design System Tokens & Vibrant Theme Palette', 'Establish modern Asana light palette, cyber violet accents, and crisp cards.', 'medium', getIsoDate(-1), user3.lastID, '#ec4899']
  );
  await db.run(`INSERT INTO task_assignees (task_id, user_id) VALUES (?, ?)`, [t4.lastID, user3.lastID]);
  await db.run(`INSERT INTO task_tags (task_id, name, color) VALUES (?, ?, ?)`, [t4.lastID, 'Design', '#ec4899']);
  await db.run(`INSERT INTO subtasks (task_id, title, is_completed, order_index) VALUES (?, ?, 1, 0)`, [t4.lastID, 'Define CSS custom properties in asana.css']);
  await db.run(`INSERT INTO subtasks (task_id, title, is_completed, order_index) VALUES (?, ?, 1, 1)`, [t4.lastID, 'Add micro-animations and smooth spring transitions']);

  // Task 5: Backlog
  const t5 = await db.run(
    `INSERT INTO tasks (project_id, column_id, title, description, priority, due_date, order_index, created_by, cover_color)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [proj1.lastID, colBacklog.lastID, 'Export Project Board to PDF & Markdown Report', 'Allow managers to export board summary, task completion statistics, and member workload reports with one click.', 'low', getIsoDate(7), user1.lastID, '#64748b']
  );
  await db.run(`INSERT INTO task_assignees (task_id, user_id) VALUES (?, ?)`, [t5.lastID, user1.lastID]);
  await db.run(`INSERT INTO task_tags (task_id, name, color) VALUES (?, ?, ?)`, [t5.lastID, 'Feature', '#6366f1']);

  // Notifications
  await db.run(
    `INSERT INTO notifications (user_id, type, title, message, project_id, task_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [user1.lastID, 'task_assigned', 'Task Assigned', 'You were assigned to "Implement WebGL 3D Hologram Hero".', proj1.lastID, t1.lastID]
  );
  await db.run(
    `INSERT INTO notifications (user_id, type, title, message, project_id, task_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [user1.lastID, 'comment_added', 'New Comment', 'Ali commented on "Implement WebGL 3D Hologram Hero".', proj1.lastID, t1.lastID]
  );

  // Activity Log
  await db.run(
    `INSERT INTO activity_logs (project_id, task_id, user_id, action, details)
     VALUES (?, ?, ?, ?, ?)`,
    [proj1.lastID, t1.lastID, user2.lastID, 'moved_task', 'Moved task to "In Progress"']
  );
  await db.run(
    `INSERT INTO activity_logs (project_id, task_id, user_id, action, details)
     VALUES (?, ?, ?, ?, ?)`,
    [proj1.lastID, t4.lastID, user3.lastID, 'completed_task', 'Completed all subtasks on "Design System Tokens"']
  );

  console.log('Demo data successfully seeded.');
}

module.exports = {
  db,
  initDatabase
};
