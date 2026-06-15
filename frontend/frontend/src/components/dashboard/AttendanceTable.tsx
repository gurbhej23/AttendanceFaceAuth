import { useNavigate } from "react-router-dom";
import type { AttendanceRecord } from "../../types/attendance";
import Table from "../common/Table";

interface AttendanceTableProps {
  records: AttendanceRecord[];
  loading: boolean;
  setViewReason: (reason: string | null) => void; 
  setShowReasonModal: (value: boolean) => void;
  getStatusBadgeClass: (status: string) => string;
  getMediaUrl: (path?: string | null) => string;
}

export default function AttendanceTable({
  records,
  loading,
  setViewReason,
  setShowReasonModal,
  getStatusBadgeClass,
  getMediaUrl,
}: AttendanceTableProps) {
  const navigate = useNavigate();


  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-4xl shadow-2xl border border-white/10 overflow-hidden">
      <div className="p-6 border-b border-white/10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl text-white font-bold">
            Attendance Records
          </h2>
          <p className="text-slate-400 mt-1">Your daily attendance history</p>
        </div>
        <div className="bg-slate-900/70 border border-slate-700 px-4 py-3 rounded-2xl text-slate-300 text-sm">
          Total Records:{" "}
          <span className="text-white font-bold">{records.length}</span>
        </div>
      </div>

      {loading ? (
        <div className="p-10 text-center">
          <div className="animate-spin rounded-full h-14 w-14 border-b-2 border-blue-500 mx-auto" />
          <p className="text-slate-400 mt-5 text-lg">Loading records...</p>
        </div>
      ) : records.length === 0 ? (
        <div className="p-12 text-center">
          <div className="text-6xl mb-4">📭</div>
          <p className="text-slate-300 text-xl font-semibold">
            No attendance records
          </p>
          <p className="text-slate-500 mt-2">
            No attendance found for selected date
          </p>
        </div>
      ) : (
        <div className="w-full overflow-x-auto">
          <Table
            headers={[
              "Profile",
              "Employee",
              "ID",
              "Check In",
              "Check Out",
              "Duration",
              "Status",
              "Reason",
              "Date",
              "CV",
            ]}
          >
            {records.map((record, idx) => (
              <tr
                key={idx}
                className="border-b border-white/5 hover:bg-white/5 transition-all duration-200 text-center"
              >
                <td className="px-4 py-4">
                  <div className="mx-auto h-10 w-10 overflow-hidden rounded-full border border-white/10 bg-slate-800">
                    {record.profile_img ? (
                      <button onClick={() => navigate("/profile")}>
                        <img
                          src={getMediaUrl(record.profile_img)}
                          alt={record.employee_name}
                          className="h-full w-full object-cover cursor-pointer"
                        />
                      </button>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-blue-500 to-cyan-400 text-white font-bold text-sm">
                        {record.employee_name?.charAt(0)}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4 text-left">
                  <p className="text-white font-semibold">
                    {record.employee_name}
                  </p>
                  <p className="text-xs text-slate-400">Employee</p>
                </td>
                <td className=" text-sm text-slate-300 font-medium">
                  {record.employee_id}
                </td>
                <td className="px-4 py-4">
                  <span className="bg-green-500/10 text-green-300 px-1 py-1.5 rounded-xl font-mono text-sm">
                    {record.check_in}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <span className="bg-red-500/10 text-red-300 px-3 py-1.5 rounded-xl font-mono text-sm">
                    {record.check_out}
                  </span>
                </td>
                <td className="px-4 py-4 text-slate-300 font-semibold">
                  {record.duration}
                </td>
                <td className="px-4 py-4">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold capitalize ${getStatusBadgeClass(record.status)}`}
                  >
                    {record.status.replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-4">
                  {record.reason && record.reason !== "--" ? (
                    <button
                      onClick={() => {
                        setViewReason(record.reason ?? null);
                        setShowReasonModal(true);
                      }}
                      className="text-slate-400 max-w-30 truncate block hover:text-blue-400 underline underline-offset-2 transition cursor-pointer text-sm"
                    >
                      {record.reason}
                    </button>
                  ) : (
                    <span className="text-slate-600">--</span>
                  )}
                </td>
                <td className="px-4 py-4 text-slate-500 font-medium">
                  {record.date}
                </td>
                <td className="px-5 py-4">
                  {record.cv_file ? (
                    <a
                      href={getMediaUrl(record.cv_file)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-blue-400 hover:text-blue-300"
                    >
                      View CV
                    </a>
                  ) : (
                    <span className="text-slate-600 text-xs">--</span>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        </div>
      )}
    </div>
  );
}
