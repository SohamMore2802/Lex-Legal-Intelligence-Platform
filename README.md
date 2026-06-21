# Lex Legal Intelligence Platform

## Overview

Lex Legal Intelligence Platform converts legal PDF documents into an interactive, searchable knowledge source. The app focuses on deterministic, explainable retrieval: uploaded PDFs are parsed, split into contextual text chunks, indexed with TF-IDF, and queried via cosine similarity. Answers are extracted from the document text and returned with source citations and page references.

This repository contains the backend Flask app, a small client UI, and the PDF processing logic implemented in `src/pdf_processor.py`.

## Tech Stack (detailed)

This project combines cutting-edge AI/ML libraries with a modern full-stack web architecture for building intelligent document retrieval and analysis systems.

### Languages

- **Python** — Core backend language for ML, document processing, and server logic. Python's rich ecosystem (NumPy, Pandas, scikit-learn, PyTorch, TensorFlow, LangChain, LangGraph) makes it ideal for AI/ML pipelines and data processing.

### Backend Libraries & Frameworks

- **Python Libraries:**
  - **NumPy** — Numerical computing, array operations, and matrix math for ML pipelines.
  - **Pandas** — Data manipulation, loading, transformation, and analysis of structured data.
  - **scikit-learn** — Traditional ML: TF-IDF, feature extraction, similarity metrics, classification, and clustering.
  - **PyTorch** — Deep learning framework for custom neural networks, embeddings, and fine-tuning models.
  - **TensorFlow** — Alternative/complementary deep learning framework for production-scale inference and training.
  - **LangChain** — Framework for building LLM-powered applications; manages prompts, chains, memory, and retrieval-augmented generation (RAG).
  - **LangGraph** — Orchestrates multi-agent workflows and complex reasoning pipelines.

- **Backend Web Frameworks:**
  - **Flask** — Lightweight Python web framework for API routes, middleware, and rapid prototyping.
  - **FastAPI** — Modern async Python framework for high-performance APIs with automatic OpenAPI documentation.

- **Database:**
  - **PostgreSQL** — Robust, production-grade relational database for structured data, user management, document metadata, and indexed search. Supports JSON fields, full-text search, and vector extensions (pgvector).

### Frontend

- **HTML** — Semantic markup for accessible, SEO-friendly web pages.
- **CSS** — Styling and responsive design (mobile-first, flexbox, grid).
- **JavaScript** — Client-side interactivity, form handling, and API communication.
- **React** — Component-based UI framework for building dynamic, reusable interfaces with state management (hooks, Context API, or Redux).
- **Node.js** — Server-side JavaScript runtime for build tools, dev servers, and full-stack development (optional).
- **Express** — Lightweight Node.js web framework (if using Node for the backend instead of or alongside Python).

### Architecture Rationale

- **ML-First:** PyTorch + TensorFlow enable custom embeddings, fine-tuning, and advanced NLP models beyond traditional TF-IDF.
- **Agentic AI:** LangChain + LangGraph support autonomous document analysis, multi-turn reasoning, and tool integration.
- **Performance:** FastAPI with async I/O handles high concurrent requests; PostgreSQL with pgvector indexes enables efficient semantic search.
- **Scalability:** Separation of concerns (Python backend, React frontend, PostgreSQL data layer) enables horizontal scaling and microservices.
- **Developer Experience:** React components + Flask/FastAPI routes provide rapid iteration; comprehensive API docs (FastAPI auto-generates OpenAPI specs).

## Features (detailed)

- Document Upload: Upload PDFs via the UI or `POST /upload` (multipart form, field: `document`). The server saves the file and calls `DocumentAssistant.load_pdf()` to extract and index text.
- Chunking: Documents are split into overlapping text chunks for context-aware retrieval. Chunk metadata includes page numbers and offsets for accurate citations.
- TF-IDF Retrieval: The system computes TF-IDF vectors for chunks and for queries, using cosine similarity to rank relevant chunks.
- Question Answering (extractive): The top chunks are combined to produce an extractive answer with listed source chunks and page references.
- Analytics: `/analysis` returns summary, top keywords, readability score, top phrases, average chunk length, and a small page preview.
- Realtime Demo: The server runs a background emitter that sends periodic `realtime_update` Socket.IO events to connected clients (used by the UI for live charts).

## Architecture & Important Files

- `app.py` — Flask + Socket.IO app and all HTTP routes. See route handlers for behavior and JSON responses.
- `src/pdf_processor.py` — `DocumentAssistant` class: loading PDFs, extracting text, chunking, building TF-IDF vectors, answering queries, and analysis helpers.
- `templates/` — Jinja2 HTML templates (`home.html`, `app.html`, `about.html`, etc.).
- `static/js/app.js` — client-side upload, query logic and Socket.IO client integration.
- `static/css/styles.css` — UI styles.
- `data/uploads/` — persistent folder for uploaded PDF files.
- `data/processed/` — optional folder for intermediate or cached artifacts.

## API Reference (quick examples)

- POST /upload (multipart form)

Request:

```bash
curl -F "document=@./contract.pdf" http://127.0.0.1:5000/upload
```

Success response:

```json
{ "success": true, "metadata": { "document_name": "contract.pdf", "page_count": 23 } }
```

- POST /query (JSON body)

Request:

```bash
curl -H "Content-Type: application/json" -d '{"question":"What is the termination clause?"}' http://127.0.0.1:5000/query
```

Success response (example):

```json
{
  "success": true,
  "result": {
    "answer": "Either party may terminate...",
    "sources": [{"page": 12, "score": 0.91}],
    "context": "...full extracted text snippet..."
  }
}
```

- GET /status

```bash
curl http://127.0.0.1:5000/status
```

Example response:

```json
{ "success": true, "loaded": true, "document_name": "contract.pdf", "page_count": 23, "chunk_count": 184 }
```

- GET /analysis

```bash
curl http://127.0.0.1:5000/analysis
```

Returns summary, keywords, readability score, and additional metadata.

## Installation (developer setup)

1. Clone the repository:

```bash
git clone https://github.com/SohamMore2802/Lex-Legal-Intelligence-Platform.git
cd Lex-Legal-Intelligence-Platform
```

2. Create and activate a virtual environment:

```bash
python -m venv .venv
.\.venv\Scripts\activate    # Windows PowerShell
```

3. Install Python dependencies:

```bash
python -m pip install -r requirements.txt
```

## Running Locally

Run the app (development):

```bash
python app.py
```

Open `http://127.0.0.1:5000` in your browser.

Environment variables:

- `PORT` — override the default port (5000). Example: `PORT=8080 python app.py`.

Notes:

- `app.py` starts a background Socket.IO emitter and expects `eventlet` for async sleep; ensure `eventlet` is installed as in `requirements.txt`.

## Testing & Validation

- Manual smoke tests: upload a known PDF with selectable text and try queries via the UI.
- API tests: use the `curl` examples above to verify endpoints return the expected JSON and status codes.

## Deployment Recommendations

- Production server: use a process manager and the async worker recommended by Flask-SocketIO (`eventlet` or `gevent`).
- Reverse proxy: run behind NGINX for TLS, static file caching, and request handling.
- Persistence & scale: use object storage for uploads (S3), a vector DB (FAISS, Milvus) for persistent indexes, and background workers (Celery, RQ) for heavy processing.

## Extending the Project

- Add configurable chunking options (chunk size, overlap) and UI controls for them.
- Integrate an embeddings-backed vector store for semantic retrieval (if you need semantic matching rather than just TF-IDF).
- Add role-based access and secure upload handling for production use.

## Contributing

1. Fork the repository and create a branch for your feature or fix.
2. Run the app and add tests where appropriate.
3. Open a pull request with a clear description of changes and testing steps.
