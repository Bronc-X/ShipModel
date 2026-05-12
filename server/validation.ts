import type { ModelRequest } from "./types.js";

export const targetLengthLimitsMm = {
  min: 60,
  max: 300
} as const;

const validationMessages: Record<string, string> = {
  category_required: "请选择模型类别。",
  subtype_required: "请选择模型原型。",
  style_required: "请选择模型风格。",
  primary_color_required: "请选择主色。",
  accent_color_required: "请选择辅助色。",
  target_length_out_of_range: `外接盒 X 轴尺寸需在 ${targetLengthLimitsMm.min}-${targetLengthLimitsMm.max} mm 内。`
};

export function validateInput(input: ModelRequest) {
  const reasons: string[] = [];
  if (!input.category) reasons.push("category_required");
  if (!input.subtype) reasons.push("subtype_required");
  if (!input.style) reasons.push("style_required");
  if (!input.primaryColor) reasons.push("primary_color_required");
  if (!input.accentColor) reasons.push("accent_color_required");
  if (
    !input.targetLengthMm ||
    input.targetLengthMm < targetLengthLimitsMm.min ||
    input.targetLengthMm > targetLengthLimitsMm.max
  ) {
    reasons.push("target_length_out_of_range");
  }
  return reasons;
}

export function formatValidationReasons(reasons: string[]) {
  return reasons.map((reason) => validationMessages[reason] ?? reason).join("；");
}
