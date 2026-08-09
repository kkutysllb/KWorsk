"use client";

import { Loader2Icon, UsersIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { useConfigSection } from "./config/use-config-section";
import { SettingsSection } from "./settings-section";

/* ── types ────────────────────────────────────────────── */

interface TokenBudget {
  enabled: boolean;
  max_tokens: number;
  warn_threshold: number;
  hard_stop_threshold?: number;
  max_input_tokens?: number | null;
  max_output_tokens?: number | null;
  per_agent?: Record<string, unknown>;
}

interface CustomAgentEntry {
  description: string;
  system_prompt: string;
  tools?: string[] | null;
  disallowed_tools?: string[] | null;
  skills?: string[] | null;
  model?: string;
  max_turns?: number;
  timeout_seconds?: number;
}

interface SubagentsConfig {
  timeout_seconds: number;
  max_turns: number | null;
  max_total_per_run: number;
  token_budget?: TokenBudget;
  agents?: Record<string, unknown>;
  custom_agents?: Record<string, CustomAgentEntry>;
}

interface WorkerSpec {
  name: string;
  description: string;
  system_prompt?: string | null;
  tools?: string[] | null;
  disallowed_tools?: string[] | null;
  skills?: string[] | null;
  model?: string;
  max_turns?: number;
  timeout_seconds?: number;
  role?: string;
}

interface OrchestrationConfig {
  mode: "single" | "multi";
  max_concurrency: number;
  workers?: WorkerSpec[];
}

/* ── helpers ──────────────────────────────────────────── */

function pickNum(
  raw: string,
  fallback: number,
  opts?: { min?: number; max?: number },
): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  if (opts?.min !== undefined && n < opts.min) return opts.min;
  if (opts?.max !== undefined && n > opts.max) return opts.max;
  return Math.trunc(n);
}

const labelCls = "text-sm font-medium leading-none";
const descCls = "mt-0.5 text-xs text-muted-foreground leading-relaxed";

/* ── main component ───────────────────────────────────── */

export function SubagentsSettingsPage() {
  return (
    <SettingsSection
      title="子代理与编排"
      description="配置子代理全局参数与多 Agent 编排模式。"
      icon={<UsersIcon className="h-5 w-5 text-primary" />}
    >
      <div className="space-y-6">
        <SubagentsForm />
        <OrchestrationForm />
      </div>
    </SettingsSection>
  );
}

/* ── subagents global form ────────────────────────────── */

function SubagentsForm() {
  const { data, loading, saving, save } = useConfigSection<SubagentsConfig>(
    "subagents",
    {
      timeout_seconds: 1800,
      max_turns: null,
      max_total_per_run: 6,
    },
  );
  const [timeoutSeconds, setTimeoutSeconds] = useState("");
  const [maxTurns, setMaxTurns] = useState("");
  const [maxTotalPerRun, setMaxTotalPerRun] = useState("");
  const [tbEnabled, setTbEnabled] = useState(false);
  const [tbMaxTokens, setTbMaxTokens] = useState("");
  const [tbWarnThreshold, setTbWarnThreshold] = useState("");
  const [customAgentsJson, setCustomAgentsJson] = useState("");
  const [customAgentsDirty, setCustomAgentsDirty] = useState(false);

  useEffect(() => {
    setTimeoutSeconds(String(data.timeout_seconds ?? 1800));
    setMaxTurns(data.max_turns != null ? String(data.max_turns) : "");
    setMaxTotalPerRun(String(data.max_total_per_run ?? 6));
    setTbEnabled(data.token_budget?.enabled ?? false);
    setTbMaxTokens(String(data.token_budget?.max_tokens ?? 2000000));
    setTbWarnThreshold(String(data.token_budget?.warn_threshold ?? 0.7));
    setCustomAgentsJson(
      JSON.stringify(data.custom_agents ?? {}, null, 2),
    );
    setCustomAgentsDirty(false);
  }, [data]);

  const dirty =
    Number(timeoutSeconds) !== (data.timeout_seconds ?? 1800) ||
    Number(maxTurns || "0") !== (data.max_turns ?? 0) ||
    Number(maxTotalPerRun) !== (data.max_total_per_run ?? 6) ||
    tbEnabled !== (data.token_budget?.enabled ?? false) ||
    Number(tbMaxTokens) !== (data.token_budget?.max_tokens ?? 2000000) ||
    Number(tbWarnThreshold) !==
      (data.token_budget?.warn_threshold ?? 0.7) ||
    customAgentsDirty;

  const handleSave = async () => {
    let parsedCustomAgents: Record<string, CustomAgentEntry> | undefined;
    if (customAgentsDirty) {
      try {
        const trimmed = customAgentsJson.trim();
        if (!trimmed || trimmed === "{}") {
          parsedCustomAgents = {};
        } else {
          const parsed = JSON.parse(trimmed);
          if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
            throw new Error("custom_agents 必须是 JSON 对象");
          }
          parsedCustomAgents = parsed as Record<string, CustomAgentEntry>;
        }
      } catch (e) {
        toast.error(
          `custom_agents JSON 解析失败：${e instanceof Error ? e.message : String(e)}`,
        );
        return;
      }
    }

    try {
      const prevTb = data.token_budget ??
        ({} as NonNullable<SubagentsConfig["token_budget"]>);
      const token_budget = {
        enabled: tbEnabled,
        max_tokens: pickNum(tbMaxTokens, 2000000, { min: 1000 }),
        warn_threshold: pickNum(tbWarnThreshold, 0.7, { min: 0, max: 1 }),
        ...(prevTb.hard_stop_threshold != null
          ? { hard_stop_threshold: prevTb.hard_stop_threshold }
          : {}),
        ...(prevTb.max_input_tokens != null
          ? { max_input_tokens: prevTb.max_input_tokens }
          : {}),
        ...(prevTb.max_output_tokens != null
          ? { max_output_tokens: prevTb.max_output_tokens }
          : {}),
        ...(prevTb.per_agent ? { per_agent: prevTb.per_agent } : {}),
      };
      const payload: SubagentsConfig = {
        timeout_seconds: pickNum(timeoutSeconds, 1800, { min: 1 }),
        max_turns: maxTurns.trim() ? pickNum(maxTurns, 1, { min: 1 }) : null,
        max_total_per_run: pickNum(maxTotalPerRun, 6, { min: 1, max: 50 }),
        token_budget,
        ...(data.agents ? { agents: data.agents } : {}),
        custom_agents: parsedCustomAgents ?? data.custom_agents ?? {},
      };
      await save(payload);
      toast.success("子代理参数已更新");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    }
  };

  const resetAll = () => {
    setTimeoutSeconds(String(data.timeout_seconds ?? 1800));
    setMaxTurns(data.max_turns != null ? String(data.max_turns) : "");
    setMaxTotalPerRun(String(data.max_total_per_run ?? 6));
    setTbEnabled(data.token_budget?.enabled ?? false);
    setTbMaxTokens(String(data.token_budget?.max_tokens ?? 2000000));
    setTbWarnThreshold(String(data.token_budget?.warn_threshold ?? 0.7));
    setCustomAgentsJson(JSON.stringify(data.custom_agents ?? {}, null, 2));
    setCustomAgentsDirty(false);
  };

  return (
    <section className="space-y-2">
      <h3 className="text-muted-foreground px-1 text-xs font-medium tracking-wide uppercase">
        子代理全局参数
      </h3>
      <div className="divide-y overflow-hidden rounded-xl border">
        {loading ? (
          <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            加载中…
          </div>
        ) : (
          <>
            <NumberRow
              label="默认超时（秒）"
              description="内置子代理的默认超时时间，自定义代理使用各自的超时（默认 1800 = 30 分钟）"
              value={timeoutSeconds}
              onChange={setTimeoutSeconds}
              placeholder="1800"
            />
            <NumberRow
              label="默认最大轮次"
              description="留空时各代理使用内置默认值（general-purpose=200, bash=60）。填写后将统一覆盖所有内置代理的最大轮次"
              value={maxTurns}
              onChange={setMaxTurns}
              placeholder="留空使用默认值"
            />
            <NumberRow
              label="单次运行最大委派数"
              description="单次 lead-agent 运行中允许的子代理委派总数（范围 1-50）"
              value={maxTotalPerRun}
              onChange={setMaxTotalPerRun}
              placeholder="6"
            />
            {/* Token 预算 */}
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className={labelCls}>启用 Token 预算</p>
                <p className={descCls}>
                  开启后对子代理的单次运行施加 token 总量上限，作为成本后隄
                </p>
              </div>
              <div className="shrink-0">
                <Switch
                  checked={tbEnabled}
                  onCheckedChange={setTbEnabled}
                  disabled={saving}
                />
              </div>
            </div>
            <NumberRow
              label="最大 Token 数"
              description="单次子代理运行允许的 token 总量上限（输入+输出），默认 2000000"
              value={tbMaxTokens}
              onChange={setTbMaxTokens}
              placeholder="2000000"
            />
            <NumberRow
              label="警告阈值"
              description="token 用量达到最大值的比例时触发软警告（0-1，默认 0.7 = 70%）"
              value={tbWarnThreshold}
              onChange={setTbWarnThreshold}
              placeholder="0.7"
            />
            {/* custom_agents JSON 编辑器 */}
            <div className="px-4 py-3">
              <p className={labelCls}>自定义子代理类型 (custom_agents)</p>
              <p className={descCls}>
                声明可被 task_tool 委派的自定义子代理。每个类型需包含
                description、system_prompt，可选 tools / skills / model /
                max_turns / timeout_seconds
              </p>
              <Textarea
                value={customAgentsJson}
                onChange={(e) => {
                  setCustomAgentsJson(e.target.value);
                  setCustomAgentsDirty(true);
                }}
                disabled={saving}
                className="mt-2 min-h-32 font-mono text-xs"
                spellCheck={false}
                placeholder={'例如：\n{\n  "researcher": {\n    "description": "深度研究子代理",\n    "system_prompt": "你是一个研究助手…",\n    "model": "inherit",\n    "max_turns": 50\n  }\n}'}
              />
            </div>
            <div className="flex gap-2 px-4 py-3">
              <Button
                size="sm"
                disabled={!dirty || saving}
                onClick={handleSave}
              >
                {saving ? "保存中…" : "应用并重启"}
              </Button>
              {dirty && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={resetAll}
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
  );
}

/* ── orchestration form ───────────────────────────────── */

function OrchestrationForm() {
  const { data, loading, saving, save } = useConfigSection<OrchestrationConfig>(
    "orchestration",
    { mode: "single", max_concurrency: 3 },
  );
  const [mode, setMode] = useState<"single" | "multi">("single");
  const [maxConcurrency, setMaxConcurrency] = useState("");
  const [workersJson, setWorkersJson] = useState("");
  const [workersDirty, setWorkersDirty] = useState(false);

  useEffect(() => {
    setMode(data.mode ?? "single");
    setMaxConcurrency(String(data.max_concurrency ?? 3));
    setWorkersJson(JSON.stringify(data.workers ?? [], null, 2));
    setWorkersDirty(false);
  }, [data]);

  const dirty =
    mode !== (data.mode ?? "single") ||
    Number(maxConcurrency) !== (data.max_concurrency ?? 3) ||
    workersDirty;

  const handleSave = async () => {
    let parsedWorkers: WorkerSpec[] | undefined;
    if (workersDirty) {
      try {
        const trimmed = workersJson.trim();
        if (!trimmed || trimmed === "[]") {
          parsedWorkers = [];
        } else {
          const parsed = JSON.parse(trimmed);
          if (!Array.isArray(parsed)) {
            throw new Error("workers 必须是 JSON 数组");
          }
          parsedWorkers = parsed as WorkerSpec[];
        }
      } catch (e) {
        toast.error(
          `workers JSON 解析失败：${e instanceof Error ? e.message : String(e)}`,
        );
        return;
      }
    }

    try {
      const payload: OrchestrationConfig = {
        mode,
        max_concurrency: pickNum(maxConcurrency, 3, { min: 1 }),
        workers: parsedWorkers ?? data.workers ?? [],
      };
      await save(payload);
      toast.success("编排配置已更新");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    }
  };

  const resetAll = () => {
    setMode(data.mode ?? "single");
    setMaxConcurrency(String(data.max_concurrency ?? 3));
    setWorkersJson(JSON.stringify(data.workers ?? [], null, 2));
    setWorkersDirty(false);
  };

  return (
    <section className="space-y-2">
      <h3 className="text-muted-foreground px-1 text-xs font-medium tracking-wide uppercase">
        多 Agent 编排
      </h3>
      <div className="divide-y overflow-hidden rounded-xl border">
        {loading ? (
          <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            加载中…
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className={labelCls}>编排模式</p>
                <p className={descCls}>
                  single：lead agent + task_tool 委派（v1.0 行为）
                  <br />
                  multi：Orchestrator 图编排，支持并行批次与协作模式（v2.0）
                </p>
              </div>
              <div className="shrink-0">
                <Select
                  value={mode}
                  onValueChange={(v) => setMode(v as "single" | "multi")}
                >
                  <SelectTrigger className="h-8 w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">single</SelectItem>
                    <SelectItem value="multi">multi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <NumberRow
              label="最大并发数"
              description="multi 模式下并行执行的子代理数量上限"
              value={maxConcurrency}
              onChange={setMaxConcurrency}
              placeholder="3"
            />
            {/* workers JSON 编辑器 */}
            <div className="px-4 py-3">
              <p className={labelCls}>编排 Workers</p>
              <p className={descCls}>
                multi 模式下的参与者列表。每个 worker 需包含 name、description，
                可选 system_prompt / tools / skills / model / max_turns /
                timeout_seconds / role
              </p>
              <Textarea
                value={workersJson}
                onChange={(e) => {
                  setWorkersJson(e.target.value);
                  setWorkersDirty(true);
                }}
                disabled={saving}
                className="mt-2 min-h-32 font-mono text-xs"
                spellCheck={false}
                placeholder={'例如：\n[\n  {\n    "name": "researcher",\n    "description": "研究员",\n    "model": "inherit",\n    "role": "worker"\n  }\n]'}
              />
            </div>
            <div className="flex gap-2 px-4 py-3">
              <Button
                size="sm"
                disabled={!dirty || saving}
                onClick={handleSave}
              >
                {saving ? "保存中…" : "应用并重启"}
              </Button>
              {dirty && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={resetAll}
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
  );
}

/* ── reusable row ─────────────────────────────────────── */

function NumberRow({
  label,
  description,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <p className={labelCls}>{label}</p>
        <p className={descCls}>{description}</p>
      </div>
      <div className="shrink-0">
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-8 w-28"
        />
      </div>
    </div>
  );
}
