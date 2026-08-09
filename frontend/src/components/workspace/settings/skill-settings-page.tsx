"use client";

import {
  FileTextIcon,
  HelpCircleIcon,
  InfoIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/core/i18n/hooks";
import { getCustomSkill, updateCustomSkill } from "@/core/skills/api";
import {
  useCreateSkill,
  useDeleteCustomSkill,
  useEnableSkill,
  useSkills,
} from "@/core/skills/hooks";
import type { CustomSkillContent, Skill } from "@/core/skills/type";
import { env } from "@/env";

import { SettingsSection } from "./settings-section";

/* ── Category metadata ────────────────────────────────── */

const CATEGORY_LABELS: Record<string, string> = {
  public: "内置技能",
  custom: "自定义",
  integrations: "集成",
  legacy: "遗留",
};

const CATEGORY_ORDER = ["public", "custom", "integrations", "legacy"];

/* ── Page ─────────────────────────────────────────────── */

export function SkillSettingsPage() {
  const { t } = useI18n();
  const { skills, isLoading, error } = useSkills();
  const { mutate: enableSkill } = useEnableSkill();
  const isStatic = env.NEXT_PUBLIC_STATIC_WEBSITE_ONLY === "true";

  const [createOpen, setCreateOpen] = useState(false);
  const [editSkill, setEditSkill] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { mutate: deleteSkill } = useDeleteCustomSkill();

  const handleDelete = (skill: Skill) => {
    if (!confirm(`确定删除技能「${skill.name}」？此操作不可撤销。`)) return;
    setDeleting(skill.name);
    deleteSkill(skill.name, {
      onSuccess: () => toast.success(`已删除技能「${skill.name}」`),
      onError: (e) => toast.error(e instanceof Error ? e.message : "删除失败"),
      onSettled: () => setDeleting(null),
    });
  };

  // Group skills by category for sectioned display.
  const grouped = skills.reduce<Record<string, Skill[]>>((acc, skill) => {
    (acc[skill.category] ??= []).push(skill);
    return acc;
  }, {});

  return (
    <SettingsSection
      title={t.settings.skills.title}
      description={t.settings.skills.description}
      icon={<SparklesIcon className="h-5 w-5 text-violet-500" />}
    >
      <div className="flex w-full flex-col gap-4">
        {/* Agent recognition pipeline explanation */}
        <SkillPipelineHelp />

        <header className="flex justify-end">
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <PlusIcon className="size-4" />
            {t.settings.skills.createSkill}
          </Button>
        </header>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            {t.common.loading}
          </div>
        ) : error ? (
          <div className="text-sm text-red-500">Error: {error.message}</div>
        ) : skills.length === 0 ? (
          <EmptySkill onCreate={() => setCreateOpen(true)} />
        ) : (
          <div className="space-y-4">
            {CATEGORY_ORDER.filter((cat) => grouped[cat]?.length).map((cat) => (
              <SkillCategoryGroup
                key={cat}
                category={cat}
                skills={grouped[cat] ?? []}
                isStatic={isStatic}
                onToggle={(skill, enabled) =>
                  enableSkill({ skillName: skill.name, enabled })
                }
                onEdit={(skill) => setEditSkill(skill.name)}
                onDelete={handleDelete}
                deleting={deleting}
              />
            ))}
          </div>
        )}

        <CreateSkillDialog open={createOpen} onOpenChange={setCreateOpen} />
        {editSkill && (
          <EditSkillDialog
            skillName={editSkill}
            onClose={() => setEditSkill(null)}
          />
        )}
      </div>
    </SettingsSection>
  );
}

/* ── Category group ───────────────────────────────────── */

function SkillCategoryGroup({
  category,
  skills,
  isStatic,
  onToggle,
  onEdit,
  onDelete,
  deleting,
}: {
  category: string;
  skills: Skill[];
  isStatic: boolean;
  onToggle: (skill: Skill, enabled: boolean) => void;
  onEdit: (skill: Skill) => void;
  onDelete: (skill: Skill) => void;
  deleting: string | null;
}) {
  const label = CATEGORY_LABELS[category] ?? category;
  const enabledCount = skills.filter((s) => s.enabled).length;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <h4 className="text-sm font-semibold">{label}</h4>
        <span className="text-xs text-muted-foreground">
          {enabledCount}/{skills.length} 启用
        </span>
      </div>
      {skills.map((skill) => (
        <SkillCard
          key={skill.name}
          skill={skill}
          isStatic={isStatic}
          onToggle={(enabled) => onToggle(skill, enabled)}
          onEdit={() => onEdit(skill)}
          onDelete={() => onDelete(skill)}
          isDeleting={deleting === skill.name}
        />
      ))}
    </div>
  );
}

/* ── Skill card ───────────────────────────────────────── */

function SkillCard({
  skill,
  isStatic,
  onToggle,
  onEdit,
  onDelete,
  isDeleting,
}: {
  skill: Skill;
  isStatic: boolean;
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  return (
    <div className="rounded-xl border p-4 transition-colors hover:bg-muted/30">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <FileTextIcon className="text-muted-foreground size-4 shrink-0" />
            <span className="text-sm font-medium">{skill.name}</span>
            {skill.license && (
              <span className="rounded border px-1 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                {skill.license}
              </span>
            )}
          </div>
          {skill.description && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {skill.description}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Switch
            checked={skill.enabled}
            disabled={isStatic}
            onCheckedChange={onToggle}
          />
          {skill.editable && (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={onEdit}
              >
                <PencilIcon className="size-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive h-8 w-8 p-0"
                onClick={onDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2Icon className="size-3.5 animate-spin" />
                ) : (
                  <Trash2Icon className="size-3.5" />
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Pipeline help section ────────────────────────────── */

/**
 * Explains how the agent discovers and invokes skills, so users understand
 * the lifecycle: register → prompt injection → slash/explicit activation →
 * execution.
 */
function SkillPipelineHelp() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/30">
      <button
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <HelpCircleIcon className="size-4 text-blue-500" />
        <span className="text-sm font-medium">
          技能如何被 Agent 识别和调用？
        </span>
      </button>
      {expanded && (
        <div className="space-y-3 px-4 pb-3 text-xs leading-relaxed text-muted-foreground">
          <div className="flex gap-2">
            <InfoIcon className="mt-0.5 size-3.5 shrink-0 text-blue-500" />
            <div>
              <p className="font-medium text-foreground">1. 系统提示注入</p>
              <p>
                每次对话开始时，已启用的技能列表（名称 + 描述）会被注入到
                Agent 的系统提示词 &lt;skill_system&gt; XML 块中。Agent
                通过描述了解每个技能的用途，并在遇到匹配的任务时主动加载。
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <InfoIcon className="mt-0.5 size-3.5 shrink-0 text-blue-500" />
            <div>
              <p className="font-medium text-foreground">2. 两种调用方式</p>
              <p>
                <strong>斜杠命令</strong>
                ：用户输入 <code className="rounded bg-muted px-1">/技能名</code>
                ，中间件自动注入完整 SKILL.md 内容，立即激活。
                <br />
                <strong>隐式识别</strong>
                ：Agent 根据任务意图匹配技能描述，通过 read_file
                读取技能内容并按指引执行。
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <InfoIcon className="mt-0.5 size-3.5 shrink-0 text-blue-500" />
            <div>
              <p className="font-medium text-foreground">3. 技能自演化</p>
              <p>
                完成任务后，Agent 可通过 skill_manage 工具自动创建、修改或删除技能
                — 例如遇到非显而易见的错误或重复工作流时，将其沉淀为可复用技能。
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <InfoIcon className="mt-0.5 size-3.5 shrink-0 text-blue-500" />
            <div>
              <p className="font-medium text-foreground">4. 缓存失效</p>
              <p>
                技能的增删改会自动清除系统提示缓存，确保下一次对话立即生效。
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Create skill dialog ──────────────────────────────── */

function CreateSkillDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const { mutate: createMutate, isPending } = useCreateSkill();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setContent("");
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !content.trim()) {
      toast.error("请填写技能名称和 SKILL.md 内容");
      return;
    }
    createMutate(
      { name: name.trim(), description: description.trim(), content },
      {
        onSuccess: () => {
          toast.success(`已创建技能「${name.trim()}」`);
          onOpenChange(false);
        },
        onError: (e) =>
          toast.error(e instanceof Error ? e.message : "创建失败"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t.settings.skills.createSkill}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="skill-name" className="text-sm font-medium">
              名称
            </label>
            <Input
              id="skill-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending}
              placeholder="如：my-custom-skill"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="skill-desc" className="text-sm font-medium">
              描述
            </label>
            <Input
              id="skill-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isPending}
              placeholder="该技能的用途说明"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="skill-content" className="text-sm font-medium">
              SKILL.md 内容
            </label>
            <Textarea
              id="skill-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isPending}
              className="min-h-48 font-mono text-xs"
              spellCheck={false}
              placeholder={`---\nname: ${name || "skill-name"}\ndescription: ${description || "技能描述"}\n---\n\n技能内容…`}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              取消
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "创建中…" : "创建"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── Edit skill dialog ────────────────────────────────── */

function EditSkillDialog({
  skillName,
  onClose,
}: {
  skillName: string;
  onClose: () => void;
}) {
  const [skill, setSkill] = useState<CustomSkillContent | null>(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCustomSkill(skillName);
      setSkill(data);
      setContent(data.content);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "加载技能失败");
      onClose();
    } finally {
      setLoading(false);
    }
  }, [skillName, onClose]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = skill !== null && content !== skill.content;

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateCustomSkill(skillName, content);
      setSkill(updated);
      setContent(updated.content);
      toast.success(`已更新技能「${skillName}」`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            编辑技能{skill ? `「${skill.name}」` : "…"}
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            加载中…
          </div>
        ) : (
          <>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={saving}
              className="min-h-64 font-mono text-xs"
              spellCheck={false}
            />
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={saving}>
                取消
              </Button>
              <Button onClick={handleSave} disabled={!dirty || saving}>
                {saving ? "保存中…" : "保存"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── Empty state ──────────────────────────────────────── */

function EmptySkill({ onCreate }: { onCreate: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border py-12">
      <SparklesIcon className="text-muted-foreground size-8" />
      <p className="text-sm font-medium">{t.settings.skills.emptyTitle}</p>
      <p className="text-muted-foreground text-xs">
        {t.settings.skills.emptyDescription}
      </p>
      <Button size="sm" variant="outline" onClick={onCreate}>
        <PlusIcon className="size-4" />
        {t.settings.skills.emptyButton}
      </Button>
    </div>
  );
}
