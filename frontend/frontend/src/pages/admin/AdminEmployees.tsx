import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../services/api";
import Input from "../../components/common/Input";
import Button from "../../components/common/Button";
import { isAdminOrHR } from "../../utils/auth";
import { getMediaUrl } from "../../utils/chatHelpers";
import { ALL_JOB_ROLES, DEPARTMENTS } from "../../constants/departments";
import AnimatedBackground from "../../components/motion/AnimatedBackground";
import ThreeDCardContainer from "../../components/motion/ThreeDCardContainer";
import {
  ArrowLeft,
  Search,
  Users,
  UserCheck,
  UserX,
  Building2,
  Pencil,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  Phone,
  Mail,
  FileText,
  CalendarDays,
  ShieldCheck,
  UserPlus,
  ScanFace,
  KeyRound,
} from "lucide-react";

interface Employee {
  employee_id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  designation: string;
  is_active: boolean;
  is_online?: boolean;
  join_date?: string;
  has_face?: boolean;
  has_attendance_pin?: boolean;
  profile_img: string;
  cv_file: string;
}

const PAGE_SIZE = 8;

const getError = (err: unknown, fallback: string) => {
  const e = err as { response?: { data?: { error?: string } } };
  return e.response?.data?.error || fallback;
};

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function Avatar({ employee, size = 10 }: { employee: Employee; size?: number }) {
  const px = size * 4;
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-full border border-slate-200 bg-linear-to-br from-blue-500 to-cyan-500 dark:border-slate-700"
      style={{ width: px, height: px }}
    >
      {employee.profile_img ? (
        <img
          src={getMediaUrl(employee.profile_img)}
          alt={employee.name}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-sm font-bold text-white">
          {initials(employee.name || "?")}
        </div>
      )}
      {employee.is_online && (
        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" />
      )}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    admin: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
    hr: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    employee: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold capitalize ${styles[role] || styles.employee
        }`}
    >
      {role}
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${active
        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
        : "bg-red-500/15 text-red-700 dark:text-red-300"
        }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-red-500"}`} />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export default function AdminEmployees() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"active" | "inactive" | "all">("active");
  const [role, setRole] = useState("all");
  const [department, setDepartment] = useState("all");
  const [viewMode, setViewMode] = useState<"employees" | "staff">("employees");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [viewing, setViewing] = useState<Employee | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const [saving, setSaving] = useState(false);

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
    if (!isAdminOrHR()) {
      navigate("/", { replace: true });
      return;
    }
    const timer = setTimeout(loadEmployees, 250);
    return () => clearTimeout(timer);
  }, [loadEmployees, navigate]);

  useEffect(() => {
    setPage(1);
  }, [search, status, role, department, viewMode]);

  const stats = useMemo(() => {
    const active = employees.filter((e) => e.is_active).length;
    const inactive = employees.filter((e) => !e.is_active).length;
    const departments = new Set(employees.map((e) => e.department).filter(Boolean));
    return { active, inactive, departments: departments.size };
  }, [employees]);

  const visibleEmployees = useMemo(() => {
    let list =
      viewMode === "staff"
        ? employees.filter((e) => e.role !== "employee")
        : employees.filter((e) => e.role === "employee");
    if (department !== "all") {
      list = list.filter((e) => e.department === department);
    }
    return list;
  }, [employees, viewMode, department]);

  const totalPages = Math.max(1, Math.ceil(visibleEmployees.length / PAGE_SIZE));
  const pagedEmployees = visibleEmployees.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  const updateEmployee = async () => {
    if (!editing) return;
    try {
      setSaving(true);
      const res = await API.post("/employees/admin-update-employee/", editing);
      showToast(res.data.message || "Employee updated");
      setEditing(null);
      loadEmployees();
    } catch (err) {
      showToast(getError(err, "Update failed"), false);
    } finally {
      setSaving(false);
    }
  };

  const statCards = [
    {
      label: "Total employees",
      value: employees.filter((e) => e.role === "employee").length,
      icon: Users,
      accent: "from-blue-500 to-cyan-500",
    },
    {
      label: "Active accounts",
      value: stats.active,
      icon: UserCheck,
      accent: "from-emerald-500 to-teal-500",
    },
    {
      label: "Inactive accounts",
      value: stats.inactive,
      icon: UserX,
      accent: "from-red-500 to-rose-500",
    },
    {
      label: "Departments",
      value: stats.departments,
      icon: Building2,
      accent: "from-purple-500 to-indigo-500",
    },
  ];

  return (
    <div className="admin-page-bg relative min-h-screen overflow-hidden bg-slate-950 px-4 py-6 text-slate-900 dark:text-white transition-colors duration-300">
      <AnimatedBackground />

      {toast && (
        <div
          className={`fixed top-5 left-1/2 z-50 -translate-x-1/2 rounded-2xl border px-5 py-3 text-sm font-semibold shadow-xl ${toast.ok
            ? "border-green-500/30 bg-green-500/15 text-green-700 dark:text-green-300"
            : "border-red-500/30 bg-red-500/15 text-red-700 dark:text-red-300"
            }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="relative z-10 mx-auto max-w-7xl">
        {/* Header */}
        <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              onClick={() => navigate(-1)}
              text={<ArrowLeft className="h-5 w-5" />}
              unstyled
              aria-label="Back"
              className="rounded-2xl border border-slate-300 bg-white p-3 text-slate-700 shadow-md hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            />
            <div>
              <p className="admin-subheading text-sm font-semibold text-blue-600 dark:text-blue-300">
                Admin workspace
              </p>
              <h1 className="admin-heading-title text-3xl font-extrabold text-slate-900 dark:text-white">
                Employee Management
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              onClick={() => navigate("/register")}
              text={
                <span className="inline-flex items-center gap-2">
                  <UserPlus className="h-4 w-4" /> Add employee
                </span>
              }
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm text-white shadow-md shadow-blue-500/20 hover:bg-blue-700"
            />
            <Button
              onClick={() => navigate("/attendance-sheet")}
              text="Attendance sheet"
              className="sheet-btn-secondary rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-sm"
            />
            <Button
              onClick={() => {
                localStorage.clear();
                navigate("/", { replace: true });
              }}
              text="Logout"
              className="rounded-xl bg-red-600 px-4 py-2.5 text-sm text-white hover:bg-red-700 shadow-md shadow-red-500/20"
            />
          </div>
        </header>

        {/* Stat cards */}
        <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {statCards.map(({ label, value, icon: Icon, accent }) => (
            <ThreeDCardContainer key={label} maxDegrees={9}>
              <div className="admin-card relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-lg backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900">
                <div
                  className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br ${accent} text-white shadow-md`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-3xl font-black text-slate-900 dark:text-white">{value}</p>
                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                  {label}
                </p>
              </div>
            </ThreeDCardContainer>
          ))}
        </div>

        {/* Main panel */}
        <ThreeDCardContainer maxDegrees={4}>
          <section className="admin-card overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900">
            {/* Toolbar */}
            <div className="grid gap-3 border-b border-slate-200 p-5 dark:border-slate-800 lg:grid-cols-[1fr_150px_150px_150px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, ID, email, department..."
                  className="sheet-input-box rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 pl-10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-blue-500"
                />
              </div>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "active" | "inactive" | "all")}
                className="sheet-input-box rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-slate-900 dark:text-white outline-none focus:border-blue-500"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="all">All status</option>
              </select>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="sheet-input-box rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-slate-900 dark:text-white outline-none focus:border-blue-500"
              >
                <option value="all">All departments</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="sheet-input-box rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-slate-900 dark:text-white outline-none focus:border-blue-500"
              >
                <option value="all">All access</option>
                <option value="employee">Employee</option>
                <option value="hr">HR</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {/* View mode tabs */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-950">
                <button
                  onClick={() => setViewMode("employees")}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${viewMode === "employees"
                    ? "bg-blue-600 text-white shadow"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    }`}
                >
                  Employees
                </button>
                <button
                  onClick={() => setViewMode("staff")}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${viewMode === "staff"
                    ? "bg-cyan-600 text-white shadow"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    }`}
                >
                  HR / Admin
                </button>
              </div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {visibleEmployees.length} result{visibleEmployees.length === 1 ? "" : "s"}
              </p>
            </div>

            {/* Table */}
            {loading ? (
              <div className="space-y-3 p-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex animate-pulse items-center gap-4 rounded-2xl bg-slate-100 p-4 dark:bg-slate-800/60"
                  >
                    <div className="h-10 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-1/3 rounded bg-slate-300 dark:bg-slate-700" />
                      <div className="h-2.5 w-1/4 rounded bg-slate-200 dark:bg-slate-800" />
                    </div>
                    <div className="h-6 w-16 rounded-full bg-slate-200 dark:bg-slate-800" />
                  </div>
                ))}
              </div>
            ) : visibleEmployees.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                  <Users className="h-6 w-6 text-slate-400" />
                </div>
                <p className="font-semibold text-slate-700 dark:text-slate-200">
                  No employees found
                </p>
                <p className="max-w-xs text-sm text-slate-500 dark:text-slate-400">
                  Try adjusting your search or filters, or add a new employee to get started.
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-950 dark:text-slate-500">
                      <tr>
                        <th className="px-5 py-4">Employee</th>
                        <th className="px-5 py-4">Department</th>
                        <th className="px-5 py-4">Contact</th>
                        <th className="px-5 py-4">Access</th>
                        <th className="px-5 py-4">Status</th>
                        <th className="px-5 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {pagedEmployees.map((employee) => (
                        <tr
                          key={employee.employee_id}
                          className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <Avatar employee={employee} />
                              <div className="min-w-0">
                                <button
                                  onClick={() => setViewing(employee)}
                                  className="block truncate text-left font-semibold text-slate-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-300"
                                >
                                  {employee.name}
                                </button>
                                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                                  {employee.employee_id}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-sm">
                            <p className="text-slate-700 dark:text-slate-300">
                              {employee.department || "--"}
                            </p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">
                              {employee.designation || "--"}
                            </p>
                          </td>
                          <td className="px-5 py-4 text-sm">
                            <p className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                              <Mail className="h-3.5 w-3.5 text-slate-400" />
                              <span className="max-w-[160px] truncate">{employee.email}</span>
                            </p>
                            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
                              <Phone className="h-3 w-3" /> {employee.phone || "--"}
                            </p>
                          </td>
                          <td className="px-5 py-4">
                            <RoleBadge role={employee.role} />
                          </td>
                          <td className="px-5 py-4">
                            <StatusBadge active={employee.is_active} />
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-2">
                              <Button
                                onClick={() => setViewing(employee)}
                                text={<Eye className="h-4 w-4" />}
                                unstyled
                                title="View profile"
                                aria-label="View profile"
                                className="rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                              />
                              <Button
                                onClick={() => setEditing(employee)}
                                text={<Pencil className="h-4 w-4" />}
                                unstyled
                                title="Edit employee"
                                aria-label="Edit employee"
                                className="rounded-xl bg-blue-600 p-2.5 text-white hover:bg-blue-700"
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4 dark:border-slate-800">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Page {page} of {totalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        text={<ChevronLeft className="h-4 w-4" />}
                        unstyled
                        aria-label="Previous page"
                        className="rounded-xl border border-slate-300 p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      />
                      <Button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        text={<ChevronRight className="h-4 w-4" />}
                        unstyled
                        aria-label="Next page"
                        className="rounded-xl border border-slate-300 p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </ThreeDCardContainer>
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar employee={editing} size={12} />
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    Edit employee
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {editing.employee_id}
                  </p>
                </div>
              </div>
              <Button
                onClick={() => setEditing(null)}
                text={<X className="h-5 w-5" />}
                unstyled
                aria-label="Close"
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {[
                ["name", "Name"],
                ["phone", "Phone"],
              ].map(([field, label]) => (
                <label key={field} className="text-sm text-slate-500 dark:text-slate-400">
                  {label}
                  <Input
                    value={String(editing[field as keyof Employee] || "")}
                    onChange={(e) => setEditing({ ...editing, [field]: e.target.value })}
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 p-3 text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </label>
              ))}
              <label className="text-sm text-slate-500 dark:text-slate-400">
                Department
                <select
                  value={editing.department || "IT"}
                  onChange={(e) => setEditing({ ...editing, department: e.target.value })}
                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 p-3 text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                >
                  {DEPARTMENTS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-500 dark:text-slate-400">
                Job Role
                <select
                  value={editing.designation || "Software Engineer"}
                  onChange={(e) => setEditing({ ...editing, designation: e.target.value })}
                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 p-3 text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                >
                  {ALL_JOB_ROLES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-500 dark:text-slate-400">
                Access
                <select
                  value={editing.role}
                  onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 p-3 text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                >
                  <option value="employee">Employee</option>
                  <option value="hr">HR</option>
                  <option value="admin">Admin</option>
                </select>
              </label>

              {/* Status toggle */}
              <div className="flex items-center justify-between rounded-2xl border border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Account status
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setEditing({ ...editing, is_active: !editing.is_active })
                  }
                  className={`relative h-7 w-12 rounded-full transition-colors ${editing.is_active ? "bg-emerald-500" : "bg-slate-400 dark:bg-slate-700"
                    }`}
                  aria-pressed={editing.is_active}
                  aria-label="Toggle account status"
                >
                  <span
                    className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${editing.is_active ? "translate-x-5" : "translate-x-0.5"
                      }`}
                  />
                </button>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                onClick={() => setEditing(null)}
                text="Cancel"
                className="rounded-xl border border-slate-300 px-5 py-3 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              />
              <Button
                onClick={updateEmployee}
                text="Save changes"
                loading={saving}
                className="rounded-xl bg-blue-600 px-5 py-3 text-white hover:bg-blue-700"
              />
            </div>
          </div>
        </div>
      )}

      {/* View profile modal */}
      {viewing && (
        <div className="fixed inset-0 z-99 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5 flex items-start justify-between">
              <div className="flex items-center gap-4">
                <Avatar employee={viewing} size={16} />
                <div>
                  <p className="text-sm font-semibold text-blue-600 dark:text-blue-300">
                    {viewing.employee_id}
                  </p>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                    {viewing.name}
                  </h2>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <RoleBadge role={viewing.role} />
                    <StatusBadge active={viewing.is_active} />
                  </div>
                </div>
              </div>
              <Button
                onClick={() => setViewing(null)}
                text={<X className="h-5 w-5" />}
                unstyled
                aria-label="Close"
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  { Icon: Mail, label: "Email", value: viewing.email || "--" },
                  { Icon: Phone, label: "Phone", value: viewing.phone || "--" },
                  { Icon: Building2, label: "Department", value: viewing.department || "--" },
                  { Icon: ShieldCheck, label: "Job Role", value: viewing.designation || "--" },
                  { Icon: CalendarDays, label: "Joined", value: viewing.join_date || "--" },
                  {
                    Icon: ScanFace,
                    label: "Face Enrolled",
                    value: viewing.has_face ? "Yes" : "Not set up",
                  },
                  {
                    Icon: KeyRound,
                    label: "Attendance PIN",
                    value: viewing.has_attendance_pin ? "Configured" : "Not set",
                  },
                ] as const
              ).map(({ Icon, label, value }) => (
                <div
                  key={label}
                  className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
                    <p className="truncate font-semibold text-slate-800 dark:text-white">
                      {value}
                    </p>
                  </div>
                </div>
              ))}
              {viewing.cv_file && (
                <a
                  href={getMediaUrl(viewing.cv_file)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-3 text-center font-semibold text-blue-600 hover:bg-blue-500/15 dark:text-blue-300 sm:col-span-2"
                >
                  <FileText className="h-4 w-4" /> View CV
                </a>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                onClick={() => {
                  setEditing(viewing);
                  setViewing(null);
                }}
                text="Edit employee"
                className="rounded-xl border border-slate-300 px-5 py-3 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              />
              <Button
                onClick={() => setViewing(null)}
                text="Close"
                className="rounded-xl bg-blue-600 px-5 py-3 text-white hover:bg-blue-700"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}