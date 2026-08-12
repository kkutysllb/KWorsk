"use client";

import { ArrowLeftIcon, DownloadIcon } from "lucide-react";
import { useCallback } from "react";

import { Button } from "@/components/ui/button";
import {
  downloadArtifactUrl,
} from "@/core/artifacts/authenticated-url";
import { urlOfArtifact } from "@/core/artifacts/utils";
import { useI18n } from "@/core/i18n/hooks";
import { getFileName } from "@/core/utils/files";
import { cn } from "@/lib/utils";

import { ArtifactFileDetail } from "./artifact-file-detail";
import { useArtifacts } from "./context";

/**
 * ArtifactPreviewOverlay — full-screen modal-style preview for a
 * selected chat artifact.
 *
 * Replaces the old right-side "split" preview with a dedicated page-level
 * surface: the artifact renders centred on a muted backdrop, with a
 * fixed top-right toolbar containing **下载** (direct download of the
 * selected file) and **返回任务** (close overlay, return to chat). Works
 * for every supported artifact type today (markdown / html report / code
 * file / skill package) and any HTML report the agent produces tomorrow.
 */
export function ArtifactPreviewOverlay({
  threadId,
  className,
}: {
  threadId: string;
  className?: string;
}) {
  const { t } = useI18n();
  const { open, selectedArtifact, setOpen } = useArtifacts();

  const handleDownload = useCallback(() => {
    if (!selectedArtifact) return;
    void downloadArtifactUrl(
      urlOfArtifact({ filepath: selectedArtifact, threadId, download: true }),
      getFileName(selectedArtifact),
    );
  }, [selectedArtifact, threadId]);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  if (!open || !selectedArtifact) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Artifact preview"
      className={cn(
        "fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm",
        className,
      )}
    >
      {/* Top-right toolbar: 下载 + 返回任务 */}
      <div className="pointer-events-none absolute top-3 right-4 z-10 flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="pointer-events-auto gap-1.5 bg-background/80 backdrop-blur"
          onClick={handleDownload}
          aria-label={t.common.download}
        >
          <DownloadIcon className="size-4" />
          <span>{t.common.download}</span>
        </Button>
        <Button
          size="sm"
          className="pointer-events-auto gap-1.5"
          onClick={handleClose}
          aria-label="返回任务"
        >
          <ArrowLeftIcon className="size-4" />
          <span>返回任务</span>
        </Button>
      </div>

      <ArtifactFileDetail
        className="size-full"
        headerClassName="pl-[78px]"
        filepath={selectedArtifact}
        threadId={threadId}
      />
    </div>
  );
}