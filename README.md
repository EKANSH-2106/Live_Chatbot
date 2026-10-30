# 🤖 Live Chatbot

A locally-hosted AI chatbot web application powered by **FastAPI**, **Ollama**, and **SQLite**. Chat with a local LLM model entirely on your own machine — no API keys, no internet required.

---

## ✨ Features

- 💬 **Multi-conversation support** — create, switch, and delete chat sessions
- 🧠 **Ollama integration** — runs any local model (default: `qwen3:4b`)
- 💾 **Persistent history** — all conversations saved in a local SQLite database
- ⚡ **FastAPI backend** — clean REST API with automatic docs at `/docs`
- 🌐 **Vanilla frontend** — lightweight HTML/CSS/JS, no frameworks needed

---

## 🗂️ Project Structure

```
LIVE_CHATBOT/
├── main.py          # FastAPI app & all API endpoints
├── models.py        # SQLAlchemy ORM models (Conversation, Message)
├── database.py      # Database engine and session setup
├── init_db.py       # Script to manually initialize & verify the database
├── static/
│   ├── index.html   # Frontend UI
│   ├── script.js    # Chat logic and API calls
│   └── style.css    # Styling
└── README.md
```

---

## 🛠️ Tech Stack

| Layer      | Technology                  |
|------------|-----------------------------|
| Backend    | Python, FastAPI              |
| AI Model   | Ollama (`qwen3:4b`)          |
| Database   | SQLite + SQLAlchemy ORM      |
| Frontend   | HTML, CSS, JavaScript        |

---

## 🚀 Getting Started

### Prerequisites

- Python 3.10+
- [Ollama](https://ollama.com/) installed and running
- The `qwen3:4b` model pulled in Ollama

```bash
ollama pull qwen3:4b
```

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/your-username/live-chatbot.git
cd live-chatbot
```

2. **Create and activate a virtual environment**

```bash
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate
```

3. **Install dependencies**

```bash
pip install fastapi sqlalchemy requests uvicorn
```

4. **Run the application**

```bash
uvicorn main:app --reload
```

5. **Open your browser** and navigate to:

```
http://localhost:8000
```

> The database (`chatbot.db`) is created automatically on first run. You can also run `python init_db.py` to initialize and verify it manually.

---

## 📡 API Endpoints

| Method   | Endpoint                                    | Description                  |
|----------|---------------------------------------------|------------------------------|
| `GET`    | `/api/health`                               | Health check                 |
| `POST`   | `/api/conversations`                        | Create a new conversation    |
| `GET`    | `/api/conversations`                        | List all conversations       |
| `GET`    | `/api/conversations/{id}/messages`          | Get messages in a conversation |
| `DELETE` | `/api/conversations/{id}`                   | Delete a conversation        |
| `POST`   | `/api/chat`                                 | Send a message and get a reply |

Interactive API docs available at `http://localhost:8000/docs`.

---

## ⚙️ Configuration

You can change the AI model or Ollama URL by editing these constants in `main.py`:

```python
OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL_NAME = "qwen3:4b"
```

---

## 📝 License

This project is open source and available under the [MIT License](LICENSE).
