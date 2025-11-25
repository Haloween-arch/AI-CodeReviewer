# ai/report_service/main.py

from fastapi import FastAPI, Request
import httpx
import asyncio
import os
import json
import logging
from typing import Any, Dict, List, Tuple

# ---------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Report Service (Quality-Focused Summaries v3)")

# ---------------------------------------------------------------------
# Microservice base URLs
# ---------------------------------------------------------------------
SERVICE_URLS: Dict[str, str] = {
    "style": os.getenv("STYLE_SERVICE", "http://127.0.0.1:8001"),
    "syntax": os.getenv("SYNTAX_SERVICE", "http://127.0.0.1:8002"),
    "security": os.getenv("SECURITY_SERVICE", "http://127.0.0.1:8003"),
    "quality": os.getenv("QUALITY_SERVICE", "http://127.0.0.1:8004"),
    "rule": os.getenv("RULE_SERVICE", "http://127.0.0.1:8006"),
}

# ---------------------------------------------------------------------
# Gemini Setup (HTTP API, NOT python sdk)
# ---------------------------------------------------------------------
GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_READY = bool(GEMINI_KEY)
MODEL_NAME = os.getenv("REPORT_MODEL", "gemini-2.5-flash-preview-09-2025")
GEMINI_API_URL_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

if GEMINI_READY:
    logger.info(f"✅ Gemini enabled for report summaries using model: {MODEL_NAME}")
else:
    logger.warning("⚠ No GEMINI_API_KEY — AI summaries disabled, using fallback text")


# ---------------------------------------------------------------------
# Helpers: flatten issues into a common format
# ---------------------------------------------------------------------
SEVERITY_RANK = {
    "critical": 4,
    "high": 3,
    "error": 3,
    "medium": 2,
    "warning": 2,
    "low": 1,
    "style": 1,
}


def _normalize_severity(raw: str | None, default: str = "low") -> str:
    if not raw:
        return default
    s = raw.lower()
    if s in SEVERITY_RANK:
        return s
    # map some common alternatives
    if s.startswith("err"):
        return "error"
    if s.startswith("warn"):
        return "warning"
    return default


def flatten_issues(results: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Turn each microservice's output into a flat list of issues with a unified shape:

    {
      "type": "syntax|style|security|quality|rule",
      "severity": "critical|high|medium|low|style|warning|error",
      "line": <int>,
      "message": "<short description>",
      "suggestion": "<short suggestion if we have one>"
    }
    """
    issues: List[Dict[str, Any]] = []

    # ---------- SYNTAX ----------
    syntax = results.get("syntax") or {}
    for err in syntax.get("errors") or []:
        issues.append(
            {
                "type": "syntax",
                "severity": "high",
                "line": err.get("line", 0),
                "message": err.get("message", "Syntax error"),
                "suggestion": "Fix the syntax so the code can run without crashing.",
            }
        )

    # ---------- STYLE (local linters) ----------
    style = results.get("style") or {}
    for i in style.get("local_issues") or []:
        issues.append(
            {
                "type": "style",
                "severity": _normalize_severity(i.get("severity"), "style"),
                "line": i.get("line", 0),
                "message": i.get("message", "Style issue"),
                "suggestion": "Follow the project’s style / formatting guidelines.",
                "code": i.get("code"),
            }
        )

    # ---------- STYLE (AI review) ----------
    ai_rev = (style.get("ai_review") or {})
    for i in ai_rev.get("issues") or []:
        issues.append(
            {
                "type": "style",
                "severity": "medium",
                "line": i.get("line", 0),
                "message": i.get("message", "Readability / best-practice issue"),
                "suggestion": i.get("suggestion")
                or "Improve naming, structure or readability here.",
            }
        )

    # ---------- SECURITY ----------
    security = results.get("security") or {}
    bandit = ((security.get("security_issues") or {}).get("bandit") or {})
    for s in bandit.get("results") or []:
        issues.append(
            {
                "type": "security",
                "severity": "high",
                "line": s.get("line_number", 0),
                "message": s.get("issue_text", "Potential security weakness"),
                "suggestion": s.get("issue_cwe")
                or "Refactor this part to avoid unsafe patterns or data exposure.",
            }
        )

    # AI security review
    for s in (security.get("ai") or {}).get("issues") or []:
        issues.append(
            {
                "type": "security",
                "severity": _normalize_severity(s.get("severity"), "medium"),
                "line": s.get("line", 0),
                "message": s.get("message", "Security concern"),
                "suggestion": s.get("suggestion")
                or "Harden this code path to avoid attacks or data leaks.",
            }
        )

    # ---------- QUALITY / PERFORMANCE ----------
    quality = results.get("quality") or {}
    qa = quality.get("analysis") or {}
    if qa:
        msg = f"Time: {qa.get('time_complexity', 'unknown')}, Space: {qa.get('space_complexity', 'unknown')}"
        issues.append(
            {
                "type": "quality",
                "severity": "medium",
                "line": 0,
                "message": msg,
                "suggestion": "Consider using a more efficient algorithm or data structure.",
            }
        )

    # ---------- RULE ENGINE ----------
    rule = results.get("rule") or {}
    for r in rule.get("issues") or []:
        issues.append(
            {
                "type": "rule",
                "severity": _normalize_severity(r.get("severity"), "low"),
                "line": r.get("line", 0),
                "message": r.get("message", "Rule violation"),
                "suggestion": r.get("suggestion")
                or "Align this with the project’s best-practice or business rule.",
            }
        )

    return issues


# ---------------------------------------------------------------------
# Helpers: compute counts & simple scores
# ---------------------------------------------------------------------
def compute_basic_stats(issues: List[Dict[str, Any]], results: Dict[str, Any]) -> Dict[str, Any]:
    total = len(issues)
    by_sev = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    by_type = {"syntax": 0, "style": 0, "security": 0, "quality": 0, "rule": 0}

    for it in issues:
        sev = _normalize_severity(it.get("severity"), "low")
        t = (it.get("type") or "rule").lower()
        if sev in by_sev:
            by_sev[sev] += 1
        else:
            by_sev["low"] += 1
        if t in by_type:
            by_type[t] += 1
        else:
            by_type["rule"] += 1

    # Quality score – reuse style service combined score if present
    style = results.get("style") or {}
    style_summary = style.get("summary") or {}
    quality_score = (
        style_summary.get("qualityScore")
        or style_summary.get("combined_score")
        or 0
    )

    # Security score – simple heuristic if not provided
    security_issues_count = by_type["security"]
    security_score = 100 - min(100, security_issues_count * 10)

    return {
        "totalIssues": total,
        "bySeverity": by_sev,
        "byType": by_type,
        "qualityScore": quality_score,
        "securityScore": security_score,
    }


def pick_quality_impact_issues(issues: List[Dict[str, Any]], max_items: int = 5) -> List[Dict[str, Any]]:
    """
    Choose the issues that matter most for *quality*:
      - prioritise syntax + security + quality
      - then style / rule with higher severity
    """
    def sort_key(it: Dict[str, Any]) -> Tuple[int, int]:
        sev_rank = SEVERITY_RANK.get(
            _normalize_severity(it.get("severity"), "low"), 1
        )
        t = (it.get("type") or "").lower()
        # bump syntactic / security / quality issues
        type_boost = 2 if t in ("syntax", "security", "quality") else 0
        return (type_boost, sev_rank)

    sorted_issues = sorted(issues, key=sort_key, reverse=True)
    return sorted_issues[:max_items]


# ---------------------------------------------------------------------
# Gemini: generate a **structured** human-readable summary
# ---------------------------------------------------------------------
async def ai_generate_summary(
    client: httpx.AsyncClient,
    all_results: Dict[str, Any],
    language: str,
    code: str,
    flat_issues: List[Dict[str, Any]],
    stats: Dict[str, Any],
) -> str | None:
    """
    Ask Gemini to write a plain-language report with:

    - Key Problems & Fixes (quality-impacting issues, with line & suggestion)
    - Overall section
    - Short explanation of scores
    """
    api_url = f"{GEMINI_API_URL_BASE}/{MODEL_NAME}:generateContent?key={GEMINI_KEY}"

    key_issues = pick_quality_impact_issues(flat_issues, max_items=6)

    system_prompt = """
You are a senior engineer writing a report for a NON-TECHNICAL audience.
Your goal: Explain the results of 5 code-analysis services in **simple, friendly English**.

Reader persona:
- Product Manager / Team Lead
- Not technical
- Wants to understand risks, effort, and what to fix first

Your tone:
- SIMPLE WORDS
- NO jargon
- No guesses about the business domain
- Very short sentences
- Direct and human-readable

============================
STRUCTURE OF THE OUTPUT
============================

# Simple Summary
Write 3–4 sentences explaining the overall health of the code. Explain if the code is safe, readable, stable, or risky. Avoid technical terms.

# What Each Service Found  
Explain each service in its own section using very simple language.

## Syntax Check (Code Basics)
In 2–4 bullet points:
- What errors were found?
- What does it mean for a non-technical person? (“The program might stop working”, “This part will break the flow”, etc.)
- Why it matters
- What needs to be fixed in simple steps

## Style Check (Readability & Cleanliness)
Explain:
- Problems found
- Why messy formatting matters (“Hard to maintain”, “Developers may misunderstand”, etc.)
- What improvements are needed

## Security Scan (Safety & Data Protection)
Explain:
- Any weaknesses
- What it means in real life (“Hackers might exploit this”, “User data could leak”)
- What must be changed

## Quality & Performance (Efficiency)
Explain:
- Any performance or efficiency problems
- Why a slow or inefficient algorithm matters
- Simple fix direction (“Use faster methods”, “Remove unnecessary work”)

## Rule Engine (Project Rules & Best Practices)
Explain:
- What rules were broken
- Why rules matter (“Consistency”, “Fewer mistakes”, etc.)
- What needs correction

# Key Issues to Fix First
Take the 5–6 most important issues (we pass them to you as JSON).
For each issue, write:

1. **Issue Type** (Syntax / Security / Style / Quality / Rule)
   - What is wrong (1–2 short sentences, no jargon)
   - Why it matters (plain business impact)
   - Suggested Fix (very clear, actionable)

# Overall Stats (Make them human-friendly)
Explain:
- How many issues total
- How many serious vs less serious
- What the quality score means
- What the security score means

For example:
• “Quality Score 70/100 – The code is readable but needs cleanup.”  
• “Security Score 80/100 – Mostly safe, but a few improvements needed.”

# Final Guidance (Executive Suggestions)
Write 2–3 bullet points telling the manager:
- What the team should fix first
- What gives the biggest quality improvement
- What reduces the biggest risk

============================
RULES:
============================
- NEVER show raw JSON.
- NEVER use technical terms like “linter”, “AST”, “CWE”, “bandit”, etc.
- ALWAYS translate findings into business impact.
- Use simple and short sentences.
- Speak like explaining to someone with zero coding background.

"""

    payload: Dict[str, Any] = {
        "contents": [{"parts": [{"text": user_query}]}],
        "systemInstruction": system_prompt,
    }

    max_retries = 3
    delay = 1.0

    for attempt in range(max_retries):
        try:
            resp = await client.post(
                api_url,
                json=payload,
                headers={"Content-Type": "application/json"},
            )
            resp.raise_for_status()
            data = resp.json()
            # Gemini v1beta: candidates[0].content.parts[0].text
            text = (
                data.get("candidates", [{}])[0]
                .get("content", {})
                .get("parts", [{}])[0]
                .get("text", "")
            )
            if text.strip():
                return text.strip()
        except httpx.HTTPStatusError as e:
            logger.error(
                f"Gemini HTTP error (attempt {attempt+1}): "
                f"{e.response.status_code} - {e.response.text[:200]}"
            )
        except Exception as e:
            logger.error(f"Gemini general error (attempt {attempt+1}): {e}")

        if attempt < max_retries - 1:
            await asyncio.sleep(delay)
            delay *= 2

    logger.error("Gemini summary failed after all retries.")
    return None
# ---------------------------------------------------------------------
# Fallback summary (if AI is disabled or fails)
# ---------------------------------------------------------------------
def fallback_summary(flat_issues: List[Dict[str, Any]], stats: Dict[str, Any]) -> str:
    """Structured but simpler summary used when Gemini is not available."""
    lines: List[str] = []
    lines.append("Simple Summary\n")
    lines.append(
        "AI summary is not available. Showing numeric summary instead.\n"
    )

    key_issues = pick_quality_impact_issues(flat_issues, max_items=3)

    lines.append("Key Problems & Fixes (Top Quality Impact)\n")

    if not key_issues:
        lines.append("No significant issues detected.\n")
    else:
        for idx, it in enumerate(key_issues, start=1):
            t = (it.get("type") or "issue").upper()
            line_no = it.get("line", 0)
            msg = it.get("message", "Issue")
            sugg = it.get("suggestion") or "Refactor or clean up this part."

            # generic "why it matters"
            why = "It affects overall code quality."
            if it["type"] == "syntax":
                why = "The code may fail to run at all."
            elif it["type"] == "security":
                why = "Attackers might exploit this to compromise data or systems."
            elif it["type"] == "quality":
                why = "It can make the code slower or harder to scale."
            elif it["type"] == "style":
                why = "It makes the code harder for others to read and maintain."

            lines.append(f"{idx}. {t} (Line {line_no})")
            lines.append(f"Problem: {msg}")
            lines.append(f"Why it matters: {why}")
            lines.append(f"Suggested fix: {sugg}\n")

    sev = stats["bySeverity"]
    qscore = stats["qualityScore"]
    sscore = stats["securityScore"]

    lines.append("Overall")
    lines.append(
        f"• We found {stats['totalIssues']} total issues in your code."
    )
    lines.append(
        f"• Most serious issues: {sev['critical']} critical and {sev['high']} high-severity items."
    )
    lines.append(
        f"• Less serious issues: {sev['medium']} medium and {sev['low']} low-level findings."
    )
    lines.append("")
    lines.append("Quality & Security Scores (higher is better)")
    lines.append(
        f"• Quality Score: {qscore}/100 – how clean and maintainable your code looks."
    )
    lines.append(
        f"• Security Score: {sscore}/100 – how safe your code appears from a security standpoint."
    )

    return "\n".join(lines)
# ---------------------------------------------------------------------
# Main endpoint: combine all analyzer outputs + AI summary
# ---------------------------------------------------------------------
@app.post("/report/generate")
async def generate_report(request: Request):
    """
    Accepts JSON: { "code": "<source_code>", "language": "python" }

    Returns:
      - raw `report` (per-service outputs)
      - a unified `issues_flat` list
      - `basic_stats` (counts + scores)
      - `summary_readable` (AI or fallback)
    """
    body = await request.json()
    code = body.get("code", "")
    language = body.get("language", "python")

    if not isinstance(code, str) or not code.strip():
        return {"error": "No valid code provided"}

    results: Dict[str, Any] = {}

    async with httpx.AsyncClient(timeout=30) as client:
        # fan-out all analyzer calls
        tasks = {
            key: client.post(
                f"{base}/analyze/{key}",
                json={"language": language, "code": code},
            )
            for key, base in SERVICE_URLS.items()
        }

        responses = await asyncio.gather(
            *tasks.values(), return_exceptions=True
        )

        # collect raw service responses
        for i, key in enumerate(tasks.keys()):
            r = responses[i]
            if isinstance(r, Exception):
                logger.error(f"Service {key} failed: {r}")
                results[key] = {"error": str(r)}
            else:
                try:
                    data = r.json()
                    if not isinstance(data, dict):
                        data = {"error": "Invalid JSON from service"}
                    results[key] = data
                except Exception as e:
                    logger.error(f"Service {key} returned malformed JSON: {e}")
                    results[key] = {"error": "Malformed response"}

        # build unified issues + stats
        flat_issues = flatten_issues(results)
        stats = compute_basic_stats(flat_issues, results)

        # generate AI summary if possible
        summary_text: str | None = None
        ai_used = False

        if GEMINI_READY:
            summary_text = await ai_generate_summary(
                client, results, language, code, flat_issues, stats
            )
            if summary_text:
                ai_used = True
            else:
                logger.warning("AI summary failed, using fallback text.")

        if not summary_text:
            summary_text = fallback_summary(flat_issues, stats)

    # Final response
    return {
        "summary_readable": summary_text,
        "issues_flat": flat_issues,
        "basic_stats": stats,
        "report": results,
        "metadata": {
            "services": list(SERVICE_URLS.keys()),
            "ai_summary_used": ai_used,
        },
    }