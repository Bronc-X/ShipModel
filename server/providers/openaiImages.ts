import type { Concept, ModelRequest } from "../types.js";
import { buildImagePrompt } from "./prompt.js";

interface OpenAIImageItem {
  b64_json?: string;
  url?: string;
}

interface OpenAIImageResponse {
  data?: OpenAIImageItem[];
}

interface OpenAiConceptOptions {
  onConceptDone?: (concept: Concept, index: number, total: number) => void;
}

export async function openAiConcepts(input: ModelRequest, runId: string, options: OpenAiConceptOptions = {}): Promise<Concept[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2";
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing");
  }

  const variants: Array<"A" | "B"> = ["A", "B"];
  const concepts: Concept[] = [];

  for (const [index, variant] of variants.entries()) {
    const concept = await generateConcept(input, variant, baseUrl, apiKey, model);
    concepts.push(concept);
    options.onConceptDone?.(concept, index + 1, variants.length);
  }

  return concepts.map((concept) => ({ ...concept, id: `${concept.id}-${runId.slice(0, 6)}` }));
}

async function generateConcept(
  input: ModelRequest,
  variant: "A" | "B",
  baseUrl: string,
  apiKey: string,
  model: string
): Promise<Concept> {
  const prompt = buildImagePrompt(input, variant);
  const response = await fetch(`${baseUrl}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      prompt,
      size: "1024x1024"
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI image generation failed: ${response.status} ${detail}`);
  }

  const json = (await response.json()) as OpenAIImageResponse;
  const image = json.data?.[0];
  const imageUrl = image?.b64_json
    ? `data:image/png;base64,${image.b64_json}`
    : image?.url;

  if (!imageUrl) {
    throw new Error("OpenAI image generation returned no image");
  }

  return {
    id: `concept-${variant.toLowerCase()}`,
    title: variant === "A" ? "推荐建模图" : "备选参考图",
    imageUrl,
    prompt,
    feedback: conceptFeedback(input, variant)
  };
}

function conceptFeedback(input: ModelRequest, variant: "A" | "B") {
  const subject = feedbackSubjects[input.subtype] ?? "主体";
  const colorway = `${colorLabel(input.primaryColor)}为主，${colorLabel(input.accentColor)}点缀`;
  const labelCopy = input.label ? `编号 ${input.label} 已作为小面积标记融入外壳。` : "未加入额外编号标记。";

  if (variant === "A") {
    return `${subject}以低位三分之四视角呈现，主体完整、遮挡少，轮廓和落地姿态更适合交给 Tripo 生成 STL。${colorway}，${labelCopy}`;
  }

  return `${subject}从略高的展示角度展开，顶面、侧面和结构分区更清楚，适合作为备选或对照图。${colorway}，${labelCopy}`;
}

const feedbackSubjects: Record<string, string> = {
  "race-car": "赛车模型",
  "off-road": "越野车模型",
  "future-sports": "未来跑车模型",
  jet: "现代战机模型",
  airliner: "客机模型",
  biplane: "复古双翼机模型",
  "space-fighter": "固定翼无人机模型",
  warship: "现代舰艇模型",
  sailboat: "近海巡逻艇模型",
  "vintage-ship": "古典帆船模型"
};

const colorNames: Record<string, string> = {
  "#c7352f": "信号红",
  "#245b70": "港湾蓝",
  "#f3ead7": "奶油白",
  "#2e3538": "石墨黑",
  "#e5b843": "救援黄",
  "#2e6a4e": "松针绿"
};

function colorLabel(value: string) {
  return colorNames[value.toLowerCase()] ?? value;
}
