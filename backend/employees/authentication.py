from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from .models import Employee


class MongoJWTAuthentication(BaseAuthentication):
    """
    Custom JWT Authentication for MongoEngine Employee model.
    Decodes the Bearer token and attaches the Employee instance to request.user.
    If no Authorization header is present (or header is 'authenticated'), returns None
    so unauthenticated requests can be processed by permissions/views.
    """

    def authenticate(self, request):
        header = request.headers.get("Authorization") or request.META.get("HTTP_AUTHORIZATION")
        if not header:
            return None

        parts = header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return None

        raw_token = parts[1]
        if not raw_token or raw_token == "authenticated":
            return None

        try:
            token = AccessToken(raw_token)
        except (InvalidToken, TokenError):
            raise AuthenticationFailed("Invalid or expired token.")

        employee_id = token.get("employee_id") or token.get("user_id")
        if not employee_id:
            raise AuthenticationFailed("Token contains no employee identification.")

        employee = Employee.objects(employee_id=str(employee_id)).first()
        if not employee or not getattr(employee, "is_active", True):
            raise AuthenticationFailed("Employee not found or inactive.")

        return (employee, token)
