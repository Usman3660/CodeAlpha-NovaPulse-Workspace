require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const { Server } = require('socket.io');

const { initDatabase } = require('./db/database');
const { initSocket } = require('./socket');
const { apiLimiter } = require('./middleware/security');

const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const columnRoutes = require('./routes/columns');
const taskRoutes = require('./routes/tasks');
const commentRoutes = require('./routes/comments');
const notificationRoutes = require('./routes/notifications');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Attach socket IO to app so routes can use it if needed
app.set('io', io);

// Security Middlewares
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
          "https://unpkg.com"
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com"
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "https://cdnjs.cloudflare.com",
          "data:"
        ],
        imgSrc: [
          "'self'",
          "data:",
          "blob:",
          "https:",
          "http:"
        ],
        connectSrc: ["'self'", "ws:", "wss:", "https:", "http:"],
        mediaSrc: ["'self'", "data:", "blob:"]
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply General Rate Limiter to all API endpoints
app.use('/api', apiLimiter);

// Serve Static Frontend Assets
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/columns', columnRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Single Page App fallback (serve index.html for unknown non-API routes)
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint not found.' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// Initialize WebSocket Engine
initSocket(io);

// Start Server
const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await initDatabase();
    server.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`  NovaPulse Collaboration Hub Server Started!`);
      console.log(`  Live at: http://localhost:${PORT}`);
      console.log(`  Ready for Real-Time 3D Board Collaboration`);
      console.log(`====================================================`);
    });
  } catch (error) {
    console.error('Failed to initialize server/database:', error);
    process.exit(1);
  }
}

start();
