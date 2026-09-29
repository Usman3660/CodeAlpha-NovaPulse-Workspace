const rateLimit = require('express-rate-limit');
const validator = require('validator');

// Rate Limiter for Auth Routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max 100 requests per 15 minutes per IP
  message: { error: 'Too many authentication attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// General API Rate Limiter
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 300, // Max 300 requests per minute
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Sanitization helper to escape HTML tags to prevent XSS
function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return validator.escape(str.trim());
}

// Strip dangerous control characters and trim
function cleanInput(str) {
  if (typeof str !== 'string') return '';
  return validator.stripLow(str.trim());
}

// Validate email format
function isValidEmail(email) {
  return typeof email === 'string' && validator.isEmail(email);
}

module.exports = {
  authLimiter,
  apiLimiter,
  sanitizeString,
  cleanInput,
  isValidEmail
};
