import { useState, useRef, useEffect } from 'react';
import { submitReview } from '../api';

const MAX_LEN = 5000;

const REVIEW_PRESETS = [
  {
    label: '✨ Masterpiece',
    text: 'An absolute masterpiece of cinema. The storytelling, exceptional cinematography, and haunting musical score create an indelible emotional journey.',
  },
  {
    label: '🥱 Disappointing',
    text: 'A profoundly disappointing film with disjointed pacing, flat characters, and an anticlimactic ending that wastes its promising premise.',
  },
  {
    label: '🤔 Negation Test',
    text: 'Not a bad movie at all! In fact, the witty dialogue and energetic performances made it surprisingly delightful.',
  },
];

function ResultBanner({ result }) {
  const barRef = useRef(null);
  const isPos = result.sentiment === 'positive';

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    bar.style.width = '0%';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        bar.style.width = `${result.confidence}%`;
      });
    });
  }, [result]);

  return (
    <div className={`result-banner ${result.sentiment}`} role="status">
      <div className="result-top-info">
        <div className="result-icon">{isPos ? '😍' : '😤'}</div>
        <div className="result-info">
          <div className="result-movie-tag">
            🎬 Review for: <strong>{result.movie_title || 'General Review'}</strong>
          </div>
          <div className="result-label">
            ✦ {isPos ? 'Positive' : 'Negative'} Sentiment Detected
          </div>
          <div className="result-confidence">
            CNN Model Confidence: <strong>{result.confidence}%</strong>
          </div>
        </div>
      </div>
      <div className="confidence-bar-wrap">
        <div className="confidence-bar" ref={barRef} />
      </div>
    </div>
  );
}

export default function AnalyzerSection({
  selectedMovie,
  onSelectMovie,
  movies = [],
  onNewReview,
  showToast,
}) {
  const [text, setText] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const textareaRef = useRef(null);

  // Focus textarea when a movie is selected
  useEffect(() => {
    if (selectedMovie && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [selectedMovie]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const trimmed = text.trim();

    if (!trimmed) {
      setError('Please enter a review before submitting.');
      return;
    }
    if (trimmed.length < 10) {
      setError('Review is too short (minimum 10 characters).');
      return;
    }

    const movieId = isCustomMode ? null : (selectedMovie ? selectedMovie.id : null);
    const movieTitle = isCustomMode ? customTitle.trim() : (selectedMovie ? selectedMovie.title : null);

    setLoading(true);
    try {
      const data = await submitReview({
        review: trimmed,
        movie_id: movieId,
        movie_title: movieTitle,
      });
      setResult(data);
      showToast(`Review for "${data.movie_title}" analyzed & saved!`, 'success');
      onNewReview(data);
    } catch (err) {
      setError(err.message);
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  function handleSelectMovieFromDropdown(e) {
    const val = e.target.value;
    if (val === '__custom__') {
      setIsCustomMode(true);
      onSelectMovie(null);
    } else if (val === '') {
      setIsCustomMode(false);
      onSelectMovie(null);
    } else {
      setIsCustomMode(false);
      const found = movies.find(m => String(m.id) === val);
      if (found) onSelectMovie(found);
    }
  }

  const charColor = text.length > 4500 ? 'var(--clr-neg)' : undefined;

  return (
    <section className="section" id="analyzer">
      <div className="container">
        <div className="section-header">
          <div className="badge-pill">⚡ Neural Sentiment Classifier</div>
          <h2 className="section-title">Analyze a Movie Review</h2>
          <p className="section-sub">
            Choose a movie, write or paste your critique, and let the CNN model predict the sentiment.
          </p>
        </div>

        <div className="analyzer-card glass-card" id="analyzer-card">
          {/* Movie Selection Banner */}
          <div className="analyzer-movie-selector">
            <div className="selector-label-row">
              <span className="selector-title">Selected Movie:</span>
              <div className="selector-options">
                <button
                  type="button"
                  className={`btn-toggle-mode ${!isCustomMode ? 'active' : ''}`}
                  onClick={() => setIsCustomMode(false)}
                >
                  Featured Catalog
                </button>
                <button
                  type="button"
                  className={`btn-toggle-mode ${isCustomMode ? 'active' : ''}`}
                  onClick={() => {
                    setIsCustomMode(true);
                    onSelectMovie(null);
                  }}
                >
                  Other / Custom Movie
                </button>
              </div>
            </div>

            {!isCustomMode ? (
              <div className="catalog-picker-wrap">
                {selectedMovie ? (
                  <div className="selected-movie-badge-card">
                    {selectedMovie.poster_url && (
                      <img
                        src={selectedMovie.poster_url}
                        alt={selectedMovie.title}
                        className="selected-movie-thumb"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    )}
                    <div className="selected-movie-details">
                      <span className="selected-tag">Currently Reviewing</span>
                      <h4 className="selected-title">{selectedMovie.title} ({selectedMovie.year})</h4>
                      <span className="selected-subinfo">{selectedMovie.genre} · Dir. {selectedMovie.director}</span>
                    </div>
                    <button
                      type="button"
                      className="btn-clear-selection"
                      onClick={() => onSelectMovie(null)}
                      title="Clear movie selection"
                    >
                      Change Movie ✕
                    </button>
                  </div>
                ) : (
                  <div className="dropdown-picker">
                    <select
                      className="movie-select-input"
                      value={selectedMovie ? selectedMovie.id : ''}
                      onChange={handleSelectMovieFromDropdown}
                      aria-label="Select a movie to review"
                    >
                      <option value="">-- Choose a movie to review (or General Review) --</option>
                      {movies.map(m => (
                        <option key={m.id} value={m.id}>
                          🎬 {m.title} ({m.year}) — {m.genre}
                        </option>
                      ))}
                      <option value="__custom__">➕ Type a custom movie title...</option>
                    </select>
                  </div>
                )}
              </div>
            ) : (
              <div className="custom-movie-input-wrap">
                <input
                  type="text"
                  className="custom-title-input"
                  placeholder="Enter the movie title (e.g., Gladiator II, Titanic, Spider-Man)..."
                  value={customTitle}
                  onChange={e => setCustomTitle(e.target.value)}
                  maxLength={100}
                />
              </div>
            )}
          </div>

          {result && <ResultBanner result={result} />}

          {/* Quick Preset Buttons */}
          <div className="preset-prompts-bar">
            <span className="preset-label">Quick samples:</span>
            <div className="preset-buttons">
              {REVIEW_PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="btn-preset"
                  onClick={() => {
                    setText(p.text);
                    setError('');
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <form id="review-form" noValidate onSubmit={handleSubmit}>
            <div className="input-group">
              <label htmlFor="review-input" className="input-label">
                Your Review Text
              </label>
              <textarea
                ref={textareaRef}
                id="review-input"
                name="review"
                rows={6}
                maxLength={MAX_LEN}
                placeholder={
                  selectedMovie
                    ? `What did you think of ${selectedMovie.title}? Write your honest thoughts on the acting, plot, direction, soundtrack, and visuals...`
                    : "e.g. — This film was an absolute masterpiece. The cinematography, the acting, the soundtrack — everything clicked perfectly..."
                }
                required
                aria-required="true"
                aria-describedby="char-count review-error"
                value={text}
                onChange={e => setText(e.target.value)}
              />
              <div className="input-footer">
                <span className="error-msg" id="review-error" role="alert">
                  {error}
                </span>
                <span className="char-count" id="char-count" style={{ color: charColor }}>
                  {text.length} / {MAX_LEN}
                </span>
              </div>
            </div>

            <button
              type="submit"
              className="btn-analyze"
              id="analyze-btn"
              disabled={loading}
            >
              <span className="btn-text">
                {loading ? 'Analyzing Sentiment…' : `Submit & Analyze ${selectedMovie ? `for ${selectedMovie.title}` : 'Review'}`}
              </span>
              {loading && <span className="btn-spinner" aria-hidden="true" />}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
