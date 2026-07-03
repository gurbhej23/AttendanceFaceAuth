from django.core.management.base import BaseCommand

from employees.extras_views import run_attendance_reminder_emails


class Command(BaseCommand):
    help = "Email employees who have not checked in today (run before 10 AM IST)"

    def add_arguments(self, parser):
        parser.add_argument("--force", action="store_true")

    def handle(self, *args, **options):
        result = run_attendance_reminder_emails(force=options["force"])
        self.stdout.write(self.style.SUCCESS(str(result)))
