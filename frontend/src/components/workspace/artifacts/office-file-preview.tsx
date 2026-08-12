"use client";

import { AlertCircleIcon, LoaderIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type OfficeFormat = "xlsx" | "docx" | "pptx";

export function getOfficeFormat(filepath: string): OfficeFormat | null {
  const ext = filepath.split(".").pop()?.toLowerCase();
  if (ext === "xlsx" || ext === "xls") return "xlsx";
  if (ext === "docx") return "docx";
  if (ext === "pptx") return "pptx";
  return null;
}

export function isOfficeFile(filepath: string): boolean {
  return getOfficeFormat(filepath) !== null;
}

/* -------------------------------------------------------------------------- */

export function OfficeFilePreview({
  url,
  filepath,
}: {
  url: string | undefined;
  filepath: string;
}) {
  const format = getOfficeFormat(filepath);
  const [data, setData] = useState<ArrayBuffer>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    setData(undefined);
    setError(undefined);
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.arrayBuffer();
      })
      .then((buf) => {
        if (!cancelled) setData(buf);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load office file");
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState />;

  switch (format) {
    case "xlsx":
      return <XlsxRenderer data={data} />;
    case "docx":
      return <DocxRenderer data={data} />;
    case "pptx":
      return <PptxRenderer data={data} />;
    default:
      return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Loading / Error                                                            */
/* -------------------------------------------------------------------------- */

function LoadingState() {
  return (
    <div className="flex size-full items-center justify-center">
      <LoaderIcon className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-2 p-8 text-center">
      <AlertCircleIcon className="size-8 text-destructive" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* XLSX (SheetJS) — pure React table, no innerHTML                         */
/* -------------------------------------------------------------------------- */

interface SheetData {
  name: string;
  rows: (string | number | boolean | null)[][];
}

function XlsxRenderer({ data }: { data: ArrayBuffer }) {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    import("xlsx")
      .then((XLSX) => {
        if (cancelled) return;
        try {
          const wb = XLSX.read(data, { type: "array" });
          const parsed: SheetData[] = wb.SheetNames.filter(
            (n): n is string => typeof n === "string",
          ).map((name) => {
            const sheet = wb.Sheets[name];
            const json = sheet
              ? (XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(
                  sheet,
                  { header: 1, blankrows: false, defval: null },
                ) as (string | number | boolean | null)[][])
              : [];
            return { name, rows: json };
          });
          if (!cancelled) {
            setSheets(parsed);
            setActiveSheet(0);
          }
        } catch {
          if (!cancelled) setError("Failed to parse spreadsheet");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load spreadsheet library");
      });
    return () => {
      cancelled = true;
    };
  }, [data]);

  if (error) return <ErrorState message={error} />;
  if (sheets.length === 0) return <LoadingState />;

  const sheet = sheets[activeSheet] ?? sheets[0];
  if (!sheet) return <LoadingState />;

  return (
    <div className="flex size-full flex-col overflow-hidden">
      {sheets.length > 1 && (
        <div className="flex shrink-0 items-center gap-1 border-b bg-background px-3 py-1.5">
          {sheets.map((s, i) => (
            <button
              key={s.name}
              type="button"
              onClick={() => setActiveSheet(i)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                i === activeSheet
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      <div className="xlsx-preview min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-xs">
          <tbody>
            {sheet.rows.map((row, ri) => (
              <tr key={ri} className={ri === 0 ? "sticky top-0" : ""}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className="border border-border px-2 py-1 whitespace-nowrap"
                    style={
                      ri === 0
                        ? {
                            fontWeight: 600,
                            backgroundColor: "var(--muted)",
                          }
                        : undefined
                    }
                  >
                    {cell === null || cell === undefined ? "" : String(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* DOCX (docx-preview)                                                        */
/* -------------------------------------------------------------------------- */

function DocxRenderer({ data }: { data: ArrayBuffer }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    setLoading(true);
    setError(undefined);

    import("docx-preview")
      .then(({ renderAsync }) => {
        if (cancelled || !containerRef.current) return;
        // Clear previous content
        containerRef.current.innerHTML = "";
        return renderAsync(
          new Blob([data]),
          containerRef.current,
          undefined,
          {
            inWrapper: true,
            breakPages: true,
            ignoreLastRenderedPageBreak: true,
            experimental: true,
            className: "docx-preview",
          },
        );
      })
      .then(() => {
        if (!cancelled) setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Failed to render document");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [data]);

  if (error) return <ErrorState message={error} />;
  return (
    <div className="docx-preview-container flex-1 overflow-auto">
      {loading && <LoadingState />}
      <div ref={containerRef} className="docx-preview-wrapper" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* PPTX (pptx-vanilla-viewer)                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Minimal type for the viewer instance — we only call destroy().
 * The full type lives in the package's .d.ts; importing it here would pull
 * the entire 12k-line declaration into the build graph.
 */
type PptxViewerHandle = { destroy: () => void };

function PptxRenderer({ data }: { data: ArrayBuffer }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<PptxViewerHandle | null>(null);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    setLoading(true);
    setError(undefined);

    import("pptx-vanilla-viewer")
      .then(({ createPptxViewer }) => {
        if (cancelled || !containerRef.current) return;
        viewerRef.current?.destroy();
        const viewer = createPptxViewer(containerRef.current, {
          source: data,
          onLoad: () => {
            if (!cancelled) setLoading(false);
          },
          onError: (msg: string) => {
            if (!cancelled) {
              setError(msg || "Failed to load presentation");
              setLoading(false);
            }
          },
        }) as PptxViewerHandle;
        viewerRef.current = viewer;
      })
      .catch(() => {
        if (!cancelled) {
          setError("Failed to load presentation library");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
  }, [data]);

  if (error) return <ErrorState message={error} />;
  return (
    <div className="size-full overflow-auto">
      {loading && <LoadingState />}
      <div ref={containerRef} className="size-full" />
    </div>
  );
}
