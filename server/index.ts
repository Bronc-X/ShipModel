import "./env.js";
import cors from "cors";
import express from "express";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { ensureRunDir, getRunDir, loadRun, publicRunFile, runsDir, saveRun } from "./storage.js";
import type { ConceptProgressEvent, ConceptResponse, GenerateModelRequest, HandshakeResponse, ModelRequest, ModelRun } from "./types.js";
import { openAiConcepts } from "./providers/openaiImages.js";
import { generateTripoModel } from "./providers/tripoModel.js";
import { validateStl } from "./validate.js";
import { formatValidationReasons, validateInput } from "./validation.js";

const app = express();
const port = Number(process.env.PORT ?? 5174);

app.use(cors());
app.use(express.json({ limit: "30mb" }));
app.use("/runs", express.static(runsDir));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.get("/api/handshake", (_request, response) => {
  const payload: HandshakeResponse = {
    ok: true,
    app: "printable-model-demo",
    apiVersion: "0.1.0",
    mode: {
      imageProvider: "openai",
      modelProvider: "tripo"
    },
    configured: {
      openai: Boolean(process.env.OPENAI_API_KEY),
      tripo: Boolean(process.env.TRIPO_API_KEY)
    },
    capabilities: {
      conceptImages: true,
      modelGeneration: true,
      stlDownload: true,
      threeMfDownload: false,
      statuses: ["Ready", "Failed"]
    }
  };

  response.json(payload);
});

app.post("/api/concepts", async (request, response) => {
  if (String(request.headers.accept ?? "").includes("application/x-ndjson")) {
    await streamConceptProgress(request.body as ModelRequest, response);
    return;
  }

  try {
    const input = request.body as ModelRequest;
    const validation = validateInput(input);
    if (validation.length > 0) {
      response.status(400).json({
        error: "Invalid input",
        message: formatValidationReasons(validation),
        reasons: validation
      });
      return;
    }

    const runId = randomUUID();
    await ensureRunDir(runId);
    if (!process.env.OPENAI_API_KEY) {
      response.status(503).json({
        error: "OpenAI is not configured",
        message: "生成概念图前，请先设置 OPENAI_API_KEY。"
      });
      return;
    }

    const concepts = await openAiConcepts(input, runId);
    const now = new Date().toISOString();
    const run: ModelRun = {
      runId,
      input,
      concepts,
      reasons: [],
      files: {},
      createdAt: now,
      updatedAt: now
    };

    await saveRun(run);
    const payload: ConceptResponse = { runId, concepts };
    response.json(payload);
  } catch (error) {
    response.status(500).json({
      error: "Concept generation failed",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

async function streamConceptProgress(input: ModelRequest, response: express.Response) {
  response.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  response.setHeader("Cache-Control", "no-cache, no-transform");
  response.setHeader("X-Accel-Buffering", "no");

  const send = (event: ConceptProgressEvent) => {
    response.write(`${JSON.stringify(event)}\n`);
  };

  try {
    send({ phase: "queued", progress: 5, message: "已接收概念图生成请求。" });

    const validation = validateInput(input);
    if (validation.length > 0) {
      response.status(400);
      send({ phase: "complete", progress: 100, message: formatValidationReasons(validation) });
      response.end();
      return;
    }

    send({ phase: "validating", progress: 12, message: "参数校验通过，正在创建生成记录。" });
    const runId = randomUUID();
    await ensureRunDir(runId);
    send({ phase: "image", progress: 22, message: "正在生成第 1 张概念图。", runId, conceptIndex: 1, totalConcepts: 2 });

    if (!process.env.OPENAI_API_KEY) {
      response.status(503);
      send({ phase: "complete", progress: 100, message: "生成概念图前，请先设置 OPENAI_API_KEY。", runId });
      response.end();
      return;
    }

    const concepts = await openAiConcepts(input, runId, {
      onConceptDone: (_concept, index, total) => {
        const progress = index === 1 ? 56 : 84;
        const nextMessage = index < total ? `第 ${index} 张已完成，正在生成第 ${index + 1} 张。` : "两张概念图已生成，正在保存结果。";
        send({ phase: "image", progress, message: nextMessage, runId, conceptIndex: index, totalConcepts: total });
      }
    });

    send({ phase: "saving", progress: 92, message: "正在保存概念图和生成记录。", runId, totalConcepts: concepts.length });

    const now = new Date().toISOString();
    const run: ModelRun = {
      runId,
      input,
      concepts,
      reasons: [],
      files: {},
      createdAt: now,
      updatedAt: now
    };

    await saveRun(run);
    const payload: ConceptResponse = { runId, concepts };
    send({ phase: "complete", progress: 100, message: "概念图已生成。", runId, totalConcepts: concepts.length, response: payload });
  } catch (error) {
    send({
      phase: "complete",
      progress: 100,
      message: error instanceof Error ? error.message : "Concept generation failed"
    });
  } finally {
    response.end();
  }
}

app.post("/api/models", async (request, response) => {
  try {
    const body = request.body as GenerateModelRequest;
    const run = await loadRun(body.runId);
    const concept = run.concepts.find((item) => item.id === body.conceptId);
    if (!concept) {
      response.status(404).json({ error: "Concept not found" });
      return;
    }

    run.selectedConceptId = body.conceptId;
    run.reasons = [];

    try {
      if (!process.env.TRIPO_API_KEY) {
        throw new Error("生成可打印模型前，请先设置 TRIPO_API_KEY。");
      }

      const stlFile = await generateTripoModel(run);
      const reasons = await validateStl(run.runId, stlFile);

      if (reasons.length > 0) {
        run.status = "Failed";
        run.reasons = reasons;
        run.files = {};
      } else {
        run.status = "Ready";
        run.reasons = [];
        run.files = {
          stl: publicRunFile(run.runId, stlFile)
        };
      }
    } catch (error) {
      run.status = "Failed";
      run.reasons = [error instanceof Error ? error.message : "model_generation_failed"];
      run.files = {};
    }

    await saveRun(run);
    response.json({ run });
  } catch (error) {
    response.status(500).json({
      error: "Model generation failed",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

app.get("/api/runs/:runId", async (request, response) => {
  try {
    const run = await loadRun(request.params.runId);
    response.json({ run });
  } catch {
    response.status(404).json({ error: "Run not found" });
  }
});

app.get("/api/runs/:runId/download/stl", async (request, response) => {
  try {
    const run = await loadRun(request.params.runId);
    if (run.status !== "Ready" || !run.files.stl) {
      response.status(404).json({ error: "STL is not ready" });
      return;
    }
    response.download(path.join(getRunDir(run.runId), path.basename(run.files.stl)), `${run.runId}.stl`);
  } catch {
    response.status(404).json({ error: "Run not found" });
  }
});

app.listen(port, () => {
  process.stdout.write(`Printable model API listening on http://localhost:${port}\n`);
});
