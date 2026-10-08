from typing import Optional
import os
import time
import torch
import torch.nn as nn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from transformers import AutoTokenizer
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from prometheus_fastapi_instrumentator import Instrumentator
from prometheus_client import Counter, Histogram

PREDICTIONS = Counter(
    "cinescope_predictions_total",
    "Total sentiment predictions made",
    ["sentiment"],          # label: 'positive' or 'negative'
)
INFERENCE_TIME = Histogram(
    "cinescope_inference_seconds",
    "CNN inference latency in seconds",
    buckets=[0.05, 0.1, 0.25, 0.5, 1.0, 2.5],
)
DB_ERRORS = Counter(
    "cinescope_db_errors_total",
    "Total database errors encountered",
)

# Load .env from the backend/ directory, and force it to override any lingering system variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"), override=True)

# ─── Model Definition ──────────────────────────────────────────────────────────
class CNN(nn.Module):
    def __init__(self, vocab_size, embedding_dim, n_filters, filter_sizes,
                 output_dim, dropout_rate, pad_index):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, embedding_dim, padding_idx=pad_index)
        self.convs = nn.ModuleList([
            nn.Conv1d(embedding_dim, n_filters, fs) for fs in filter_sizes
        ])
        self.fc = nn.Linear(len(filter_sizes) * n_filters, output_dim)
        self.dropout = nn.Dropout(dropout_rate)

    def forward(self, ids):
        embedded = self.dropout(self.embedding(ids))
        embedded = embedded.permute(0, 2, 1)
        conved = [torch.relu(conv(embedded)) for conv in self.convs]
        pooled = [conv.max(dim=-1).values for conv in conved]
        cat = self.dropout(torch.cat(pooled, dim=-1))
        return self.fc(cat)


# ─── Globals ───────────────────────────────────────────────────────────────────
device    = torch.device("cuda" if torch.cuda.is_available() else "cpu")
tokenizer = None
model     = None
db_conn   = None

MODEL_PATH   = os.path.join(os.path.dirname(__file__), "..", "CNNModel.pt")
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")

# Hyperparameters (must match training)
VOCAB_SIZE    = 30522   # bert-base-uncased
EMBEDDING_DIM = 300
N_FILTERS     = 100
FILTER_SIZES  = [3, 5, 7]
OUTPUT_DIM    = 2
DROPOUT_RATE  = 0.5
MAX_LENGTH    = 256

DEFAULT_MOVIES = [
    {
        "title": "Inception",
        "year": 2010,
        "genre": "Sci-Fi / Action",
        "director": "Christopher Nolan",
        "rating_imdb": 8.8,
        "poster_url": "https://image.tmdb.org/t/p/w500/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg",
        "backdrop_url": "https://image.tmdb.org/t/p/w1280/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg",
        "description": "A skilled thief who steals corporate secrets through dream-sharing technology is offered a chance to have his criminal history erased as payment for the inverse task: planting an idea into the mind of a CEO."
    },
    {
        "title": "The Dark Knight",
        "year": 2008,
        "genre": "Action / Crime",
        "director": "Christopher Nolan",
        "rating_imdb": 9.0,
        "poster_url": "https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
        "backdrop_url": "https://image.tmdb.org/t/p/w1280/nMKdUUepR0i5zn0y1T4CsSB5chy.jpg",
        "description": "When the menace known as the Joker wreaks havoc and chaos on Gotham, Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice."
    },
    {
        "title": "Interstellar",
        "year": 2014,
        "genre": "Sci-Fi / Adventure",
        "director": "Christopher Nolan",
        "rating_imdb": 8.7,
        "poster_url": "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
        "backdrop_url": "https://image.tmdb.org/t/p/w1280/xJHokMbljvjADYdit5fK5VQsXEG.jpg",
        "description": "When Earth becomes increasingly uninhabitable, ex-pilot Cooper and a brave team of researchers travel through a wormhole in space in search of a new home for humanity."
    },
    {
        "title": "Pulp Fiction",
        "year": 1994,
        "genre": "Crime / Drama",
        "director": "Quentin Tarantino",
        "rating_imdb": 8.9,
        "poster_url": "https://image.tmdb.org/t/p/w500/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg",
        "backdrop_url": "https://image.tmdb.org/t/p/w1280/suaEOtk1N1sgg2MTM7oZd2cfVp3.jpg",
        "description": "The lives of two mob hitmen, a boxer, a gangster and his wife, and a pair of diner bandits intertwine in four tales of violence and redemption."
    },
    {
        "title": "Oppenheimer",
        "year": 2023,
        "genre": "Biography / Drama",
        "director": "Christopher Nolan",
        "rating_imdb": 8.9,
        "poster_url": "https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
        "backdrop_url": "https://image.tmdb.org/t/p/w1280/fm6KqXpk3M2HVveHwCrBSSBaO0V.jpg",
        "description": "The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb during World War II."
    },
    {
        "title": "Spirited Away",
        "year": 2001,
        "genre": "Animation / Fantasy",
        "director": "Hayao Miyazaki",
        "rating_imdb": 8.6,
        "poster_url": "https://image.tmdb.org/t/p/w500/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg",
        "backdrop_url": "https://image.tmdb.org/t/p/w1280/Ab8mkHmkYADjU7wQiOkia9BzGvS.jpg",
        "description": "During her family's move to the suburbs, a sullen 10-year-old girl wanders into a world ruled by gods, witches, and spirits, and where humans are changed into beasts."
    },
    {
        "title": "Dune: Part Two",
        "year": 2024,
        "genre": "Sci-Fi / Adventure",
        "director": "Denis Villeneuve",
        "rating_imdb": 8.6,
        "poster_url": "https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg",
        "backdrop_url": "https://image.tmdb.org/t/p/w1280/xOMo8BRK7PfcJv9JCnx7s5200bm.jpg",
        "description": "Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family."
    },
    {
        "title": "Parasite",
        "year": 2019,
        "genre": "Thriller / Drama",
        "director": "Bong Joon-ho",
        "rating_imdb": 8.5,
        "poster_url": "https://image.tmdb.org/t/p/w500/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg",
        "backdrop_url": "https://image.tmdb.org/t/p/w1280/hiKmp9Sm994YMmPZGhIR9ul6xK0.jpg",
        "description": "Greed and class discrimination threaten the newly formed symbiotic relationship between the wealthy Park family and the destitute Kim clan."
    },
    {
        "title": "The Matrix",
        "year": 1999,
        "genre": "Sci-Fi / Action",
        "director": "Lana & Lilly Wachowski",
        "rating_imdb": 8.7,
        "poster_url": "https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
        "backdrop_url": "https://image.tmdb.org/t/p/w1280/7u3XmlizLY025hu0U009g97y1G7.jpg",
        "description": "When a beautiful stranger leads computer hacker Neo to a forbidding underworld, he discovers the shocking truth about his simulated reality."
    },
    {
        "title": "Whiplash",
        "year": 2014,
        "genre": "Drama / Music",
        "director": "Damien Chazelle",
        "rating_imdb": 8.5,
        "poster_url": "https://image.tmdb.org/t/p/w500/7fn624j5lj3xTme2SgiLCeuedmO.jpg",
        "backdrop_url": "https://image.tmdb.org/t/p/w1280/6bbZ6XyvgfjhQAhapg7KFumSCKc.jpg",
        "description": "A promising young drummer enrolls at a cut-throat music conservatory where his dreams of greatness are mentored by an instructor who will stop at nothing to realize a student's potential."
    }
]


# ─── Model Loader ──────────────────────────────────────────────────────────────
def load_model():
    global tokenizer, model
    print("Loading tokenizer (bert-base-uncased)...")
    tokenizer = AutoTokenizer.from_pretrained("bert-base-uncased")
    pad_index = tokenizer.pad_token_id

    print("Loading CNN weights...")
    model = CNN(VOCAB_SIZE, EMBEDDING_DIM, N_FILTERS, FILTER_SIZES,
                OUTPUT_DIM, DROPOUT_RATE, pad_index).to(device)
    state = torch.load(MODEL_PATH, map_location=device, weights_only=True)
    model.load_state_dict(state)
    model.eval()
    print("[OK] CNN model ready on", device)


# ─── DB Helpers ────────────────────────────────────────────────────────────────
def _db_params():
    return dict(
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
        dbname=os.getenv("DB_NAME", "movie_reviews"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "postgres"),
    )

def get_db():
    """Return a live connection; reconnects if the previous one dropped."""
    global db_conn
    try:
        if db_conn is None or db_conn.closed:
            db_conn = psycopg2.connect(**_db_params())
        else:
            # Quick liveness check
            db_conn.cursor().execute("SELECT 1")
    except psycopg2.OperationalError:
        db_conn = psycopg2.connect(**_db_params())
    return db_conn


def init_db(retries: int = 10, delay: float = 3.0):
    """Create movies and reviews tables, retrying until Postgres is ready."""
    for attempt in range(1, retries + 1):
        try:
            conn = get_db()
            with conn.cursor() as cur:
                # 1. Movies table
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS movies (
                        id           SERIAL PRIMARY KEY,
                        title        VARCHAR(255) NOT NULL,
                        year         INT NOT NULL,
                        genre        VARCHAR(100) NOT NULL,
                        director     VARCHAR(100),
                        rating_imdb  FLOAT,
                        poster_url   TEXT,
                        backdrop_url TEXT,
                        description  TEXT,
                        created_at   TIMESTAMP NOT NULL DEFAULT NOW()
                    );
                """)

                # 2. Reviews table
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS reviews (
                        id          SERIAL PRIMARY KEY,
                        review_text TEXT        NOT NULL,
                        sentiment   VARCHAR(10) NOT NULL,
                        confidence  FLOAT       NOT NULL,
                        created_at  TIMESTAMP   NOT NULL DEFAULT NOW()
                    );
                """)

                # 3. Add movie associations to reviews if not present
                cur.execute("ALTER TABLE reviews ADD COLUMN IF NOT EXISTS movie_id INT REFERENCES movies(id) ON DELETE SET NULL;")
                cur.execute("ALTER TABLE reviews ADD COLUMN IF NOT EXISTS movie_title VARCHAR(255);")

                # 4. Check if movies table has rows; seed if empty
                cur.execute("SELECT COUNT(*) FROM movies;")
                m_count = cur.fetchone()[0]
                if m_count == 0:
                    for m in DEFAULT_MOVIES:
                        cur.execute("""
                            INSERT INTO movies (title, year, genre, director, rating_imdb, poster_url, backdrop_url, description)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        """, (
                            m["title"], m["year"], m["genre"], m["director"],
                            m["rating_imdb"], m["poster_url"], m["backdrop_url"], m["description"]
                        ))
                    print(f"[OK] Seeded {len(DEFAULT_MOVIES)} default movies.")

                # 5. Populate default movie_title for any unassigned legacy reviews
                cur.execute("UPDATE reviews SET movie_title = 'General Review' WHERE movie_title IS NULL;")

            conn.commit()
            print("[OK] Database tables and seed movies ready.")
            return
        except psycopg2.OperationalError as e:
            print(f"  DB not ready (attempt {attempt}/{retries}): {e}")
            if attempt < retries:
                time.sleep(delay)
    raise RuntimeError(
        "Could not connect to PostgreSQL after several attempts. "
        "Make sure it is running and .env credentials are correct."
    )


# ─── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    load_model()
    init_db()
    yield
    global db_conn
    if db_conn and not db_conn.closed:
        db_conn.close()
        print("DB connection closed.")


# ─── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="CineScope — Movie Sentiment API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve frontend static files at /static/*
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

Instrumentator().instrument(app).expose(app)

# ─── Schemas ───────────────────────────────────────────────────────────────────
class ReviewRequest(BaseModel):
    review: str
    movie_id: Optional[int] = None
    movie_title: Optional[str] = None


# ─── Inference ─────────────────────────────────────────────────────────────────
def predict(text: str):
    encoding = tokenizer(
        text,
        add_special_tokens=True,
        truncation=True,
        max_length=MAX_LENGTH,
        padding="max_length",
        return_tensors="pt",
    )
    input_ids = encoding["input_ids"].to(device)
    with INFERENCE_TIME.time():
        with torch.no_grad():
            logits = model(input_ids)
            probs  = torch.softmax(logits, dim=-1)
            pred   = logits.argmax(dim=-1).item()
            conf   = probs[0, pred].item()
    label = "positive" if pred == 1 else "negative"
    PREDICTIONS.labels(label).inc()
    return label, round(conf * 100, 2)


# ─── Routes ────────────────────────────────────────────────────────────────────
@app.get("/", include_in_schema=False)
def serve_frontend():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


@app.get("/api/movies", summary="List all movies with aggregate sentiment stats")
def get_movies():
    try:
        conn = get_db()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    m.id,
                    m.title,
                    m.year,
                    m.genre,
                    m.director,
                    m.rating_imdb,
                    m.poster_url,
                    m.backdrop_url,
                    m.description,
                    m.created_at,
                    COUNT(r.id) AS total_reviews,
                    SUM(CASE WHEN r.sentiment = 'positive' THEN 1 ELSE 0 END) AS positive_reviews,
                    SUM(CASE WHEN r.sentiment = 'negative' THEN 1 ELSE 0 END) AS negative_reviews,
                    ROUND(COALESCE(AVG(r.confidence), 0)::numeric, 2) AS avg_confidence
                FROM movies m
                LEFT JOIN reviews r ON m.id = r.movie_id
                GROUP BY m.id
                ORDER BY m.id ASC
            """)
            rows = cur.fetchall()
            movies = []
            for r in rows:
                item = dict(r)
                tot = int(item["total_reviews"] or 0)
                pos = int(item["positive_reviews"] or 0)
                neg = int(item["negative_reviews"] or 0)
                item["total_reviews"] = tot
                item["positive_reviews"] = pos
                item["negative_reviews"] = neg
                item["positive_pct"] = round((pos / tot) * 100, 1) if tot > 0 else None
                movies.append(item)
    except psycopg2.Error as e:
        raise HTTPException(503, f"Database error: {e}")

    return {"movies": movies}


@app.get("/api/movies/{movie_id}", summary="Get specific movie details and its reviews")
def get_movie_detail(movie_id: int):
    try:
        conn = get_db()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    m.*,
                    COUNT(r.id) AS total_reviews,
                    SUM(CASE WHEN r.sentiment = 'positive' THEN 1 ELSE 0 END) AS positive_reviews,
                    SUM(CASE WHEN r.sentiment = 'negative' THEN 1 ELSE 0 END) AS negative_reviews,
                    ROUND(COALESCE(AVG(r.confidence), 0)::numeric, 2) AS avg_confidence
                FROM movies m
                LEFT JOIN reviews r ON m.id = r.movie_id
                WHERE m.id = %s
                GROUP BY m.id
            """, (movie_id,))
            movie = cur.fetchone()
            if not movie:
                raise HTTPException(404, "Movie not found")
            
            cur.execute("""
                SELECT * FROM reviews 
                WHERE movie_id = %s 
                ORDER BY created_at DESC 
                LIMIT 20
            """, (movie_id,))
            reviews = cur.fetchall()
            
            item = dict(movie)
            tot = int(item["total_reviews"] or 0)
            pos = int(item["positive_reviews"] or 0)
            item["total_reviews"] = tot
            item["positive_reviews"] = pos
            item["negative_reviews"] = int(item["negative_reviews"] or 0)
            item["positive_pct"] = round((pos / tot) * 100, 1) if tot > 0 else None
            item["reviews"] = [dict(r) for r in reviews]
            return item
    except psycopg2.Error as e:
        raise HTTPException(503, f"Database error: {e}")


@app.post("/api/reviews", summary="Submit a review for sentiment analysis")
def submit_review(body: ReviewRequest):
    text = body.review.strip()
    if not text:
        raise HTTPException(400, "Review text cannot be empty.")
    if len(text) < 10:
        raise HTTPException(400, "Review too short — minimum 10 characters.")

    sentiment, confidence = predict(text)

    movie_id = body.movie_id
    movie_title = (body.movie_title or "").strip() or None

    try:
        conn = get_db()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            if movie_id:
                cur.execute("SELECT title FROM movies WHERE id = %s", (movie_id,))
                m_row = cur.fetchone()
                if m_row:
                    movie_title = m_row["title"]
                else:
                    movie_id = None

            if not movie_title:
                movie_title = "General Review"

            cur.execute(
                """INSERT INTO reviews (review_text, sentiment, confidence, created_at, movie_id, movie_title)
                   VALUES (%s, %s, %s, %s, %s, %s) RETURNING *""",
                (text, sentiment, confidence, datetime.utcnow(), movie_id, movie_title),
            )
            row = cur.fetchone()
        conn.commit()
    except psycopg2.Error as e:
        raise HTTPException(503, f"Database error: {e}")

    return {
        "id":          row["id"],
        "sentiment":   row["sentiment"],
        "confidence":  row["confidence"],
        "created_at":  row["created_at"].isoformat(),
        "movie_id":    row["movie_id"],
        "movie_title": row["movie_title"],
    }


@app.get("/api/reviews", summary="Paginated list of past reviews with optional filters")
def get_reviews(limit: int = 10, offset: int = 0, movie_id: Optional[int] = None, sentiment: Optional[str] = None):
    try:
        conn = get_db()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            where_clauses = []
            params = []
            if movie_id is not None:
                where_clauses.append("movie_id = %s")
                params.append(movie_id)
            if sentiment and sentiment != "all":
                where_clauses.append("sentiment = %s")
                params.append(sentiment)

            where_str = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

            cur.execute(
                f"SELECT * FROM reviews {where_str} ORDER BY created_at DESC LIMIT %s OFFSET %s",
                (*params, limit, offset),
            )
            rows = cur.fetchall()

            cur.execute(f"SELECT COUNT(*) AS total FROM reviews {where_str}", tuple(params))
            total = cur.fetchone()["total"]
    except psycopg2.Error as e:
        raise HTTPException(503, f"Database error: {e}")

    return {"reviews": [dict(r) for r in rows], "total": total}


@app.get("/api/stats", summary="Aggregate sentiment statistics")
def get_stats():
    try:
        conn = get_db()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT
                    COUNT(*)                                               AS total,
                    SUM(CASE WHEN sentiment = 'positive' THEN 1 ELSE 0 END) AS positive,
                    SUM(CASE WHEN sentiment = 'negative' THEN 1 ELSE 0 END) AS negative,
                    ROUND(AVG(confidence)::numeric, 2)                     AS avg_confidence
                FROM reviews
            """)
            stats = cur.fetchone()

            cur.execute("""
                SELECT 
                    m.id,
                    m.title,
                    m.poster_url,
                    COUNT(r.id) as review_count,
                    ROUND((SUM(CASE WHEN r.sentiment = 'positive' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(r.id), 0) * 100), 1) as pos_pct
                FROM reviews r
                JOIN movies m ON r.movie_id = m.id
                GROUP BY m.id, m.title, m.poster_url
                ORDER BY review_count DESC
                LIMIT 3
            """)
            top_movies = cur.fetchall()
    except psycopg2.Error as e:
        raise HTTPException(503, f"Database error: {e}")

    return {
        "total":          int(stats["total"] or 0),
        "positive":       int(stats["positive"] or 0),
        "negative":       int(stats["negative"] or 0),
        "avg_confidence": float(stats["avg_confidence"] or 0),
        "top_movies":     [dict(t) for t in top_movies] if top_movies else [],
    }


@app.get("/api/health", summary="Health check")
def health():
    db_ok = False
    try:
        get_db().cursor().execute("SELECT 1")
        db_ok = True
    except Exception:
        pass
    return {
        "model":  "loaded" if model is not None else "not loaded",
        "device": str(device),
        "db":     "connected" if db_ok else "disconnected",
    }
