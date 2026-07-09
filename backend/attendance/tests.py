from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase
from rest_framework.test import APIRequestFactory

from attendance import hr_views


class BreakActionTests(SimpleTestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    def test_break_can_start_for_present_record_without_check_in_time(self):
        employee = SimpleNamespace(employee_id="E123", name="Ada", is_active=True)
        employee_queryset = MagicMock()
        employee_queryset.first.return_value = employee

        record = SimpleNamespace(
            check_in_time=None,
            check_out_time=None,
            break_start_time=None,
            break_end_time=None,
            break_minutes=0,
            status="present",
            save=MagicMock(),
        )
        record_queryset = MagicMock()
        record_queryset.first.return_value = record

        with patch("attendance.hr_views.Employee.objects", MagicMock(return_value=employee_queryset)), patch(
            "attendance.hr_views.AttendanceRecord.objects", MagicMock(return_value=record_queryset)
        ):
            request = self.factory.post(
                "/attendance/hr/break/",
                {"employee_id": "E123", "action": "start"},
                format="json",
            )
            response = hr_views.break_action(request)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        self.assertTrue(response.data["break_active"])
        record.save.assert_called_once()
