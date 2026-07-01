const ROWS = 7;

export default function AttendanceTableSkeleton() {
  return (
    <div className="overflow-x-auto" aria-busy="true" aria-label="Loading attendance">
      <table className="dash-data-table w-full text-left text-white">
        <thead className="dash-data-table-head border-b border-slate-700/80 bg-slate-700/30 text-xs uppercase tracking-wider text-slate-500">
          <tr className="text-center">
            {Array.from({ length: 11 }).map((_, i) => (
              <th key={i} className="px-5 py-4">
                <div className="mx-auto h-3 w-12 skeleton-shimmer rounded" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: ROWS }).map((_, row) => (
            <tr
              key={row}
              className="border-b border-slate-700/60"
              style={{ animationDelay: `${row * 50}ms` }}
            >
              <td className="px-5 py-4">
                <div className="mx-auto h-12 w-12 skeleton-shimmer rounded-full" />
              </td>
              <td className="px-5 py-4">
                <div className="mx-auto h-4 w-28 skeleton-shimmer rounded" />
                <div className="mx-auto mt-2 h-3 w-36 skeleton-shimmer rounded" />
              </td>
              <td className="px-5 py-4">
                <div className="mx-auto h-4 w-24 skeleton-shimmer rounded" />
              </td>
              <td className="px-5 py-4">
                <div className="mx-auto h-4 w-20 skeleton-shimmer rounded" />
              </td>
              <td className="px-5 py-4">
                <div className="mx-auto h-4 w-16 skeleton-shimmer rounded" />
              </td>
              <td className="px-5 py-4">
                <div className="mx-auto h-4 w-16 skeleton-shimmer rounded" />
              </td>
              <td className="px-5 py-4">
                <div className="mx-auto h-4 w-14 skeleton-shimmer rounded" />
              </td>
              <td className="px-5 py-4">
                <div className="mx-auto h-7 w-24 skeleton-shimmer rounded-full" />
              </td>
              <td className="px-5 py-4">
                <div className="mx-auto h-4 w-20 skeleton-shimmer rounded" />
              </td>
              <td className="px-5 py-4">
                <div className="mx-auto h-4 w-24 skeleton-shimmer rounded" />
              </td>
              <td className="px-5 py-4">
                <div className="mx-auto h-4 w-12 skeleton-shimmer rounded" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
