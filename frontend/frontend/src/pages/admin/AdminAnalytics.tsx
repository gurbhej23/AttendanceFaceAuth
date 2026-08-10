import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import API from "../../services/api";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import AnimatedBackground from "../../components/motion/AnimatedBackground";

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
    ["Employees", data?.total_employees ?? 0, "text-blue-600 dark:text-blue-400"],
    ["Records", data?.total_records ?? 0, "text-emerald-600 dark:text-emerald-400"],
    ["Work Hours", data?.total_working_hours ?? "0h 0m", "text-cyan-600 dark:text-cyan-400"],
    ["Avg Late", `${data?.average_late_minutes ?? 0}m`, "text-amber-600 dark:text-amber-400"],
  ];

  return (
    <div className="admin-page-bg relative min-h-screen bg-slate-950 p-4 sm:p-6 text-slate-900 dark:text-white overflow-x-hidden">
      <AnimatedBackground />

      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="text-center md:text-left">
            <p className="admin-subheading text-sm text-slate-600 dark:text-slate-400">Admin Analytics</p>
            <h1 className="admin-heading-title text-3xl font-extrabold text-slate-900 dark:text-white">
              Attendance Analytics
            </h1>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <select
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="sheet-input-box rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-slate-900 dark:text-white outline-none focus:border-blue-500 cursor-pointer"
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
              className="sheet-input-box w-28 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-slate-900 dark:text-white outline-none focus:border-blue-500"
            />
            <Button
              text="Attendance Sheet"
              onClick={() => navigate("/attendance-sheet")}
              className="rounded-xl bg-blue-600 text-white hover:bg-blue-700 px-5 py-3 font-semibold shadow-lg shadow-blue-500/20 transition cursor-pointer"
            />
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/15 p-4 text-red-700 dark:text-red-300 font-semibold shadow-md">
            {error}
          </div>
        )}

        {loading ? (
          <div className="admin-card rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-10 text-center text-slate-600 dark:text-slate-300 shadow-xl">
            Loading analytics...
          </div>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {cards.map(([label, value, color], idx) => (
                <motion.div
                  key={String(label)}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.08 }}
                  whileHover={{ scale: 1.04, rotateX: 3, rotateY: -3, z: 15 }}
                  className="admin-card rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-lg backdrop-blur-xl transition-all"
                  style={{ perspective: 1000 }}
                >
                  <p className="sheet-stat-label text-sm text-slate-500 dark:text-slate-400 font-semibold">{label}</p>
                  <p className={`mt-2 text-3xl font-black ${color}`}>{value}</p>
                </motion.div>
              ))}
            </div>

            <div className="mb-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.01 }}
                className="admin-card rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl backdrop-blur-xl"
              >
                <h2 className="admin-heading-title mb-5 text-xl font-bold text-slate-900 dark:text-white">Daily Trend</h2>
                <div className="space-y-3">
                  {(data?.daily || []).map((day) => {
                    const total =
                      Number(day.present || 0) +
                      Number(day.absent || 0) +
                      Number(day.half_day || 0) +
                      Number(day.leave || 0);
                    return (
                      <div key={String(day.date)} className="grid grid-cols-[96px_1fr] items-center gap-3">
                        <span className="sheet-subheading text-sm text-slate-600 dark:text-slate-400 font-medium">{String(day.date).slice(5)}</span>
                        <div className="h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                          <div
                            className="h-full rounded-full bg-linear-to-r from-emerald-500 via-amber-400 to-rose-500 shadow-sm"
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
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.01 }}
                className="admin-card rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl backdrop-blur-xl"
              >
                <h2 className="admin-heading-title mb-5 text-xl font-bold text-slate-900 dark:text-white">Status Mix</h2>
                <div className="space-y-3">
                  {Object.entries(data?.status_counts || {}).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between rounded-2xl bg-slate-100 dark:bg-slate-800/70 px-4 py-3 border border-slate-200 dark:border-slate-700/50">
                      <span className="capitalize text-slate-700 dark:text-slate-300 font-semibold">{status.replace("_", " ")}</span>
                      <span className="font-bold text-slate-900 dark:text-white">{count}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.01 }}
                className="admin-card rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl backdrop-blur-xl"
              >
                <h2 className="admin-heading-title mb-5 text-xl font-bold text-slate-900 dark:text-white">Departments</h2>
                <div className="space-y-3">
                  {(data?.departments || []).map((department) => (
                    <div key={department.department} className="rounded-2xl bg-slate-100 dark:bg-slate-800/70 p-4 border border-slate-200 dark:border-slate-700/50">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="font-bold text-slate-900 dark:text-white">{department.department}</p>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{department.employees} employees</p>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Present {department.present} · Late {department.late} · Absent {department.absent}
                      </p>
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.01 }}
                className="admin-card rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl backdrop-blur-xl"
              >
                <h2 className="admin-heading-title mb-5 text-xl font-bold text-slate-900 dark:text-white">Top Late Employees</h2>
                <div className="space-y-3">
                  {(data?.top_late_employees || []).map((employee) => (
                    <div key={employee.employee_id} className="flex items-center justify-between rounded-2xl bg-slate-100 dark:bg-slate-800/70 p-4 border border-slate-200 dark:border-slate-700/50">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{employee.employee_name}</p>
                        <p className="text-xs text-slate-500">{employee.employee_id}</p>
                      </div>
                      <p className="text-sm font-bold text-amber-600 dark:text-yellow-300">
                        {employee.late_count} times · {employee.minutes_late}m
                      </p>
                    </div>
                  ))}
                  {data?.top_late_employees.length === 0 && (
                    <p className="text-sm text-slate-500">No late records this month</p>
                  )}
                </div>
              </motion.div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
