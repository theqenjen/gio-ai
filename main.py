from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Literal

import httpx
from fastapi import FastAPI
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")
STATIC_DIR = Path(__file__).parent / "static"

app = FastAPI(title="Gio AI", description="A local AI chat app powered by Ollama")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(min_length=1, max_length=100_000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=100)
    model: str | None = Field(default=None, min_length=1, max_length=100)


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "ollama_url": OLLAMA_BASE_URL, "default_model": OLLAMA_MODEL}


@app.get("/api/models")
async def models() -> dict[str, list[str]]:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            response.raise_for_status()
        return {"models": [model["name"] for model in response.json().get("models", [])]}
    except (httpx.HTTPError, ValueError) as exc:
        return {"models": [], "error": f"Could not reach Ollama: {exc}"}


@app.post("/api/chat")
async def chat(request: ChatRequest) -> StreamingResponse:
    model = request.model or OLLAMA_MODEL
    payload = {
        "model": model,
        "messages": [message.model_dump() for message in request.messages],
        "stream": True,
    }

    async def stream_response():
        timeout = httpx.Timeout(connect=10.0, read=None, write=30.0, pool=10.0)
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream("POST", f"{OLLAMA_BASE_URL}/api/chat", json=payload) as response:
                    if response.is_error:
                        detail = (await response.aread()).decode("utf-8", errors="replace")
                        yield json.dumps({"error": f"Ollama returned {response.status_code}: {detail}"}) + "\n"
                        return
                    async for line in response.aiter_lines():
                        if line:
                            yield line + "\n"
        except httpx.HTTPError as exc:
            yield json.dumps({"error": f"Could not connect to Ollama at {OLLAMA_BASE_URL}: {exc}"}) + "\n"

    return StreamingResponse(stream_response(), media_type="application/x-ndjson")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=int(os.getenv("PORT", "8000")), reload=True)
