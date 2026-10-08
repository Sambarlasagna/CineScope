import { useState, useEffect, useCallback } from 'react';
import Navbar          from './components/Navbar';
import Hero            from './components/Hero';
import MoviesSection   from './components/MoviesSection';
import AnalyzerSection from './components/AnalyzerSection';
import StatsSection    from './components/StatsSection';
import HistorySection  from './components/HistorySection';
import MovieModal      from './components/MovieModal';
import Footer          from './components/Footer';
import ToastContainer  from './components/ToastContainer';
import { useToast }    from './hooks/useToast';
import { fetchMovies } from './api';

export default function App() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [movies, setMovies] = useState([]);
  const [moviesLoading, setMoviesLoading] = useState(true);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [detailModalMovie, setDetailModalMovie] = useState(null);

  const { toasts, showToast } = useToast();

  const loadMovies = useCallback(async () => {
    try {
      const data = await fetchMovies();
      setMovies(data.movies || []);
    } catch (err) {
      console.error('Failed to load movies:', err);
    } finally {
      setMoviesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMovies();
  }, [loadMovies, refreshKey]);

  const handleNewReview = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  const handleSelectMovie = useCallback((movie) => {
    setSelectedMovie(movie);
    // Smooth scroll to analyzer section
    const el = document.getElementById('analyzer');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const handleOpenDetail = useCallback((movie) => {
    setDetailModalMovie(movie);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setDetailModalMovie(null);
  }, []);

  return (
    <>
      {/* Animated ambient background orbs */}
      <div className="bg-orbs" aria-hidden="true">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      <Navbar onReviewClick={() => {
        const el = document.getElementById('analyzer');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }} />

      <Hero />

      <main>
        <MoviesSection
          movies={movies}
          loading={moviesLoading}
          onSelectMovie={handleSelectMovie}
          onOpenDetail={handleOpenDetail}
        />

        <AnalyzerSection
          selectedMovie={selectedMovie}
          onSelectMovie={setSelectedMovie}
          movies={movies}
          onNewReview={handleNewReview}
          showToast={showToast}
        />

        <StatsSection refreshKey={refreshKey} />

        <HistorySection
          refreshKey={refreshKey}
          showToast={showToast}
          movies={movies}
        />
      </main>

      {detailModalMovie && (
        <MovieModal
          movie={detailModalMovie}
          onClose={handleCloseDetail}
          onSelectForReview={handleSelectMovie}
        />
      )}

      <Footer />
      <ToastContainer toasts={toasts} />
    </>
  );
}
