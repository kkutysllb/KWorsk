"use client";

import { FileOutputIcon, SparklesIcon } from "lucide-react";

import { ArtifactFileList } from "@/components/workspace/artifacts/artifact-file-list";
import { useI18n } from "@/core/i18n/hooks";
import { useUploadedFiles } from "@/core/uploads/hooks";
import { useActiveThreadMessages } from "@/hooks/use-active-thread";
import { useThreadResources } from "@/hooks/use-thread-artifacts";

import { PanelEmpty, PanelSection } from "../panel-section";

export function ResourcesSection({ threadId }: { threadId: string }) {
  const { t } = useI18n();
  const { messages } = useActiveThreadMessages();
  const { skills, artifacts } = useThreadResources(messages);
  const uploads = useUploadedFiles(threadId);
  const uploadFiles = uploads.data?.files ?? [];

  return (
    <>
      <PanelSection
        id="resources"
        icon={SparklesIcon}
        title={t.rightPanel.skills}
        count={skills.length}
      >
        {skills.length === 0 ? (
          <PanelEmpty text={t.rightPanel.empty} />
        ) : (
          <ul className="flex flex-wrap gap-1">
            {skills.map((s) => (
              <li
                key={s}
                className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
              >
                {s}
              </li>
            ))}
          </ul>
        )}
      </PanelSection>

      <PanelSection
        id="resources"
        icon={SparklesIcon}
        title={t.rightPanel.uploads}
        count={uploadFiles.length}
      >
        {uploadFiles.length === 0 ? (
          <PanelEmpty text={t.rightPanel.empty} />
        ) : (
          <ul className="space-y-1">
            {uploadFiles.map((f) => (
              <li
                key={f.filename}
                className="truncate text-xs text-muted-foreground"
              >
                {f.filename}
              </li>
            ))}
          </ul>
        )}
      </PanelSection>

      <PanelSection
        id="artifacts"
        icon={FileOutputIcon}
        title={t.rightPanel.artifacts}
        count={artifacts.length}
      >
        {artifacts.length === 0 ? (
          <PanelEmpty text={t.rightPanel.empty} />
        ) : (
          <ArtifactFileList files={artifacts} threadId={threadId} />
        )}
      </PanelSection>
    </>
  );
}
