import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";

interface Employee {
  employee_id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  designation: string;
  is_active: boolean;
  profile_img: string;
  cv_file: string;
}

const getMediaUrl = (path?: string | null) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `http://localhost:8000${path.startsWith("/") ? path : `/${path}`}`;
};

const getError = (err: unknown, fallback: string) => {
  const e = err as { response?: { data?: { error?: string } } };
  return e.response?.data?.error || fallback;
};

export default function AdminEmployees() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"active" | "inactive" | "all">("active");
  const [role, setRole] = useState("all");
  const [editing, setEditing] = useState<Employee | null>(null);
  const [tempPassword, setTempPassword] = useState("");
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const loadEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.get("/employees/admin-employees/", {
        params: { search, status, role },
      });
      setEmployees(res.data.employees || []);
    } catch (err) {
      showToast(getError(err, "Could not load employees"), false);
    } finally {
      setLoading(false);
    }
  }, [search, status, role]);

  useEffect(() => {
    if (localStorage.getItem("role") !== "admin") {
      navigate("/", { replace: true });
      return;
    }
    const timer = setTimeout(loadEmployees, 250);
    return () => clearTimeout(timer);
  }, [loadEmployees, navigate]);

  const stats = useMemo(() => {
    const active = employees.filter((e) => e.is_active).length;
    const admins = employees.filter((e) => e.role !== "employee").length;
    const departments = new Set(employees.map((e) => e.department).filter(Boolean));
    return { active, admins, departments: departments.size };
  }, [employees]);

  const updateEmployee = async () => {
    if (!editing) return;
    try {
      const res = await API.post("/employees/admin-update-employee/", editing);
      showToast(res.data.message || "Employee updated");
      setEditing(null);
      loadEmployees();
    } catch (err) {
      showToast(getError(err, "Update failed"), false);
    }
  };

  const resetPassword = async (employee: Employee) => {
    try {
      const res = await API.post("/employees/admin-reset-password/", {
        employee_id: employee.employee_id,
      });
      setTempPassword(res.data.temporary_password || "");
      showToast("Password reset successfully");
    } catch (err) {
      showToast(getError(err, "Password reset failed"), false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      {toast && (
        <div
          className={`fixed top-5 left-1/2 z-50 -translate-x-1/2 rounded-2xl border px-5 py-3 text-sm font-semibold shadow-xl ${
            toast.ok
              ? "border-green-500/30 bg-green-500/15 text-green-300"
              : "border-red-500/30 bg-red-500/15 text-red-300"
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-blue-300">Admin workspace</p>
            <h1 className="text-3xl font-bold">Employee Management</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => navigate("/attendance-sheet")}
              className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold hover:bg-slate-800"
            >
              Attendance sheet
            </button>
            <button
              onClick={() => {
                localStorage.clear();
                navigate("/", { replace: true });
              }}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </header>

        <div className="mb-5 grid gap-4 md:grid-cols-3">
          {[
            ["Visible employees", employees.length],
            ["Active accounts", stats.active],
            ["Departments", stats.departments],
          ].map(([label, value]) => (
            <div key={label} className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">{label}</p>
              <p className="mt-2 text-3xl font-bold">{value}</p>
            </div>
          ))}
        </div>

        <section className="rounded-3xl border border-slate-800 bg-slate-900">
          <div className="grid gap-3 border-b border-slate-800 p-5 lg:grid-cols-[1fr_160px_160px]">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, ID, email, department..."
              className="rounded-2xl border border-slate-700 bg-slate-950 p-3 outline-none focus:border-blue-500"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "active" | "inactive" | "all")}
              className="rounded-2xl border border-slate-700 bg-slate-950 p-3 outline-none focus:border-blue-500"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All status</option>
            </select>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="rounded-2xl border border-slate-700 bg-slate-950 p-3 outline-none focus:border-blue-500"
            >
              <option value="all">All roles</option>
              <option value="employee">Employee</option>
              <option value="hr">HR</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {loading ? (
            <div className="p-10 text-center text-slate-400">Loading employees...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Employee</th>
                    <th className="px-5 py-4">Department</th>
                    <th className="px-5 py-4">Phone</th>
                    <th className="px-5 py-4">Role</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => (
                    <tr key={employee.employee_id} className="border-t border-slate-800">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 overflow-hidden rounded-2xl bg-slate-800">
                            {employee.profile_img ? (
                              <img
                                src={getMediaUrl(employee.profile_img)}
                                alt={employee.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-blue-600 font-bold">
                                {employee.name.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-semibold">{employee.name}</p>
                            <p className="text-xs text-slate-400">
                              {employee.employee_id} / {employee.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-300">
                        <p>{employee.department || "--"}</p>
                        <p className="text-xs text-slate-500">
                          {employee.designation || "--"}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-300">
                        {employee.phone || "--"}
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-semibold capitalize text-blue-300">
                          {employee.role}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            employee.is_active
                              ? "bg-green-500/15 text-green-300"
                              : "bg-red-500/15 text-red-300"
                          }`}
                        >
                          {employee.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEditing(employee)}
                            className="rounded-xl bg-slate-800 px-3 py-2 text-xs font-semibold hover:bg-slate-700"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => resetPassword(employee)}
                            className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold hover:bg-amber-700"
                          >
                            Reset password
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {employees.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-slate-500">
                        No employees found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="mb-5 text-2xl font-bold">Edit employee</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {[
                ["name", "Name"],
                ["phone", "Phone"],
                ["department", "Department"],
                ["designation", "Designation"],
              ].map(([field, label]) => (
                <label key={field} className="text-sm text-slate-400">
                  {label}
                  <input
                    value={String(editing[field as keyof Employee] || "")}
                    onChange={(e) =>
                      setEditing({ ...editing, [field]: e.target.value })
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 p-3 text-white outline-none focus:border-blue-500"
                  />
                </label>
              ))}
              <label className="text-sm text-slate-400">
                Role
                <select
                  value={editing.role}
                  onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                  className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 p-3 text-white outline-none focus:border-blue-500"
                >
                  <option value="employee">Employee</option>
                  <option value="hr">HR</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <label className="text-sm text-slate-400">
                Status
                <select
                  value={editing.is_active ? "active" : "inactive"}
                  onChange={(e) =>
                    setEditing({ ...editing, is_active: e.target.value === "active" })
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 p-3 text-white outline-none focus:border-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setEditing(null)}
                className="rounded-2xl border border-slate-700 px-5 py-3 font-semibold text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={updateEmployee}
                className="rounded-2xl bg-blue-600 px-5 py-3 font-bold hover:bg-blue-700"
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}

      {tempPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 text-center">
            <h2 className="text-2xl font-bold">Temporary password</h2>
            <p className="mt-2 text-sm text-slate-400">
              Share this with the employee if email delivery is unavailable.
            </p>
            <div className="my-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 font-mono text-xl text-amber-200">
              {tempPassword}
            </div>
            <button
              onClick={() => setTempPassword("")}
              className="rounded-2xl bg-blue-600 px-5 py-3 font-bold hover:bg-blue-700"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
