# 🎬 CineScope — IMDB Movie Review Sentiment Analysis

> **Classify any movie review as Positive or Negative** using custom-trained deep learning models (CNN & LSTM), served through a production-grade full-stack web application with real-time monitoring.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Model Performance](#model-performance)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [ML Pipeline](#ml-pipeline)
- [API Reference](#api-reference)
- [Running the App](#running-the-app)
- [Monitoring](#monitoring)

---

## Overview

CineScope is an end-to-end sentiment analysis project built on the [IMDB Large Movie Review Dataset](https://ai.stanford.edu/~amaas/data/sentiment/). It covers the complete ML lifecycle:

1. **Data Processing** — tokenization with BERT's `bert-base-uncased` tokenizer
2. **Model Training** — custom CNN and LSTM networks built in PyTorch
3. **Experiment Tracking** — runs logged with MLflow
4. **Serving** — FastAPI backend exposing a REST API
5. **Frontend** — React (Vite) SPA for interactive review submission and history
6. **Containerization** — full Docker Compose stack
7. **Observability** — Prometheus metrics + Grafana dashboards

---

## Model Performance

| Model | Test Accuracy | Notes |
|-------|:------------:|-------|
| **CNN** | **89.5%** | 3 epochs, embedding dim 300, filters [3,5,7] |
| **LSTM** | **88.5%** | Similar configuration |

### Tuning History (CNN)

| Configuration | Test Accuracy |
|---|:---:|
| 10 epochs, Adam, CE loss, no weight init, emb dim 128, dropout 0.5, max len 128 | 80% |
| 10 epochs, Adam, CE loss, **with** weight init, emb dim 128, dropout 0.5, max len 128 | 82% |
| 10 epochs, Adam, CE loss, weight init, emb dim 300, dropout 0.5, max len 256 | 86% |
| **3 epochs** (early stop at lowest val loss), same as above | **88–89.5%** |

> **Key Insight:** Validation loss started increasing after ~3 epochs — a sign of overfitting. The model is saved at its best validation checkpoint, so training is capped at 3 epochs to save time.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Docker Compose                        │
│                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │   Frontend  │───▶│   Backend   │───▶│   PostgreSQL    │  │
│  │  React/Vite │    │   FastAPI   │    │  (reviews DB)   │  │
│  │  Nginx :80  │    │    :8000    │    │                 │  │
│  └─────────────┘    └──────┬──────┘    └─────────────────┘  │
│                            │ /metrics                        │
│                     ┌──────▼──────┐                         │
│                     │ Prometheus  │◀─── postgres-exporter    │
│                     │   :9090     │◀─── node-exporter        │
│                     └──────┬──────┘◀─── nginx-exporter       │
│                            │                                 │
│                     ┌──────▼──────┐                         │
│                     │   Grafana   │                         │
│                     │   :3000     │                         │
│                     └─────────────┘                         │
└──────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Machine Learning
| Component | Technology |
|---|---|
| Framework | PyTorch |
| Tokenizer | HuggingFace Transformers (`bert-base-uncased`) |
| Experiment Tracking | MLflow |
| Notebook | Jupyter (`main.ipynb`) |

### Backend
| Component | Technology |
|---|---|
| Web Framework | FastAPI |
| Runtime | Python 3 + Uvicorn |
| Database | PostgreSQL 16 |
| DB Driver | psycopg2 |
| Metrics | Prometheus FastAPI Instrumentator |

### Frontend
| Component | Technology |
|---|---|
| Framework | React 18 (Vite) |
| Styling | Vanilla CSS (glassmorphism + animations) |
| Server | Nginx |

### Infrastructure
| Component | Technology |
|---|---|
| Containerization | Docker + Docker Compose |
| Metrics Collection | Prometheus |
| Dashboards | Grafana |
| DB Metrics | postgres-exporter |
| Host Metrics | node-exporter |
| Nginx Metrics | nginx-prometheus-exporter |

---

## Project Structure

```
IMDB_MovieReview_SentimentAnalysis/
│
├── main.ipynb              # Full ML pipeline (data → train → evaluate)
├── CNNModel.pt             # Trained CNN weights
├── LSTMModel.pt            # Trained LSTM weights
├── dataset.csv             # IMDB 50k reviews dataset
├── docker-compose.yml      # Full production stack
├── run.bat                 # Windows convenience script
│
├── backend/
│   ├── app.py              # FastAPI app (inference + CRUD + metrics)
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   ├── Hero.jsx
│   │   │   ├── AnalyzerSection.jsx   # Review submission + result display
│   │   │   ├── StatsSection.jsx      # Aggregate sentiment stats
│   │   │   ├── HistorySection.jsx    # Paginated review history
│   │   │   ├── Footer.jsx
│   │   │   └── ToastContainer.jsx
│   │   ├── hooks/useToast.js
│   │   ├── api.js                    # API client
│   │   └── App.jsx
│   ├── nginx.conf
│   └── Dockerfile
│
├── monitoring/
│   ├── prometheus.yml                # Scrape configs
│   ├── alerts.yml                    # Alerting rules
│   └── grafana/provisioning/         # Auto-provisioned dashboards
│
└── mlartifacts/                      # MLflow artifact store
```

---

## ML Pipeline

All steps are documented and reproducible in [`main.ipynb`](./main.ipynb).

### Step 1 — Data Processing
- Load 50k IMDB reviews from `dataset.csv` into a Pandas DataFrame
- Convert text labels (`positive`/`negative`) → integers (1/0)
- Tokenize reviews using `bert-base-uncased` (vocab size: 30,522) — provides built-in `<PAD>` and `<UNK>` tokens, no custom vocabulary needed
- Split: **80% train / 10% validation / 10% test**
- Wrap in PyTorch `Dataset` and `DataLoader` objects

> **Why BERT tokenizer over torchtext?** `torchtext` had version incompatibilities with the installed PyTorch version. Switching to HuggingFace Transformers was simpler and more robust.

### Step 2 — Model Architecture

**CNN**
```
Embedding(30522, 300) → Conv1d × 3 (filter sizes: 3,5,7) → MaxPool → Dropout(0.5) → Linear(300, 2)
```

**LSTM** — Similar embedding layer with LSTM layers and a fully connected output head.

### Step 3 — Training Setup
- Optimizer: **Adam**
- Loss function: **Cross-Entropy**
- Pre-initialized embedding weights for faster convergence
- Best model checkpoint saved at lowest validation loss

### Step 4 — Evaluation & Comparison

CNN Training Curves:

![CNN Training Curves](image.png)

LSTM Training Curves:

![LSTM Training Curves](image-1.png)

Model Comparison (Confusion Matrix & Metrics):

![Confusion Matrix Comparison](image-2.png)
![Metrics Comparison](image-3.png)

---

## API Reference

Base URL: `http://localhost:8000`  
Interactive docs: `http://localhost:8000/docs` (Swagger UI)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/reviews` | Submit a review for sentiment analysis |
| `GET` | `/api/reviews` | Paginated history of past reviews |
| `GET` | `/api/stats` | Aggregate sentiment statistics |
| `GET` | `/api/health` | Health check (model + DB status) |
| `GET` | `/metrics` | Prometheus metrics scrape endpoint |

### `POST /api/reviews`
```json
// Request
{ "review": "This movie was absolutely fantastic!" }

// Response
{
  "id": 42,
  "sentiment": "positive",
  "confidence": 97.83,
  "created_at": "2026-10-08T13:10:00"
}
```

### `GET /api/stats`
```json
{
  "total": 150,
  "positive": 112,
  "negative": 38,
  "avg_confidence": 91.45
}
```

---

## Running the App

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

### Quick Start

```bash
# Clone the repository
git clone https://github.com/Sambarlasagna/IMDB_MovieReview_SentimentAnalysis.git
cd IMDB_MovieReview_SentimentAnalysis

# Start all services
docker compose up --build
```

On Windows, you can also double-click **`run.bat`**.

### Service URLs

| Service | URL |
|---------|-----|
| 🎬 CineScope App | http://localhost |
| 📖 API Docs (Swagger) | http://localhost:8000/docs |
| 📊 Grafana | http://localhost:3001 |
| 🔥 Prometheus | http://localhost:9091 |

> **Grafana credentials:** `admin` / `cinescope123`

### Stopping

```bash
docker compose down

# Also remove persistent volumes (database + metrics data):
docker compose down -v
```

---

## Monitoring

The observability stack automatically tracks:

| Metric | Source | Description |
|--------|--------|-------------|
| `cinescope_predictions_total` | Backend | Total predictions, labelled by sentiment |
| `cinescope_inference_seconds` | Backend | CNN inference latency histogram |
| `cinescope_db_errors_total` | Backend | Database error counter |
| HTTP request rate / latency / errors | FastAPI auto-instrumentation | |
| PostgreSQL query & connection stats | postgres-exporter | |
| CPU, memory, disk usage | node-exporter | |
| Nginx request rate | nginx-prometheus-exporter | |

Grafana dashboards are **auto-provisioned** on first startup via `monitoring/grafana/provisioning/`.

Prometheus scrapes on a **15s interval** and retains data for **15 days**.
