// src/pages/AdminAttendanceSheet.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import Button from "../components/Button";
import axios from "axios";

interface SheetRecord {
  serial_no: number;
  employee_id: string;
  employee_name: string;
  email: string;
  department: string;
  designation: string;
  date: string;
  status: string;
  check_in: string;
  check_out: string;
  duration: string;
  reason: string;
  half_day_until: string;
  profile_img?: string;
  cv_file?: string;
}

interface SheetResponse {
  sheet_name: string;
  date: string;
  total_employees: number;
  present_count: number;
  absent_count: number;
  half_day_count: number;
  records: SheetRecord[];
}

type StatusFilter = "all" | "present" | "absent" | "half_day";

const getLocalDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const statusClass = (status: string) => {
  switch (status) {
    case "present":
    case "late":
      return "bg-green-500/20 text-green-300";
    case "half day":
    case "half_day":
      return "bg-orange-500/20 text-orange-300";
    case "absent":
    case "leave":
      return "bg-red-500/20 text-red-300";
    default:
      return "bg-slate-500/20 text-slate-300";
  }
};

const statusLabel = (status: string) =>
  status
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");

const getMediaUrl = (path?: string | null) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `http://localhost:8000${path.startsWith("/") ? path : `/${path}`}`;
};

export default function AdminAttendanceSheet() {
  const navigate = useNavigate();

  const [selectedDate, setSelectedDate] = useState(getLocalDate());
  const [sheet, setSheet] = useState<SheetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [viewReason, setViewReason] = useState<string | null>(null);

  const today = getLocalDate();

  // ── Filter records ─────────────────────────────────────────────────────
  const filteredRecords = useMemo(() => {
    const records = sheet?.records || [];
    const search = searchTerm.trim().toLowerCase();
    return records.filter((record) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "present" &&
          ["present", "late"].includes(record.status)) ||
        (statusFilter === "half_day" &&
          ["half_day", "half day"].includes(record.status)) ||
        (statusFilter === "absent" &&
          ["absent", "leave"].includes(record.status)) ||
        record.status === statusFilter;

      const matchesSearch =
        !search ||
        [
          record.employee_name,
          record.employee_id,
          record.email,
          record.department,
          record.designation,
          record.status,
          record.reason,
        ]
          .join(" ")
          .toLowerCase()
          .includes(search);

      return matchesStatus && matchesSearch;
    });
  }, [sheet, searchTerm, statusFilter]);

  // ── Fetch sheet ────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchSheet = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await API.get("/attendance/admin-sheet/", {
          params: { date: selectedDate },
        });

        setSheet(response.data);
      } catch (err: unknown) {
        if (axios.isAxiosError(err)) {
          setError(
            err.response?.data?.error || "Failed to load attendance sheet",
          );
        } else {
          setError("Failed to load attendance sheet");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchSheet();
  }, [selectedDate]);

  useEffect(() => {
    const role = localStorage.getItem("role");
    if (role !== "admin") navigate("/", { replace: true });
  }, [navigate]);

  const handleLogout = () => {
    localStorage.clear();
    navigate("/", { replace: true });
    window.history.pushState(null, "", "/");
  };

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-8xl mx-auto">
        {/* ── HEADER ── */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-3xl text-white font-bold">
              HR Attendance Sheet
            </h1>
            <p className="text-slate-400 mt-1">
              All employees attendance summary for selected date
            </p>
          </div>
          <div className="flex flex-wrap justify-between gap-3">
            <input
              type="date"
              value={selectedDate}
              max={today}
              onChange={(e) =>
                setSelectedDate(e.target.value > today ? today : e.target.value)
              }
              className="p-3 rounded-xl bg-slate-800 text-white border border-slate-700 focus:border-blue-500 outline-none"
            />
            <Button
              text="Logout"
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-xl font-semibold cursor-pointer"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-300 p-4 rounded-xl mb-5">
            {error}
          </div>
        )}

        {/* ── SUMMARY CARDS ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            {
              filter: "all",
              label: "Total",
              value: sheet?.total_employees ?? 0,
              color: "border-slate-700",
              text: "text-slate-300",
            },
            {
              filter: "present",
              label: "Present",
              value: sheet?.present_count ?? 0,
              color: "border-green-500/30",
              text: "text-green-400",
            },
            {
              filter: "absent",
              label: "Absent",
              value: sheet?.absent_count ?? 0,
              color: "border-red-500/30",
              text: "text-red-400",
            },
            {
              filter: "half_day",
              label: "Half Day",
              value: sheet?.half_day_count ?? 0,
              color: "border-orange-500/30",
              text: "text-orange-400",
            },
          ].map(({ filter, label, value, color, text }) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter as StatusFilter)}
              className={`text-left bg-slate-800 border p-5 rounded-2xl transition hover:scale-[1.02] ${
                statusFilter === filter ? color.replace("/30", "") : color
              }`}
            >
              <p className={`text-sm ${text}`}>{label}</p>
              <p className="text-3xl text-white font-bold mt-2">{value}</p>
            </button>
          ))}
        </div>

        {/* ── TABLE ── */}
        <div className="bg-slate-800 border border-slate-700 rounded-3xl overflow-hidden">
          <div className="p-5 border-b border-slate-700 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h2 className="text-xl text-white font-bold">
              {sheet?.sheet_name || "Attendance Sheet"}
            </h2>
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search employee, ID, department..."
              className="w-full md:w-96 p-3 rounded-xl bg-slate-700 text-white border border-slate-600 focus:border-blue-500 outline-none"
            />
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-300">
              Loading sheet...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-white">
                <thead className="bg-slate-700/50 border-b border-slate-700 text-xs text-slate-400 uppercase tracking-wider text-center">
                  <tr>
                    <th className="px-5 py-4">No.</th>
                    <th className="px-5 py-4">Photo</th>
                    <th className="px-5 py-4">Employee</th>
                    <th className="px-5 py-4">ID</th>
                    <th className="px-5 py-4">Department</th>
                    <th className="px-5 py-4">Check In</th>
                    <th className="px-5 py-4">Check Out</th>
                    <th className="px-5 py-4">Duration</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Reason</th>
                    <th className="px-5 py-4">View Profile</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => (
                    <tr
                      key={record.employee_id}
                      className="border-b border-slate-700 hover:bg-slate-700/40 transition text-center"
                    >
                      <td className="px-5 py-4 text-slate-400">
                        {record.serial_no}
                      </td>

                      <td className="px-5 py-4">
                        <div className="mx-auto h-12 w-12 overflow-hidden rounded-2xl border border-white/10 bg-slate-700">
                          {record.profile_img ? (
                            <img
                              src={getMediaUrl(record.profile_img)}
                              alt={record.employee_name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-blue-600 font-bold text-white">
                              {record.employee_name?.charAt(0)}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-medium">{record.employee_name}</p>
                        <p className="text-xs text-slate-400">{record.email}</p>
                      </td>

                      <td className="px-5 py-4 text-slate-300">
                        {record.employee_id}
                      </td>

                      <td className="px-5 py-4 text-slate-300">
                        <p>{record.department}</p>
                        <p className="text-xs text-slate-500">
                          {record.designation}
                        </p>
                      </td>

                      <td className="px-5 py-4 font-mono text-green-300">
                        {record.check_in}
                      </td>
                      <td className="px-5 py-4 font-mono text-red-300">
                        {record.check_out}
                      </td>
                      <td className="px-5 py-4 text-slate-300">
                        {record.duration}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium ${statusClass(record.status)}`}
                        >
                          {statusLabel(record.status)}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        {record.reason && record.reason !== "--" ? (
                          <button
                            onClick={() => setViewReason(record.reason)}
                            className=" text-slate-400 max-w-35 truncate block hover:text-blue-400 underline underline-offset-2 transition cursor-pointer text-sm"
                            title="Click to view full reason"
                          >
                            {record.reason}
                          </button>
                        ) : (
                          <span className="text-slate-600">--</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {record.cv_file && (
                          <a
                            href={getMediaUrl(record.cv_file)}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 block text-xs font-semibold text-blue-400 hover:text-blue-300"
                          >
                            View CV
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}

                  {filteredRecords.length === 0 && (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-5 py-8 text-center text-slate-400"
                      >
                        No records found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── REASON MODAL ── */}
      {viewReason && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-5">
          <div className="bg-[#111827] border border-white/10 rounded-4xl p-8 w-full max-w-md shadow-2xl">
            <div className="w-16 h-16 rounded-3xl bg-blue-500/20 flex items-center justify-center text-3xl mx-auto mb-5">
              📝
            </div>
            <h2 className="text-2xl text-white font-bold text-center mb-4">
              Full Reason
            </h2>
            <div className="bg-slate-900/70 border border-slate-700 rounded-2xl p-4">
              <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap wrap-break-words">
                {viewReason}
              </p>
            </div>
            <Button
              text="Close"
              onClick={() => setViewReason(null)}
              className="w-full mt-6 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-2xl font-semibold transition cursor-pointer"
            />
          </div>
        </div>
      )}
    </div>
  );
}
