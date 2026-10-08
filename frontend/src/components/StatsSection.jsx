import { useState, useEffect, useCallback } from 'react';
import { fetchStats } from '../api';

function useCounter(target, duration = 800) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let start = null;
    const from = 0;
    function step(ts) {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + (target - from) * ease));
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, [target, duration]);
  return value;
}

function StatCard({ icon, value, label, className = '', subtext = '' }) {
  const animated = useCounter(typeof value === 'number' ? value : 0);
  const display = typeof value === 'string' ? value : animated;
  return (
    <div className={`stat-card glass-card ${className}`}>
      <div className="stat-card-header">
        <div className="stat-icon">{icon}</div>
        {subtext && <span className="stat-subtext">{subtext}</span>}
      </div>
      <div className="stat-value">{display}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export default function StatsSection({ refreshKey }) {
  const [stats, setStats] = useState({
    total: 0,
    positive: 0,
    negative: 0,
    avg_confidence: 0,
    top_movies: [],
  });

  const load = useCallback(async () => {
    try {
      const data = await fetchStats();
      setStats(data);
    } catch { /* silently fail */ }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const posPct = stats.total > 0 ? Math.round((stats.positive / stats.total) * 100) : 0;
  const negPct = stats.total > 0 ? Math.round((stats.negative / stats.total) * 100) : 0;

  return (
    <section className="section section-alt" id="stats">
      <div className="container">
        <div className="section-header">
          <div className="badge-pill">📊 System Analytics</div>
          <h2 className="section-title">Model &amp; Platform Metrics</h2>
          <p className="section-sub">Aggregated sentiment data across all submitted reviews.</p>
        </div>

        <div className="stats-grid" id="stats-grid">
          <StatCard
            icon="📋"
            value={stats.total}
            label="Total Reviews"
            subtext="PostgreSQL DB"
          />
          <StatCard
            icon="😍"
            value={stats.positive}
            label="Positive Reviews"
            className="positive-card"
            subtext={`${posPct}% of total`}
          />
          <StatCard
            icon="😤"
            value={stats.negative}
            label="Negative Reviews"
            className="negative-card"
            subtext={`${negPct}% of total`}
          />
          <StatCard
            icon="🎯"
            value={stats.avg_confidence ? `${stats.avg_confidence}%` : '—'}
            label="Avg Model Confidence"
            subtext="CNN PyTorch"
          />
        </div>

        {/* Top Movies Leaderboard if reviews exist */}
        {stats.top_movies && stats.top_movies.length > 0 && (
          <div className="top-movies-panel glass-card">
            <div className="top-movies-header">
              <span className="trophy-icon">🏆</span>
              <h3>Most Reviewed Movies</h3>
            </div>
            <div className="top-movies-list">
              {stats.top_movies.map((m, idx) => (
                <div key={m.id || idx} className="top-movie-item">
                  <div className="top-movie-rank">#{idx + 1}</div>
                  {m.poster_url && (
                    <img src={m.poster_url} alt="" className="top-movie-poster" />
                  )}
                  <div className="top-movie-info">
                    <span className="top-movie-title">{m.title}</span>
                    <span className="top-movie-meta">
                      {m.review_count} {m.review_count === 1 ? 'review' : 'reviews'} · {m.pos_pct != null ? `${m.pos_pct}% Positive` : 'No rating'}
                    </span>
                  </div>
                  {m.pos_pct != null && (
                    <div className="top-movie-pct-badge" style={{ color: m.pos_pct >= 50 ? 'var(--clr-pos)' : 'var(--clr-neg)' }}>
                      {m.pos_pct}% Pos
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
