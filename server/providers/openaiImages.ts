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

type ImageFetch = (url: string, init: RequestInit) => Promise<Response>;

export async function openAiConcepts(input: ModelRequest, runId: string, options: OpenAiConceptOptions = {}, imageFetch: ImageFetch = fetch): Promise<Concept[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2";
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing");
  }

  const variants: Array<"A"> = ["A"];
  const concepts: Concept[] = [];

  for (const [index, variant] of variants.entries()) {
    const concept = await generateConcept(input, variant, baseUrl, apiKey, model, imageFetch);
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
  model: string,
  imageFetch: ImageFetch
): Promise<Concept> {
  const prompt = buildImagePrompt(input, variant);
  const response = await imageFetch(`${baseUrl}/images/generations`, {
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
    title: "建模图",
    imageUrl,
    prompt,
    feedback: conceptFeedback(input, variant)
  };
}

export async function reviseOpenAiConcept(input: ModelRequest, concept: Concept, instruction: string, imageFetch: ImageFetch = fetch): Promise<Concept> {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2";
  const trimmed = instruction.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing");
  }
  if (!trimmed) {
    throw new Error("请先写下想修改的地方。");
  }

  const prompt = buildRevisionPrompt(input, concept, trimmed);
  const response = await imageFetch(`${baseUrl}/images/edits`, await buildImageEditRequest(apiKey, model, prompt, concept.imageUrl, imageFetch));

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI image revision failed: ${response.status} ${detail}`);
  }

  const json = (await response.json()) as OpenAIImageResponse;
  const image = json.data?.[0];
  const imageUrl = image?.b64_json
    ? `data:image/png;base64,${image.b64_json}`
    : image?.url;

  if (!imageUrl) {
    throw new Error("OpenAI image revision returned no image");
  }

  return {
    id: `${concept.id}-rev-${Date.now().toString(36)}`,
    title: "修改后的建模图",
    imageUrl,
    prompt,
    feedback: `已按你的描述调整：${trimmed}`
  };
}

function conceptFeedback(input: ModelRequest, variant: "A" | "B") {
  const subject = feedbackSubjects[input.subtype] ?? "主体";
  const colorway = `${colorLabel(input.primaryColor)}为主，${colorLabel(input.accentColor)}点缀`;
  const markingCopy = input.markingText?.trim() ? `标志文字“${input.markingText.trim()}”已作为小面积标记融入外壳。` : "未加入额外标志文字。";

  if (variant === "A") {
    return `${subject}以低位三分之四视角呈现，主体完整、遮挡少，轮廓和落地姿态更适合交给 Tripo 生成 STL。${colorway}，${markingCopy}`;
  }

  return `${subject}从略高的展示角度展开，顶面、侧面和结构分区更清楚，适合作为备选或对照图。${colorway}，${markingCopy}`;
}

function buildRevisionPrompt(input: ModelRequest, concept: Concept, instruction: string) {
  return [
    buildImagePrompt(input, "A"),
    `Revise the existing concept titled "${concept.title}" with these user instructions: ${instruction}.`,
    "Keep the same overall subject, printable hard-surface scale-model style, centered studio composition, and single connected printable geometry.",
    "Apply requested geometry or color changes clearly, while keeping fragile details thickened and attached."
  ].join(" ");
}

async function buildImageEditRequest(apiKey: string, model: string, prompt: string, imageUrl: string, imageFetch: ImageFetch): Promise<RequestInit> {
  let image: { mime: string; extension: string; bytes: Buffer };
  if (imageUrl.startsWith("data:image/")) {
    image = decodeDataImage(imageUrl);
  } else if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    image = await downloadImageForEdit(imageUrl, imageFetch);
  } else {
    throw new Error("Concept image must be a data image or HTTP URL");
  }

  const form = new FormData();
  form.append("model", model);
  form.append("prompt", prompt);
  form.append("size", "1024x1024");
  const uploadBytes = new Uint8Array(image.bytes.byteLength);
  uploadBytes.set(image.bytes);
  form.append("image", new Blob([uploadBytes], { type: image.mime }), `concept.${image.extension}`);

  return {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: form
  };
}

function decodeDataImage(imageUrl: string) {
  const [metadata, base64] = imageUrl.split(",", 2);
  if (!base64) {
    throw new Error("Concept image data URL is invalid");
  }

  const match = /^data:(image\/[a-z0-9.+-]+);base64$/i.exec(metadata);
  if (!match) {
    throw new Error("Concept image data URL must be base64 encoded");
  }

  return {
    mime: match[1],
    extension: extensionForMime(match[1]),
    bytes: Buffer.from(base64, "base64")
  };
}

function extensionForMime(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

async function downloadImageForEdit(imageUrl: string, imageFetch: ImageFetch) {
  const response = await imageFetch(imageUrl, { method: "GET" });
  if (!response.ok) {
    throw new Error(`Concept image download failed: ${response.status}`);
  }

  const mime = normalizeImageMime(response.headers.get("content-type") ?? imageMimeFromUrl(imageUrl));
  return {
    mime,
    extension: extensionForMime(mime),
    bytes: Buffer.from(await response.arrayBuffer())
  };
}

function normalizeImageMime(mime: string) {
  const normalized = mime.split(";")[0]?.trim().toLowerCase();
  if (normalized === "image/png" || normalized === "image/webp" || normalized === "image/jpeg") {
    return normalized;
  }
  return "image/png";
}

function imageMimeFromUrl(imageUrl: string) {
  const pathname = new URL(imageUrl).pathname.toLowerCase();
  if (pathname.endsWith(".webp")) return "image/webp";
  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return "image/jpeg";
  return "image/png";
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
