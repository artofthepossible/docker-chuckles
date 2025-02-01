import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import pg from 'pg';
import Redis from 'ioredis';
import seedDatabase from '../db/migrations/seed.js';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Debug: Check build directory
const buildPath = path.join(__dirname, '../build');
console.log('Checking build directory:', buildPath);
if (fs.existsSync(buildPath)) {
  console.log('Build directory contents:', fs.readdirSync(buildPath));
} else {
  console.error('Build directory does not exist!');
}

// Initialize Redis client with better error handling and retry strategy
const redis = new Redis({
  host: 'redis',  // Remove the redis:// prefix
  port: 6379,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 5
});

redis.on('error', (error) => {
  console.error('Redis connection error:', error);
});

// Initialize Postgres pool
const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
});

// Serve static files from the React app
app.use(express.static(buildPath));

// API endpoints
app.get('/health', async (_, res) => {
  try {
    await redis.ping();
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'healthy' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/jokes/random', async (_, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM jokes ORDER BY RANDOM() LIMIT 1');
    if (rows[0]) {
      await pool.query('UPDATE jokes SET times_displayed = times_displayed + 1 WHERE id = $1', [rows[0].id]);
      res.json(rows[0]);
    } else {
      res.status(404).json({ error: 'No jokes found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  const indexPath = path.join(buildPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    console.error('index.html not found at:', indexPath);
    res.status(404).send('Build files not found. Please ensure the React app is built properly.');
  }
});

// Initialize services
const initializeServices = async () => {
  try {
    await redis.ping();
    console.log('Redis connected');
    
    await pool.query('SELECT 1');
    console.log('Postgres connected');
    
    await seedDatabase();
    console.log('Database initialized');
    
    app.listen(PORT, () => {
      console.log(`Server running on ${PORT}`);
      console.log('Application ready at http://localhost:3001');
    });
  } catch (error) {
    console.error('Failed to initialize services:', error);
    process.exit(1);
  }
};

initializeServices(); 