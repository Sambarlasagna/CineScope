export default function Navbar({ onReviewClick }) {
  return (
    <nav className="navbar" role="navigation" aria-label="Main navigation">
      <div className="nav-inner">
        <a href="#" className="nav-logo" id="nav-logo-link">
          <span className="logo-icon">🎬</span>
          <span className="logo-text">Cine<span className="logo-accent">Scope</span></span>
        </a>
        <div className="nav-links">
          <a href="#movies-showcase" id="nav-movies-link">Movies</a>
          <a href="#analyzer" id="nav-analyzer-link">Analyze</a>
          <a href="#history"  id="nav-history-link">History</a>
          <a href="#stats"    id="nav-stats-link">Stats</a>
        </div>
        <div className="nav-actions">
          <a
            href="#analyzer"
            className="nav-cta-btn"
            id="nav-cta-btn"
            onClick={onReviewClick}
          >
            ✍️ Review a Movie
          </a>
        </div>
      </div>
    </nav>
  );
}
