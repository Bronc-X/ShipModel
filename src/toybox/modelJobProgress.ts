import type { ModelJobEvent } from "../types";

export type ModelTimelineItem = {
  id: string;
  tag: string;
  message: string;
  detail: string;
  state: "active" | "done" | "error" | "warn";
};

export type ModelFailureSummary = {
  title: string;
  action: string;
  detail: string;
};

export function summarizeModelFailure(reasons: string[] = []): ModelFailureSummary {
  const detail = reasons.filter(Boolean).join("\n");
  if (!detail) {
    return {
      title: "正在读取失败原因",
      action: "正在从本地 API 恢复这次生成记录，请稍等。",
      detail: ""
    };
  }
  const normalized = detail.toLowerCase();

  if (normalized.includes("tripo_api_key") || normalized.includes("tripo api key")) {
    return {
      title: "Tripo API Key 未配置",
      action: "先在本地 .env.local 填入 TRIPO_API_KEY，再重启 API 服务。",
      detail
    };
  }

  if (normalized.includes("tripo image upload") && (normalized.includes("timeout") || normalized.includes("connect timeout") || normalized.includes("und_err_connect_timeout"))) {
    return {
      title: "Tripo 上传连接超时",
      action: "先检查 WARP/VPN、DNS 或代理，再重试生成。",
      detail
    };
  }

  if (normalized.includes("tripo request failed before response") || normalized.includes("fetch failed") || normalized.includes("name resolution") || normalized.includes("enotfound")) {
    return {
      title: "Tripo 网络连接失败",
      action: "当前机器没有稳定连到 Tripo API，请先恢复网络后重试。",
      detail
    };
  }

  if (normalized.includes("tripo image upload failed")) {
    return {
      title: "Tripo 图片上传失败",
      action: "概念图没有成功上传到 Tripo，请重新生成概念图或稍后重试。",
      detail
    };
  }

  if (normalized.includes("tripo api error") || normalized.includes("tripo task") || normalized.includes("image_to_model")) {
    return {
      title: "Tripo 建模任务失败",
      action: "这是 Tripo 返回的建模错误，请按下方原始信息判断是否需要换图或重试。",
      detail
    };
  }

  if (normalized.includes("stl_") || normalized.includes("validate_stl")) {
    return {
      title: "STL 文件校验失败",
      action: "Tripo 返回了文件，但本地基础校验未通过，请重新生成或检查下载文件。",
      detail
    };
  }

  return {
    title: "模型生成失败",
    action: "请查看下方原始错误，再决定是重试、换图还是调整参数。",
    detail
  };
}

export function buildModelTimeline(events: ModelJobEvent[], busy: boolean): ModelTimelineItem[] {
  const base = events.length
    ? events
    : [{ type: "job.started" as const, jobId: "pending", title: "等待模型生成任务开始", at: new Date().toISOString() }];

  const timeline = base.slice(-8).map((event, index) => ({
    id: `${event.type}-${event.at}-${index}`,
    tag: eventTag(event),
    message: eventMessage(event),
    detail: eventDetail(event),
    state: eventState(event)
  }));

  if (busy && !events.some((event) => event.type === "tool.started")) {
    timeline.push({
      id: "waiting-first-tool",
      tag: "WAIT",
      message: "等待后端工具事件",
      detail: "连接已建立后会显示 Tripo 调用、STL 校验和产物写入。",
      state: "active"
    });
  }

  return timeline;
}

export function getPipelineState(events: ModelJobEvent[], keys: string[], busy: boolean, index: number) {
  const hasError = events.some((event) => event.type === "step.failed" && keys.includes(event.stepId));
  if (hasError) return "warn";
  const hasDone = events.some((event) => eventMatchesPipelineKey(event, keys) && eventState(event) === "done");
  if (hasDone) return "done";
  const hasActive = events.some((event) => eventMatchesPipelineKey(event, keys));
  if (hasActive) return "active";
  if (busy && index === 0 && events.length === 0) return "active";
  return "pending";
}

function eventTag(event: ModelJobEvent) {
  if (event.type === "artifact.created") return "ARTIFACT";
  if (event.type === "step.failed") return "ERROR";
  if (event.type === "job.started") return "JOB";
  if (event.type === "job.completed") return "DONE";
  if (event.type === "step.started") return "STEP";
  if (event.type === "artifact.patch") return "PATCH";
  return event.name.replace(/_/g, "-").toUpperCase();
}

function eventMessage(event: ModelJobEvent) {
  if (event.type === "job.started") return event.title;
  if (event.type === "step.started") return event.title;
  if (event.type === "tool.started") return `正在执行 ${event.name}`;
  if (event.type === "tool.completed") return `${event.name} 已完成`;
  if (event.type === "artifact.created") return event.title ?? `${event.kind} 已创建`;
  if (event.type === "artifact.patch") return "产物已更新";
  if (event.type === "step.failed") return event.error;
  if (event.response?.run.status === "Ready") return "模型生成完成";
  if (event.response?.run.status === "Failed") return "模型生成失败";
  return "任务结束";
}

function eventDetail(event: ModelJobEvent) {
  if (event.type === "tool.started") return event.inputSummary ?? "等待工具返回结果。";
  if (event.type === "tool.completed") return event.outputSummary ?? "工具已返回结构化结果。";
  if (event.type === "artifact.created") return `${event.kind} 产物已进入检查台。`;
  if (event.type === "artifact.patch") return "结构化产物补丁已应用。";
  if (event.type === "step.failed") return event.recoverable ? summarizeModelFailure([event.error]).action : "任务已停止。";
  if (event.type === "job.completed" && event.response?.run.status === "Ready") return "后端已保存可下载 STL。";
  if (event.type === "job.completed" && event.response?.run.status === "Failed") return "后端已保存失败原因，稍后进入失败页。";
  if (event.type === "job.completed") return "任务结束但没有返回模型。";
  return "事件来自后端生成链路。";
}

function eventState(event: ModelJobEvent): ModelTimelineItem["state"] {
  if (event.type === "step.failed") return "error";
  if (event.type === "tool.started" || event.type === "step.started" || event.type === "job.started") return "active";
  if (event.type === "job.completed" && event.response?.run.status === "Failed") return "error";
  if (event.type === "job.completed" && !event.response) return "warn";
  return "done";
}

function eventMatchesPipelineKey(event: ModelJobEvent, keys: string[]) {
  if (keys.includes(event.type)) return true;
  if ("callId" in event && keys.includes(event.callId)) return true;
  if ("stepId" in event && keys.includes(event.stepId)) return true;
  return "name" in event && keys.includes(event.name);
}
