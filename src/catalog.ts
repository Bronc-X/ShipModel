import type { ModelCategory, ModelRequest, ModelSubtype } from "./types";

export const categories: Array<{
  id: ModelCategory;
  name: string;
  description: string;
  subtypes: Array<{ id: ModelSubtype; name: string; note: string }>;
}> = [
  {
    id: "vehicle",
    name: "车辆",
    description: "紧凑轮廓、夸张轮拱、适合玩具模型的姿态。",
    subtypes: [
      { id: "race-car", name: "赛车", note: "低趴、速度感、带编号" },
      { id: "off-road", name: "越野车", note: "厚重、抬高、结实" },
      { id: "future-sports", name: "未来跑车", note: "流线型概念外壳" }
    ]
  },
  {
    id: "aircraft",
    name: "飞行器",
    description: "轮廓清晰，机翼加厚，并带有适合展示的底座。",
    subtypes: [
      { id: "jet", name: "喷气机", note: "锐利但安全" },
      { id: "biplane", name: "双翼机", note: "经典双层机翼" },
      { id: "space-fighter", name: "太空战机", note: "玩具科幻轮廓" }
    ]
  },
  {
    id: "ship",
    name: "船舰",
    description: "静态船模，船体稳固，细节适合打印。",
    subtypes: [
      { id: "warship", name: "战舰", note: "风格化，不强调真实武器" },
      { id: "sailboat", name: "帆船", note: "清晰桅杆结构" },
      { id: "vintage-ship", name: "复古船", note: "复古船体与甲板" }
    ]
  }
];

export const styles = ["赛道日", "复古套件", "未来实验室", "收藏玩具", "海事经典"];

export const colors = [
  { name: "信号红", value: "#c7352f" },
  { name: "港湾蓝", value: "#245b70" },
  { name: "奶油白", value: "#f3ead7" },
  { name: "石墨黑", value: "#2e3538" },
  { name: "救援黄", value: "#e5b843" },
  { name: "松针绿", value: "#2e6a4e" }
];

export const defaultInput: ModelRequest = {
  category: "vehicle",
  subtype: "race-car",
  style: "赛道日",
  primaryColor: "#c7352f",
  accentColor: "#f3ead7",
  label: "07",
  description: "一个结实的冠军赛车模型，带有圆润顺滑的外壳面板。",
  targetLengthMm: 120
};

export function firstSubtype(category: ModelCategory): ModelSubtype {
  return categories.find((item) => item.id === category)?.subtypes[0].id ?? "race-car";
}
