// src/components/common/Table.tsx

interface TableProps {
  headers: string[];
  children: React.ReactNode;
  className?: string;
}

export default function Table({ headers, children, className }: TableProps) {
  return (
    <div className={`dash-data-table-wrap overflow-x-auto border border-slate-700/60 rounded-2xl ${className || ""}`}>
      <table className="dash-data-table w-full text-center text-white">
        <thead className="dash-data-table-head border-b border-slate-700/80 bg-slate-800/80 text-center">
          <tr>
            {headers.map((header, index) => (
              <th
                key={index}
                className="px-6 py-4 text-center font-bold tracking-wider text-xs uppercase text-slate-300 whitespace-nowrap"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="text-center">{children}</tbody>
      </table>
    </div>
  );
}
