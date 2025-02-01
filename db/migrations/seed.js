import pg from 'pg';
const { Pool } = pg;

const jokes = [
  { setup: 'Why was the container sad?', punchline: 'Because it was feeling a little boxed in!' },
  { setup: 'Why did the container go to therapy?', punchline: 'Because it was struggling to contain its emotions!' },
  // ... (all other jokes)
];

async function seedDatabase() {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST,
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
  });

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS jokes (
        id SERIAL PRIMARY KEY,
        setup TEXT NOT NULL,
        punchline TEXT NOT NULL,
        times_displayed INTEGER DEFAULT 0
      );
    `);

    const { rows } = await pool.query('SELECT COUNT(*) FROM jokes');
    if (parseInt(rows[0].count) === 0) {
      await Promise.all(jokes.map(joke =>
        pool.query('INSERT INTO jokes (setup, punchline) VALUES ($1, $2)', [joke.setup, joke.punchline])
      ));
      console.log('Database seeded');
    }
  } catch (error) {
    console.error('Seeding error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

export default seedDatabase; 