"""Team directory, announcements, streak, celebrations, reminders, polls."""

import re
from datetime import datetime, timedelta

import pytz
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from attendance.models import AttendanceRecord
from employees.extras_models import Announcement
from employees.models import Employee, GroupMessage, ChatGroup
from employees.views import (
    employee_payload,
    find_employee,
    group_message_payload,
    broadcast_group_event,
    can_access_group,
    send_email,
)
from employees.media_utils import media_url

IST = pytz.timezone("Asia/Kolkata")
MENTION_RE = re.compile(r"@\[([^\]]+)\]\(([^)]+)\)")
MENTION_RE = re.compile(r"@\[([^\]]+)\]\(([^)]+)\)")


def _today_ist() -> str:
    return datetime.now(IST).strftime("%Y-%m-%d")


def _parse_mentions(text: str) -> list[str]:
    return list({m.group(2).strip() for m in MENTION_RE.finditer(text or "")})


@api_view(["GET"])
def team_directory(request):
    employee_id = request.query_params.get("employee_id", "").strip()
    search = request.query_params.get("search", "").strip().lower()
    department = request.query_params.get("department", "").strip()

    viewer = find_employee(employee_id)
    if not viewer:
        return Response({"success": False, "error": "Employee not found"}, status=404)

    query = Employee.objects(is_active=True)
    if department and department != "all":
        query = query.filter(department=department)

    rows = []
    for emp in query.order_by("department", "name"):
        if search:
            blob = " ".join(
                [
                    emp.name or "",
                    emp.employee_id or "",
                    emp.department or "",
                    emp.designation or "",
                    emp.email or "",
                ]
            ).lower()
            if search not in blob:
                continue
        rows.append(employee_payload(emp))

    departments = sorted(
        {e.department for e in Employee.objects(is_active=True) if e.department}
    )
    return Response({"success": True, "directory": rows, "departments": departments})


@api_view(["GET", "POST"])
def announcements(request):
    if request.method == "GET":
        active_only = request.query_params.get("active", "1") != "0"
        today = _today_ist()
        items = Announcement.objects(is_active=True).order_by("-created_at") if active_only else Announcement.objects().order_by("-created_at")
        records = []
        for a in items:
            if a.expires_at and a.expires_at < today:
                continue
            records.append(
                {
                    "id": str(a.id),
                    "title": a.title,
                    "body": a.body,
                    "created_by": a.created_by,
                    "created_by_name": a.created_by_name,
                    "audience": a.audience,
                    "expires_at": a.expires_at,
                    "created_at": a.created_at.isoformat() if a.created_at else "",
                }
            )
        return Response({"success": True, "announcements": records})

    employee_id = str(request.data.get("employee_id", "")).strip()
    admin = find_employee(employee_id)
    if not admin or admin.role not in ("admin", "hr"):
        return Response({"success": False, "error": "Admin access required"}, status=403)

    title = str(request.data.get("title", "")).strip()
    body = str(request.data.get("body", "")).strip()
    if not title or not body:
        return Response({"success": False, "error": "title and body required"}, status=400)

    ann = Announcement(
        title=title,
        body=body,
        created_by=admin.employee_id,
        created_by_name=admin.name,
        audience=str(request.data.get("audience", "all")),
        expires_at=str(request.data.get("expires_at", "")).strip(),
    )
    ann.save()
    return Response({"success": True, "id": str(ann.id), "message": "Announcement published"})


@api_view(["DELETE"])
def announcement_delete(request, announcement_id):
    employee_id = str(request.data.get("employee_id", "")).strip()
    admin = find_employee(employee_id)
    if not admin or admin.role not in ("admin", "hr"):
        return Response({"success": False, "error": "Admin access required"}, status=403)
    ann = Announcement.objects(id=announcement_id).first()
    if not ann:
        return Response({"success": False, "error": "Not found"}, status=404)
    ann.is_active = False
    ann.save()
    return Response({"success": True, "message": "Announcement removed"})


def compute_attendance_streak(employee_id: str) -> dict:
    today = datetime.now(IST).date()
    streak = 0
    on_time_streak = 0

    cursor = today
    for _ in range(90):
        date_str = cursor.strftime("%Y-%m-%d")
        rec = AttendanceRecord.objects(employee_id=employee_id, date=date_str).first()
        if not rec or not rec.check_in_time:
            break
        if rec.status in ("present", "late"):
            streak += 1
        else:
            break
        cursor -= timedelta(days=1)

    # On-time streak: completed days only (yesterday backward), not today
    cursor = today - timedelta(days=1)
    for _ in range(90):
        date_str = cursor.strftime("%Y-%m-%d")
        rec = AttendanceRecord.objects(employee_id=employee_id, date=date_str).first()
        if not rec or not rec.check_in_time:
            break
        if rec.status == "present" and (rec.minutes_late or 0) == 0:
            on_time_streak += 1
        else:
            break
        cursor -= timedelta(days=1)

    return {
        "present_streak": streak,
        "on_time_streak": on_time_streak,
        "badge": (
            f"{on_time_streak} days on time"
            if on_time_streak >= 3
            else (f"{streak} day streak" if streak >= 3 else "")
        ),
    }


def _parse_join_date(join):
    """Return (month_day 'MM-DD', join_year int) from join_date or created_at."""
    if not join:
        return "", 0
    if isinstance(join, str) and len(join) >= 10:
        try:
            return join[5:10], int(join[:4])
        except ValueError:
            return join[5:10], 0
    if hasattr(join, "strftime"):
        return join.strftime("%m-%d"), join.year
    return "", 0


def celebrations_for_today() -> list[dict]:
    today = datetime.now(IST)
    md = today.strftime("%m-%d")
    items = []
    for emp in Employee.objects(is_active=True):
        dob = getattr(emp, "date_of_birth", "") or ""
        join = getattr(emp, "join_date", "") or getattr(emp, "created_at", None)
        join_md, join_year = _parse_join_date(join)
        if dob and len(dob) >= 10 and dob[5:10] == md:
            items.append(
                {
                    "type": "birthday",
                    "employee_id": emp.employee_id,
                    "name": emp.name,
                    "department": emp.department,
                    "profile_img": media_url(emp.profile_img or ""),
                }
            )
        if join_md == md:
            years = today.year - join_year if join_year else 0
            base = {
                "employee_id": emp.employee_id,
                "name": emp.name,
                "department": emp.department,
                "profile_img": media_url(emp.profile_img or ""),
            }
            if years < 1:
                items.append({**base, "type": "welcome"})
            else:
                items.append({**base, "type": "anniversary", "years": years})
    return items


@api_view(["GET"])
def dashboard_extras(request):
    employee_id = request.query_params.get("employee_id", "").strip()
    emp = find_employee(employee_id)
    if not emp:
        return Response({"success": False, "error": "Employee not found"}, status=404)

    today = _today_ist()
    announcements_list = []
    for a in Announcement.objects(is_active=True).order_by("-created_at")[:5]:
        if a.expires_at and a.expires_at < today:
            continue
        if a.audience not in ("all", "", emp.department, emp.role):
            continue
        announcements_list.append(
            {"id": str(a.id), "title": a.title, "body": a.body, "created_by_name": a.created_by_name}
        )

    return Response(
        {
            "success": True,
            "announcements": announcements_list,
            "celebrations": celebrations_for_today(),
            "streak": compute_attendance_streak(employee_id),
        }
    )


@api_view(["GET"])
def attendance_streak(request):
    employee_id = request.query_params.get("employee_id", "").strip()
    if not find_employee(employee_id):
        return Response({"success": False, "error": "Employee not found"}, status=404)
    return Response({"success": True, **compute_attendance_streak(employee_id)})


@api_view(["POST"])
def send_attendance_reminders(request):
    """Call from cron before 10 AM IST, or admin trigger."""
    force = bool(request.data.get("force"))
    employee_id = str(request.data.get("employee_id", "")).strip()
    admin = find_employee(employee_id)
    if employee_id and admin and admin.role not in ("admin", "hr"):
        return Response({"success": False, "error": "Admin only"}, status=403)
    result = run_attendance_reminder_emails(force=force)
    return Response({"success": True, **result})


def run_attendance_reminder_emails(force: bool = False) -> dict:
    now = datetime.now(IST)
    if now.hour >= 10 and not force:
        return {"sent": 0, "date": now.strftime("%Y-%m-%d"), "skipped": "after_10am"}

    today = now.strftime("%Y-%m-%d")
    sent = 0
    for emp in Employee.objects(is_active=True, role="employee"):
        marked = AttendanceRecord.objects(
            employee_id=emp.employee_id, date=today, check_in_time__ne=None
        ).first()
        if marked:
            continue
        subject = "Reminder: Mark your attendance"
        text = f"Hi {emp.name},\n\nYou have not marked attendance for {today}. Please check in before 10 AM.\n"
        html = f"<p>Hi {emp.name},</p><p>You have not marked attendance for <strong>{today}</strong>. Please check in before 10 AM.</p>"
        ok, _ = send_email(emp.email, subject, text, html)
        if ok:
            sent += 1
    return {"sent": sent, "date": today}


@api_view(["POST"])
def group_poll_vote(request):
    employee_id = str(request.data.get("employee_id", "")).strip()
    message_id = str(request.data.get("message_id", "")).strip()
    option_id = str(request.data.get("option_id", "")).strip()

    voter = find_employee(employee_id)
    msg = GroupMessage.objects(id=message_id).first()
    if not voter or not msg:
        return Response({"success": False, "error": "Not found"}, status=404)

    group = ChatGroup.objects(id=msg.group_id).first()
    if not group or not can_access_group(voter, group):
        return Response({"success": False, "error": "Access denied"}, status=403)

    poll = getattr(msg, "poll_data", None) or {}
    options = poll.get("options", [])
    if not any(o.get("id") == option_id for o in options):
        return Response({"success": False, "error": "Invalid option"}, status=400)

    votes = dict(poll.get("votes", {}) or {})
    for oid, voters in list(votes.items()):
        votes[oid] = [v for v in voters if v != employee_id]
    votes.setdefault(option_id, [])
    if employee_id not in votes[option_id]:
        votes[option_id].append(employee_id)
    poll["votes"] = votes
    msg.poll_data = poll
    msg.save()

    payload = group_message_payload(msg, group)
    broadcast_group_event(msg.group_id, "poll_vote", payload)
    return Response({"success": True, "message": payload})


def publish_due_scheduled_messages():
    now = datetime.now(pytz.UTC)
    pending = GroupMessage.objects(
        message_type="scheduled", is_deleted=False, scheduled_published=False
    )
    published = 0
    for msg in pending:
        scheduled_for = getattr(msg, "scheduled_for", None)
        if not scheduled_for or scheduled_for > now:
            continue
        msg.message_type = "user"
        msg.scheduled_published = True
        msg.save()
        group = ChatGroup.objects(id=msg.group_id).first()
        if group:
            broadcast_group_event(
                msg.group_id, "message", group_message_payload(msg, group)
            )
        published += 1
    return published
