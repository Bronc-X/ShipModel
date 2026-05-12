const baseUrl = "http://localhost:5174";

const handshake = await getJson("/api/handshake");

if (handshake.mode.imageProvider !== "openai") {
  throw new Error("Handshake must expose OpenAI as the image provider");
}

if (handshake.mode.modelProvider !== "tripo") {
  throw new Error("Handshake must expose Tripo as the model provider");
}

if (handshake.capabilities.statuses.join(",") !== "Ready,Failed") {
  throw new Error("Handshake status contract drifted");
}

const conceptResponse = await fetch(`${baseUrl}/api/concepts`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    category: "ship",
    subtype: "warship",
    style: "Maritime classic",
    primaryColor: "#245b70",
    accentColor: "#e5b843",
    label: "88",
    description: "A compact ceremonial warship with a sturdy display hull.",
    targetLengthMm: 120
  })
});

if (!handshake.configured.openai && conceptResponse.status !== 503) {
  throw new Error("Concept endpoint must fail with 503 when OPENAI_API_KEY is missing");
}

process.stdout.write(
  JSON.stringify(
    {
      ok: true,
      configured: handshake.configured,
      conceptStatus: conceptResponse.status
    },
    null,
    2
  ) + "\n"
);

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`);
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}
