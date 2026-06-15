import API from "./api";

export const getProfile = (employee_id: string) =>
  API.get("/employees/profile/", { params: { employee_id } });

export const updateProfile = (data: any) =>
  API.post("/employees/update-profile/", data);

export const updateFace = (data: any, timeout?: number) =>
  API.post("/employees/update-face/", data, { timeout });

export const adminGetEmployees = (params: any) =>
  API.get("/employees/admin-employees/", { params });

export const adminUpdateEmployee = (data: any) =>
  API.post("/employees/admin-update-employee/", data);
