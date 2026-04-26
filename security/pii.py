"""PII detection & redaction.

Regex-based detector covering the high-leverage cases for an AI chatbot:
email, phone, SSN, credit card, IPv4, JWT, AWS keys, GitHub PAT, generic API
keys, private keys. Fast, dependency-free, and easy to audit.

For production, swap to Microsoft Presidio (NER + recognizers) — same interface.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List, Tuple


@dataclass
class PIIMatch:
    type: str
    start: int
    end: int
    value: str


# Order matters: more-specific patterns first so they win on overlap.
PATTERNS: List[Tuple[str, re.Pattern[str]]] = [
    ("AWS_ACCESS_KEY", re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b")),
    ("GITHUB_PAT", re.compile(r"\bghp_[A-Za-z0-9]{36}\b")),
    ("PRIVATE_KEY", re.compile(r"-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----")),
    ("JWT", re.compile(r"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b")),
    ("CREDIT_CARD", re.compile(r"\b(?:\d[ -]?){13,19}\b")),
    ("SSN", re.compile(r"\b\d{3}-\d{2}-\d{4}\b")),
    ("EMAIL", re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")),
    ("PHONE", re.compile(r"\b(?:\+?\d{1,3}[-. ]?)?(?:\(\d{2,4}\)[-. ]?|\d{2,4}[-. ])\d{3,4}[-. ]?\d{3,4}\b")),
    ("IPV4", re.compile(r"\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b")),
    ("API_KEY", re.compile(r"\b(?:sk|pk|api|secret)[_-][A-Za-z0-9_-]{20,}\b", re.IGNORECASE)),
]


def _luhn_ok(num: str) -> bool:
    digits = [int(c) for c in num if c.isdigit()]
    if not 13 <= len(digits) <= 19:
        return False
    checksum = 0
    for i, d in enumerate(reversed(digits)):
        if i % 2 == 1:
            d *= 2
            if d > 9:
                d -= 9
        checksum += d
    return checksum % 10 == 0


def detect(text: str) -> List[PIIMatch]:
    matches: List[PIIMatch] = []
    occupied: List[Tuple[int, int]] = []

    def overlaps(s: int, e: int) -> bool:
        return any(not (e <= os or s >= oe) for os, oe in occupied)

    for kind, pattern in PATTERNS:
        for m in pattern.finditer(text):
            s, e = m.start(), m.end()
            if overlaps(s, e):
                continue
            value = m.group(0)
            if kind == "CREDIT_CARD" and not _luhn_ok(value):
                continue
            matches.append(PIIMatch(type=kind, start=s, end=e, value=value))
            occupied.append((s, e))
    matches.sort(key=lambda x: x.start)
    return matches


def redact(text: str, matches: List[PIIMatch] | None = None) -> Tuple[str, List[PIIMatch]]:
    if matches is None:
        matches = detect(text)
    if not matches:
        return text, []
    out: List[str] = []
    cursor = 0
    for m in matches:
        out.append(text[cursor:m.start])
        out.append(f"[REDACTED_{m.type}]")
        cursor = m.end
    out.append(text[cursor:])
    return "".join(out), matches
