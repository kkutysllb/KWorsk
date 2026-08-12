"use client";

import { AlertCircleIcon, LoaderIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** PPTX viewer is heavy (~10 MB) — lazy-load to avoid bloating main bundle. */
const PowerPointViewer = dynamic(
  () => import("pptx-react-viewer").then((m) => m.PowerPointViewer),
  {
    ssr: false,
    loading: () => <LoadingState />,
  },
);

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
/* XLSX (SheetJS)                                                             */
/* -------------------------------------------------------------------------- */

function XlsxRenderer({ data }: { data: ArrayBuffer }) {
  const [sheets, setSheets] = useState<{ name: string; html: string }[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    // Lazy-load SheetJS to keep initial bundle small
    import("xlsx")
      .then((XLSX) => {
        if (cancelled) return;
        try {
          const wb = XLSX.read(data, { type: "array" });
          const rendered = wb.SheetNames.map((name) => {
            const sheet = wb.Sheets[name];
            return {
              name,
              html: sheet
                ? XLSX.utils.sheet_to_html(sheet, { editable: false })
                : "<p>Empty sheet</p>",
            };
          });
          if (!cancelled) {
            setSheets(rendered);
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

  return (
    <div className="flex size-full flex-col">
      {sheets.length > 1 && (
        <div className="border-b px-3 py-2">
          <Select
            value={String(activeSheet)}
            onValueChange={(v) => setActiveSheet(Number(v))}
          >
            <SelectTrigger className="h-8 w-48 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sheets.map((s, i) => (
                <SelectItem key={s.name} value={String(i)}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div
        className="xlsx-preview flex-1 overflow-auto p-4"
        dangerouslySetInnerHTML={{ __html: sheets[activeSheet]?.html ?? "" }}
      />
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
/* PPTX (pptx-react-viewer)                                                   */
/* -------------------------------------------------------------------------- */

function PptxRenderer({ data }: { data: ArrayBuffer }) {
  const uint8 = useMemo(() => new Uint8Array(data), [data]);
  return (
    <div className="size-full overflow-auto">
      <PowerPointViewer content={uint8} canEdit={false} />
    </div>
  );
}
