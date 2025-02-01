import pg from 'pg';
const { Pool } = pg;

const jokes = [
  { setup: 'What did the container say to the other container?', punchline: 'You are always so full of yourself!' },
  { setup: 'Why did the container go to the party?', punchline: 'Because it was a great way to package itself!' },
  { setup: 'What do you call a container that is always making jokes?', punchline: 'A box of laughs!' },
  { setup: 'Why did the container fail at school?', punchline: 'It just couldn\'t contain its excitement for the next subject!' },
  { setup: 'What do you call a container that loves to sing?', punchline: 'A note-worthy box!' },
  { setup: 'Why did the container always get invited to the cookouts?', punchline: 'Because it was great at keeping things fresh!' },
  { setup: 'Why was the container so good at math?', punchline: 'It was always able to compute what it contained!' },
  { setup: 'What\'s a container\'s favorite type of music?', punchline: 'Anything with a good track record!' },
  { setup: 'Why was the container nervous?', punchline: 'Because it was worried it would be shipped off!' },
  { setup: 'What did the box say to the bottle?', punchline: 'You always seem to have things bottled up!' },
  { setup: 'Why did the container join the gym?', punchline: 'To get some solid exercise!' },
  { setup: 'Why did the container break up with the jar?', punchline: 'Because it couldn’t handle the pressure!' },
  { setup: 'What did one container say to the other on a road trip?', punchline: 'I think we\'re going to need more storage space!' },
  { setup: 'What\'s a container\'s favorite exercise?', punchline: 'Stacking!' },
  { setup: 'Why was the container so calm?', punchline: 'It knew how to keep its contents cool.' },
  { setup: 'How do containers handle stress?', punchline: 'They contain themselves!' },
  { setup: 'What did the container say at the comedy club?', punchline: 'I\'m just here to contain the laughs!' },
  { setup: 'Why didn\'t the container go to the beach?', punchline: 'It didn\'t want to get too packed!' },
  { setup: 'What\'s a container\'s favorite board game?', punchline: 'Clue — they love solving the mystery of what\'s inside!' },
  { setup: 'What\'s the container\'s favorite type of holiday?', punchline: 'Shipping day!' },
  { setup: 'Why did the container get a promotion?', punchline: 'Because it was always packed with potential!' },
  { setup: 'Why did the container bring a flashlight?', punchline: 'It didn\'t want to get lost in storage!' },
  { setup: 'What do you call a container with great fashion?', punchline: 'A stylish storage solution!' },
  { setup: 'Why was the container so good at solving puzzles?', punchline: 'It had a knack for fitting things together!' },
  { setup: 'What did the container say to the delivery truck?', punchline: 'Let\'s roll, I\'ve got stuff to do!' },
  { setup: 'What\'s a container\'s favorite TV show?', punchline: 'Storage Wars!' },
  { setup: 'Why do containers make terrible secret agents?', punchline: 'Because they\'re always leaking information!' },
  { setup: 'What did the container say after a workout?', punchline: 'I\'m feeling boxed out!' },
  { setup: 'Why did the container feel so successful?', punchline: 'It always knew how to package itself for success!' },
  { setup: 'What do containers talk about at parties?', punchline: 'The best ways to store their secrets!' },
  { setup: 'Why did the container refuse to leave the store?', punchline: 'It was afraid of being shipped out!' },
  { setup: 'Why did the container bring a ladder to work?', punchline: 'To elevate its storage game!' },
  { setup: 'What did the container say to its owner?', punchline: 'I\'ll hold your stuff, but you\'ve got to fill me up first!' },
  { setup: 'Why are containers so good at keeping things together?', punchline: 'Because they always know how to wrap things up!' },
  { setup: 'Why didn\'t the container like to travel?', punchline: 'It felt too boxed in!' },
  { setup: 'What\'s a container\'s favorite social media app?', punchline: 'Snapchat — because it loves sending boxed messages!' },
  { setup: 'Why did the container start a podcast?', punchline: 'To give listeners something to unbox!' },
  { setup: 'How do containers send messages?', punchline: 'They box up their thoughts and ship them out!' },
  { setup: 'Why did the container go to the bar?', punchline: 'It needed to pop open a good drink!' },
  { setup: 'What do you call a container that\'s always worried?', punchline: 'A nervous nelly — it\'s always stressing about being packed too tight!' },
  { setup: 'Why did the container love science class?', punchline: 'Because it was great at containing the facts!' },
  { setup: 'What did the container say to the fragile box?', punchline: 'Take it easy, we\'re in this together!' },
  { setup: 'What\'s a container\'s favorite hobby?', punchline: 'Organizing its thoughts!' },
  { setup: 'Why do containers make great team players?', punchline: 'They know how to pack everything in a coordinated way!' },
  { setup: 'Why did the container take a nap?', punchline: 'It needed a little rest after a long day of being filled!' },
  { setup: 'What do you call a lazy container?', punchline: 'A couch potato — it just sits there, doing nothing!' },
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