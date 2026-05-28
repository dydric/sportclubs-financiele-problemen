// Bestand: js/modules/site/debug.js

// Gebruik NODE_ENV of fallback op 'development'
const env = process.env.NODE_ENV || 'development';
export const DEBUG = env === 'development';

const recentMessages = new Map();

const shouldLog = (message, delay = 10000) => {
  const now = Date.now();
  if (!recentMessages.has(message) || now - recentMessages.get(message) > delay) {
    recentMessages.set(message, now);
    return true;
  }
  return false;
};

export const log = (message, delay = 10000, ...args) => {
  if (!DEBUG) return;
  const msg = typeof message === 'string' ? message : args.join(' ');
  if (shouldLog(msg, delay)) {
    console.log('🪵', msg);
  }
};

export const warn = (...args) => {
  if (DEBUG) console.warn('⚠️', ...args);
};

export const error = (...args) => {
  if (DEBUG) console.error('❌', ...args);
};
