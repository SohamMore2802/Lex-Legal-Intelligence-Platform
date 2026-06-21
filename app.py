import os
import time
import random
from threading import Event
from flask import Flask, render_template, request, jsonify
from werkzeug.utils import secure_filename
from flask_socketio import SocketIO
from src.pdf_processor import DocumentAssistant

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "data", "uploads")

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app = Flask(__name__)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024  # 50 MB

# enable CORS for socketio served client if needed (kept simple)
socketio = SocketIO(app, cors_allowed_origins="*")

assistant = DocumentAssistant(base_dir=BASE_DIR)

# Background real-time emitter control
thread_stop_event = Event()


def realtime_emitter():
    """Background task that emits realtime updates to connected clients.

    For demo purposes this emits a timestamp and a random value every second.
    Replace or extend with real metrics (processing progress, extraction counts, etc.).
    """
    while not thread_stop_event.is_set():
        payload = {
            "ts": int(time.time() * 1000),
            "value": random.random() * 100,
        }
        socketio.emit("realtime_update", payload)
        socketio.sleep(1)


@app.route("/")
@app.route("/home")
@app.route("/index")
def index():
    return render_template("home.html")


@app.route("/app")
def app_page():
    return render_template("app.html")


@app.route("/about")
def about_page():
    return render_template("about.html")


@app.route("/faq")
def faq_page():
    return render_template("faq.html")


@app.route("/contact")
def contact_page():
    return render_template("contact.html")


@app.route("/upload", methods=["POST"])
def upload_document():
    if "document" not in request.files:
        return jsonify({"success": False, "message": "No file uploaded."}), 400

    document = request.files["document"]
    if document.filename == "":
        return jsonify({"success": False, "message": "Please choose a PDF to upload."}), 400

    filename = secure_filename(document.filename)
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    document.save(filepath)

    try:
        metadata = assistant.load_pdf(filepath)
    except Exception as exc:
        return jsonify({"success": False, "message": str(exc)}), 500

    return jsonify({"success": True, "metadata": metadata})


@app.route("/query", methods=["POST"])
def query_document():
    data = request.get_json(force=True)
    question = data.get("question", "").strip()
    if not question:
        return jsonify({"success": False, "message": "Please enter a question."}), 400

    try:
        result = assistant.ask(question)
    except Exception as exc:
        return jsonify({"success": False, "message": str(exc)}), 500

    return jsonify({"success": True, "result": result})


@app.route("/status", methods=["GET"])
def status():
    return jsonify({
        "success": True,
        "loaded": assistant.has_document,
        "document_name": assistant.document_name,
        "page_count": assistant.page_count,
        "chunk_count": len(assistant.chunks),
    })


@app.route("/analysis", methods=["GET"])
def analysis():
    if not assistant.has_document:
        return jsonify({"success": False, "message": "No document loaded."}), 400

    metadata = {
        "summary": assistant.summarize(),
        "keywords": assistant.extract_keywords(),
        "readability_score": assistant._flesch_reading_ease(assistant.document_text),
        "approximate_word_count": assistant._count_words(assistant.document_text),
        "average_chunk_length": assistant._avg_chunk_length(),
        "top_phrases": assistant._top_phrases(assistant.document_text),
        "key_sections": assistant._extract_sections(assistant.document_text),
        "page_preview": assistant._page_preview(),
    }

    return jsonify({
        "success": True,
        **metadata,
    })


@app.route("/reset", methods=["POST"])
def reset():
    assistant.document_name = None
    assistant.page_count = 0
    assistant.chunks = []
    assistant.embeddings = None
    assistant.document_text = ""
    assistant.has_document = False
    return jsonify({"success": True})


if __name__ == "__main__":
    # start background realtime emitter
    socketio.start_background_task(realtime_emitter)
    # use socketio.run to enable websocket support; eventlet is recommended in requirements
    port = int(os.environ.get("PORT", 5000))
    socketio.run(app, debug=True, host="0.0.0.0", port=port)
