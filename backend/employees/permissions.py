from rest_framework.permissions import BasePermission


def get_employee_from_request(request):
    if getattr(request, "user", None) and getattr(request.user, "is_authenticated", False):
        return request.user

    from .views import find_employee

    employee_id = None
    if isinstance(getattr(request, "data", None), dict):
        employee_id = request.data.get("employee_id") or request.data.get("employeeId")
    if not employee_id and hasattr(request, "query_params"):
        employee_id = request.query_params.get("employee_id") or request.query_params.get("employeeId")

    if not employee_id:
        return None

    return find_employee(str(employee_id).strip())


class EmployeeAccessPermission(BasePermission):
    """Allow public auth endpoints and restrict admin/HR routes by role."""

    PUBLIC_PATHS = {
        "/api/employees/login/",
        "/api/employees/register/",
        "/api/employees/admin-login/",
        "/api/employees/send-otp/",
        "/api/employees/reset-password/",
        "/api/employees/send-registration-otp/",
        "/api/employees/verify-registration-otp/",
        "/api/attendance/send-verify-otp/",
        "/api/attendance/verify-otp/",
        "/api/attendance/verify-face/",
        "/api/attendance/verify-pin/",
    }

    def has_permission(self, request, view):
        path = (request.path or "").rstrip("/") + "/"
        if path in self.PUBLIC_PATHS:
            return True

        if path.startswith("/api/employees/admin") or "/admin-employees" in path:
            return self._has_role(request, {"admin", "hr"})

        return self._has_role(request, {"employee", "admin", "hr"})

    def _has_role(self, request, allowed_roles):
        if getattr(request, "user", None) and getattr(request.user, "is_authenticated", False):
            user_role = getattr(request.user, "role", "employee")
            return user_role in allowed_roles

        employee = get_employee_from_request(request)
        if not employee:
            return False
        return getattr(employee, "role", "employee") in allowed_roles

