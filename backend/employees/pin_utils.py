"""Attendance PIN validation and lockout helpers."""

import re
from datetime import datetime, timedelta

import pytz
from django.contrib.auth.hashers import check_password, make_password

IST = pytz.timezone("Asia/Kolkata")

PIN_PATTERN = re.compile(r"^\d{4,6}$")
MAX_PIN_ATTEMPTS = 5
PIN_LOCK_MINUTES = 15


def validate_attendance_pin(pin: str) -> str | None:
    """Return error message or None if valid."""
    pin = (pin or "").strip()
    if not PIN_PATTERN.match(pin):
        return "PIN must be 4–6 digits"
    if len(set(pin)) == 1:
        return "PIN cannot be all identical digits"
    ascending = "".join(str(i % 10) for i in range(int(pin[0]), int(pin[0]) + len(pin)))
    descending = "".join(str((int(pin[0]) - i) % 10) for i in range(len(pin)))
    if pin in (ascending, descending) and len(pin) >= 4:
        return "PIN cannot be a simple sequence (e.g. 1234)"
    return None


def hash_attendance_pin(pin: str) -> str:
    return make_password(pin.strip())


def verify_attendance_pin(pin: str, pin_hash: str) -> bool:
    if not pin_hash:
        return False
    return check_password(pin.strip(), pin_hash)


def is_pin_locked(employee) -> tuple[bool, str]:
    locked_until = getattr(employee, "pin_locked_until", None)
    if not locked_until:
        return False, ""
    now = datetime.now(IST)
    if locked_until.tzinfo is None:
        locked_until = IST.localize(locked_until)
    if now < locked_until:
        remaining = int((locked_until - now).total_seconds() / 60) + 1
        return True, f"Too many attempts. Try again in {remaining} min or use Email OTP."
    return False, ""


def record_pin_failure(employee) -> None:
    attempts = (getattr(employee, "pin_failed_attempts", 0) or 0) + 1
    employee.pin_failed_attempts = attempts
    if attempts >= MAX_PIN_ATTEMPTS:
        employee.pin_locked_until = datetime.now(IST) + timedelta(minutes=PIN_LOCK_MINUTES)
        employee.pin_failed_attempts = 0
    employee.save()


def clear_pin_failures(employee) -> None:
    employee.pin_failed_attempts = 0
    employee.pin_locked_until = None
    employee.save()
