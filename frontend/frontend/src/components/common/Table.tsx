// src/components/AppTable.tsx

interface TableProps {
  headers: string[];

  children: React.ReactNode;

  className?: string;
}

export default function Table({ headers, children }: TableProps) {
  return (
    <div className="dash-data-table-wrap overflow-x-auto border border-slate-700">
      <table className="dash-data-table w-full text-left text-white">
        <thead className="dash-data-table-head border-b border-slate-700 bg-slate-700/50 text-center">
          <tr>
            {headers.map((header, index) => (
              <th
                key={index}
                className="px-6 py-4 font-semibold whitespace-nowrap"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
