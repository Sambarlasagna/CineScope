import { useState, useEffect } from 'react';
import { fetchMovieDetail } from '../api';

export default function MovieModal({ movie, onClose, onSelectForReview }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!movie) return;
    let isMounted = true;
    setLoading(true);

    fetchMovieDetail(movie.id)
      .then(data => {
        if (isMounted) {
          setDetails(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setDetails(movie);
          setLoading(false);
        }
      });

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      isMounted = false;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [movie, onClose]);

  if (!movie) return null;

  const current = details || movie;
  const reviews = current.reviews || [];
  const posPct = current.positive_pct != null ? current.positive_pct : (current.total_reviews > 0 ? Math.round((current.positive_reviews / current.total_reviews) * 100) : null);

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">✕</button>

        {current.backdrop_url && (
          <div className="modal-backdrop-hero">
            <img src={current.backdrop_url} alt="" className="modal-backdrop-img" />
            <div className="modal-backdrop-overlay" />
          </div>
        )}

        <div className="modal-body">
          <div className="modal-header-row">
            <div className="modal-poster-wrap">
              <img
                src={current.poster_url}
                alt={current.title}
                className="modal-poster"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>

            <div className="modal-header-info">
              <div className="modal-meta-top">
                <span className="movie-year-badge">{current.year}</span>
                <span className="movie-genre-badge">{current.genre}</span>
                {current.rating_imdb && (
                  <span className="imdb-badge">★ {current.rating_imdb} IMDb</span>
                )}
              </div>

              <h2 id="modal-title" className="modal-title">{current.title}</h2>
              <p className="modal-director">Directed by <strong>{current.director}</strong></p>

              {posPct !== null ? (
                <div className="modal-sentiment-summary">
                  <div className="sentiment-stat-row">
                    <span className="sentiment-highlight">
                      {posPct >= 50 ? '😍' : '😤'} {posPct}% Positive Sentiment
                    </span>
                    <span className="review-count-label">({current.total_reviews} {current.total_reviews === 1 ? 'review' : 'reviews'})</span>
                  </div>
                  <div className="modal-sentiment-meter">
                    <div className="meter-fill-pos" style={{ width: `${posPct}%` }} />
                    <div className="meter-fill-neg" style={{ width: `${100 - posPct}%` }} />
                  </div>
                </div>
              ) : (
                <div className="modal-no-sentiment">
                  <span>✨ No sentiment reviews yet. Be the first to analyze!</span>
                </div>
              )}

              <div className="modal-actions">
                <button
                  className="btn-primary-glow"
                  onClick={() => {
                    onSelectForReview(current);
                    onClose();
                  }}
                >
                  ✍️ Write a Review for {current.title}
                </button>
              </div>
            </div>
          </div>

          <div className="modal-synopsis-section">
            <h3 className="section-subtitle">Synopsis</h3>
            <p className="modal-description">{current.description}</p>
          </div>

          <div className="modal-reviews-section">
            <div className="modal-reviews-header">
              <h3 className="section-subtitle">Community Reviews ({reviews.length})</h3>
            </div>

            {loading ? (
              <div className="loading-placeholder mini">
                <div className="spinner-sm" />
                <span>Loading reviews...</span>
              </div>
            ) : reviews.length === 0 ? (
              <div className="empty-reviews-box">
                <p>🎬 No reviews recorded for this movie yet.</p>
                <button
                  className="btn-outline-sm"
                  onClick={() => {
                    onSelectForReview(current);
                    onClose();
                  }}
                >
                  Be the first to submit a review
                </button>
              </div>
            ) : (
              <div className="modal-reviews-list">
                {reviews.map(r => (
                  <div key={r.id} className={`modal-review-card ${r.sentiment}`}>
                    <div className="modal-review-badge">
                      <span className="badge-emoji">{r.sentiment === 'positive' ? '😊' : '😞'}</span>
                      <span className="badge-text">{r.sentiment} ({r.confidence}%)</span>
                      <span className="modal-review-date">{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="modal-review-text">{r.review_text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
