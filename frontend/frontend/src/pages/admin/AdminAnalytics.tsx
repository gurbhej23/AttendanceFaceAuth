import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../services/api";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";

interface AnalyticsData {
  total_employees: number;
  total_records: number;
  total_working_hours: string;
  average_late_minutes: number;
  status_counts: Record<string, number>;
  location_counts: Record<string, number>;
  daily: Array<Record<string, string | number>>;
  departments: Array<{
    department: string;
    employees: number;
    present: number;
    late: number;
    absent: number;
  }>;
  top_late_employees: Array<{
    employee_id: string;
    employee_name: string;
    late_count: number;
    minutes_late: number;
  }>;
}

export default function AdminAnalytics() {
  const navigate = useNavigate();
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const role = localStorage.getItem("role");
    if (!["admin", "hr"].includes(role || "")) navigate("/", { replace: true });
  }, [navigate]);

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await API.get("/attendance/admin-analytics/", {
          params: { year, month },
        });
        setData(res.data);
      } catch {
        setError("Failed to load analytics");
      } finally {
        setLoading(false);
      }
    };
    loadAnalytics();
  }, [year, month]);

  const maxDaily = useMemo(() => {
    if (!data?.daily.length) return 1;
    return Math.max(
      ...data.daily.map(
        (day) =>
          Number(day.present || 0) +
          Number(day.absent || 0) +
          Number(day.half_day || 0) +
          Number(day.leave || 0),
      ),
      1,
    );
  }, [data]);

  const cards = [
    ["Employees", data?.total_employees ?? 0, "text-blue-300"],
    ["Records", data?.total_records ?? 0, "text-green-300"],
    ["Work Hours", data?.total_working_hours ?? "0h 0m", "text-cyan-300"],
    ["Avg Late", `${data?.average_late_minutes ?? 0}m`, "text-yellow-300"],
  ];

  return (
    <div className="min-h-screen bg-slate-900 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="text-center">
            <p className="text-sm text-slate-400">Admin</p>
            <h1 className="text-3xl font-bold text-white">Attendance Analytics</h1>
          </div>
          <div className="flex justify-center gap-3">
            <select
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-800 p-3 text-white outline-none focus:border-blue-500"
            >
              {Array.from({ length: 12 }, (_, index) => (
                <option key={index + 1} value={String(index + 1)}>
                  {new Date(2026, index).toLocaleString("en-IN", {
                    month: "long",
                  })}
                </option>
              ))}
            </select>
            <Input
              value={year}
              onChange={(event) => setYear(event.target.value)}
              className="w-28 rounded-xl border border-slate-700 bg-slate-800 p-3 text-white outline-none focus:border-blue-500"
            />
            <Button
              text="Attendance"
              onClick={() => navigate("/attendance-sheet")}
              className="bg-blue-600 text-white hover:bg-blue-700 p-4"
            />
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/15 p-4 text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-3xl border border-slate-700 bg-slate-800 p-10 text-center text-slate-300">
            Loading analytics...
          </div>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {cards.map(([label, value, color]) => (
                <div
                  key={label}
                  className="rounded-3xl border border-slate-700 bg-slate-800 p-5"
                >
                  <p className="text-sm text-slate-400">{label}</p>
                  <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            <div className="mb-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <div className="rounded-3xl border border-slate-700 bg-slate-800 p-5">
                <h2 className="mb-5 text-xl font-bold text-white">Daily Trend</h2>
                <div className="space-y-3">
                  {(data?.daily || []).map((day) => {
                    const total =
                      Number(day.present || 0) +
                      Number(day.absent || 0) +
                      Number(day.half_day || 0) +
                      Number(day.leave || 0);
                    return (
                      <div key={String(day.date)} className="grid grid-cols-[96px_1fr] items-center gap-3">
                        <span className="text-sm text-slate-400">{String(day.date).slice(5)}</span>
                        <div className="h-3 overflow-hidden rounded-full bg-slate-700">
                          <div
                            className="h-full rounded-full bg-linear-to-r from-green-500 via-yellow-400 to-red-500"
                            style={{ width: `${Math.max((total / maxDaily) * 100, 4)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {data?.daily.length === 0 && (
                    <p className="text-sm text-slate-500">No records for this month</p>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-700 bg-slate-800 p-5">
                <h2 className="mb-5 text-xl font-bold text-white">Status Mix</h2>
                <div className="space-y-3">
                  {Object.entries(data?.status_counts || {}).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between rounded-2xl bg-slate-900/70 px-4 py-3">
                      <span className="capitalize text-slate-300">{status.replace("_", " ")}</span>
                      <span className="font-bold text-white">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-slate-700 bg-slate-800 p-5">
                <h2 className="mb-5 text-xl font-bold text-white">Departments</h2>
                <div className="space-y-3">
                  {(data?.departments || []).map((department) => (
                    <div key={department.department} className="rounded-2xl bg-slate-900/70 p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="font-semibold text-white">{department.department}</p>
                        <p className="text-sm text-slate-400">{department.employees} employees</p>
                      </div>
                      <p className="text-sm text-slate-400">
                        Present {department.present} · Late {department.late} · Absent {department.absent}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-700 bg-slate-800 p-5">
                <h2 className="mb-5 text-xl font-bold text-white">Top Late Employees</h2>
                <div className="space-y-3">
                  {(data?.top_late_employees || []).map((employee) => (
                    <div key={employee.employee_id} className="flex items-center justify-between rounded-2xl bg-slate-900/70 p-4">
                      <div>
                        <p className="font-semibold text-white">{employee.employee_name}</p>
                        <p className="text-xs text-slate-500">{employee.employee_id}</p>
                      </div>
                      <p className="text-sm font-bold text-yellow-300">
                        {employee.late_count} times · {employee.minutes_late}m
                      </p>
                    </div>
                  ))}
                  {data?.top_late_employees.length === 0 && (
                    <p className="text-sm text-slate-500">No late records this month</p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
