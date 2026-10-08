export default function Hero() {
  return (
    <header className="hero" id="hero">
      <div className="hero-content">
        <div className="hero-badge">
          <span className="pulse-dot" />
          <span>CNN Model · 89.5% Accuracy · PostgreSQL Synced</span>
        </div>
        <h1 className="hero-title">
          Decode the Sentiment<br />
          <span className="gradient-text">Behind Every Movie</span>
        </h1>
        <p className="hero-sub">
          Explore iconic films, analyze audience reception with deep learning, and submit
          your own reviews to our persistent database with instant AI sentiment scoring.
        </p>
        <div className="hero-cta-group">
          <a href="#movies-showcase" className="hero-cta primary" id="hero-explore-btn">
            Explore Movies 🎬
          </a>
          <a href="#analyzer" className="hero-cta secondary" id="hero-cta-btn">
            Analyze a Review ↓
          </a>
        </div>

        <div className="hero-features-list">
          <div className="feature-item">
            <span className="feature-icon">⚡</span>
            <span>Sub-millisecond CNN Inference</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">🎯</span>
            <span>Real-time Confidence Score</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">💾</span>
            <span>PostgreSQL Review Archive</span>
          </div>
        </div>
      </div>

      <div className="hero-visual" aria-hidden="true">
        <div className="hero-cards-stack">
          <div className="hero-preview-card card-1 glass-card">
            <div className="preview-top">
              <span className="preview-emoji">🎬</span>
              <span className="preview-title">Inception (2010)</span>
            </div>
            <p className="preview-quote">&ldquo;Mind-bending masterpiece, visionary direction and score!&rdquo;</p>
            <div className="preview-badge-row">
              <span className="badge-pos">😍 99.4% Positive</span>
              <span className="badge-dir">C. Nolan</span>
            </div>
          </div>

          <div className="hero-preview-card card-2 glass-card">
            <div className="preview-top">
              <span className="preview-emoji">🦇</span>
              <span className="preview-title">The Dark Knight (2008)</span>
            </div>
            <p className="preview-quote">&ldquo;Heath Ledger delivers the greatest performance in comic book history.&rdquo;</p>
            <div className="preview-badge-row">
              <span className="badge-pos">😍 98.7% Positive</span>
              <span className="badge-dir">C. Nolan</span>
            </div>
          </div>

          <div className="hero-preview-card card-3 glass-card">
            <div className="preview-top">
              <span className="preview-emoji">🚀</span>
              <span className="preview-title">Interstellar (2014)</span>
            </div>
            <p className="preview-quote">&ldquo;Emotional triumph exploring love across the dimensions of spacetime.&rdquo;</p>
            <div className="preview-badge-row">
              <span className="badge-pos">🤩 97.2% Positive</span>
              <span className="badge-dir">C. Nolan</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
