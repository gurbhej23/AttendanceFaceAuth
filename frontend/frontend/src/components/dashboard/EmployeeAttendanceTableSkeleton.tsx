const ROWS = 5;
const COLS = 10;

export default function EmployeeAttendanceTableSkeleton() {
  return (
    <div className="overflow-x-auto" aria-busy="true" aria-label="Loading attendance">
      <table className="w-full text-left text-white">
        <thead className="border-b border-white/10 bg-slate-800/40 text-xs uppercase tracking-wider text-slate-500">
          <tr className="text-center">
            {Array.from({ length: COLS }).map((_, i) => (
              <th key={i} className="px-4 py-4">
                <div className="mx-auto h-3 w-12 skeleton-shimmer rounded" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: ROWS }).map((_, row) => (
            <tr key={row} className="border-b border-white/5">
              <td className="px-4 py-4">
                <div className="mx-auto h-10 w-10 skeleton-shimmer rounded-full" />
              </td>
              <td className="px-4 py-4">
                <div className="mx-auto h-4 w-24 skeleton-shimmer rounded" />
                <div className="mx-auto mt-2 h-3 w-16 skeleton-shimmer rounded" />
              </td>
              <td className="px-4 py-4">
                <div className="mx-auto h-4 w-20 skeleton-shimmer rounded" />
              </td>
              <td className="px-4 py-4">
                <div className="mx-auto h-7 w-16 skeleton-shimmer rounded-xl" />
              </td>
              <td className="px-4 py-4">
                <div className="mx-auto h-7 w-16 skeleton-shimmer rounded-xl" />
              </td>
              <td className="px-4 py-4">
                <div className="mx-auto h-4 w-14 skeleton-shimmer rounded" />
              </td>
              <td className="px-4 py-4">
                <div className="mx-auto h-7 w-20 skeleton-shimmer rounded-full" />
              </td>
              <td className="px-4 py-4">
                <div className="mx-auto h-4 w-20 skeleton-shimmer rounded" />
              </td>
              <td className="px-4 py-4">
                <div className="mx-auto h-4 w-24 skeleton-shimmer rounded" />
              </td>
              <td className="px-4 py-4">
                <div className="mx-auto h-4 w-12 skeleton-shimmer rounded" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
