"use client";

import {
  BotIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
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
import {
  createAgent,
  deleteAgent,
  getAgent,
  listAgents,
  updateAgent,
} from "@/core/agents/api";
import type { Agent, UpdateAgentRequest } from "@/core/agents/types";

import { useConfigSection } from "./config/use-config-section";
import { SettingsSection } from "./settings-section";

interface AgentsApiConfig {
  enabled: boolean;
}

export function AgentsSettingsPage() {
  const { data, loading, saving, save } = useConfigSection<AgentsApiConfig>(
    "agents_api",
    { enabled: false },
  );
  const [enabled, setEnabled] = useState(data.enabled);

  useEffect(() => {
    setEnabled(data.enabled);
  }, [data.enabled]);

  const dirty = enabled !== data.enabled;

  const handleSave = async () => {
    try {
      await save({ enabled });
      toast.success("代理 API 设置已更新");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    }
  };

  return (
    <SettingsSection
      title="代理"
      description="管理自定义代理，启用/禁用代理管理 API。"
      icon={<BotIcon className="h-5 w-5 text-primary" />}
    >
      <div className="space-y-6">
        {/* Agent API 开关 */}
        <section className="space-y-2">
          <h3 className="text-muted-foreground px-1 text-xs font-medium tracking-wide uppercase">
            API
          </h3>
          <div className="divide-y overflow-hidden rounded-xl border">
            {loading ? (
              <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" />
                加载中…
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      启用代理管理 API
                    </div>
                    <div className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                      开启后允许通过 HTTP 创建、编辑和删除自定义代理
                    </div>
                  </div>
                  <div className="shrink-0">
                    <Switch
                      checked={enabled}
                      onCheckedChange={setEnabled}
                      disabled={saving}
                    />
                  </div>
                </div>
                <div className="flex gap-2 px-4 py-3">
                  <Button
                    size="sm"
                    disabled={!dirty || saving}
                    onClick={handleSave}
                  >
                    {saving ? "保存中…" : "保存"}
                  </Button>
                  {dirty && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEnabled(data.enabled)}
                      disabled={saving}
                    >
                      重置
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </section>

        {/* Agent 列表 */}
        <AgentsList />
      </div>
    </SettingsSection>
  );
}

/* ── Agent list ───────────────────────────────────────── */

function AgentsList() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

  const loadAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listAgents();
      setAgents(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载代理列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAgents();
  }, [loadAgents]);

  const handleDelete = async (name: string) => {
    setDeleting(name);
    try {
      await deleteAgent(name);
      setAgents((prev) => prev.filter((a) => a.name !== name));
      toast.success(`已删除代理「${name}」`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "删除失败");
    } finally {
      setDeleting(null);
    }
  };

  const handleNew = () => {
    setEditingAgent(null);
    setDialogOpen(true);
  };

  const handleEdit = async (name: string) => {
    try {
      const agent = await getAgent(name);
      setEditingAgent(agent);
      setDialogOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "加载代理详情失败");
    }
  };

  const handleDialogSuccess = () => {
    void loadAgents();
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          自定义代理
        </h3>
        <Button size="sm" variant="outline" onClick={handleNew}>
          <PlusIcon className="size-3.5" />
          新建
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 rounded-xl border px-4 py-6 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          加载中…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 px-4 py-4 text-sm text-red-500">
          {error}
        </div>
      ) : agents.length === 0 ? (
        <div className="rounded-xl border px-4 py-8 text-center text-sm text-muted-foreground">
          暂无自定义代理，点击「新建」创建第一个代理
        </div>
      ) : (
        <div className="space-y-2">
          {agents.map((agent) => (
            <div
              key={agent.name}
              className="rounded-xl border p-4 transition-colors hover:bg-muted/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <BotIcon className="text-muted-foreground size-4 shrink-0" />
                    <span className="text-sm font-medium">{agent.name}</span>
                  </div>
                  {agent.description && (
                    <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-relaxed">
                      {agent.description}
                    </p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {agent.model && (
                      <span>
                        <span className="text-muted-foreground/70">模型:</span>{" "}
                        {agent.model}
                      </span>
                    )}
                    {agent.skills && agent.skills.length > 0 && (
                      <span>
                        <span className="text-muted-foreground/70">技能:</span>{" "}
                        {agent.skills.length}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEdit(agent.name)}
                    className="h-8 px-2"
                  >
                    <PencilIcon className="size-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(agent.name)}
                    disabled={deleting === agent.name}
                    className="text-destructive hover:text-destructive h-8 px-2"
                  >
                    {deleting === agent.name ? (
                      <Loader2Icon className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2Icon className="size-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AgentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        agent={editingAgent}
        onSuccess={handleDialogSuccess}
      />
    </section>
  );
}

/* ── Agent create/edit dialog ─────────────────────────── */

interface AgentFormData {
  name: string;
  description: string;
  model: string;
  skills: string;
  soul: string;
}

const EMPTY_FORM: AgentFormData = {
  name: "",
  description: "",
  model: "",
  skills: "",
  soul: "",
};

function AgentDialog({
  open,
  onOpenChange,
  agent,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: Agent | null;
  onSuccess: () => void;
}) {
  const isEdit = agent !== null;
  const [form, setForm] = useState<AgentFormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (agent) {
        setForm({
          name: agent.name,
          description: agent.description ?? "",
          model: agent.model ?? "",
          skills: agent.skills?.join(", ") ?? "",
          soul: agent.soul ?? "",
        });
      } else {
        setForm(EMPTY_FORM);
      }
    }
  }, [open, agent]);

  const update = (key: keyof AgentFormData, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("请填写代理名称");
      return;
    }

    const skills = form.skills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    setSubmitting(true);
    try {
      if (isEdit) {
        const req: UpdateAgentRequest = {
          description: form.description.trim() || null,
          model: form.model.trim() || null,
          skills: skills.length > 0 ? skills : null,
          soul: form.soul.trim() || null,
        };
        await updateAgent(agent!.name, req);
        toast.success(`已更新代理「${agent!.name}」`);
      } else {
        await createAgent({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          model: form.model.trim() || null,
          skills: skills.length > 0 ? skills : null,
          soul: form.soul.trim() || undefined,
        });
        toast.success(`已创建代理「${form.name.trim()}」`);
      }
      onOpenChange(false);
      onSuccess();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `编辑代理「${agent?.name}」` : "新建代理"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="agent-name" className="text-sm font-medium">名称</label>
            <Input
              id="agent-name"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              disabled={isEdit || submitting}
              placeholder="如：financial-analyst"
              className="h-9"
            />
            {isEdit && (
              <p className="text-xs text-muted-foreground">名称创建后不可修改</p>
            )}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="agent-desc" className="text-sm font-medium">描述</label>
            <Input
              id="agent-desc"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              disabled={submitting}
              placeholder="该代理的用途说明"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="agent-model" className="text-sm font-medium">模型</label>
            <Input
              id="agent-model"
              value={form.model}
              onChange={(e) => update("model", e.target.value)}
              disabled={submitting}
              placeholder="留空继承默认模型"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="agent-skills" className="text-sm font-medium">技能</label>
            <Input
              id="agent-skills"
              value={form.skills}
              onChange={(e) => update("skills", e.target.value)}
              disabled={submitting}
              placeholder="逗号分隔，如：a-stock-screener, fund-flow"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="agent-soul" className="text-sm font-medium">系统提示词 (Soul)</label>
            <Textarea
              id="agent-soul"
              value={form.soul}
              onChange={(e) => update("soul", e.target.value)}
              disabled={submitting}
              placeholder="定义该代理的行为和角色…"
              className="min-h-24 resize-y"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              取消
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? "保存中…"
                : isEdit
                  ? "保存"
                  : "创建"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
