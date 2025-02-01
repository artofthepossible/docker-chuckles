import { Pool } from 'pg';

const pool = new Pool({
  // Add your database configuration here
});

export async function getRandomJoke(req, res) {
  try {
    const result = await pool.query(`
      SELECT * FROM jokes 
      ORDER BY RANDOM() 
      LIMIT 1
    `);
    
    // Update times_displayed counter
    await pool.query(`
      UPDATE jokes 
      SET times_displayed = times_displayed + 1 
      WHERE id = $1
    `, [result.rows[0].id]);

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch joke' });
  }
}

// Additional endpoints
export async function getJokesByCategory(req, res) {
  // Implementation
}

export async function rateJoke(req, res) {
  // Implementation
}

export async function getFavoriteJokes(req, res) {
  // Implementation
} 