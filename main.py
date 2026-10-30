
from pathlib import Path
from typing import Literal

import requests
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy import select

from database import Base, SessionLocal, engine
from models import Conversation, Message


app = FastAPI(
    title="Live Chatbot API",
    description="A local AI chatbot powered by FastAPI, SQLite and Ollama.",
    version="1.0.0",
)

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL_NAME = "qwen3:4b"

MAX_MESSAGE_LENGTH = 4000

# Create database tables automatically when the application starts.
Base.metadata.create_all(bind=engine)


# -----------------------------
# Request and response models
# -----------------------------

class ChatRequest(BaseModel):
    message: str = Field(
        min_length=1,
        max_length=MAX_MESSAGE_LENGTH,
    )
    conversation_id: int | None = Field(default=None, gt=0)


class ConversationResponse(BaseModel):
    id: int
    title: str


class MessageResponse(BaseModel):
    role: Literal["user", "assistant"]
    content: str


# -----------------------------
# Health check
# -----------------------------

@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "application": "Live Chatbot",
        "model": MODEL_NAME,
    }


# -----------------------------
# Create a conversation
# -----------------------------

@app.post(
    "/api/conversations",
    response_model=ConversationResponse,
)
def create_conversation():
    with SessionLocal() as db:
        conversation = Conversation()
        db.add(conversation)
        db.commit()
        db.refresh(conversation)

        return {
            "id": conversation.id,
            "title": conversation.title,
        }


# -----------------------------
# List all conversations
# -----------------------------

@app.get("/api/conversations")
def list_conversations():
    with SessionLocal() as db:
        conversations = db.scalars(
            select(Conversation).order_by(
                Conversation.id.desc()
            )
        ).all()

        return [
            {
                "id": item.id,
                "title": item.title,
            }
            for item in conversations
        ]


# -----------------------------
# Retrieve conversation messages
# -----------------------------

@app.get(
    "/api/conversations/{conversation_id}/messages",
    response_model=list[MessageResponse],
)
def get_conversation_messages(conversation_id: int):
    if conversation_id <= 0:
        raise HTTPException(
            status_code=400,
            detail="Invalid conversation ID.",
        )

    with SessionLocal() as db:
        conversation = db.get(
            Conversation,
            conversation_id,
        )

        if conversation is None:
            raise HTTPException(
                status_code=404,
                detail="Conversation not found.",
            )

        messages = db.scalars(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.id)
        ).all()

        return [
            {
                "role": item.role,
                "content": item.content,
            }
            for item in messages
        ]


# -----------------------------
# Delete a conversation
# -----------------------------

@app.delete("/api/conversations/{conversation_id}")
def delete_conversation(conversation_id: int):
    if conversation_id <= 0:
        raise HTTPException(
            status_code=400,
            detail="Invalid conversation ID.",
        )

    with SessionLocal() as db:
        conversation = db.get(
            Conversation,
            conversation_id,
        )

        if conversation is None:
            raise HTTPException(
                status_code=404,
                detail="Conversation not found.",
            )

        db.delete(conversation)
        db.commit()

        return {
            "message": "Conversation deleted successfully."
        }


# -----------------------------
# AI chat endpoint
# -----------------------------

@app.post("/api/chat")
def chat(request: ChatRequest):
    user_message = request.message.strip()

    if not user_message:
        raise HTTPException(
            status_code=400,
            detail="Please enter a message.",
        )

    # Load conversation history and save the user message.
    with SessionLocal() as db:

        if request.conversation_id is None:
            conversation = Conversation()
            db.add(conversation)
            db.commit()
            db.refresh(conversation)

        else:
            conversation = db.get(
                Conversation,
                request.conversation_id,
            )

            if conversation is None:
                raise HTTPException(
                    status_code=404,
                    detail="Conversation not found.",
                )

        previous_messages = db.scalars(
            select(Message)
            .where(
                Message.conversation_id == conversation.id
            )
            .order_by(Message.id)
        ).all()

        messages = [
            {
                "role": item.role,
                "content": item.content,
            }
            for item in previous_messages
        ]

        messages.append({
            "role": "user",
            "content": user_message,
        })

        user_record = Message(
            conversation_id=conversation.id,
            role="user",
            content=user_message,
        )

        db.add(user_record)

        if conversation.title == "New conversation":
            conversation.title = user_message[:60]

        db.commit()

        current_conversation_id = conversation.id

    # Call Ollama outside the database session.
    try:
        response = requests.post(
            OLLAMA_URL,
            json={
                "model": MODEL_NAME,
                "messages": messages,
                "stream": False,
                "keep_alive": "30m",
            },
            timeout=(10, 180),
        )

        response.raise_for_status()
        result = response.json()

        reply = result["message"]["content"].strip()

        if not reply:
            raise ValueError("The model returned an empty response.")

    except requests.Timeout:
        raise HTTPException(
            status_code=504,
            detail="The AI model took too long to respond. Please try again.",
        )

    except requests.ConnectionError:
        raise HTTPException(
            status_code=503,
            detail="Ollama is unavailable. Please start Ollama and try again.",
        )

    except requests.RequestException as exc:
        print(f"Ollama request error: {exc}")

        raise HTTPException(
            status_code=502,
            detail="There was a problem communicating with Ollama.",
        )

    except (ValueError, KeyError, TypeError):
        raise HTTPException(
            status_code=502,
            detail="The AI model returned an invalid response.",
        )

    # Save the assistant response in a new database session.
    with SessionLocal() as db:
        assistant_record = Message(
            conversation_id=current_conversation_id,
            role="assistant",
            content=reply,
        )

        db.add(assistant_record)
        db.commit()

    return {
        "reply": reply,
        "conversation_id": current_conversation_id,
    }


# -----------------------------
# Serve frontend
# -----------------------------

app.mount(
    "/",
    StaticFiles(directory=STATIC_DIR, html=True),
    name="static",
)
