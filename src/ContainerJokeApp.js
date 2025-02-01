import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ContainerJokeApp = () => {
  const [joke, setJoke] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRandomJoke = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/jokes/random');
      setJoke(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch joke');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRandomJoke();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!joke) return null;

  return (
    <div className="container mx-auto p-4">
      <p className="text-lg font-bold mb-4">{joke.setup}</p>
      <p className="text-lg mb-4">{joke.punchline}</p>
      <button
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        onClick={fetchRandomJoke}
      >
        Next Joke
      </button>
    </div>
  );
};

export default ContainerJokeApp;