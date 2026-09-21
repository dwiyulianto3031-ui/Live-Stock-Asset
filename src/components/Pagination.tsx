"use client";

type Props = {
  page: number;
  totalPages: number;
  totalItems: number;
  perPage: number;
  onPageChange: (p: number) => void;
};

export default function Pagination({
  page,
  totalPages,
  totalItems,
  perPage,
  onPageChange,
}: Props) {
  if (totalItems === 0) return null;

  const start = (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, totalItems);

  const pages: number[] = [];
  const from = Math.max(1, page - 2);
  const to = Math.min(totalPages, from + 4);
  for (let i = from; i <= to; i++) pages.push(i);

  const btn =
    "px-3 py-1.5 rounded-lg text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-t border-slate-200">
      <p className="text-xs text-slate-600">
        Menampilkan{" "}
        <span className="font-semibold text-slate-800">
          {start}-{end}
        </span>{" "}
        dari <span className="font-semibold text-slate-800">{totalItems}</span>{" "}
        data · Halaman <span className="font-semibold">{page}</span> dari{" "}
        <span className="font-semibold">{totalPages}</span>
      </p>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          className={`${btn} bg-white border border-slate-300 text-slate-700 hover:bg-slate-100`}
          title="Halaman pertama"
        >
          ««
        </button>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className={`${btn} bg-white border border-slate-300 text-slate-700 hover:bg-slate-100`}
        >
          ‹ Prev
        </button>

        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`${btn} ${
              p === page
                ? "bg-indigo-600 text-white border border-indigo-600"
                : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-100"
            }`}
          >
            {p}
          </button>
        ))}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className={`${btn} bg-white border border-slate-300 text-slate-700 hover:bg-slate-100`}
        >
          Next ›
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          className={`${btn} bg-white border border-slate-300 text-slate-700 hover:bg-slate-100`}
          title="Halaman terakhir"
        >
          »»
        </button>
      </div>
    </div>
  );
}
