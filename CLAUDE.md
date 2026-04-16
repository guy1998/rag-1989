# RAG-1989 — CLAUDE.md

## Project Overview

RAG-1989 is a **GraphRAG (Graph-based Retrieval-Augmented Generation)** system that uses **GraphMeRT** as its core document preprocessing and knowledge extraction method. Given a set of PDF documents, the system builds a heterogeneous knowledge graph, trains a graph neural network on it, and uses semantic retrieval to answer user questions via a local LLM (Ollama).

---

## What is GraphMeRT?

**GraphMeRT** (Graph Masked Entity Representation Training) is a compact neurosymbolic framework for extracting high-quality knowledge graphs (KGs) from unstructured text. It is an encoder-only transformer architecture that combines:

- **Masked Language Modeling (MLM)** over root/text tokens — learns syntactic and semantic structure
- **Masked Node Modeling (MNM)** over symbolic leaf nodes (KG triples) — enforces ontology-consistent, factual constraints

The joint training objective aligns neural representations with curated KG structure, enabling the model to distill factual, structurally valid triples during extraction — without prompt engineering or large LLMs. GraphMeRT achieves a FActScore of 69.8%, outperforming larger LLM baselines, making it well-suited for high-stakes domains (medical, legal).

In this project, GraphMeRT is the **preprocessing layer**: PDFs are converted into chain graphs (text nodes + KG leaf nodes), and the model is trained via masked entity prediction before being used for retrieval.

---

## Architecture

```
PDF Documents
     │
     ▼
extract_sentences_from_pdf()        ← pdfplumber + NLTK
     │
     ├──► SentenceTransformer embeddings (all-MiniLM-L6-v2, 384d)
     │         │
     │         └──► PCA → 10d (target_dim)
     │
     └──► AutoKGBuilder (spaCy SVO triples)
               │
               └──► SeedKG (entity2id / relation2id vocab)
                         │
                         ▼
              pdfs_to_chain_graphs()
              ┌────────────────────────────────┐
              │  chain graph per window:        │
              │   • seq_len=5  text nodes       │
              │   • num_leaves=2 KG leaf nodes  │
              │   • 30% leaf masking for MLM    │
              └────────────┬───────────────────┘
                           │
                           ▼
              GraphMERTDataset + collate_fn()
                           │
                           ▼
              GraphMERTModel (graph_mert.py)
              ┌──────────────────────────────┐
              │  Linear projection (10→64)   │
              │  HGTLayer × 2  (hgat.py)     │
              │  TransformerEncoder          │
              │  Classification head         │
              └──────────────────────────────┘
                           │
                    CrossEntropyLoss
                 (only on masked positions)
                           │
                           ▼
              Saved model (.pth) + corpus (.pt)
                           │
                           ▼
              RetrieverQA (graph_inference.py)
              Cosine similarity search at query time
                           │
                           ▼
              Ollama LLM (llama3.1) — streaming RAG answer
```

---

## File Map

| File | Role |
|------|------|
| [api/main.py](api/main.py) | Flask REST API — all endpoints, model lifecycle |
| [api/data_processing.py](api/data_processing.py) | PDF ingestion, KG extraction, chain-graph construction |
| [api/graph_mert.py](api/graph_mert.py) | GraphMERTModel — HGT + TransformerEncoder + head |
| [api/hgat.py](api/hgat.py) | HGTLayer — type-aware multi-head attention |
| [api/train.py](api/train.py) | Training loop, progress tracking |
| [api/graph_inference.py](api/graph_inference.py) | RetrieverQA — cosine similarity semantic search |
| [api/chat_service.py](api/chat_service.py) | SQLAlchemy ORM — Chat/Message persistence (PostgreSQL) |
| [api/requirements.txt](api/requirements.txt) | Python dependencies |

---

## API Endpoints

Base: `http://localhost:5000/api`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/train` | Upload PDFs, train a new GraphMeRT model |
| POST | `/re-train` | Retrain an existing model with updated PDFs |
| GET | `/train/progress/<model_name>` | Poll training progress (0–100) |
| POST | `/generate` | Streaming RAG answer (SSE) |
| GET | `/models` | List all trained models |
| GET | `/model_pdfs/<model_name>` | List PDFs associated with a model |
| GET | `/graph/<model_name>` | KG as JSON node-link (NetworkX) |
| GET | `/graph/<model_name>/png` | KG visualized as PNG |
| GET | `/chat/list` | List all persisted chats |
| GET | `/chat/info/<chat_id>` | Retrieve a single chat with messages |

---

## Key Hyperparameters

| Parameter | Value | Location |
|-----------|-------|----------|
| `seq_len` | 5 | text nodes per chain graph window |
| `num_leaves` | 2 | KG leaf nodes per graph |
| `target_dim` | 10 | embedding dim after PCA |
| `hidden_dim` | 64 | GraphMERTModel hidden size |
| `n_heads` | 4 | HGT attention heads |
| `num_hgt_layers` | 2 | stacked HGT layers |
| `rel_vocab_size` | 1000 | relation vocabulary size |
| `mask_prob` | 0.30 | fraction of leaves masked during training |
| `epochs` | 3 | training epochs |
| `lr` | 1e-3 | Adam learning rate |
| `batch_size` | 2 | DataLoader batch size |

---

## External Services

- **Ollama** — local LLM server (`OLLAMA_API_URL`, default `http://localhost:11434/generate`; model `OLLAMA_MODEL`, default `llama3.1`)
- **PostgreSQL** — chat persistence (`postgresql://admin:password@localhost:5432/mpgraphrag`)
- **SentenceTransformers** — `all-MiniLM-L6-v2` for corpus and query embeddings
- **spaCy** — dependency-parsed SVO triple extraction (requires `en_core_web_sm`)

---

## Environment Variables

```
OLLAMA_API_URL=http://localhost:11434/generate
OLLAMA_MODEL=llama3.1
OLLAMA_API_KEY=          # optional
DATABASE_URL=postgresql://admin:password@localhost:5432/mpgraphrag   # via chat_service.py
```

---

## Storage Layout

```
models/
  <model_name>/
    model.pth          # trained GraphMERTModel weights
    retriever_kg.pt    # serialized RetrieverQA (corpus + triples + embeddings)
    graph.gpickle      # NetworkX KG for visualization
    pdfs/              # uploaded source PDFs
```

---

## Development Notes

- The Flask server runs on `0.0.0.0:5000`; CORS is open to `http://localhost:5173` (Vite frontend assumed)
- Training runs in a **background thread** (`threading.Thread`); use `/train/progress/<name>` to poll
- `generate` endpoint uses **Server-Sent Events (SSE)** — clients must handle chunked streaming
- spaCy model `en_core_web_sm` must be downloaded: `python -m spacy download en_core_web_sm`
- NLTK `punkt` tokenizer is auto-downloaded on first run
- HGTLayer distinguishes two node types: `'text'` (sentence embeddings) and `'leaf'` (KG triple nodes)
- The GraphMeRT loss only backpropagates through **masked leaf positions** (`ignore_index=-100`)
