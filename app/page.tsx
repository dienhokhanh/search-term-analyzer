"use client";

import { useMemo, useState } from "react";
import Papa from "papaparse";

type RawRow = {
  "Search term": string;
  "Match type": string;
  Impressions: number | string;
  Clicks: number | string;
  Cost: number | string;
  Conversions: number | string;
};

type Suggestion = "Add as Negative" | "Add as Exact" | "Keep / Monitor";

type AnalyzedRow = {
  searchTerm: string;
  matchType: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  cpa: number | null;
  suggestion: Suggestion;
};

const REQUIRED_COLUMNS: (keyof RawRow)[] = [
  "Search term",
  "Match type",
  "Impressions",
  "Clicks",
  "Cost",
  "Conversions",
];

const SUGGESTION_OPTIONS: Suggestion[] = [
  "Add as Negative",
  "Add as Exact",
  "Keep / Monitor",
];

export default function Home() {
  const [rows, setRows] = useState<AnalyzedRow[]>([]);
  const [costThreshold, setCostThreshold] = useState<number>(20);
  const [targetCpa, setTargetCpa] = useState<number>(25);
  const [fileError, setFileError] = useState<string | null>(null);
  const [filterSuggestion, setFilterSuggestion] = useState<Suggestion | "All">(
    "All",
  );

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileError(null);

    Papa.parse<RawRow>(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: (results) => {
        if (results.errors && results.errors.length > 0) {
          setFileError("Failed to parse CSV. Please check the file format.");
          return;
        }

        const data = results.data;
        if (!data || data.length === 0) {
          setFileError("CSV appears to be empty.");
          return;
        }

        const headers = results.meta.fields ?? [];
        const missing = REQUIRED_COLUMNS.filter(
          (col) => !headers.includes(col),
        );

        if (missing.length > 0) {
          setFileError(
            `Missing required columns: ${missing.join(
              ", ",
            )}. Please ensure the header names match exactly.`,
          );
          return;
        }

        const parsedRows: AnalyzedRow[] = data.map((row) => {
          const searchTerm = String(row["Search term"] ?? "").trim();
          const matchType = String(row["Match type"] ?? "").trim();
          const impressions = Number(row.Impressions ?? 0) || 0;
          const clicks = Number(row.Clicks ?? 0) || 0;
          const cost = Number(row.Cost ?? 0) || 0;
          const conversions = Number(row.Conversions ?? 0) || 0;

          const cpa =
            conversions > 0 ? parseFloat((cost / conversions).toFixed(2)) : null;

          let suggestion: Suggestion = "Keep / Monitor";
          if (cost > costThreshold && conversions === 0) {
            suggestion = "Add as Negative";
          } else if (
            conversions >= 1 &&
            cpa !== null &&
            cpa <= targetCpa &&
            matchType.toLowerCase() !== "exact"
          ) {
            suggestion = "Add as Exact";
          }

          return {
            searchTerm,
            matchType,
            impressions,
            clicks,
            cost,
            conversions,
            cpa,
            suggestion,
          };
        });

        setRows(parsedRows);
      },
    });
  };

  const filteredRows = useMemo(() => {
    if (filterSuggestion === "All") return rows;
    return rows.filter((row) => row.suggestion === filterSuggestion);
  }, [rows, filterSuggestion]);

  const handleExport = () => {
    if (!rows.length) return;

    const exportRows = rows.filter(
      (row) => row.suggestion === "Add as Negative" || row.suggestion === "Add as Exact",
    );

    if (!exportRows.length) return;

    const csvRows = exportRows.map((row) => {
      if (row.suggestion === "Add as Negative") {
        return {
          Keyword: `"${row.searchTerm}"`,
          "Match Type": "Phrase",
          Suggestion: row.suggestion,
        };
      }
      return {
        Keyword: `[${row.searchTerm}]`,
        "Match Type": "Exact",
        Suggestion: row.suggestion,
      };
    });

    const csv = Papa.unparse(csvRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "search-term-analyzer-export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const suggestionBadgeClasses = (suggestion: Suggestion) => {
    if (suggestion === "Add as Negative") {
      return "bg-red-100 text-red-700 ring-red-200";
    }
    if (suggestion === "Add as Exact") {
      return "bg-emerald-100 text-emerald-700 ring-emerald-200";
    }
    return "bg-slate-100 text-slate-700 ring-slate-200";
  };

  return (
    <div className="min-h-screen bg-slate-950 py-10 text-slate-100">
      <div className="mx-auto max-w-6xl px-4">
        <header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Search Term Analyzer
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Upload a search term report and get rule-based optimization
              suggestions.
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={!rows.length}
            className="inline-flex items-center justify-center rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 shadow-sm ring-1 ring-slate-300 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Export CSV
          </button>
        </header>

        <main className="space-y-6">
          <section className="grid gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm sm:grid-cols-[minmax(0,2fr),minmax(0,1.5fr)] sm:p-5 lg:p-6">
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-200">
                CSV Upload
              </h2>
              <p className="text-xs text-slate-400">
                Required columns (header row): Search term, Match type,
                Impressions, Clicks, Cost, Conversions.
              </p>
              <label className="flex cursor-pointer items-center justify-center rounded-md border border-dashed border-slate-700 bg-slate-900/80 px-4 py-6 text-center text-xs font-medium text-slate-300 hover:border-slate-500 hover:bg-slate-900">
                <div>
                  <p className="mb-1">Drop CSV here or click to browse</p>
                  <p className="text-[11px] text-slate-500">Max ~5MB, .csv</p>
                </div>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              {fileError && (
                <p className="text-xs text-red-400">{fileError}</p>
              )}
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-200">
                Rule Settings
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="flex items-center justify-between text-xs font-medium text-slate-300">
                    <span>Cost Threshold</span>
                    <span className="text-[11px] text-slate-500">Default 20</span>
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-xs text-slate-400">
                      $
                    </span>
                    <input
                      type="number"
                      min={0}
                      className="block w-full rounded-md border border-slate-800 bg-slate-900 px-6 py-1.5 text-xs text-slate-100 shadow-sm outline-none ring-0 placeholder:text-slate-500 focus:border-slate-500"
                      value={costThreshold}
                      onChange={(e) =>
                        setCostThreshold(Number(e.target.value) || 0)
                      }
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="flex items-center justify-between text-xs font-medium text-slate-300">
                    <span>Target CPA</span>
                    <span className="text-[11px] text-slate-500">Default 25</span>
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-xs text-slate-400">
                      $
                    </span>
                    <input
                      type="number"
                      min={0}
                      className="block w-full rounded-md border border-slate-800 bg-slate-900 px-6 py-1.5 text-xs text-slate-100 shadow-sm outline-none focus:border-slate-500"
                      value={targetCpa}
                      onChange={(e) =>
                        setTargetCpa(Number(e.target.value) || 0)
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3 text-[11px] text-slate-400">
                <p className="font-medium text-slate-300">Logic</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  <li>
                    If Cost &gt; Cost Threshold and Conversions = 0 →{" "}
                    <span className="font-semibold text-red-300">
                      Add as Negative
                    </span>
                  </li>
                  <li>
                    If Conversions ≥ 1 and CPA ≤ Target CPA and Match type ≠
                    Exact →{" "}
                    <span className="font-semibold text-emerald-300">
                      Add as Exact
                    </span>
                  </li>
                  <li>
                    Otherwise →{" "}
                    <span className="font-semibold text-slate-200">
                      Keep / Monitor
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm sm:p-5 lg:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-200">
                  Analyzed Terms
                </h2>
                <p className="text-xs text-slate-400">
                  {rows.length
                    ? `${filteredRows.length} of ${rows.length} rows shown`
                    : "Upload a CSV to see results."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs font-medium text-slate-300">
                  Filter by suggestion
                </label>
                <select
                  className="rounded-md border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 shadow-sm focus:border-slate-500"
                  value={filterSuggestion}
                  onChange={(e) =>
                    setFilterSuggestion(
                      e.target.value as Suggestion | "All",
                    )
                  }
                >
                  <option value="All">All</option>
                  {SUGGESTION_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/40">
              <div className="max-h-[460px] overflow-auto">
                <table className="min-w-full divide-y divide-slate-800 text-xs">
                  <thead className="bg-slate-950/80 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-slate-400">
                        Search term
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-slate-400">
                        Match type
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-slate-400">
                        Impr.
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-slate-400">
                        Clicks
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-slate-400">
                        Cost
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-slate-400">
                        Conv.
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-slate-400">
                        CPA
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-slate-400">
                        Suggestion
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-slate-950/40">
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-3 py-6 text-center text-xs text-slate-500"
                        >
                          {rows.length
                            ? "No rows match this filter."
                            : "No data yet. Upload a CSV to begin."}
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row, index) => (
                        <tr key={`${row.searchTerm}-${index}`}>
                          <td className="max-w-[200px] px-3 py-2 text-left text-xs text-slate-100">
                            <span className="line-clamp-2">{row.searchTerm}</span>
                          </td>
                          <td className="px-3 py-2 text-left text-xs text-slate-300">
                            {row.matchType}
                          </td>
                          <td className="px-3 py-2 text-right text-xs tabular-nums text-slate-300">
                            {row.impressions.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right text-xs tabular-nums text-slate-300">
                            {row.clicks.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right text-xs tabular-nums text-slate-100">
                            ${row.cost.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right text-xs tabular-nums text-slate-300">
                            {row.conversions.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right text-xs tabular-nums text-slate-300">
                            {row.cpa !== null ? `$${row.cpa.toFixed(2)}` : "—"}
                          </td>
                          <td className="px-3 py-2 text-left text-xs">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${suggestionBadgeClasses(
                                row.suggestion,
                              )}`}
                            >
                              {row.suggestion}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
