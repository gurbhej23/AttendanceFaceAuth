import { useNavigate } from "react-router-dom";
import type { AttendanceRecord } from "../../types/attendance";
import { DASH_CELL_EMPTY, isEmptyCellValue } from "../../utils/dashboardUi";
import Table from "../common/Table";
import ProfileAvatarImg from "../common/ProfileAvatarImg";
import EmployeeAttendanceTableSkeleton from "./EmployeeAttendanceTableSkeleton";

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
    <div className="dash-table-panel dash-fade-up dash-fade-up-delay-4 overflow-hidden border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl">
      <div className="flex flex-col gap-4 border-b border-white/10 p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Attendance Records
          </h2>
          <p className="mt-1 text-slate-300">Your daily attendance history</p>
        </div>
        <div className="dash-squircle border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
          Total Records:{" "}
          <span className="font-bold text-white">{records.length}</span>
        </div>
      </div>

      {loading ? (
        <EmployeeAttendanceTableSkeleton />
      ) : records.length === 0 ? (
        <div className="p-12 text-center dash-fade-up">
          <div className="mb-4 text-6xl">📭</div>
          <p className="text-xl font-semibold text-slate-300">
            No attendance records
          </p>
          <p className="mt-2 text-slate-400">
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
            {records.map((record, idx) => {
              const checkInEmpty = isEmptyCellValue(record.check_in);
              const checkOutEmpty = isEmptyCellValue(record.check_out);
              const durationEmpty = isEmptyCellValue(record.duration);

              return (
              <tr
                key={`${record.date}-${record.employee_id}-${idx}`}
                className="dash-table-row dash-row-enter border-b border-white/5 text-center"
                style={{
                  animationDelay: `${Math.min(idx, 12) * 35}ms`,
                }}
              >
                <td className="px-4 py-4">
                  <div className="mx-auto h-10 w-10 overflow-hidden rounded-full border border-white/10 bg-slate-800">
                    {record.profile_img ? (
                      <button onClick={() => navigate("/profile")}>
                        <ProfileAvatarImg
                          src={getMediaUrl(record.profile_img)}
                          alt={record.employee_name}
                          className="cursor-pointer"
                        />
                      </button>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-blue-500 to-cyan-400 text-sm font-bold text-white">
                        {record.employee_name?.charAt(0)}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4 text-left">
                  <p className="font-semibold text-white">
                    {record.employee_name}
                  </p>
                  <p className="text-xs text-slate-300">Employee</p>
                </td>
                <td className="text-sm font-medium text-slate-300">
                  {record.employee_id}
                </td>
                <td className="px-4 py-4">
                  {checkInEmpty ? (
                    <span className={`font-mono text-sm ${DASH_CELL_EMPTY}`}>
                      {record.check_in || "--"}
                    </span>
                  ) : (
                    <span className="dash-squircle bg-green-500/10 px-1 py-1.5 font-mono text-sm text-green-300">
                      {record.check_in}
                    </span>
                  )}
                </td>
                <td className="px-4 py-4">
                  {checkOutEmpty ? (
                    <span className={`font-mono text-sm ${DASH_CELL_EMPTY}`}>
                      {record.check_out || "--"}
                    </span>
                  ) : (
                    <span className="dash-squircle bg-red-500/10 px-3 py-1.5 font-mono text-sm text-red-300">
                      {record.check_out}
                    </span>
                  )}
                </td>
                <td className="px-4 py-4">
                  <span
                    className={
                      durationEmpty
                        ? `text-sm ${DASH_CELL_EMPTY}`
                        : "font-semibold text-slate-300"
                    }
                  >
                    {record.duration || "--"}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-semibold capitalize ${getStatusBadgeClass(record.status)} ${
                      record.status === "not_marked" ? "status-not-marked-pulse" : ""
                    }`}
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
                      className="block max-w-30 truncate text-sm text-slate-400 underline underline-offset-2 transition hover:text-blue-400"
                    >
                      {record.reason}
                    </button>
                  ) : (
                    <span className={`text-sm ${DASH_CELL_EMPTY}`}>--</span>
                  )}
                </td>
                <td className="px-4 py-4 font-medium text-slate-400">
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
                    <span className={`text-xs ${DASH_CELL_EMPTY}`}>--</span>
                  )}
                </td>
              </tr>
            );
            })}
          </Table>
        </div>
      )}
    </div>
  );
}
