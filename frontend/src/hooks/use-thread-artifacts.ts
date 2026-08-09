import type { Message } from "@langchain/langgraph-sdk";
import { useMemo } from "react";

import { extractPresentFilesFromMessage } from "@/core/messages/utils";

export interface ThreadResources {
  /** 本任务实际调用的技能名称列表（最新 assistant 消息 skills 字段）。 */
  skills: string[];
  /** 本任务产出文件路径列表（扫描所有 assistant 消息的 present_files 工具调用）。 */
  artifacts: string[];
}

/**
 * 从 messages 中提取技能与产出文件。
 *
 * Artifacts 来自 AI 消息的 ``present_files`` tool call 参数
 * （``toolCall.args.filepaths``），而不是消息或线程 state 上虚构的
 * ``msg.artifacts`` 字段。扫描全部 assistant 消息以汇聚历史产出。
 */
export function useThreadResources(messages: Message[]): ThreadResources {
  return useMemo(() => {
    const skills: string[] = [];
    const artifacts: string[] = [];
    const seen = new Set<string>();

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i] as {
        type?: string;
        skills?: string[];
      };
      if (msg?.type === "ai") {
        // Skills 只取最新一条 assistant 消息的值（与之前行为一致）
        if (skills.length === 0 && msg.skills) {
          skills.push(...msg.skills);
        }
        // Artifacts 扫描全部 assistant 消息的 present_files 工具调用
        const files = extractPresentFilesFromMessage(messages[i]!);
        for (const f of files) {
          if (!seen.has(f)) {
            seen.add(f);
            artifacts.unshift(f);
          }
        }
      }
    }
    return { skills, artifacts };
  }, [messages]);
}
