"use client";

import { FileIcon, Loader2Icon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useAuthenticatedArtifactObjectUrl } from "@/core/artifacts/authenticated-url";
import { resolveArtifactURL } from "@/core/artifacts/utils";
import { useI18n } from "@/core/i18n/hooks";
import type { FileInMessage } from "@/core/messages/utils";
import { cn } from "@/lib/utils";

const FILE_TYPE_MAP: Record<string, string> = {
  json: "JSON",
  csv: "CSV",
  txt: "TXT",
  md: "Markdown",
  py: "Python",
  js: "JavaScript",
  ts: "TypeScript",
  tsx: "TSX",
  jsx: "JSX",
  html: "HTML",
  css: "CSS",
  xml: "XML",
  yaml: "YAML",
  yml: "YAML",
  pdf: "PDF",
  png: "PNG",
  jpg: "JPG",
  jpeg: "JPEG",
  gif: "GIF",
  svg: "SVG",
  zip: "ZIP",
  tar: "TAR",
  gz: "GZ",
};

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"];

function getFileExt(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

function getFileTypeLabel(filename: string): string {
  const ext = getFileExt(filename);
  return FILE_TYPE_MAP[ext] ?? (ext.toUpperCase() || "FILE");
}

function isImageFile(filename: string): boolean {
  return IMAGE_EXTENSIONS.includes(getFileExt(filename));
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "—";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/**
 * FilesCard — file chips/cards attached to or produced by a message.
 */
export function FilesCard({
  files,
  threadId,
  className,
}: {
  files: FileInMessage[];
  threadId: string;
  className?: string;
}) {
  if (files.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {files.map((file, index) => (
        <FileCard
          key={`${file.filename}-${index}`}
          file={file}
          threadId={threadId}
        />
      ))}
    </div>
  );
}

function FileCard({
  file,
  threadId,
}: {
  file: FileInMessage;
  threadId: string;
}) {
  const { t } = useI18n();
  const isUploading = file.status === "uploading";
  const isImage = isImageFile(file.filename);
  const fileUrl = file.path ? resolveArtifactURL(file.path, threadId) : null;
  const displayFileUrl = useAuthenticatedArtifactObjectUrl(fileUrl);

  if (isUploading) {
    return (
      <div className="bg-background border-border/40 flex max-w-50 min-w-30 flex-col gap-1 rounded-lg border p-3 opacity-60">
        <div className="flex items-start gap-2">
          <Loader2Icon className="text-muted-foreground mt-0.5 size-4 shrink-0 animate-spin" />
          <span className="text-foreground truncate text-sm font-medium" title={file.filename}>
            {file.filename}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Badge variant="secondary" className="rounded px-1.5 py-0.5 text-[10px] font-normal">
            {getFileTypeLabel(file.filename)}
          </Badge>
          <span className="text-muted-foreground text-[10px]">{t.uploads.uploading}</span>
        </div>
      </div>
    );
  }

  if (!file.path) return null;

  if (isImage) {
    if (!displayFileUrl) return null;
    return (
      <a
        href={displayFileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group border-border/40 relative block overflow-hidden rounded-lg border"
      >
        <img
          src={displayFileUrl}
          alt={file.filename}
          className="h-32 w-auto max-w-60 object-cover transition-transform group-hover:scale-105"
        />
      </a>
    );
  }

  return (
    <div className="flex max-w-52 min-w-32 flex-col gap-1 overflow-hidden rounded-xl border border-border/50 bg-muted/15 p-3 transition-colors hover:bg-muted/25 hover:border-border/70">
      <div className="flex items-start gap-2">
        <FileIcon className="mt-0.5 size-4 shrink-0 text-violet-500" />
        <span className="truncate text-sm font-medium text-foreground" title={file.filename}>
          {file.filename}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <Badge variant="secondary" className="rounded px-1.5 py-0.5 text-[10px] font-normal">
          {getFileTypeLabel(file.filename)}
        </Badge>
        <span className="text-[10px] text-muted-foreground">{formatBytes(file.size)}</span>
      </div>
    </div>
  );
}
