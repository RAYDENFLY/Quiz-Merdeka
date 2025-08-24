from fastapi import FastAPI, Request, HTTPException
import logging
from pydantic import BaseModel
import json
import random
import copy
import re
import requests
import os
from pymongo import MongoClient
from bson.objectid import ObjectId
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import asyncio
from datetime import datetime, timedelta, timezone
try:
    from zoneinfo import ZoneInfo
except Exception:
    ZoneInfo = None
load_dotenv()


app = FastAPI()


@app.middleware("http")
async def require_api_key(request, call_next):
    # enforce only for our API paths
    path = request.url.path or ""
    if path.startswith("/quiz") or path.startswith("/chat"):
        if API_KEY:
            auth = request.headers.get('authorization') or request.headers.get('Authorization')
            if not auth or not auth.lower().startswith('bearer '):
                return JSONResponse(status_code=401, content={"detail": "Missing or invalid Authorization header"})
            token = auth.split(None, 1)[1].strip()
            if token != API_KEY:
                return JSONResponse(status_code=401, content={"detail": "Unauthorized"})
        else:
            # API_KEY not configured; already warned on startup, allow for dev
            pass
    return await call_next(request)

# Logging setup
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')


# CORS - allow frontend dev servers
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Environment variables
UNLI_API_KEY = os.getenv("OPENAI_API_KEY")
LUNOS_API_KEY = os.getenv("LUNOS_API_KEY")
MAILRY_SETUP_LINK = os.getenv("MAILRY_SETUP_LINK")
MAILRY_API_URL = os.getenv("MAILRY_API_URL")  # optional: explicit API endpoint for sending mail
MAILRY_API_KEY = os.getenv("MAILRY_API_KEY")  # Bearer token for Mailry API
MAILRY_EMAIL_ID = os.getenv("MAILRY_EMAIL_ID")  # default sender emailId (uuid) for Mailry
FRONTEND_BASE = os.getenv("FRONTEND_BASE")
MONGODB_URI = os.getenv("MONGODB_URI")
API_KEY = os.getenv("API_KEY")
if not API_KEY:
    logging.warning("API_KEY not set: API endpoints will NOT require authentication (development mode)")

# MongoDB setup
client = None
submissions_collection = None
leaderboard_collection = None
if MONGODB_URI:
    try:
        client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=3000)
        # try ping
        client.admin.command('ping')
        db = client["quiz_merdeka"]
        submissions_collection = db["submissions"]
        leaderboard_collection = db["leaderboard"]
        logging.info("MongoDB: connected and collections initialized")
    except Exception as e:
        logging.error("MongoDB: connection failed: %s", e)
else:
    logging.warning("MONGODB_URI not set; MongoDB integration disabled")


# Background task: weekly leaderboard reset
async def _weekly_leaderboard_reset_loop():
    """Align to Asia/Jakarta timezone and reset leaderboard at next Sunday 00:00 (WIB, UTC+7), then every 7 days.

    Behavior:
    - Compute delay until next Sunday 00:00 in Asia/Jakarta.
    - Sleep until that time, perform reset, then sleep exactly 7 days between resets.
    - If ZoneInfo is unavailable, fall back to naive UTC+7 arithmetic.
    """
    tz_name = 'Asia/Jakarta'
    interval = timedelta(days=7)
    logging.info("Weekly leaderboard reset loop started (target tz=%s)", tz_name)
    try:
        while True:
            try:
                # compute next Sunday 00:00 in target tz (Asia/Jakarta). Prefer ZoneInfo when available,
                # otherwise fall back to simple UTC+7 arithmetic. The result is a delay in seconds until
                # the next occurrence of Sunday 00:00 WIB.
                tz_obj = None
                if ZoneInfo is not None:
                    try:
                        tz_obj = ZoneInfo(tz_name)
                    except Exception:
                        tz_obj = None

                if tz_obj is not None:
                    # timezone-aware path
                    now_tz = datetime.now(tz_obj)
                    target_weekday = 6  # Sunday (Monday=0..Sunday=6)
                    days_ahead = (target_weekday - now_tz.weekday() + 7) % 7
                    # if today is Sunday and we've already passed or are at midnight, schedule next week
                    if days_ahead == 0 and (now_tz.hour >= 0 and (now_tz.minute > 0 or now_tz.second > 0 or now_tz.microsecond > 0)):
                        days_ahead = 7
                    next_target = (now_tz + timedelta(days=days_ahead)).replace(hour=0, minute=0, second=0, microsecond=0)
                    next_target_utc = next_target.astimezone(timezone.utc)
                    now_utc = datetime.now(timezone.utc)
                    delay = (next_target_utc - now_utc).total_seconds()
                else:
                    # fallback: assume server clock is UTC and compute Jakarta (UTC+7)
                    now_utc = datetime.utcnow().replace(tzinfo=timezone.utc)
                    jakarta_now = now_utc + timedelta(hours=7)
                    target_weekday = 6
                    days_ahead = (target_weekday - jakarta_now.weekday() + 7) % 7
                    # if today is Sunday and we've already passed or are at midnight, schedule next week
                    if days_ahead == 0 and (jakarta_now.hour >= 0 and (jakarta_now.minute > 0 or jakarta_now.second > 0 or jakarta_now.microsecond > 0)):
                        days_ahead = 7
                    next_target_j = (jakarta_now + timedelta(days=days_ahead)).replace(hour=0, minute=0, second=0, microsecond=0)
                    # convert next_target back to UTC
                    next_target_utc = (next_target_j - timedelta(hours=7)).replace(tzinfo=timezone.utc)
                    now_utc = datetime.now(timezone.utc)
                    delay = (next_target_utc - now_utc).total_seconds()

                if delay < 0:
                    delay = 0
                logging.info("Weekly reset scheduled in %.0f seconds (next target local: %s)", delay, next_target if 'next_target' in locals() else next_target_j)
                await asyncio.sleep(delay)

                # perform reset
                if leaderboard_collection is None:
                    logging.info("Weekly reset: leaderboard_collection not initialized; skipping")
                else:
                    try:
                        res = leaderboard_collection.delete_many({})
                        logging.info("Weekly reset: removed %s leaderboard entries", getattr(res, 'deleted_count', 'unknown'))
                    except Exception as e:
                        logging.error("Weekly reset delete failed: %s", e)

                # after first reset, sleep exactly 7 days before next
                await asyncio.sleep(interval.total_seconds())
            except asyncio.CancelledError:
                logging.info("Weekly leaderboard reset loop cancelled")
                raise
            except Exception as e:
                logging.error("Weekly reset loop error: %s", e)
                # on unexpected error, wait a minute then retry loop
                await asyncio.sleep(60)
    except asyncio.CancelledError:
        logging.info("Weekly leaderboard reset loop cancelled (outer)")
        raise


@app.on_event("startup")
async def _start_background_tasks():
    # create and store task so we can cancel it on shutdown
    if not hasattr(app.state, 'bg_tasks'):
        app.state.bg_tasks = []
    task = asyncio.create_task(_weekly_leaderboard_reset_loop())
    app.state.bg_tasks.append(task)


@app.on_event("shutdown")
async def _stop_background_tasks():
    tasks = getattr(app.state, 'bg_tasks', []) or []
    for t in tasks:
        try:
            t.cancel()
        except Exception:
            pass
    # wait briefly for cancellation
    await asyncio.sleep(0.1)

class QuizAnswer(BaseModel):
    email: str
    question: str
    answer: str
    name: str
    age_group: str  # "anak" atau "remaja"
    totalQuestions: int = None
    percentage: int = None
    difficulty: str = None
    timeSpent: int = None
    date: str = None


class QuestionsRequest(BaseModel):
    name: str | None = None
    email: str | None = None
    difficulty: str | None = "Mudah"

@app.post("/quiz/submit")
async def submit_quiz(request: Request):
    # Accept a permissive JSON payload to avoid 422 when frontend sends slightly different shapes.
    try:
        data = await request.json()
    except Exception as e:
        logging.error("/quiz/submit: failed to parse JSON body: %s", e)
        return {"error": "invalid json"}

    logging.info("/quiz/submit called with raw payload: %s", data)
    # normalize fields from possibly different client shapes
    def _get(k, default=None):
        return data.get(k, data.get(k.lower(), default))

    # coerce commonly used fields
    name = _get('name', _get('nama', None))
    email = _get('email')
    difficulty = _get('difficulty')
    totalQuestions = _get('totalQuestions', _get('total_questions', None))
    percentage = _get('percentage', None)
    age_group = _get('age_group', _get('ageGroup', None)) or _get('ageGroup', None)
    timeSpent = _get('timeSpent', _get('time_spent', None))
    question = _get('question')
    answer = _get('answer')
    date = _get('date')
    # Rebuild a lightweight dict to use below similar to previous `data` object
    class _D: pass
    data = _D()
    data.name = name
    data.email = email
    data.difficulty = difficulty
    try:
        data.totalQuestions = int(totalQuestions) if totalQuestions is not None else None
    except Exception:
        data.totalQuestions = None
    try:
        data.percentage = int(percentage) if percentage is not None else None
    except Exception:
        data.percentage = None
    data.age_group = age_group or "remaja"
    try:
        data.timeSpent = int(timeSpent) if timeSpent is not None else 0
    except Exception:
        data.timeSpent = 0
    data.question = question or ""
    data.answer = answer
    data.date = date
    # If frontend provided percentage/totalQuestions, trust client-provided result and skip AI evaluation
    score = 0
    feedback = ""
    if data.percentage is not None and data.totalQuestions:
        try:
            percentage = int(data.percentage)
        except Exception:
            percentage = 0
        total_q = data.totalQuestions or 0
        try:
            score = int(round((percentage / 100) * total_q))
        except Exception:
            score = 0
        feedback = "Hasil dinilai oleh klien"
    else:
        # 1. Kirim jawaban ke AI (unli.dev)
        try:
            ai_response = requests.post(
                "https://api.unli.dev/evaluate",
                json={"question": data.question, "answer": data.answer, "api_key": UNLI_API_KEY},
                timeout=6
            ).json()
            score = ai_response.get("score", 0)
            feedback = ai_response.get("feedback", "Jawabanmu menarik!")
        except Exception:
            score = 0
            feedback = "Jawabanmu disimpan"

    # Use provided fields when available
    total_q = data.totalQuestions or 0
    percentage = data.percentage
    if percentage is None and total_q:
        try:
            percentage = int(round((score / total_q) * 100))
        except Exception:
            percentage = int(score)
    elif percentage is None:
        percentage = int(score)

    difficulty = data.difficulty or "unknown"
    time_spent = data.timeSpent or 0
    date_str = data.date or __import__('datetime').datetime.utcnow().isoformat()

    # 2. Simpan hasil ke MongoDB
    submission = {
        "name": data.name,
        "email": data.email,
        "age_group": data.age_group,
        "question": data.question,
        "answer": data.answer,
        "score": score,
        "percentage": percentage,
        "totalQuestions": total_q,
        "difficulty": difficulty,
        "timeSpent": time_spent,
        "date": date_str,
        "feedback": feedback,
        "created_at": __import__('datetime').datetime.utcnow()
    }
    inserted_id = None
    try:
        if submissions_collection is not None:
            res = submissions_collection.insert_one(submission)
            inserted_id = getattr(res, 'inserted_id', None)
            logging.info("Inserted submission id=%s for email=%s", inserted_id, data.email)
        else:
            logging.warning("Submissions collection not initialized; skipping insert")
    except Exception as e:
        logging.error("Failed to insert submission for %s: %s", data.email, e)

    # 3. Update leaderboard in MongoDB (keep best score per email)
    try:
        leaderboard_entry = leaderboard_collection.find_one({"email": data.email}) if leaderboard_collection is not None else None
        logging.info("Existing leaderboard entry for %s: %s", data.email, bool(leaderboard_entry))
    except Exception as e:
        logging.error("Error reading leaderboard entry for %s: %s", data.email, e)
        leaderboard_entry = None
    if leaderboard_entry:
        # update if this attempt is better
        if score > leaderboard_entry.get("score", 0):
                try:
                    res = leaderboard_collection.update_one(
                        {"_id": leaderboard_entry["_id"]},
                        {"$set": {
                            "name": data.name,
                            "score": score,
                            "percentage": percentage,
                            "totalQuestions": total_q,
                            "difficulty": difficulty,
                            "timeSpent": time_spent,
                            "date": date_str,
                            "updated_at": __import__('datetime').datetime.utcnow()
                        }}
                    )
                    logging.info("Updated leaderboard for %s, matched=%s modified=%s", data.email, getattr(res, 'matched_count', None), getattr(res, 'modified_count', None))
                except Exception as e:
                    logging.error("Failed to update leaderboard for %s: %s", data.email, e)
    else:
            try:
                if leaderboard_collection is not None:
                    res = leaderboard_collection.insert_one({
                        "email": data.email,
                        "name": data.name,
                        "score": score,
                        "percentage": percentage,
                        "totalQuestions": total_q,
                        "difficulty": difficulty,
                        "timeSpent": time_spent,
                        "date": date_str,
                        "created_at": __import__('datetime').datetime.utcnow()
                    })
                    logging.info("Inserted leaderboard entry id=%s for email=%s", getattr(res, 'inserted_id', None), data.email)
            except Exception as e:
                logging.error("Failed to insert leaderboard entry for %s: %s", data.email, e)

    # 4. Kirim hasil ke email via mailry.co (non-blocking)
    try:
        # prefer explicit API URL; require a sender emailId either from payload or env
        # fallback to a safe default endpoint if env is missing
        target_url = MAILRY_API_URL or MAILRY_SETUP_LINK or "https://api.mailry.co/ext/inbox/send"
        sender_id = MAILRY_EMAIL_ID
        # basic validation: ensure sender_id looks like a UUID to avoid provider errors
        try:
            if sender_id and not re.match(r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$', str(sender_id)):
                logging.warning('MAILRY_EMAIL_ID does not look like a UUID: %s', sender_id)
                sender_id = None
        except Exception:
            sender_id = None
        # skip if no configured target or invalid sender id
        if target_url and sender_id:
            # build result URL when an inserted id exists so user can click through from email
            result_url = None
            try:
                if inserted_id:
                    base = FRONTEND_BASE or "http://localhost:3000"
                    result_url = f"{base.rstrip('/')}/result?id={inserted_id}"
            except Exception:
                result_url = None

            # build nicely formatted HTML and plain-text bodies
            html_body = f"""
<html>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; color:#111;">
        <h2 style="color:#0f172a">Hasil Quiz Kemerdekaan</h2>
        <p>Halo {data.name},</p>
        <p><strong>Skor:</strong> {percentage}%</p>
        <p><strong>Waktu:</strong> {time_spent} detik</p>
        <p><strong>Feedback:</strong> {feedback}</p>
        <p><strong>Badge:</strong> 🏅 Kemerdekaan!</p>
        {f'<p><a href="{result_url}" style="background:#2563eb;color:#fff;padding:8px 12px;border-radius:6px;text-decoration:none;">Lihat hasil Anda</a></p>' if result_url else ''}
        <hr/>
        <p>Salam,<br/>Tim Quiz Kemerdekaan</p>
    </body>
</html>
"""

            plain_body_lines = [
                f'Halo {data.name},',
                '',
                f'Skor: {percentage}%',
                f'Waktu: {time_spent} detik',
                f'Feedback: {feedback}',
                f'Badge: Kemerdekaan!',
            ]
            if result_url:
                plain_body_lines += ['', f'Lihat hasil Anda: {result_url}']
            plain_body_lines += ['', 'Salam,', 'Tim Quiz Kemerdekaan']

            mail_payload = {
                "emailId": sender_id,
                "to": data.email,
                "subject": "Hasil Quiz Kemerdekaan",
                "htmlBody": html_body,
                "plainBody": '\n'.join(plain_body_lines),
                "resultUrl": result_url
            }
            headers = {"Content-Type": "application/json"}
            if MAILRY_API_KEY:
                headers["Authorization"] = f"Bearer {MAILRY_API_KEY}"
            try:
                requests.post(target_url, json=mail_payload, headers=headers, timeout=5)
            except Exception:
                # non-blocking: ignore failures here
                pass
    except Exception:
        pass

    # include the inserted submission id so frontend can link to authoritative result
    return {"score": score, "percentage": percentage, "feedback": feedback, "badge": "🏅 Kemerdekaan!", "inserted_id": str(inserted_id) if inserted_id else None}


@app.post("/quiz/email")
async def send_result_email(request: Request):
    """Send a simple result email via configured MAILRY_SETUP_LINK.

    Expects JSON: { name, email, score, totalQuestions, percentage, badge }
    """
    if not (MAILRY_API_URL or MAILRY_SETUP_LINK):
        raise HTTPException(status_code=503, detail="mail service not configured (set MAILRY_API_URL or MAILRY_SETUP_LINK)")
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="invalid json")

    name = payload.get('name') or 'Participan'
    email = payload.get('email')
    score = payload.get('score')
    total = payload.get('totalQuestions')
    percentage = payload.get('percentage')
    badge = payload.get('badge') or 'Badge Kemerdekaan'

    if not email:
        raise HTTPException(status_code=400, detail="missing email")

    # Build a friendly email body (plain text)
    body_lines = [
        f'Halo {name},',
        '',
        f'Terima kasih telah menyelesaikan Quiz Kemerdekaan Indonesia.',
        f'Skor Anda: {score} dari {total} ({percentage}%).',
        f'Badge: {badge}',
        '',
        'Detail lengkap dan fakta menarik akan tersedia di aplikasi.',
        '',
        'Salam,',
        'Tim Quiz Kemerdekaan'
    ]
    # Mailry requires a sender emailId (uuid) in the request. Prefer payload-provided id, otherwise use env.
    sender_id = payload.get('emailId') or payload.get('email_id') or MAILRY_EMAIL_ID
    # validate basic UUID format to catch typos early
    if not sender_id or not re.match(r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$', str(sender_id)):
        raise HTTPException(status_code=503, detail=("mail sender not configured or invalid: include 'emailId' (UUID) in request body or set correct MAILRY_EMAIL_ID env var"))

    target_url = MAILRY_API_URL or MAILRY_SETUP_LINK or "https://api.mailry.co/ext/inbox/send"
    # Build Mailry-compatible payload
    # Build nice HTML + plain versions
    try:
        inserted_id = payload.get('submission_id') or payload.get('inserted_id')
    except Exception:
        inserted_id = None
    result_url = None
    if inserted_id:
        base = FRONTEND_BASE or "http://localhost:3000"
        result_url = f"{base.rstrip('/')}/result?id={inserted_id}"

    html_body = f"""
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; color:#111;">
    <h2 style="color:#0f172a">Hasil Quiz Kemerdekaan</h2>
    <p>Halo {name},</p>
    <p>Terima kasih telah menyelesaikan Quiz Kemerdekaan Indonesia.</p>
    <p><strong>Skor:</strong> {percentage}%</p>
    <p><strong>Total soal:</strong> {total}</p>
    <p><strong>Badge:</strong> {badge}</p>
    {f'<p><a href="{result_url}" style="background:#2563eb;color:#fff;padding:8px 12px;border-radius:6px;text-decoration:none;">Lihat hasil Anda</a></p>' if result_url else ''}
    <hr/>
    <p>Salam,<br/>Tim Quiz Kemerdekaan</p>
  </body>
</html>
"""

    plain_lines = [
        f'Halo {name},',
        '',
        f'Terima kasih telah menyelesaikan Quiz Kemerdekaan Indonesia.',
        f'Skor Anda: {score} dari {total} ({percentage}%).',
        f'Badge: {badge}',
    ]
    if result_url:
        plain_lines += ['', f'Lihat hasil Anda: {result_url}']
    plain_lines += ['', 'Salam,', 'Tim Quiz Kemerdekaan']

    mail_payload = {
        "emailId": sender_id,
        "to": email,
        "subject": f"Hasil Quiz Kemerdekaan Anda - {percentage}%",
        "htmlBody": html_body,
        "plainBody": '\n'.join(plain_lines)
    }
    # If client didn't provide a submission id, try to find the latest submission for this email
    try:
        inserted_id = payload.get('submission_id') or payload.get('inserted_id')
    except Exception:
        inserted_id = None
    try:
        if not inserted_id and submissions_collection is not None and email:
            doc = submissions_collection.find_one({"email": email}, sort=[("created_at", -1)])
            if doc and doc.get("_id"):
                inserted_id = str(doc.get("_id"))
    except Exception:
        inserted_id = inserted_id

    if inserted_id:
        try:
            base = FRONTEND_BASE or "http://localhost:3000"
            result_url = f"{base.rstrip('/')}/result?id={inserted_id}"
            mail_payload['resultUrl'] = result_url
            mail_payload['htmlBody'] += f"<p><a href=\"{result_url}\" style=\"background:#2563eb;color:#fff;padding:8px 12px;border-radius:6px;text-decoration:none;\">Lihat hasil Anda</a></p>"
            mail_payload['plainBody'] += f"\n\nLihat hasil Anda: {result_url}"
        except Exception:
            pass
    # optional fields from client
    if payload.get('cc'):
        mail_payload['cc'] = payload.get('cc')
    if payload.get('attachments'):
        mail_payload['attachments'] = payload.get('attachments')

    headers = {"Content-Type": "application/json"}
    if MAILRY_API_KEY:
        headers['Authorization'] = f"Bearer {MAILRY_API_KEY}"

    try:
        resp = requests.post(target_url, json=mail_payload, headers=headers, timeout=8)
        if not resp.ok:
            logging.error('mailry send failed status=%s body=%s url=%s', resp.status_code, resp.text, target_url)
            # common misconfiguration: somebody pasted a "setup" or dashboard URL instead of the API endpoint
            if resp.status_code == 404:
                raise HTTPException(status_code=502, detail=(
                    "Mail service returned 404. The configured MAILRY_SETUP_LINK appears to point to a setup/UI page instead of the mail-sending API endpoint. "
                    "Set MAILRY_API_URL to the provider's API 'send' endpoint (for example: https://api.mailry.co/ext/inbox/send) and set MAILRY_API_KEY with your API key."
                ))
            # surface 401/403 with clearer guidance
            if resp.status_code in (401, 403):
                raise HTTPException(status_code=502, detail=(
                    f"Mail service rejected the request (status {resp.status_code}). Check MAILRY_API_KEY and that the provided emailId is valid. Response: {resp.text}"
                ))
            raise HTTPException(status_code=502, detail=f'failed to send email: status={resp.status_code}')
    except HTTPException:
        raise
    except Exception as e:
        logging.exception('Failed to send email via mailry: %s', e)
        raise HTTPException(status_code=502, detail='failed to send email')

    # optionally return the payload for debugging when requested
    try:
        # request object is available as function arg; check header or payload debug flag
        debug_flag = False
        # header check
        hdr = request.headers.get('X-Debug-Mailry') or request.headers.get('x-debug-mailry')
        if hdr and str(hdr) == '1':
            debug_flag = True
        # payload check
        if isinstance(payload, dict) and payload.get('debug'):
            debug_flag = True
        if debug_flag:
            return { 'ok': True, 'sent_payload': mail_payload }
    except Exception:
        pass

    return { 'ok': True }


@app.get("/quiz/submission/{submission_id}")
async def get_submission(submission_id: str):
    if submissions_collection is None:
        raise HTTPException(status_code=503, detail="database unavailable")
    try:
        doc = submissions_collection.find_one({"_id": ObjectId(submission_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="invalid id")
    if not doc:
        raise HTTPException(status_code=404, detail="submission not found")
    # sanitize and return
    return {
        "id": str(doc.get("_id")),
        "name": doc.get("name"),
        "email": doc.get("email"),
        "score": doc.get("score"),
        "percentage": doc.get("percentage"),
        "totalQuestions": doc.get("totalQuestions"),
        "timeSpent": doc.get("timeSpent"),
        "difficulty": doc.get("difficulty"),
        "date": doc.get("date"),
        "feedback": doc.get("feedback")
    }

@app.get("/quiz/fakta")
async def get_fakta():
    # Preferensi: gunakan unli.dev (OpenAI-compatible) untuk menghasilkan fakta sejarah singkat
    prompt = (
        "Buatkan satu fakta menarik dan singkat tentang sejarah Indonesia (fokus pada kemerdekaan atau peristiwa penting), "
        "ditulis dalam bahasa Indonesia, 1-2 kalimat. Jangan sertakan sumber atau penjelasan panjang."
    )

    # 1) Coba unli.dev (OpenAI-compatible)
    if UNLI_API_KEY:
        try:
            url = "https://api.unli.dev/v1/chat/completions"
            headers = {"Authorization": f"Bearer {UNLI_API_KEY}", "Content-Type": "application/json"}
            payload = {
                "model": "auto",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 150,
                "temperature": 0.7,
            }
            resp = requests.post(url, json=payload, headers=headers, timeout=8)
            if resp.ok:
                j = resp.json()
                # OpenAI-compatible response shape: choices[0].message.content
                fakta = None
                if isinstance(j, dict):
                    choices = j.get("choices") or []
                    if len(choices) and isinstance(choices[0], dict):
                        message = choices[0].get("message")
                        if isinstance(message, dict):
                            fakta = message.get("content")
                        else:
                            # older responses may include 'text'
                            fakta = choices[0].get("text")
                if fakta:
                    return {"fakta": fakta.strip()}
        except Exception:
            # jika unli gagal, lanjut ke fallback
            pass

    # 2) Fallback ke lunos.tech jika tersedia
    try:
        resp = requests.get("https://api.lunos.tech/fakta", params={"api_key": LUNOS_API_KEY}, timeout=6)
        if resp.ok:
            fakta = resp.json().get("fakta")
            if fakta:
                return {"fakta": fakta}
    except Exception:
        pass

    # 3) Default safe message
    return {"fakta": "Tahukah kamu? Indonesia memproklamasikan kemerdekaan pada 17 Agustus 1945."}


@app.post("/quiz/explain")
async def explain_question(request: Request):
    """Return a short AI-generated explanation for a question and the correct choice.
    Expects JSON: { question: str, choices: [str], correct_index: int }
    """
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="invalid json")

    question = payload.get('question')
    choices = payload.get('choices') or []
    correct_index = payload.get('correct_index')

    if not question or not choices or correct_index is None:
        raise HTTPException(status_code=400, detail="missing fields")

    # Build a user-friendly prompt for a short explanation in Indonesian
    correct_choice_text = None
    try:
        correct_choice_text = choices[int(correct_index)]
    except Exception:
        correct_choice_text = None

    prompt = (
        f"Jelaskan secara singkat (1-2 kalimat) mengapa jawaban '{correct_choice_text}' benar untuk pertanyaan berikut dalam bahasa Indonesia:\n\n" \
        f"{question}\n\nBerikan penjelasan faktual dan mudah dimengerti."
    )

    # Try unli.dev first
    if UNLI_API_KEY:
        try:
            url = "https://api.unli.dev/v1/chat/completions"
            headers = {"Authorization": f"Bearer {UNLI_API_KEY}", "Content-Type": "application/json"}
            body = {
                "model": "auto",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 150,
                "temperature": 0.3,
            }
            resp = requests.post(url, json=body, headers=headers, timeout=8)
            if resp.ok:
                j = resp.json()
                choices_resp = j.get('choices') or []
                if choices_resp:
                    first = choices_resp[0]
                    msg = first.get('message')
                    if isinstance(msg, dict):
                        text = msg.get('content')
                    else:
                        text = first.get('text')
                    if text:
                        return {"explanation": text.strip()}
        except Exception:
            pass

    # Fallback to lunos.tech if available
    try:
        resp = requests.post("https://api.lunos.tech/explain", json={"question": question, "choices": choices, "correct_index": correct_index, "api_key": LUNOS_API_KEY}, timeout=6)
        if resp.ok:
            j = resp.json()
            if isinstance(j, dict) and j.get('explanation'):
                return {"explanation": j.get('explanation')}
    except Exception:
        pass

    # Last-resort default explanation
    fallback = f"Jawaban yang benar adalah '{correct_choice_text}'. Penjelasan: ini sesuai dengan fakta sejarah dan sumber yang umum diketahui terkait topik tersebut."
    return {"explanation": fallback}


@app.post("/quiz/chat")
async def quiz_chat(request: Request):
    """Simple chat endpoint for history Q&A. Expects JSON { question: str } and returns { answer: str }.
    Uses unli.dev (OpenAI-compatible) when available, otherwise falls back to lunos.tech or a safe default.
    """
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="invalid json")

    question = (payload.get('question') or '').strip()
    if not question:
        raise HTTPException(status_code=400, detail="missing question")

    prompt = (
        "Jawab pertanyaan berikut dalam bahasa Indonesia dengan ringkas dan faktual (1-3 kalimat). "
        "Topik: sejarah Indonesia (khususnya kemerdekaan dan peristiwa penting)."
        f"\n\nPertanyaan: {question}\n\nJawaban:"
    )

    # Try unli.dev (OpenAI-compatible)
    if UNLI_API_KEY:
        try:
            url = "https://api.unli.dev/v1/chat/completions"
            headers = {"Authorization": f"Bearer {UNLI_API_KEY}", "Content-Type": "application/json"}
            body = {
                "model": "auto",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 300,
                "temperature": 0.3,
            }
            resp = requests.post(url, json=body, headers=headers, timeout=10)
            if resp.ok:
                j = resp.json()
                choices = j.get('choices') or []
                if choices:
                    first = choices[0]
                    msg = first.get('message')
                    if isinstance(msg, dict):
                        text = msg.get('content')
                    else:
                        text = first.get('text')
                    if text:
                        return {"answer": text.strip()}
        except Exception:
            logging.exception("quiz_chat: unli.dev call failed")

    # Fallback to lunos.tech
    try:
        resp = requests.post("https://api.lunos.tech/chat", json={"question": question, "api_key": LUNOS_API_KEY}, timeout=8)
        if resp.ok:
            j = resp.json()
            if isinstance(j, dict) and j.get('answer'):
                return {"answer": j.get('answer')}
    except Exception:
        logging.exception("quiz_chat: lunos.tech call failed")

    # Last resort
    return {"answer": "Maaf, saya sedang tidak bisa menghubungi layanan AI. Coba lagi nanti atau cek sumber sejarah terpercaya."}


@app.post("/chat")
async def chat(request: Request):
    """Compatibility wrapper so frontend can POST /chat instead of /quiz/chat."""
    # Delegate to existing handler to avoid code duplication
    return await quiz_chat(request)

@app.get("/quiz/leaderboard")
async def leaderboard():
    # Fetch enriched leaderboard from MongoDB, sorted by score desc
    try:
        docs = list(leaderboard_collection.find().sort("score", -1)) if leaderboard_collection is not None else []
    except Exception as e:
        logging.error("Failed to fetch leaderboard: %s", e)
        docs = []
    result = []
    for idx, entry in enumerate(docs, start=1):
        result.append({
            "rank": idx,
            "name": entry.get("name"),
            "email": entry.get("email"),
            "score": entry.get("score", 0),
            "percentage": entry.get("percentage", None),
            "totalQuestions": entry.get("totalQuestions", None),
            "difficulty": entry.get("difficulty", None),
            "timeSpent": entry.get("timeSpent", None),
            "date": entry.get("date", None)
        })
    return result


@app.get("/admin/mailry/test")
async def admin_mailry_test(to: str | None = None, name: str | None = None, emailId: str | None = None):
    """Send a small test email via configured Mailry API and return the provider response for debugging.

    Query params:
    - to: recipient email (required)
    - name: recipient name (optional)
    - emailId: override sender emailId (optional)
    """
    if not (MAILRY_API_URL or MAILRY_SETUP_LINK):
        raise HTTPException(status_code=503, detail="mail service not configured (set MAILRY_API_URL or MAILRY_SETUP_LINK)")
    if not to:
        raise HTTPException(status_code=400, detail="missing 'to' query parameter")

    sender_id = emailId or MAILRY_EMAIL_ID
    if not sender_id:
        raise HTTPException(status_code=503, detail=("mail sender not configured: include 'emailId' as query param or set MAILRY_EMAIL_ID env var"))

    recipient_name = name or 'Peserta'
    body_lines = [
        f'Halo {recipient_name},',
        '',
        'Ini adalah email percobaan dari layanan Quiz Merdeka untuk memverifikasi konfigurasi Mailry.',
        '',
        'Jika Anda menerima ini, konfigurasi API Mailry Anda berfungsi.'
    ]

    mail_payload = {
        "emailId": sender_id,
        "to": to,
        "subject": "[TEST] Verifikasi Mailry - Quiz Merdeka",
    "htmlBody": '<br/>'.join([line.replace('\n', '<br/>') for line in body_lines]),
    "plainBody": '\n'.join(body_lines)
    }
    # include a sample result link for convenience when sender is real
    try:
        if MAILRY_EMAIL_ID and MAILRY_EMAIL_ID != 'DEBUG_PAYLOAD':
            base = FRONTEND_BASE or "http://localhost:3000"
            # use a placeholder id when none provided
            sample_id = '68ab33514935413af792468b'
            mail_payload['resultUrl'] = f"{base.rstrip('/')}/result?id={sample_id}"
        # append with simple CTA styling
        mail_payload['htmlBody'] = f"<div style=\"font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; color:#111;\">{mail_payload['htmlBody']}<p><a href=\"{mail_payload['resultUrl']}\" style=\"background:#2563eb;color:#fff;padding:8px 12px;border-radius:6px;text-decoration:none;\">Lihat hasil Anda</a></p><hr/><p>Salam,<br/>Tim Quiz Kemerdekaan</p></div>"
        mail_payload['plainBody'] += f"\n\nLihat hasil Anda: {mail_payload['resultUrl']}"
    except Exception:
        pass

    target_url = MAILRY_API_URL or MAILRY_SETUP_LINK
    headers = {"Content-Type": "application/json"}
    if MAILRY_API_KEY:
        headers['Authorization'] = f"Bearer {MAILRY_API_KEY}"

    try:
        resp = requests.post(target_url, json=mail_payload, headers=headers, timeout=10)
        text = resp.text if isinstance(resp.text, str) else str(resp.text)
        # return a bounded snippet to avoid huge HTML dumps
        snippet = text[:4000]
        logging.info('admin_mailry_test: sent test email to=%s status=%s url=%s', to, resp.status_code, target_url)
        # debug flag via query param ?debug=1 or header X-Debug-Mailry: 1
        debug = False
        try:
            debug = (str(request := None) and False)
        except Exception:
            debug = False
        # we don't have the Request object here; detect debug via env var fallback or always include when running locally
        # Instead, allow debug when emailId query param equals 'DEBUG_PAYLOAD' (convenient local trigger)
        include_payload = (emailId == 'DEBUG_PAYLOAD')
        resp_body = {"status_code": resp.status_code, "ok": resp.ok, "body_snippet": snippet}
        if include_payload:
            resp_body['sent_payload'] = mail_payload
        return resp_body
    except Exception as e:
        logging.exception('admin_mailry_test: failed to call mailry: %s', e)
        raise HTTPException(status_code=502, detail=f'failed to call mail service: {e}')


@app.post("/quiz/questions")
async def quiz_questions(payload: QuestionsRequest):
    """Return a small set of questions. This is a simple local generator.
    The frontend expects: { questions: [{ question, choices, answer }, ...] }
    """
    # Simple question pool (can be replaced by AI generation or external API)
    pool = [
        {"question": "Siapa proklamator kemerdekaan Indonesia?", "choices": ["Sukarno & Hatta", "Sutan Sjahrir", "Tan Malaka", "Sudirman"], "answer": 0},
        {"question": "Tanggal berapakah Indonesia memproklamasikan kemerdekaan?", "choices": ["17 Agustus 1945", "10 November 1945", "1 Juni 1945", "28 Oktober 1928"], "answer": 0},
        {"question": "Siapa yang menjahit bendera Merah Putih yang dikibarkan saat proklamasi?", "choices": ["Fatmawati", "R.A. Kartini", "Cut Nyak Dien", "Dewi Sartika"], "answer": 0},
        {"question": "Dimanakah teks proklamasi resmi dibacakan?", "choices": ["Di Jalan Pegangsaan Timur 56", "Di Istana Merdeka", "Di Alun-alun Kota", "Di Gedung Sate"], "answer": 0},
        {"question": "Apa nama lagu kebangsaan Indonesia?", "choices": ["Indonesia Raya", "Bagimu Negeri", "Halo-Halo Bandung", "Tanah Airku"], "answer": 0},
        {"question": "Siapakah Pangeran Diponegoro dalam sejarah Indonesia?", "choices": ["Pemimpin Perang Jawa melawan VOC", "Presiden pertama Indonesia", "Pahlawan Kemerdekaan 1945", "Pendiri Budi Utomo"], "answer": 0},
        {"question": "Peristiwa 10 November diperingati sebagai hari apa?", "choices": ["Hari Pahlawan", "Hari Pendidikan Nasional", "Hari Kebangkitan Nasional", "Hari Proklamasi"], "answer": 0},
        {"question": "Apa tujuan Sumpah Pemuda 1928?", "choices": ["Persatuan bangsa Indonesia", "Mendirikan negara baru", "Menggulingkan penjajah", "Membentuk tentara"], "answer": 0},
        {"question": "Siapa tokoh yang memimpin pertempuran di Surabaya 1945?", "choices": ["Sudirman", "Sukarno", "Hatta", "Sutan Sjahrir"], "answer": 0},
        {"question": "Apa nama perjanjian yang mengakui kedaulatan Indonesia pada 1949?", "choices": ["Perjanjian Konferensi Meja Bundar", "Perjanjian Linggarjati", "Perjanjian Roem-Royen", "Perjanjian Renville"], "answer": 0},
        {"question": "Siapakah Cut Nyak Dien terkenal karena?", "choices": ["Perlawanan terhadap penjajah di Aceh", "Menciptakan lagu kebangsaan", "Mendirikan sekolah wanita", "Menjadi presiden"], "answer": 0},
        {"question": "Apa tujuan Budi Utomo saat didirikan?", "choices": ["Mengangkat pendidikan dan kebudayaan pribumi", "Menjadi organisasi militer", "Menyerang VOC", "Membentuk partai politik"], "answer": 0},
        {"question": "Peran unsur pemuda dalam kebangkitan nasional terlihat pada?", "choices": ["Sumpah Pemuda 1928", "Proklamasi 1945", "Konferensi Meja Bundar", "Perjanjian Renville"], "answer": 0},
        {"question": "Siapa yang dikenal sebagai Panglima Besar Tentara Nasional Indonesia?", "choices": ["Sudirman", "Sukarno", "Hatta", "Soedirman"], "answer": 0},
    ]

    # Determine target number of questions and suggested time based on requested difficulty
    diff = (payload.difficulty or "Mudah").lower()
    if "sulit" in diff or "sukar" in diff or "hard" in diff or "dewasa" in diff:
        target_count = 20
        time_minutes = 12
        age_group = "dewasa"
    elif "sedang" in diff or "medium" in diff or "smp" in diff or "sma" in diff:
        target_count = 15
        time_minutes = 8
        age_group = "remaja"
    else:
        # default -> Mudah
        target_count = 10
        time_minutes = 5
        age_group = "anak"

    # Try to ask unli.dev (OpenAI-compatible) to generate a JSON list of questions matching difficulty
    if UNLI_API_KEY:
        try:
            prompt = (
                f"Buatkan {target_count} soal pilihan ganda singkat tentang sejarah Indonesia (campuran topik: kemerdekaan, perang, perjuangan, pahlawan, dan peristiwa penting) yang sesuai untuk {age_group}. "
                "Setiap soal harus memiliki 4 pilihan, dan jawaban benar direpresentasikan sebagai indeks (0-3). "
                "Setiap soal singkat, relevan, dan sesuai tingkat kesulitan. Balas hanya dengan JSON yang memiliki kunci: total_questions, time_minutes, questions. "
                "Contoh format: {\"total_questions\":10, \"time_minutes\":5, \"questions\":[{\"question\":\"...\", \"choices\":[\"...\",...], \"answer\":0}, ...]}"
            )

            url = "https://api.unli.dev/v1/chat/completions"
            headers = {"Authorization": f"Bearer {UNLI_API_KEY}", "Content-Type": "application/json"}
            payload_body = {
                "model": "auto",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 1200,
                "temperature": 0.6,
            }
            resp = requests.post(url, json=payload_body, headers=headers, timeout=10)
            if resp.ok:
                j = resp.json()
                content = None
                choices = j.get("choices") or []
                if len(choices):
                    first = choices[0]
                    msg = first.get("message")
                    if isinstance(msg, dict):
                        content = msg.get("content")
                    else:
                        content = first.get("text")

                if content:
                    # Try to parse JSON out of the assistant content
                    try:
                        parsed = json.loads(content)
                        # basic validation
                        if isinstance(parsed, dict) and parsed.get("questions"):
                            return parsed
                    except Exception:
                        # if AI included backticks or markdown, try to extract JSON substring
                        import re
                        m = re.search(r"\{[\s\S]*\}", content)
                        if m:
                            try:
                                parsed = json.loads(m.group(0))
                                if isinstance(parsed, dict) and parsed.get("questions"):
                                    return parsed
                            except Exception:
                                pass
        except Exception:
            pass

    # Fallback: sample from local pool and repeat/trim to reach target_count
    # Prefer loading from backend/soal JSON files when available for better, labeled pools
    selected = []
    soal_dir = os.path.join(os.path.dirname(__file__), "soal")
    difficulty_file = None
    if "sulit" in diff:
        difficulty_file = os.path.join(soal_dir, "sulit.json")
    elif "sedang" in diff:
        difficulty_file = os.path.join(soal_dir, "sedang.json")
    else:
        difficulty_file = os.path.join(soal_dir, "mudah.json")

    source_questions = None
    try:
        if os.path.exists(difficulty_file):
            with open(difficulty_file, 'r', encoding='utf-8') as f:
                j = json.load(f)
                source_questions = j.get('questions') if isinstance(j, dict) else None
    except Exception:
        source_questions = None

    # fallback to local inline pool if file missing or unreadable
    if not source_questions:
        source_questions = pool

    # Build buckets by original answer index so we can sample a balanced set
    buckets = {0: [], 1: [], 2: [], 3: []}
    for q in source_questions:
        try:
            ans = int(q.get('answer', 0)) if isinstance(q.get('answer', 0), int) or str(q.get('answer', 0)).isdigit() else 0
        except Exception:
            ans = 0
        if ans not in buckets:
            ans = 0
        buckets[ans].append(copy.deepcopy(q))

    # target per index: distribute as evenly as possible
    base = target_count // 4
    rem = target_count % 4
    target_per_index = [base + (1 if i < rem else 0) for i in range(4)]

    # pick from each bucket up to its target
    for idx in range(4):
        want = target_per_index[idx]
        have = len(buckets[idx])
        if have <= want:
            selected.extend(buckets[idx])
            buckets[idx] = []
        else:
            selected.extend(random.sample(buckets[idx], want))
            # remove chosen ones
            chosen_set = set()
            # remove chosen by identity (simple approach)
            chosen = set()
            for c in selected[-want:]:
                try:
                    buckets[idx].remove(c)
                except Exception:
                    # fallback: ignore
                    pass

    # if we still need more (not enough variety), fill from remaining questions across buckets
    remaining_pool = []
    for arr in buckets.values():
        remaining_pool.extend(arr)
    while len(selected) < target_count and remaining_pool:
        take = random.choice(remaining_pool)
        selected.append(take)
        remaining_pool.remove(take)

    # if still short (very small pools), repeat random samples from source_questions
    while len(selected) < target_count:
        selected.append(copy.deepcopy(random.choice(source_questions)))

    # Trim to exact target_count
    selected = selected[:target_count]

    # Now shuffle choices per question and fix answer indexes; also avoid repeating '(variasi N)'
    try:
        from collections import Counter
        counts = Counter()
        for i, q in enumerate(selected):
            # defensive copies
            choices = list(q.get("choices", []))
            ans_idx = q.get("answer", 0) if isinstance(q.get("answer", 0), int) else 0
            if not choices:
                continue
            # use base question text (strip any existing '(variasi N)')
            q_text = q.get("question", "")
            base = re.sub(r"\s*\(variasi\s*\d+\)\s*$", "", q_text)
            counts[base] += 1
            if counts[base] > 1:
                q["question"] = f"{base} (variasi {counts[base]})"
            else:
                q["question"] = base

            # determine correct choice string from ans_idx if possible
            correct_choice = None
            try:
                if 0 <= int(ans_idx) < len(choices):
                    correct_choice = choices[int(ans_idx)]
            except Exception:
                correct_choice = None

            # shuffle and compute new index
            random.shuffle(choices)
            q["choices"] = choices
            if correct_choice is not None and correct_choice in choices:
                q["answer"] = choices.index(correct_choice)
            else:
                # ensure correct choice present by inserting at random position
                insert_at = random.randrange(0, len(choices) + 1)
                # avoid duplicating if correct_choice is None; then leave as-is and set answer 0
                if correct_choice:
                    choices.insert(insert_at, correct_choice)
                    q["choices"] = choices
                    q["answer"] = insert_at
                else:
                    q["answer"] = 0
    except Exception:
        pass

    # final pass: ensure no two questions have identical text for the user
    try:
        seen_texts = set()
        deduped = []
        for q in selected:
            q_text = str(q.get("question", "")).strip()
            base = re.sub(r"\s*\(variasi\s*\d+\)\s*$", "", q_text)
            candidate = base
            # if exact text already seen, add an incremental variation suffix until unique
            if candidate in seen_texts:
                i = 2
                new_text = f"{base} (variasi {i})"
                while new_text in seen_texts:
                    i += 1
                    new_text = f"{base} (variasi {i})"
                q["question"] = new_text
                seen_texts.add(new_text)
                deduped.append(q)
            else:
                q["question"] = base
                seen_texts.add(base)
                deduped.append(q)
        selected = deduped
    except Exception:
        # if dedupe fails for any reason, keep original selection
        pass

    # final shuffle of questions
    random.shuffle(selected)

    return {"total_questions": target_count, "time_minutes": time_minutes, "questions": selected}
