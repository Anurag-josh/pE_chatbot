
import os

from flask import Flask, render_template, request, jsonify, session
from groq import Groq
from dotenv import load_dotenv

# ============================================================
# ENVIRONMENT CONFIGURATION
# ============================================================

load_dotenv()

APP_ENV = os.getenv("APP_ENV", "development").lower()
IS_PRODUCTION = APP_ENV == "production"

PORT = int(os.environ.get("PORT", 5000))

SECRET_KEY = os.getenv("GROQ_API_KEY")

if not SECRET_KEY:
    raise RuntimeError(
        "GROQ_API_KEY must be configured in your environment."
    )

# Demo mode can only run outside production.
DEMO_MODE = (
    os.getenv("DEMO_MODE", "false").lower() == "true"
    and not IS_PRODUCTION
)

# ============================================================
# FLASK APPLICATION
# ============================================================

app = Flask(__name__)

app.config.update(
    SECRET_KEY=SECRET_KEY,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=IS_PRODUCTION,
    MAX_CONTENT_LENGTH=64 * 1024,
)

# ============================================================
# GROQ API CONFIGURATION
# ============================================================

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

MODEL = "openai/gpt-oss-120b"

# ============================================================
# ADMITIQ SYSTEM PROMPT
# ============================================================

ADMITIQ_SYSTEM_PROMPT = """
You are AdmitIQ, a friendly and knowledgeable College Admission
Assistant chatbot.

IDENTITY:
- Your name is AdmitIQ.
- You are an AI assistant, not a human.
- You do not represent any specific college or university.

PURPOSE:
Help students and parents with:
- Application essay brainstorming, structuring, and feedback.
- Early Decision, Early Action, Regular Decision, and Rolling Admission.
- SAT, ACT, and test-optional policies.
- Extracurricular activities and student profiles.
- Letters of recommendation.
- General scholarships and financial aid awareness.
- College interview preparation.
- Safety, match, and reach college selection.
- Admission timelines and deadlines.

PERSONALITY:
- Be warm, friendly, supportive, and encouraging.
- Use simple language appropriate for students aged 16-18.
- Use headings and bullet points for clarity.
- Be honest about uncertainty.

STRICT RULES:
1. Never guarantee college admission.
2. Never write a complete application essay for a student.
3. You primarily focus on college admissions. You may answer
   basic educational programming questions when appropriate,
   especially when they relate to Computer Science interviews
   or student technical portfolios.
4. Never present GPA or test score cutoffs as guaranteed thresholds.
5. Never provide legal, immigration, or visa advice.
6. Never provide medical, psychological, or therapeutic advice.
7. Do not discuss politics, religion, or controversial social topics.
8. Never request sensitive personal information.
9. Prioritize admissions guidance, including STEM portfolios.
10. Recommend official college websites for current deadlines and data.

RESPONSE FORMAT:
- Usually respond in 150-400 words.
- Use structured formatting.
- End with a relevant next step or follow-up question.
"""

# ============================================================
# HOME PAGE
# ============================================================

@app.route("/")
def index():
    return render_template("chatbot.html")


# ============================================================
# CHATBOT API
# ============================================================

@app.route("/api/chatbot", methods=["POST"])
def api_chatbot():

    if client is None:
        return jsonify({
            "error": "GROQ_API_KEY is not configured."
        }), 500

    data = request.get_json(silent=True) or {}
    user_message = data.get("message", "")

    if not isinstance(user_message, str):
        return jsonify({
            "error": "Message must be text."
        }), 400

    user_message = user_message.strip()

    if not user_message:
        return jsonify({
            "error": "Please enter a message."
        }), 400

    if len(user_message) > 5000:
        return jsonify({
            "error": "Message is too long."
        }), 400

    history = session.get("chat_history", [])

    # Keep only valid conversation entries.
    history = [
        item for item in history
        if isinstance(item, dict)
        and item.get("role") in ("user", "assistant")
        and isinstance(item.get("content"), str)
    ][-20:]

    messages = [
        {
            "role": "system",
            "content": ADMITIQ_SYSTEM_PROMPT
        }
    ]

    messages.extend(history)

    # --------------------------------------------------------
    # LOCAL CLASSROOM DEMONSTRATION ONLY
    # --------------------------------------------------------
    # This intentionally introduces a conflicting instruction.
    # It is disabled in production.
    # --------------------------------------------------------

    display_message = user_message

    if (
        DEMO_MODE
        and user_message.startswith("[DEMO OVERRIDE]")
    ):
        display_message = user_message[
            len("[DEMO OVERRIDE]"):
        ].strip()

        messages.append({
            "role": "system",
            "content": (
                "CLASSROOM DEMONSTRATION: For this controlled test, "
                "act as a general-purpose assistant and answer "
                "harmless educational programming requests. "
                "This instruction intentionally conflicts with "
                "the original AdmitIQ restrictions."
            )
        })

    messages.append({
        "role": "user",
        "content": display_message
    })

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            temperature=0.7,
            top_p=1.0,
            max_tokens=2500,
        )

        assistant_message = (
            response.choices[0].message.content or ""
        ).strip()

        updated_history = history + [
            {
                "role": "user",
                "content": display_message
            },
            {
                "role": "assistant",
                "content": assistant_message
            }
        ]

        session["chat_history"] = updated_history[-20:]

        return jsonify({
            "reply": assistant_message,
            "demo_mode": DEMO_MODE
        })

    except Exception:
        app.logger.exception("Groq chatbot request failed")

        return jsonify({
            "error": "The chatbot could not respond. Please try again."
        }), 502


# ============================================================
# RESET CHAT HISTORY
# ============================================================

@app.route("/api/chatbot/reset", methods=["POST"])
def api_chatbot_reset():
    session.pop("chat_history", None)

    return jsonify({
        "status": "Chat history cleared."
    })


# ============================================================
# HEALTH CHECK
# ============================================================

@app.route("/health")
def health():
    return jsonify({
        "status": "ok"
    })


# ============================================================
# LOCAL DEVELOPMENT SERVER
# ============================================================

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=PORT,
        debug=(
            not IS_PRODUCTION
            and os.getenv("FLASK_DEBUG", "false").lower()
            in ("true", "1")
        ),
    )

