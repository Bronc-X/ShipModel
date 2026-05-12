import type { ModelCategory, ModelRequest, ModelSubtype } from "../types";

export const categories: Array<{
  id: ModelCategory;
  name: string;
  description: string;
  subtypes: Array<{ id: ModelSubtype; name: string; note: string }>;
}> = [
  {
    id: "vehicle",
    name: "车辆",
    description: "参考真实车辆比例，保留宽轮拱、厚车身和可打印结构。",
    subtypes: [
      { id: "race-car", name: "赛道赛车", note: "低趴车身，宽轮拱" },
      { id: "off-road", name: "越野车", note: "高底盘，大胎纹" },
      { id: "future-sports", name: "概念跑车", note: "流线车顶，宽车肩" }
    ]
  },
  {
    id: "aircraft",
    name: "飞行器",
    description: "接近真实战机、无人机和古典飞机外形，同时加厚易损结构。",
    subtypes: [
      { id: "jet", name: "现代战机", note: "锐利机鼻，双尾翼" },
      { id: "airliner", name: "客机", note: "宽体机身，翼下发动机" },
      { id: "biplane", name: "古典双翼机", note: "双层机翼，螺旋桨" },
      { id: "space-fighter", name: "长航时无人机", note: "长翼展，传感器机鼻" }
    ]
  },
  {
    id: "ship",
    name: "舰船",
    description: "真实舰体轮廓优先，桥楼、甲板和桅杆细节控制在可打印范围内。",
    subtypes: [
      { id: "warship", name: "现代军舰", note: "驱逐舰/护卫舰轮廓" },
      { id: "sailboat", name: "巡逻舰艇", note: "桥楼清晰，甲板稳固" },
      { id: "vintage-ship", name: "古典帆船", note: "多桅帆面，木质船体" }
    ]
  }
];

export const stylesByCategory: Record<ModelCategory, string[]> = {
  vehicle: ["赛道日", "复古套件", "拉力改装", "收藏玩具"],
  aircraft: ["航展涂装", "低可视灰", "实验机", "复古航空"],
  ship: ["海事经典", "巡逻涂装", "舰艇灰", "古典木船"]
};

export const colors = [
  { name: "信号红", value: "#c7352f" },
  { name: "港湾蓝", value: "#245b70" },
  { name: "奶油白", value: "#f3ead7" },
  { name: "石墨黑", value: "#2e3538" },
  { name: "救援黄", value: "#e5b843" },
  { name: "松针绿", value: "#2e6a4e" }
];

export const defaultPrompts: Record<ModelSubtype, string> = {
  "race-car": "生成一个真实比例的赛道赛车模型：低趴车身、宽轮拱、赛道空气套件、厚实尾翼和适合 3D 打印的一体化结构。",
  "off-road": "生成一个真实比例的越野车模型：抬高底盘、大块胎纹、车顶架、前后防护杠和连接稳固的底盘结构。",
  "future-sports": "生成一个接近量产概念车的跑车模型：流线车顶、平滑座舱、宽车肩、整体式进气口和可打印的厚边缘。",
  jet: "生成一个现代战机比例模型：锐利机鼻、清晰主翼、双尾翼、进气口和加厚的静态展示结构。",
  airliner: "生成一个真实比例的客机模型：宽体圆柱机舱、清晰舷窗排布、后掠主翼、翼下双发发动机和加厚起落架。",
  biplane: "生成一个古典双翼机比例模型：双层机翼、螺旋桨、圆形机鼻、开放座舱轮廓和加粗连杆。",
  "space-fighter": "生成一个长航时固定翼无人机模型：长翼展、平滑传感器机鼻、细长机身、V 型尾翼和稳固起落架。",
  warship: "生成一个现代军舰比例模型：清晰舰体、桥楼、雷达桅杆、简化甲板设备和适合打印的厚边栏杆。",
  sailboat: "生成一个近海巡逻舰艇比例模型：尖锐船艏、封闭桥楼、低矮甲板设备、稳固船体和清晰舷侧线条。",
  "vintage-ship": "生成一个古典帆船比例模型：木质船体、多桅帆面、简化索具、加厚桅杆和适合静态展示的船底。"
};

export function firstSubtype(category: ModelCategory): ModelSubtype {
  return categories.find((item) => item.id === category)?.subtypes[0].id ?? "race-car";
}

export function firstStyle(category: ModelCategory): string {
  return stylesByCategory[category]?.[0] ?? stylesByCategory.vehicle[0];
}

export function defaultInputForSubtype(category: ModelCategory, subtype: ModelSubtype): ModelRequest {
  return {
    category,
    subtype,
    style: firstStyle(category),
    primaryColor: "#c7352f",
    accentColor: "#f3ead7",
    label: "07",
    description: defaultPrompts[subtype],
    targetLengthMm: 120
  };
}

export const defaultInput: ModelRequest = defaultInputForSubtype("vehicle", "race-car");
