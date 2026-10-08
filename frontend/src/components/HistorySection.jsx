import { useState, useEffect, useCallback } from 'react';
import { fetchReviews } from '../api';

const PAGE_SIZE = 8;

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium', timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function ReviewItem({ review, index }) {
  const isPos = review.sentiment === 'positive';

  return (
    <article
      className={`review-item ${review.sentiment}`}
      style={{ animationDelay: `${index * 0.04}s` }}
    >
      <div className="review-top-bar">
        <div className="review-movie-badge">
          <span className="movie-icon">🎬</span>
          <span className="movie-name">{review.movie_title || 'General Review'}</span>
        </div>

        <div className="review-meta-right">
          <div className="review-badge">
            <span className="badge-emoji">{isPos ? '😊' : '😞'}</span>
            <span className="badge-label">{review.sentiment}</span>
          </div>
          <div className="review-conf-pill">
            {review.confidence}%
          </div>
        </div>
      </div>

      <div className="review-body">
        <p className="review-text">&ldquo;{review.review_text}&rdquo;</p>
      </div>

      <div className="review-footer-row">
        <span className="review-id">#{review.id}</span>
        <span className="review-date">{formatDate(review.created_at)}</span>
      </div>
    </article>
  );
}

export default function HistorySection({ refreshKey, showToast, movies = [] }) {
  const [reviews, setReviews]       = useState([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [filter, setFilter]         = useState('all');
  const [selectedMovieId, setSelectedMovieId] = useState('');
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(false);

  const load = useCallback(async (pg = 1, f = filter, mId = selectedMovieId) => {
    setLoading(true);
    setError(false);
    try {
      const offset = (pg - 1) * PAGE_SIZE;
      const data = await fetchReviews(PAGE_SIZE, offset, mId ? Number(mId) : null, f);
      setTotal(data.total);
      setReviews(data.reviews);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [filter, selectedMovieId]);

  // Reload when a new review is submitted (refreshKey bumps)
  useEffect(() => {
    load(page, filter, selectedMovieId);
  }, [refreshKey, page, filter, selectedMovieId, load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function handleFilter(f) {
    setFilter(f);
    setPage(1);
  }

  function handleMovieFilter(e) {
    setSelectedMovieId(e.target.value);
    setPage(1);
  }

  function handleRefresh() {
    load(page, filter, selectedMovieId);
    showToast('Reviews refreshed!', 'success');
  }

  return (
    <section className="section" id="history">
      <div className="container">
        <div className="section-header">
          <div className="badge-pill">📜 Live Database Feed</div>
          <h2 className="section-title">Review History</h2>
          <p className="section-sub">
            All reviews saved into PostgreSQL with model predictions and movie tags.
          </p>
        </div>

        <div className="history-controls">
          <div className="history-filters-left">
            <div className="filter-group" role="group" aria-label="Filter by sentiment">
              {['all', 'positive', 'negative'].map(f => (
                <button
                  key={f}
                  id={`filter-${f}-btn`}
                  className={`filter-btn${filter === f ? ' active' : ''}`}
                  onClick={() => handleFilter(f)}
                >
                  {f === 'all' ? 'All Sentiments' : (f.charAt(0).toUpperCase() + f.slice(1))}
                </button>
              ))}
            </div>

            <div className="history-movie-select-wrap">
              <select
                className="history-movie-filter"
                value={selectedMovieId}
                onChange={handleMovieFilter}
                aria-label="Filter reviews by movie"
              >
                <option value="">All Movies ({total})</option>
                {movies.map(m => (
                  <option key={m.id} value={m.id}>
                    🎬 {m.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            className="btn-refresh"
            id="refresh-btn"
            aria-label="Refresh history"
            onClick={handleRefresh}
          >
            <span className="refresh-icon">↺</span> Refresh
          </button>
        </div>

        <div className="reviews-list" id="reviews-list" aria-live="polite" aria-label="Review history">
          {loading ? (
            <div className="loading-placeholder" id="history-loader">
              <div className="spinner-lg" />
              <p>Loading database reviews…</p>
            </div>
          ) : error ? (
            <div className="empty-state">
              <p>⚠️</p>
              <p>Could not load reviews. Is the backend service active?</p>
            </div>
          ) : reviews.length === 0 ? (
            <div className="empty-state">
              <p>🎬</p>
              <p>No matching reviews found. Pick a movie above to submit one!</p>
            </div>
          ) : (
            <div className="reviews-grid">
              {reviews.map((r, i) => <ReviewItem key={r.id} review={r} index={i} />)}
            </div>
          )}
        </div>

        {total > PAGE_SIZE && !loading && (
          <div className="pagination" id="pagination">
            <button
              className="page-btn"
              id="prev-btn"
              disabled={page <= 1}
              aria-label="Previous page"
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              ← Prev
            </button>
            <span className="page-info" id="page-info">
              Page {page} of {totalPages}
            </span>
            <button
              className="page-btn"
              id="next-btn"
              disabled={page >= totalPages}
              aria-label="Next page"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
