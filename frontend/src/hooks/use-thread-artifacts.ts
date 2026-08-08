import type { Message } from "@langchain/langgraph-sdk";
import { useMemo } from "react";

export interface ThreadResources {
  /** 本任务实际调用的技能名称列表（最新 assistant 消息 skills 字段）。 */
  skills: string[];
  /** 本任务产出文件路径列表（最新 assistant 消息 artifacts 字段）。 */
  artifacts: string[];
}

/**
 * 从 messages 最新 assistant 消息中提取技能与产出文件。
 */
export function useThreadResources(messages: Message[]): ThreadResources {
  return useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i] as {
        type?: string;
        skills?: string[];
        artifacts?: string[];
      };
      if (msg?.type === "assistant") {
        return {
          skills: msg.skills ?? [],
          artifacts: msg.artifacts ?? [],
        };
      }
    }
    return { skills: [], artifacts: [] };
  }, [messages]);
}
