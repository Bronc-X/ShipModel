import type { ModelRequest } from "../types.js";

interface SubtypeProfile {
  subject: string;
  reference: string;
  printability: string;
}

const colorNames: Record<string, string> = {
  "#c7352f": "signal red",
  "#245b70": "harbor blue",
  "#f3ead7": "cream white",
  "#2e3538": "graphite black",
  "#e5b843": "rescue yellow",
  "#2e6a4e": "pine green"
};

const subtypeProfiles: Record<string, SubtypeProfile> = {
  "race-car": {
    subject: "realistic compact racing car scale model",
    reference: "low wide stance, sculpted aerodynamic body, plausible wheel arches, track-day body kit, no brand or sponsor marks",
    printability: "thickened splitter, wing supports, mirrors, and wheel details so the model remains printable"
  },
  "off-road": {
    subject: "realistic off-road truck scale model",
    reference: "lifted suspension stance, large tires, squared utility body, roof rack, front guard, real expedition vehicle proportions",
    printability: "merge fragile bars into sturdy printable forms and simplify tire tread into broad clean blocks"
  },
  "future-sports": {
    subject: "realistic near-future sports car concept scale model",
    reference: "low wedge profile, smooth canopy, sculpted intakes, believable supercar proportions, no fantasy styling",
    printability: "keep aero blades and vents broad, connected, and physically plausible"
  },
  jet: {
    subject: "realistic modern twin-engine fighter aircraft scale model",
    reference: "real-world stealth combat jet proportions, angular wings, twin tails, detailed canopy, landing gear optional and sturdy",
    printability: "slightly thicken wing edges, tail fins, and gear so the static model can survive handling"
  },
  airliner: {
    subject: "realistic passenger airliner commercial jet scale model",
    reference: "real-world passenger airliner proportions, cylindrical fuselage, clean nose, swept wings, wing-mounted engines, horizontal stabilizers, window rows, no airline logos",
    printability: "thicken wings, landing gear, engine nacelles, tail surfaces, and wing roots so the static model remains printable"
  },
  biplane: {
    subject: "realistic vintage biplane scale model",
    reference: "classic radial-engine nose, two stacked wings, open cockpit impression, early aviation proportions",
    printability: "simplify struts and rigging into thicker connected supports suitable for printing"
  },
  "space-fighter": {
    subject: "realistic advanced fixed-wing unmanned aircraft scale model",
    reference: "real-world long-endurance UAV and drone proportions, long high-aspect-ratio wings, smooth sensor nose, rear pusher engine or V-tail",
    printability: "thicken wings, tail booms, sensor pod, and landing-contact points while preserving the unmanned aircraft silhouette"
  },
  warship: {
    subject: "realistic modern naval destroyer or frigate scale model",
    reference: "faceted hull, angular superstructure, radar mast, clean deck geometry, understated deck equipment, no flags, logos, or random hull markings",
    printability: "merge tiny railings and antennas into simplified sturdy raised details"
  },
  sailboat: {
    subject: "realistic offshore patrol vessel scale model",
    reference: "fast coastal patrol craft proportions, sharp bow, enclosed bridge, compact mast, dark lower hull, light upper deck",
    printability: "keep rails, mast, and small deck fittings simplified and connected"
  },
  "vintage-ship": {
    subject: "realistic classical tall sailing ship scale model",
    reference: "historical wooden hull, three masts, cream sails, simplified rigging, old-world naval proportions",
    printability: "turn fine ropes into sparse thicker rigging lines and keep masts visibly sturdy"
  }
};

export function buildImagePrompt(input: ModelRequest, variant: "A" | "B") {
  const profile = subtypeProfiles[input.subtype] ?? {
    subject: `realistic ${input.subtype} scale model`,
    reference: "real-world proportions, clean hard-surface details, no logos",
    printability: "all fragile details thickened and connected for a static printable display model"
  };
  const composition =
    variant === "A"
      ? "low three-quarter front view, complete silhouette visible, centered with generous padding"
      : "slightly higher three-quarter view emphasizing the side profile and top surfaces";
  const widthMm = Math.round(input.targetLengthMm * 0.46);
  const heightMm = Math.round(input.targetLengthMm * 0.32);
  const primaryColor = colorLabel(input.primaryColor);
  const accentColor = colorLabel(input.accentColor);
  const userGeometry = buildUserGeometryConstraint(input.description);

  return [
    `Create a polished studio render of a ${profile.subject}.`,
    userGeometry,
    `Subtype reference, used only where it does not conflict with mandatory user geometry: ${profile.reference}.`,
    `Target bounding box for the later 3D model: ${input.targetLengthMm} x ${widthMm} x ${heightMm} mm (X length x Y width x Z height). Keep these proportions visible in the silhouette.`,
    `Selected product style: ${input.style}, treated as finish and presentation only; keep the physical form realistic.`,
    `Selected colorway: primary ${primaryColor}; accent ${accentColor}. Apply the primary color to the main body and the accent color only to secondary panels or small details.`,
    input.label ? `Include the exact number "${input.label}" only as a small raised simple marking.` : "",
    `Composition: ${composition}, centered on a plain warm off-white background.`,
    `Subtype printability baseline: ${profile.printability}.`,
    "Printable geometry guardrail: make it a single connected printable static display model with clean hard-surface forms, large readable masses, thick solid wheels, chunky connected supports, and no thin floating suspension rods.",
    "If a user geometry request would create fragile detail, convert it into thicker simplified connected geometry while preserving the requested silhouette and proportions.",
    "Avoid cartoon style, chibi proportions, toy-store illustration, low-poly blockiness, fantasy silhouettes, transparent pieces, loose cables, random text, watermarks, real brand logos, readable insignia, missiles, explosions, people, and busy scenery."
  ]
    .filter(Boolean)
    .join(" ");
}

function buildUserGeometryConstraint(description: string) {
  const cleaned = description.trim();
  if (!cleaned) {
    return "Mandatory user geometry requirements: none provided. Follow subtype reference while keeping the model realistic and printable.";
  }

  const enhancements = describeGeometryEnhancements(cleaned);
  const enhancementText = enhancements.length ? ` Interpret these as: ${enhancements.join("; ")}.` : "";
  return `Mandatory user geometry requirements override subtype defaults when they conflict: ${cleaned}.${enhancementText}`;
}

function describeGeometryEnhancements(description: string) {
  const normalized = description.toLowerCase();
  const enhancements: string[] = [];

  if (normalized.includes("大脚车") || normalized.includes("monster")) {
    enhancements.push("monster-truck conversion");
  }
  if (normalized.includes("40寸") || normalized.includes("40 inch") || normalized.includes("40-inch")) {
    enhancements.push("oversized 40-inch wheels");
  }
  if (normalized.includes("高底盘") || normalized.includes("升高") || normalized.includes("lifted")) {
    enhancements.push("lifted suspension");
  }
  if (normalized.includes("夸张轮拱") || normalized.includes("大轮拱") || normalized.includes("宽轮拱")) {
    enhancements.push("enlarged wheel arches");
  }

  return enhancements;
}

function colorLabel(value: string) {
  const normalized = value.toLowerCase();
  const name = colorNames[normalized];
  return name ? `${name} (${value})` : value;
}
