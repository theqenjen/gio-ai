# Gio AI — local Ollama chat

A small, private AI chat app with a FastAPI backend and a responsive web interface. Responses stream from Ollama; conversations are kept in browser memory and are not saved to a server or database.

## Requirements

- Python 3.10+
- [Ollama](https://ollama.com/download) installed and running
- A model downloaded in Ollama, for example `llama3.2`

## Run locally

```bash
# Download a model (once)
ollama pull llama3.2

# Install and start the app
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
python main.py
```

Open <http://127.0.0.1:8000>.

Alternatively, start the API with `uvicorn main:app --reload --host 127.0.0.1 --port 8000`.

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `llama3.2` | Default model used if no model is selected in the UI |
| `PORT` | `8000` | Port used by `python main.py` |

The model selector automatically lists models installed in Ollama. If Ollama is running elsewhere, set `OLLAMA_BASE_URL` before starting the app.

## API

- `GET /api/health` — app status and configured Ollama URL
- `GET /api/models` — locally available Ollama models
- `POST /api/chat` — streamed Ollama chat response (newline-delimited JSON)

