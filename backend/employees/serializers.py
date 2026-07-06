from rest_framework import serializers


class EmployeeLoginSerializer(serializers.Serializer):
    employee_id = serializers.CharField(required=True, trim_whitespace=True)
    password = serializers.CharField(required=True, trim_whitespace=True)


class AdminLoginSerializer(serializers.Serializer):
    employee_id = serializers.CharField(required=True, trim_whitespace=True)
    password = serializers.CharField(required=True, trim_whitespace=True)
