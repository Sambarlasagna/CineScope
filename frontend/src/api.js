const API = '';   // same-origin via FastAPI static mount / nginx proxy

export async function fetchMovies() {
  const res = await fetch(`${API}/api/movies`);
  if (!res.ok) throw new Error('Failed to fetch movies');
  return res.json();
}

export async function fetchMovieDetail(movieId) {
  const res = await fetch(`${API}/api/movies/${movieId}`);
  if (!res.ok) throw new Error('Failed to fetch movie details');
  return res.json();
}

export async function submitReview({ review, movie_id = null, movie_title = null }) {
  const res = await fetch(`${API}/api/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      review,
      movie_id: movie_id ? Number(movie_id) : null,
      movie_title: movie_title || null,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Server error');
  return data;
}

export async function fetchStats() {
  const res = await fetch(`${API}/api/stats`);
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

export async function fetchReviews(limit = 10, offset = 0, movieId = null, sentiment = 'all') {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (movieId) params.append('movie_id', String(movieId));
  if (sentiment && sentiment !== 'all') params.append('sentiment', sentiment);

  const res = await fetch(`${API}/api/reviews?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch reviews');
  return res.json();
}
