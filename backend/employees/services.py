from django.contrib.auth.hashers import check_password

from .models import Employee


def authenticate_employee(employee_id: str, password: str, *, allowed_roles: set[str] | None = None):
    """Validate credentials and optionally enforce a role."""
    if not employee_id or not password:
        return None, "Employee ID and password are required"

    employee = Employee.objects(employee_id=employee_id, is_active=True).first()
    if not employee:
        return None, "Employee not found or account inactive"

    if allowed_roles and employee.role not in allowed_roles:
        return None, "Access denied. Required role not met."

    if not check_password(password, employee.password):
        return None, "Invalid password"

    return employee, None


def build_employee_login_payload(employee: Employee) -> dict:
    return {
        "employee_id": employee.employee_id,
        "name": employee.name,
        "email": employee.email,
        "role": employee.role,
        "profile_img": employee.profile_img or "",
        "cv_file": employee.cv_file or "",
        "has_face": 1 if employee.face_embedding else 0,
        "has_pin": 1 if employee.attendance_pin_hash else 0,
    }
