// ============================================================
// ELEMENTS
// ============================================================

const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const resetBtn = document.getElementById("resetBtn");
const typingIndicator = document.getElementById("typingIndicator");
const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");



// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHTML(text) {

    const div = document.createElement("div");

    div.textContent = text;

    return div.innerHTML;

}



// ============================================================
// SIMPLE MARKDOWN RENDERER
// ============================================================

function renderMarkdown(text) {

    let html = escapeHTML(text);

    // Bold: **text**
    html = html.replace(
        /\*\*(.+?)\*\*/g,
        "<strong>$1</strong>"
    );

    // Italic: *text*
    html = html.replace(
        /\*(.+?)\*/g,
        "<em>$1</em>"
    );

    // Headers: ### text
    html = html.replace(
        /^### (.+)$/gm,
        "<h4>$1</h4>"
    );

    html = html.replace(
        /^## (.+)$/gm,
        "<h3>$1</h3>"
    );

    html = html.replace(
        /^# (.+)$/gm,
        "<h2>$1</h2>"
    );

    // Unordered list items: - text
    html = html.replace(
        /^- (.+)$/gm,
        "<li>$1</li>"
    );

    // Wrap consecutive <li> in <ul>
    html = html.replace(
        /(<li>.*<\/li>\n?)+/g,
        function (match) {
            return "<ul>" + match + "</ul>";
        }
    );

    // Numbered list items: 1. text
    html = html.replace(
        /^\d+\.\s+(.+)$/gm,
        "<li>$1</li>"
    );

    // Inline code: `text`
    html = html.replace(
        /`(.+?)`/g,
        "<code>$1</code>"
    );

    // Paragraphs: double newline
    html = html.replace(
        /\n\n/g,
        "</p><p>"
    );

    // Single newlines to <br>
    html = html.replace(
        /\n/g,
        "<br>"
    );

    // Wrap in <p>
    html = "<p>" + html + "</p>";

    // Clean up empty paragraphs
    html = html.replace(
        /<p><\/p>/g,
        ""
    );

    return html;

}



// ============================================================
// FORMAT TIME
// ============================================================

function formatTime() {

    const now = new Date();

    return now.toLocaleTimeString(
        "en-US",
        {
            hour: "numeric",
            minute: "2-digit",
            hour12: true
        }
    );

}



// ============================================================
// ADD MESSAGE TO CHAT
// ============================================================

function addMessage(content, isUser) {

    const messageDiv = document.createElement("div");

    messageDiv.className =
        "message " +
        (isUser ? "user-message" : "bot-message");


    const avatarDiv = document.createElement("div");

    avatarDiv.className = "message-avatar";

    avatarDiv.textContent =
        isUser ? "👤" : "🎓";


    const contentDiv = document.createElement("div");

    contentDiv.className = "message-content";


    const bubbleDiv = document.createElement("div");

    bubbleDiv.className = "message-bubble";

    if (isUser) {
        bubbleDiv.textContent = content;
    } else {
        bubbleDiv.innerHTML = renderMarkdown(content);
    }


    const timeDiv = document.createElement("div");

    timeDiv.className = "message-time";

    timeDiv.textContent =
        (isUser ? "You" : "AdmitIQ") +
        " • " +
        formatTime();


    contentDiv.appendChild(bubbleDiv);
    contentDiv.appendChild(timeDiv);

    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentDiv);

    chatMessages.appendChild(messageDiv);

    scrollToBottom();

}



// ============================================================
// SCROLL TO BOTTOM
// ============================================================

function scrollToBottom() {

    requestAnimationFrame(() => {

        chatMessages.scrollTop =
            chatMessages.scrollHeight;

    });

}



// ============================================================
// SHOW / HIDE TYPING
// ============================================================

function showTyping() {

    typingIndicator.classList.add("active");

    scrollToBottom();

}


function hideTyping() {

    typingIndicator.classList.remove("active");

}



// ============================================================
// SEND MESSAGE
// ============================================================

async function sendMessage() {

    const message = chatInput.value.trim();

    if (!message) return;


    // Add user message
    addMessage(message, true);


    // Clear input
    chatInput.value = "";

    chatInput.style.height = "auto";


    // Disable input while processing
    sendBtn.disabled = true;

    chatInput.disabled = true;


    // Show typing
    showTyping();


    try {

        const response = await fetch(
            "/api/chatbot",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    message: message
                })
            }
        );


        const data = await response.json();


        hideTyping();


        if (!response.ok) {

            addMessage(
                "Sorry, something went wrong: " +
                (data.error || "Unknown error"),
                false
            );

        } else {

            addMessage(
                data.reply,
                false
            );

        }

    } catch (error) {

        hideTyping();

        addMessage(
            "Sorry, I couldn't connect to the server. Please make sure the Flask app is running.",
            false
        );

    } finally {

        sendBtn.disabled = false;

        chatInput.disabled = false;

        chatInput.focus();

    }

}



// ============================================================
// RESET CHAT
// ============================================================

async function resetChat() {

    try {

        await fetch(
            "/api/chatbot/reset",
            {
                method: "POST"
            }
        );

    } catch (error) {

        console.error(
            "Failed to reset chat:",
            error
        );

    }


    // Clear all messages except the welcome message
    chatMessages.innerHTML = `

        <div class="message bot-message">

            <div class="message-avatar">
                🎓
            </div>

            <div class="message-content">

                <div class="message-bubble">
                    Hey there! 👋 I'm <strong>AdmitIQ</strong>, your College Admission Assistant.
                    <br><br>
                    I'm here to help you navigate the exciting (and sometimes stressful!) world of college applications.
                    Whether you need help brainstorming essay topics, understanding deadlines, or building your activity list — I've got you covered.
                    <br><br>
                    <strong>What would you like to work on today?</strong>
                </div>

                <div class="message-time">
                    AdmitIQ • Just now
                </div>

            </div>

        </div>

    `;

    scrollToBottom();

}



// ============================================================
// AUTO-RESIZE TEXTAREA
// ============================================================

function autoResize() {

    chatInput.style.height = "auto";

    chatInput.style.height =
        Math.min(
            chatInput.scrollHeight,
            140
        ) + "px";

}



// ============================================================
// EVENT LISTENERS
// ============================================================

// Send on button click
sendBtn.addEventListener(
    "click",
    sendMessage
);


// Send on Enter (Shift+Enter for newline)
chatInput.addEventListener(
    "keydown",

    function (event) {

        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {

            event.preventDefault();
            sendMessage();

        }

    }
);


// Auto-resize textarea
chatInput.addEventListener(
    "input",
    autoResize
);


// Reset chat
resetBtn.addEventListener(
    "click",
    resetChat
);


// Sidebar toggle (mobile)
sidebarToggle.addEventListener(
    "click",

    function () {

        sidebar.classList.toggle("open");

    }
);


// Close sidebar when clicking outside (mobile)
document.addEventListener(
    "click",

    function (event) {

        if (
            window.innerWidth <= 768 &&
            sidebar.classList.contains("open") &&
            !sidebar.contains(event.target) &&
            !sidebarToggle.contains(event.target)
        ) {

            sidebar.classList.remove("open");

        }

    }
);



// ============================================================
// INITIAL FOCUS
// ============================================================

chatInput.focus();
