import { useState, useMemo } from 'react';

const GENRES = ['All', 'Sci-Fi', 'Action', 'Drama', 'Crime', 'Animation', 'Adventure', 'Biography'];

export default function MoviesSection({ movies, loading, onSelectMovie, onOpenDetail }) {
  const [activeGenre, setActiveGenre] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMovies = useMemo(() => {
    return movies.filter(movie => {
      const matchesGenre = activeGenre === 'All' || movie.genre.toLowerCase().includes(activeGenre.toLowerCase());
      const query = searchQuery.toLowerCase().trim();
      const matchesQuery = !query || 
        movie.title.toLowerCase().includes(query) || 
        movie.director.toLowerCase().includes(query) ||
        movie.genre.toLowerCase().includes(query);
      return matchesGenre && matchesQuery;
    });
  }, [movies, activeGenre, searchQuery]);

  return (
    <section className="section" id="movies-showcase">
      <div className="container">
        <div className="section-header">
          <div className="badge-pill">🎬 Explore Movies</div>
          <h2 className="section-title">Trending &amp; Classic Films</h2>
          <p className="section-sub">
            Browse iconic cinema, inspect real-time AI sentiment scores, or select any movie to submit your review!
          </p>
        </div>

        {/* Search & Genre Controls */}
        <div className="movies-toolbar">
          <div className="movies-search-wrap">
            <span className="search-icon" aria-hidden="true">🔍</span>
            <input
              type="text"
              className="movies-search-input"
              placeholder="Search by title, director, or genre..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              aria-label="Search movies"
            />
            {searchQuery && (
              <button 
                className="search-clear-btn" 
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <div className="genre-pill-group" role="tablist" aria-label="Filter by genre">
            {GENRES.map(genre => (
              <button
                key={genre}
                className={`genre-pill ${activeGenre === genre ? 'active' : ''}`}
                onClick={() => setActiveGenre(genre)}
                role="tab"
                aria-selected={activeGenre === genre}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>

        {/* Movies Grid */}
        {loading ? (
          <div className="loading-placeholder">
            <div className="spinner-lg" />
            <p>Loading curated movie collection...</p>
          </div>
        ) : filteredMovies.length === 0 ? (
          <div className="empty-state">
            <p>🎞️</p>
            <p>No movies match &quot;{searchQuery}&quot; in {activeGenre}.</p>
            <button 
              className="btn-refresh" 
              onClick={() => { setActiveGenre('All'); setSearchQuery(''); }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="movies-grid" id="movies-grid">
            {filteredMovies.map(movie => {
              const posPct = movie.positive_pct != null 
                ? movie.positive_pct 
                : (movie.total_reviews > 0 ? Math.round((movie.positive_reviews / movie.total_reviews) * 100) : null);

              return (
                <div key={movie.id} className="movie-card glass-card">
                  <div className="movie-poster-container" onClick={() => onOpenDetail(movie)}>
                    <img
                      src={movie.poster_url}
                      alt={movie.title}
                      className="movie-poster-img"
                      loading="lazy"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                    <div className="poster-fallback" style={{ display: 'none' }}>
                      <span className="fallback-icon">🎬</span>
                      <span className="fallback-title">{movie.title}</span>
                    </div>

                    <div className="poster-gradient-scrim" />

                    <div className="poster-floating-badges">
                      <span className="imdb-pill">★ {movie.rating_imdb || 'N/A'}</span>
                      <span className="year-pill">{movie.year}</span>
                    </div>

                    <div className="poster-hover-overlay">
                      <span className="quick-view-badge">View Synopsis &amp; Reviews ↗</span>
                    </div>
                  </div>

                  <div className="movie-card-info">
                    <div className="movie-genre-row">
                      <span className="movie-genre-tag">{movie.genre.split('/')[0].trim()}</span>
                      <span className="movie-director-tag">{movie.director}</span>
                    </div>

                    <h3 className="movie-card-title" title={movie.title} onClick={() => onOpenDetail(movie)}>
                      {movie.title}
                    </h3>

                    {/* Sentiment Consensus Pill */}
                    <div className="sentiment-consensus-box">
                      {posPct !== null ? (
                        <>
                          <div className="consensus-top">
                            <span className={`consensus-sentiment-text ${posPct >= 50 ? 'pos' : 'neg'}`}>
                              {posPct >= 50 ? '😍' : '😤'} {posPct}% Positive
                            </span>
                            <span className="consensus-count">
                              {movie.total_reviews} {movie.total_reviews === 1 ? 'review' : 'reviews'}
                            </span>
                          </div>
                          <div className="consensus-mini-bar">
                            <div className="consensus-bar-pos" style={{ width: `${posPct}%` }} />
                            <div className="consensus-bar-neg" style={{ width: `${100 - posPct}%` }} />
                          </div>
                        </>
                      ) : (
                        <div className="consensus-unreviewed">
                          <span>✨ Be the first to review</span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="movie-card-actions">
                      <button
                        className="btn-card-review"
                        onClick={() => onSelectMovie(movie)}
                        title={`Write a review for ${movie.title}`}
                      >
                        <span className="btn-icon">✍️</span> Review
                      </button>
                      <button
                        className="btn-card-details"
                        onClick={() => onOpenDetail(movie)}
                        title="View details and existing reviews"
                      >
                        Details
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
