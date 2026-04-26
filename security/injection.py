"""Prompt-injection detection.

Heuristics for the most common attacks against LLM applications:
- Direct instruction override ("ignore previous instructions")
- Role hijack ("you are now a ...")
- System prompt extraction ("show me your system prompt")
- Indirect injection markers in retrieved context
- Jailbreak template fragments (DAN, AIM, etc.)

Returns a confidence score 0-1 and the matched signals.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List


@dataclass
class InjectionFinding:
    signal: str
    severity: str  # "low" | "medium" | "high"
    matched: str


SIGNALS: list[tuple[str, str, re.Pattern[str]]] = [
    ("instruction_override", "high", re.compile(
        r"\b(ignore|disregard|forget|override)\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|system)\b",
        re.IGNORECASE,
    )),
    ("role_hijack", "high", re.compile(
        r"\b(you\s+are\s+now|act\s+as|pretend\s+to\s+be|roleplay\s+as)\s+(a|an)?\s*(developer|admin|root|jailbroken|unrestricted|DAN|AIM)\b",
        re.IGNORECASE,
    )),
    ("system_prompt_leak", "high", re.compile(
        r"\b(show|print|reveal|repeat|output)\s+(me\s+)?(your|the)\s+(system\s+)?(prompt|instructions?|rules?)\b",
        re.IGNORECASE,
    )),
    ("dan_jailbreak", "high", re.compile(
        r"\b(DAN|do\s+anything\s+now|developer\s+mode|jailbreak|unrestricted\s+mode)\b",
        re.IGNORECASE,
    )),
    ("delimiter_smuggling", "medium", re.compile(
        r"(\[/?(SYSTEM|INST|ASSISTANT|USER)\]|<\|im_(start|end)\|>|###\s*(SYSTEM|INSTRUCTION))",
    )),
    ("ignore_safety", "medium", re.compile(
        r"\b(without|bypass|ignore)\s+(safety|filters?|content\s+policy|guidelines)\b",
        re.IGNORECASE,
    )),
    ("base64_payload", "low", re.compile(
        r"\b[A-Za-z0-9+/]{120,}={0,2}\b"
    )),
]


def analyze(text: str) -> tuple[float, list[InjectionFinding]]:
    findings: list[InjectionFinding] = []
    score = 0.0
    weights = {"high": 0.7, "medium": 0.4, "low": 0.15}

    for signal_name, severity, pattern in SIGNALS:
        m = pattern.search(text)
        if m:
            findings.append(InjectionFinding(signal=signal_name, severity=severity, matched=m.group(0)[:80]))
            score = max(score, weights[severity])
            # Stack: each additional signal adds half-weight.
            score = min(1.0, score + weights[severity] * 0.5 * (len(findings) - 1))

    return score, findings


THRESHOLD_BLOCK = 0.6
