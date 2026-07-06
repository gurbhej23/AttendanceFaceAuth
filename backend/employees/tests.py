from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase

from .permissions import EmployeeAccessPermission


class EmployeeAccessPermissionTests(SimpleTestCase):
    def setUp(self):
        self.permission = EmployeeAccessPermission()

    def make_request(self, path, data=None):
        return SimpleNamespace(
            path=path,
            data=data or {},
            query_params={},
            method="POST",
            auth=None,
            user=None,
        )

    def test_allows_public_auth_routes(self):
        request = self.make_request("/api/employees/login/", {"employee_id": "EMP-1", "password": "abc123"})

        self.assertTrue(self.permission.has_permission(request, None))

    def test_denies_admin_route_for_non_admin(self):
        request = self.make_request("/api/employees/admin-employees/", {"employee_id": "EMP-1"})

        with patch("employees.permissions.get_employee_from_request", return_value=SimpleNamespace(role="employee")):
            self.assertFalse(self.permission.has_permission(request, None))

    def test_allows_admin_route_for_admin(self):
        request = self.make_request("/api/employees/admin-employees/", {"employee_id": "EMP-1"})

        with patch("employees.permissions.get_employee_from_request", return_value=SimpleNamespace(role="admin")):
            self.assertTrue(self.permission.has_permission(request, None))
