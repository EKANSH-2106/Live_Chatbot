
const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const chatMessages = document.getElementById("chat-messages");
const sendButton = document.getElementById("send-button");

const newChatButton = document.getElementById("new-chat-button");
const conversationList = document.getElementById("conversation-list");
const sidebar = document.getElementById("sidebar");
const menuButton = document.getElementById("menu-button");
const sidebarOverlay = document.getElementById("sidebar-overlay");

const CONVERSATION_KEY = "liveChatConversationId";

let conversationId = null;
let isReady = false;
let isSending = false;
let isSwitching = false;

function addMessage(text, sender) {
    const element = document.createElement("div");
    element.classList.add("message");

    if (sender === "user") {
        element.classList.add("user-message");
    } else {
        element.classList.add("bot-message");
    }

    element.textContent = text;
    chatMessages.appendChild(element);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    return element;
}

function showWelcome() {
    addMessage(
        "Hello! I'm your chatbot. Send me a message to get started.",
        "bot"
    );
}

function showTypingIndicator() {
    const indicator = addMessage("AI is thinking...", "bot");
    indicator.classList.add("typing-indicator");
    return indicator;
}

async function apiRequest(url, options = {}) {
    const response = await fetch(url, options);

    if (!response.ok) {
        let message = `Request failed (${response.status})`;

        try {
            const data = await response.json();
            message = data.detail || message;
        } catch {
            // Keep the fallback error message.
        }

        throw new Error(message);
    }

    return response.json();
}

function setCurrentConversation(id) {
    conversationId = Number(id);
    localStorage.setItem(CONVERSATION_KEY, String(conversationId));
}

function closeSidebar() {
    sidebar.classList.remove("open");
    sidebarOverlay.classList.remove("visible");
    menuButton.setAttribute("aria-expanded", "false");
}

function toggleSidebar() {
    const isOpen = sidebar.classList.toggle("open");
    sidebarOverlay.classList.toggle("visible", isOpen);
    menuButton.setAttribute("aria-expanded", String(isOpen));
}

async function refreshConversationList() {
    try {
        const conversations = await apiRequest("/api/conversations");

        conversationList.replaceChildren();

        if (conversations.length === 0) {
            const empty = document.createElement("p");
            empty.className = "sidebar-empty";
            empty.textContent = "No conversations yet. Start a new chat.";
            conversationList.appendChild(empty);
            return;
        }

        conversations.forEach((conversation) => {
            const row = document.createElement("div");
            row.className = "conversation-item";

            const selectButton = document.createElement("button");
            selectButton.type = "button";
            selectButton.className = "conversation-select";
            selectButton.textContent = conversation.title || "New conversation";
            selectButton.title = selectButton.textContent;

            if (Number(conversation.id) === conversationId) {
                selectButton.classList.add("active");
                selectButton.setAttribute("aria-current", "true");
            }

            selectButton.addEventListener("click", async () => {
                await switchConversation(conversation.id);
            });

            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "delete-chat-button";
            deleteButton.textContent = "×";
            deleteButton.title = "Delete conversation";
            deleteButton.setAttribute(
                "aria-label",
                `Delete ${conversation.title || "conversation"}`
            );

            deleteButton.addEventListener("click", async () => {
                await deleteConversation(conversation.id);
            });

            row.append(selectButton, deleteButton);
            conversationList.appendChild(row);
        });
    } catch (error) {
        console.error("Could not load conversation list:", error);
        conversationList.replaceChildren();

        const message = document.createElement("p");
        message.className = "sidebar-empty";
        message.textContent = "Could not load chat history. Refresh to retry.";
        conversationList.appendChild(message);
    }
}

async function createConversation() {
    const conversation = await apiRequest("/api/conversations", {
        method: "POST"
    });

    setCurrentConversation(conversation.id);
    chatMessages.replaceChildren();
    showWelcome();

    await refreshConversationList();
    closeSidebar();
    messageInput.focus();
}

async function switchConversation(id) {
    if (isSending || isSwitching) {
        return;
    }

    isSwitching = true;
    sendButton.disabled = true;

    try {
        const messages = await apiRequest(
            `/api/conversations/${Number(id)}/messages`
        );

        setCurrentConversation(id);
        chatMessages.replaceChildren();

        if (messages.length === 0) {
            showWelcome();
        } else {
            messages.forEach((message) => {
                addMessage(message.content, message.role);
            });
        }

        await refreshConversationList();
        closeSidebar();
    } catch (error) {
        console.error("Could not open conversation:", error);
        addMessage(`Could not open conversation: ${error.message}`, "bot");
    } finally {
        isSwitching = false;
        sendButton.disabled = !isReady;
        messageInput.focus();
    }
}

async function deleteConversation(id) {
    if (isSending || isSwitching) {
        return;
    }

    const confirmed = window.confirm(
        "Delete this conversation and its saved messages? This cannot be undone."
    );

    if (!confirmed) {
        return;
    }

    try {
        await apiRequest(`/api/conversations/${Number(id)}`, {
            method: "DELETE"
        });

        if (Number(id) === conversationId) {
            localStorage.removeItem(CONVERSATION_KEY);
            conversationId = null;
            await createConversation();
        } else {
            await refreshConversationList();
        }
    } catch (error) {
        console.error("Could not delete conversation:", error);
        addMessage(
            `Could not delete conversation: ${error.message}`,
            "bot"
        );
    }
}

chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const message = messageInput.value.trim();

    if (!message || !isReady || isSending || isSwitching) {
        return;
    }

    isSending = true;
    sendButton.disabled = true;
    sendButton.textContent = "Thinking...";

    addMessage(message, "user");
    messageInput.value = "";

    const typingIndicator = showTypingIndicator();

    try {
        const data = await apiRequest("/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message,
                conversation_id: conversationId
            })
        });

        typingIndicator.remove();
        addMessage(data.reply, "assistant");

        setCurrentConversation(data.conversation_id);
        await refreshConversationList();
    } catch (error) {
        console.error("Chat request failed:", error);
        typingIndicator.remove();

        addMessage(
            `Sorry, I couldn't get a response. ${error.message}`,
            "bot"
        );
    } finally {
        isSending = false;
        sendButton.disabled = !isReady;
        sendButton.textContent = "Send";
        messageInput.focus();
    }
});

newChatButton.addEventListener("click", async () => {
    if (isSending || isSwitching) {
        return;
    }

    newChatButton.disabled = true;

    try {
        await createConversation();
    } catch (error) {
        console.error("Could not create a new chat:", error);
        addMessage(`Could not create a new chat: ${error.message}`, "bot");
    } finally {
        newChatButton.disabled = false;
    }
});

menuButton.addEventListener("click", toggleSidebar);
sidebarOverlay.addEventListener("click", closeSidebar);

async function initializeChat() {
    sendButton.disabled = true;
    newChatButton.disabled = true;

    try {
        let savedId = localStorage.getItem(CONVERSATION_KEY);

        if (savedId && /^\d+$/.test(savedId)) {
            try {
                const messages = await apiRequest(
                    `/api/conversations/${Number(savedId)}/messages`
                );

                setCurrentConversation(savedId);
                chatMessages.replaceChildren();

                if (messages.length === 0) {
                    showWelcome();
                } else {
                    messages.forEach((message) => {
                        addMessage(message.content, message.role);
                    });
                }
            } catch {
                localStorage.removeItem(CONVERSATION_KEY);
                conversationId = null;
            }
        }

        if (conversationId === null) {
            await createConversation();
        }

        await refreshConversationList();
        isReady = true;
    } catch (error) {
        console.error("Chat initialization failed:", error);
        addMessage(
            "Could not connect to the chatbot. Check that the backend is running, then refresh.",
            "bot"
        );
    } finally {
        sendButton.disabled = !isReady;
        newChatButton.disabled = !isReady;
    }
}

initializeChat();
