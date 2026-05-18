// src/components/AppTable.tsx

interface TableProps {
  headers: string[];
  children: React.ReactNode;
  className?: string;
}

export default function Table({ headers, children }: TableProps) {
  return (
    <div className="overflow-x-auto border border-slate-700">
      <table className="w-full text-left text-white">
        {/* TABLE HEADER */}
        <thead className="bg-slate-700/50 border-b border-slate-700 text-center">
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

        {/* TABLE BODY */}
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
