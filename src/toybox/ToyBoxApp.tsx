import {
  AlertTriangle,
  Box,
  CheckCircle2,
  Clock,
  Copy,
  Database,
  Download,
  Eye,
  FileDown,
  Grid3X3,
  HelpCircle,
  History,
  LayoutDashboard,
  Link,
  Menu,
  Plane,
  Ruler,
  Save,
  Settings,
  ShieldCheck,
  Ship,
  Sparkles,
  Terminal,
  Truck,
  Users,
  Wand2
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { generateConcepts, generateModel, getHandshake, getRun, reviseConcept } from "../api";
import { ModelViewer } from "../components/ModelViewer";
import type { Concept, ConceptProgressEvent, HandshakeResponse, ModelCategory, ModelJobEvent, ModelRequest, ModelRun, ModelSubtype } from "../types";
import { categories, colors, defaultInput, defaultInputForSubtype, defaultPrompts, firstStyle, firstSubtype, stylesByCategory } from "./catalog";
import { conceptPreviewAssets } from "./conceptPreviewAssets";
import {
  appendHistoryEntry,
  entryFromRunStatus,
  getHistoryEntries,
  getMembership,
  setMembership,
  type LocalHistoryEntry,
  type MembershipSnapshot
} from "./localHistory";
import { buildModelTimeline, getPipelineState, summarizeModelFailure } from "./modelJobProgress";
import { parseRoute, routePaths, type RouteName, type RouteState } from "./routes";
import { getSupabaseSyncState, syncHistoryEntry } from "./supabaseSync";

type ToastTone = "info" | "error";
type PreviewMode = "applied" | "wireframe";

const targetLengthLimitsMm = { min: 60, max: 300 } as const;

const subtypeIcons: Record<ModelCategory, ReactNode> = {
  vehicle: <Truck size={30} />,
  aircraft: <Plane size={30} />,
  ship: <Ship size={30} />
};

const previewModeLabels: Record<PreviewMode, string> = {
  applied: "概念预览",
  wireframe: "尺寸网格"
};

type DetailRenderView = "front" | "side" | "top" | "joint";

type InspectionProfile = {
  printTime: string;
  renders: Array<{ label: string; note: string; view: DetailRenderView }>;
  advice: string[];
};

const modelBuildTokens = [
  "queue", "task", "image", "token", "upload", "Tripo", "poll", "mesh", "shell", "surface",
  "watertight", "normal", "edge", "repair", "merge", "scale", "bbox", "axis", "units", "mm",
  "support", "overhang", "thin-wall", "detail", "decimate", "smooth", "convert", "asset", "glb", "stl",
  "download", "checksum", "cache", "metadata", "preview", "viewer", "bounds", "status", "running", "queued",
  "retry", "timeout", "heartbeat", "inspect", "slice", "bed", "raft", "nozzle", "layer", "infill",
  "bridge", "island", "manifold", "waterline", "orientation", "render", "crop", "front-view", "top-view", "joint",
  "export", "ready", "handoff", "console", "tail"
];

export function ToyBoxApp() {
  const [route, setRoute] = useState<RouteState>(() => parseRoute(window.location.pathname));
  const [input, setInput] = useState<ModelRequest>(defaultInput);
  const [runId, setRunId] = useState<string | null>(null);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null);
  const [run, setRun] = useState<ModelRun | null>(null);
  const [handshake, setHandshake] = useState<HandshakeResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [conceptProgress, setConceptProgress] = useState<ConceptProgressEvent | null>(null);
  const [modelEvents, setModelEvents] = useState<ModelJobEvent[]>([]);
  const [conceptRevisionText, setConceptRevisionText] = useState("");
  const [revisionBusy, setRevisionBusy] = useState(false);
  const [revisionProgress, setRevisionProgress] = useState<ConceptProgressEvent | null>(null);
  const [toast, setToast] = useState<{ tone: ToastTone; message: string } | null>(null);
  const [alert, setAlert] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("applied");
  const [historyEntries, setHistoryEntries] = useState<LocalHistoryEntry[]>(() => getHistoryEntries());
  const [membership, setMembershipState] = useState<MembershipSnapshot>(() => getMembership());

  const activeCategory = useMemo(() => categories.find((category) => category.id === input.category) ?? categories[0], [input.category]);
  const activePreview = conceptPreviewAssets[input.subtype];
  const selectedConcept = concepts.find((concept) => concept.id === selectedConceptId) ?? concepts[0];
  const readyRun = run?.status === "Ready" ? run : null;
  const stlDownloadHref = readyRun ? `/api/runs/${encodeURIComponent(readyRun.runId)}/download/stl` : "";
  const supabaseSyncState = getSupabaseSyncState();

  useEffect(() => {
    getHandshake()
      .then(setHandshake)
      .catch((error) => showToast(error instanceof Error ? error.message : "API 连接失败，请检查本地服务。", "error"));
  }, []);

  useEffect(() => {
    const handlePop = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  useEffect(() => {
    if (window.location.pathname === "/") {
      navigate("configure", true);
    }
  }, []);

  useEffect(() => {
    if ((route.name !== "download" && route.name !== "failed") || !route.runId) return;
    if (run?.runId === route.runId && (run.status === "Ready" || run.status === "Failed")) return;
    let cancelled = false;
    setBusy(true);
    setAlert(null);

    getRun(route.runId)
      .then(({ run: restoredRun }) => {
        if (cancelled) return;
        restoreRun(restoredRun);
        if (restoredRun.status === "Ready") {
          setRoute({ name: "download", runId: restoredRun.runId });
          replacePath(`/download/${restoredRun.runId}`);
        } else if (restoredRun.status === "Failed") {
          setRoute({ name: "failed", runId: restoredRun.runId });
          replacePath(`/failed/${restoredRun.runId}`);
        } else {
          setRoute({ name: "concept", runId: restoredRun.runId });
          replacePath("/concept");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setRoute({ name: "missing", runId: route.runId });
        setAlert("没有找到这次生成记录。");
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });

    return () => {
      cancelled = true;
    };
  }, [route.name, route.runId, run]);

  function showToast(message: string, tone: ToastTone = "info") {
    setToast({ message, tone });
    window.setTimeout(() => {
      setToast((current) => (current?.message === message ? null : current));
    }, 4500);
  }

  function showAlert(message: string) {
    setAlert(message);
    showToast(message, "error");
  }

  function navigate(name: RouteName, replace = false, id?: string) {
    const path = name === "download" && id ? `/download/${id}` : name === "failed" && id ? `/failed/${id}` : routePaths[name];
    if (replace) {
      replacePath(path);
    } else {
      window.history.pushState({}, "", path);
    }
    setRoute({ name, runId: id });
  }

  function restoreRun(restoredRun: ModelRun) {
    setRun(restoredRun);
    setRunId(restoredRun.runId);
    setInput(restoredRun.input);
    setConcepts(restoredRun.concepts);
    setSelectedConceptId(restoredRun.selectedConceptId ?? restoredRun.concepts[0]?.id ?? null);
  }

  function resetWorkspace() {
    setInput(defaultInputForSubtype("vehicle", "race-car"));
    setRunId(null);
    setConcepts([]);
    setSelectedConceptId(null);
    setRun(null);
    setConceptProgress(null);
    setConceptRevisionText("");
    setRevisionProgress(null);
    setAlert(null);
    navigate("configure");
    showToast("已清空画布，可以开始下一版。");
  }

  function setCategory(category: ModelCategory) {
    const subtype = firstSubtype(category);
    setInput((current) => ({
      ...current,
      category,
      subtype,
      style: firstStyle(category),
      description: defaultPrompts[subtype]
    }));
  }

  function setSubtype(subtype: ModelSubtype) {
    setInput((current) => ({
      ...current,
      subtype,
      description: defaultPrompts[subtype]
    }));
  }

  async function handleGenerateConcepts() {
    const targetLengthError = getTargetLengthError(input.targetLengthMm);
    if (targetLengthError) {
      showAlert(targetLengthError);
      navigate("configure", true);
      return;
    }

    setBusy(true);
    setAlert(null);
    setRevisionProgress(null);
    setConceptProgress({ phase: "queued", progress: 3, message: "正在提交概念图生成请求。" });
    try {
      const response = await generateConcepts(input, setConceptProgress);
      setRunId(response.runId);
      setConcepts(response.concepts);
      setSelectedConceptId(response.concepts[0]?.id ?? null);
      setConceptRevisionText("");
      setRun(null);
      saveHistory({
        input,
        runId: response.runId,
        concepts: response.concepts,
        selectedConceptId: response.concepts[0]?.id ?? null,
        status: "concept"
      });
      navigate("concept");
      showToast("概念图已生成，确认或继续微调后就能生成 STL。");
    } catch (error) {
      showAlert(error instanceof Error ? error.message : "概念图生成失败。");
      navigate("configure", true);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateModel() {
    if (!runId || !selectedConceptId) {
      showAlert("请先生成并选择概念图，再提交 STL。");
      navigate("configure", true);
      return;
    }

    setBusy(true);
    setAlert(null);
    setModelEvents([]);
    navigate("generating");

    try {
      const response = await generateModel(runId, selectedConceptId, (event) => {
        setModelEvents((events) => [...events, event]);
      });
      restoreRun(response.run);
      saveHistory({
        input: response.run.input,
        runId: response.run.runId,
        concepts: response.run.concepts,
        selectedConceptId: response.run.selectedConceptId ?? null,
        status: entryFromRunStatus(response.run.status)
      });
      navigate(response.run.status === "Ready" ? "download" : "failed", true, response.run.runId);
    } catch (error) {
      showAlert(error instanceof Error ? error.message : "模型生成失败。");
      navigate("failed", true, runId);
    } finally {
      setBusy(false);
    }
  }

  async function handleReviseConcept() {
    if (!runId || !selectedConceptId) {
      showAlert("请先生成概念图，再提交再确认修改。");
      return;
    }
    const instruction = conceptRevisionText.trim();
    if (!instruction) {
      showAlert("请先写下想修改的地方。");
      return;
    }

    setRevisionBusy(true);
    setAlert(null);
    setRevisionProgress({ phase: "queued", progress: 8, message: "已接收再确认修改，正在锁定原图和第一步参数。" });
    try {
      setRevisionProgress({ phase: "validating", progress: 24, message: "正在合并固定输入和你的局部修改描述。" });
      const response = await reviseConcept(runId, selectedConceptId, instruction);
      setRevisionProgress({ phase: "image", progress: 84, message: "确认图已重新生成，正在更新当前建模图。" });
      restoreRun(response.run);
      setSelectedConceptId(response.concept.id);
      setConceptRevisionText("");
      saveHistory({
        input: response.run.input,
        runId: response.run.runId,
        concepts: response.run.concepts,
        selectedConceptId: response.concept.id,
        status: "concept"
      });
      showToast("概念图已按你的描述更新。");
      setRevisionProgress({ phase: "complete", progress: 100, message: "再确认图已更新，可继续生成 STL。" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "概念图修改失败。";
      setRevisionProgress({ phase: "complete", progress: 100, message });
      showAlert(message);
    } finally {
      setRevisionBusy(false);
    }
  }

  function handleNav(name: RouteName) {
    setAlert(null);
    if (name === "configure" || isUtilityRoute(name)) {
      navigate(name);
      return;
    }
    if (name === "concept") {
      if (!concepts.length) {
        showAlert("请先生成概念图，再进入方案选择。");
        navigate("configure", true);
        return;
      }
      navigate("concept");
      return;
    }
    if (name === "generating") {
      if (readyRun) {
        navigate("download", false, readyRun.runId);
        return;
      }
      void handleCreateModel();
      return;
    }
    if (name === "download") {
      if (!readyRun) {
        showAlert("STL 生成完成后才能下载。");
        navigate("configure", true);
        return;
      }
      navigate("download", false, readyRun.runId);
    }
  }

  function exportProject() {
    navigate("files");
    if (readyRun) {
      window.location.assign(stlDownloadHref);
    } else {
      showAlert("STL 生成完成后才能导出。");
    }
  }

  function saveProject() {
    saveHistory({
      input,
      runId,
      concepts,
      selectedConceptId,
      status: readyRun ? "ready" : concepts.length ? "concept" : "saved"
    });
    navigate("files");
    showToast("当前配置已保存到此浏览器。");
  }

  function saveHistory(entry: Parameters<typeof appendHistoryEntry>[1]) {
    const saved = appendHistoryEntry(localStorage, entry);
    setHistoryEntries(getHistoryEntries());
    void syncHistoryEntry(saved);
    return saved;
  }

  function handleUpgrade(plan: "free" | "pro") {
    setMembershipState(setMembership(localStorage, plan));
    showToast(plan === "pro" ? "Pro 已在本地启用，历史容量和云同步提示已更新。" : "已切回 Free 本地方案。");
  }

  function setToolbarView(nextMode: PreviewMode) {
    setPreviewMode(nextMode);
    showToast(`已切换到${previewModeLabels[nextMode]}。`);
  }

  return (
    <div className="toybox-app">
      <Header busy={busy} readyRun={readyRun} onNavigate={handleNav} onExport={exportProject} onSave={saveProject} />

      {route.name === "generating" ? (
        <ProjectLayout routeName={route.name} onNew={resetWorkspace} onNavigate={handleNav}>
          <ProgressPage events={modelEvents} busy={busy} ready={Boolean(readyRun)} onCancel={() => showToast("请求已提交，完成后会自动进入下载页。")} />
        </ProjectLayout>
      ) : route.name === "concept" ? (
        <ProjectLayout routeName={route.name} onNew={resetWorkspace} onNavigate={handleNav}>
          <ConceptPage
            concepts={concepts}
            selectedConceptId={selectedConceptId}
            progress={conceptProgress}
            revisionProgress={revisionProgress}
            busy={busy}
            revisionBusy={revisionBusy}
            revisionText={conceptRevisionText}
            onSelect={setSelectedConceptId}
            onCreate={handleCreateModel}
            onRevisionText={setConceptRevisionText}
            onRevise={handleReviseConcept}
            onBack={() => navigate("configure")}
          />
        </ProjectLayout>
      ) : route.name === "download" ? (
        <ProjectLayout routeName={route.name} onNew={resetWorkspace} onNavigate={handleNav}>
          <DownloadPage run={readyRun} stlHref={stlDownloadHref} onNew={resetWorkspace} onBack={() => navigate("configure")} />
        </ProjectLayout>
      ) : route.name === "failed" ? (
        <FailedPage isLoading={busy && Boolean(route.runId) && run?.runId !== route.runId} run={run?.runId === route.runId || !route.runId ? run : null} onRetry={() => navigate("configure")} onBack={() => navigate("configure")} />
      ) : route.name === "missing" ? (
        <MissingRunPage runId={route.runId} onBack={() => navigate("configure")} />
      ) : isUtilityRoute(route.name) ? (
        <ProjectLayout routeName={route.name} onNew={resetWorkspace} onNavigate={handleNav}>
          <UtilityPage
            routeName={route.name}
            historyEntries={historyEntries}
            membership={membership}
            supabaseSyncState={supabaseSyncState}
            onBack={() => navigate("configure")}
            onUpgrade={handleUpgrade}
          />
        </ProjectLayout>
      ) : (
        <div className="app-body">
          <Sidebar routeName={route.name} onNew={resetWorkspace} onNavigate={handleNav} />
          <ConfigPanel
            input={input}
            handshake={handshake}
            busy={busy}
            progress={conceptProgress}
            activeCategory={activeCategory}
            activePreview={activePreview}
            onInput={setInput}
            onCategory={setCategory}
            onSubtype={setSubtype}
            onGenerate={handleGenerateConcepts}
          />
          <main className="viewport">
            <div className="progress-line">
              <div style={{ width: `${conceptProgress?.progress ?? (concepts.length ? 55 : 15)}%` }} />
            </div>
            <div className="viewport-toolbar" aria-label="视图工具栏">
              <button className={previewMode === "applied" ? "tool-button active" : "tool-button"} type="button" title="参数预览" onClick={() => setToolbarView("applied")}>
                <Eye size={20} />
                <span className="sr-only">参数预览</span>
              </button>
              <button className={previewMode === "wireframe" ? "tool-button active" : "tool-button"} type="button" title="真实线框比例" onClick={() => setToolbarView("wireframe")}>
                <Grid3X3 size={20} />
                <span className="sr-only">真实线框比例</span>
              </button>
            </div>
            <div className="viewport-center">
              {readyRun ? (
                <ModelViewer category={input.category} primaryColor={input.primaryColor} accentColor={input.accentColor} stlUrl={stlDownloadHref} />
              ) : (
                <ConceptPreview input={input} preview={activePreview} mode={previewMode} />
              )}
            </div>
          </main>
        </div>
      )}

      <StatusMessages toast={toast} alert={alert} />
    </div>
  );
}

function Header({
  busy,
  readyRun,
  onNavigate,
  onExport,
  onSave
}: {
  busy: boolean;
  readyRun: ModelRun | null;
  onNavigate: (name: RouteName) => void;
  onExport: () => void;
  onSave: () => void;
}) {
  return (
    <header className="toybox-header">
      <div className="brand-row">
        <button className="brand-title" type="button" onClick={() => onNavigate("configure")}>
          Toy-Box 3D
        </button>
      </div>
      <div className="header-actions">
        <span className="status-chip">{busy ? "正在生成" : readyRun ? "STL 已就绪" : "先配置模型"}</span>
        <button className="button secondary" type="button" onClick={onExport}>
          <FileDown size={17} />
          导出 STL
        </button>
        <button className="button primary" type="button" onClick={onSave}>
          <Save size={17} />
          保存配置
        </button>
        <button className="icon-button" type="button" aria-label="设置" onClick={() => onNavigate("settings")}>
          <Settings size={20} />
        </button>
        <button className="icon-button" type="button" aria-label="提问" onClick={() => onNavigate("help")}>
          <HelpCircle size={20} />
        </button>
        <button className="avatar" type="button" aria-label="个人" onClick={() => onNavigate("profile")}>
          L
        </button>
      </div>
    </header>
  );
}

function ProjectLayout({ routeName, onNew, onNavigate, children }: { routeName: RouteName; onNew: () => void; onNavigate: (name: RouteName) => void; children: ReactNode }) {
  return (
    <div className="app-body">
      <Sidebar routeName={routeName} onNew={onNew} onNavigate={onNavigate} />
      {children}
    </div>
  );
}

function Sidebar({ routeName, onNew, onNavigate }: { routeName: RouteName; onNew: () => void; onNavigate: (name: RouteName) => void }) {
  return (
    <aside className="sidebar">
      <div className="workspace-card">
        <div className="workspace-icon">
          <Box size={22} />
        </div>
        <div>
          <h2>模型工作台</h2>
          <p>V1.0.5 Alpha</p>
        </div>
      </div>
      <button className="button secondary full-width" type="button" onClick={onNew}>
        <Sparkles size={17} />
        新建版本
      </button>
      <nav className="side-nav" aria-label="当前项目功能栏">
        <SideButton active={routeName === "configure"} icon={<Menu size={19} />} label="参数" onClick={() => onNavigate("configure")} />
        <SideButton active={routeName === "concept"} icon={<LayoutDashboard size={19} />} label="选图" onClick={() => onNavigate("concept")} />
        <SideButton active={routeName === "generating"} icon={<Wand2 size={19} />} label="生成 STL" onClick={() => onNavigate("generating")} />
        <SideButton active={routeName === "download"} icon={<Download size={19} />} label="下载 STL" onClick={() => onNavigate("download")} />
      </nav>
      <div className="side-footer">
        <SideButton active={routeName === "history"} icon={<History size={19} />} label="本地历史" onClick={() => onNavigate("history")} />
        <SideButton active={routeName === "storage"} icon={<Database size={19} />} label="本地存储" onClick={() => onNavigate("storage")} />
        <SideButton active={routeName === "invite"} icon={<Users size={19} />} label="邀请联盟" onClick={() => onNavigate("invite")} />
      </div>
    </aside>
  );
}

function SideButton({ active = false, icon, label, onClick }: { active?: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button className={active ? "side-link active" : "side-link"} type="button" onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function ConfigPanel({
  input,
  handshake,
  busy,
  progress,
  activeCategory,
  activePreview,
  onInput,
  onCategory,
  onSubtype,
  onGenerate
}: {
  input: ModelRequest;
  handshake: HandshakeResponse | null;
  busy: boolean;
  progress: ConceptProgressEvent | null;
  activeCategory: (typeof categories)[number];
  activePreview: (typeof conceptPreviewAssets)[ModelSubtype];
  onInput: (input: ModelRequest | ((current: ModelRequest) => ModelRequest)) => void;
  onCategory: (category: ModelCategory) => void;
  onSubtype: (subtype: ModelSubtype) => void;
  onGenerate: () => void;
}) {
  return (
    <section className="config-panel" aria-label="生成参数">
      <div className="panel-content">
        <div className="panel-title">
          <h2>先定模型方向</h2>
          <p>先描述要生成的模型，编号默认不启用；需要时可加入番号、字母或姓名等个性化信息。</p>
          <p className="tiny-label">
            openai:{handshake?.configured.openai ? "已连接" : "缺失"} · tripo:{handshake?.configured.tripo ? "已连接" : "缺失"}
          </p>
        </div>

        <div className="form-section">
          <span className="section-label">选择类别</span>
          <div className="tabs">
            {categories.map((category) => (
              <button className={input.category === category.id ? "tab-button active" : "tab-button"} key={category.id} type="button" onClick={() => onCategory(category.id)}>
                {category.name}
              </button>
            ))}
          </div>
        </div>

        <div className="form-section">
          <span className="section-label">选择原型</span>
          <div className="archetype-grid">
            {activeCategory.subtypes.map((subtype) => (
              <button className={input.subtype === subtype.id ? "archetype-card active" : "archetype-card"} key={subtype.id} type="button" onClick={() => onSubtype(subtype.id)}>
                <img alt="" aria-hidden="true" src={conceptPreviewAssets[subtype.id].imageUrl} />
                <span className="archetype-icon">{subtypeIcons[input.category]}</span>
                <strong>{subtype.name}</strong>
                <span>{subtype.note}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="form-section">
          <span className="section-label">外接盒尺寸 (mm)</span>
          <div className="dimension-grid">
            {([
              ["X Axis", input.targetLengthMm, false],
              ["Y Axis", Math.round(input.targetLengthMm * 0.46), true],
              ["Z Axis", Math.round(input.targetLengthMm * 0.32), true]
            ] as const).map(([label, value, readOnly]) => (
              <div className="field-card" key={label}>
                <label>{label}</label>
                <input
                  aria-label={label}
                  inputMode="numeric"
                  type="number"
                  min={readOnly ? undefined : targetLengthLimitsMm.min}
                  max={readOnly ? undefined : targetLengthLimitsMm.max}
                  readOnly={readOnly}
                  value={value}
                  onChange={(event) => {
                    const next = Number(event.currentTarget.value);
                    if (!readOnly && Number.isFinite(next)) {
                      onInput((current) => ({ ...current, targetLengthMm: next }));
                    }
                  }}
                />
              </div>
            ))}
          </div>
          <span className="tiny-label">X 可调范围 {targetLengthLimitsMm.min}-{targetLengthLimitsMm.max} mm，Y/Z 会按比例自动计算。</span>
        </div>

        <div className="form-section">
          <span className="section-label">风格 / 个性化信息</span>
          <div className="field-row">
            <select className="select-input" aria-label="样式" value={input.style} onChange={(event) => onInput((current) => ({ ...current, style: event.target.value }))}>
              {stylesByCategory[input.category].map((style) => (
                <option key={style}>{style}</option>
              ))}
            </select>
            <input className="text-input" aria-label="个性化信息" maxLength={24} placeholder="可选，番号、字母或姓名" value={input.markingText ?? ""} onChange={(event) => onInput((current) => ({ ...current, markingText: event.target.value }))} />
          </div>
          <span className="tiny-label">默认留空，不会自动添加编号。</span>
        </div>

        <ColorPicker label="主色" value={input.primaryColor} ariaPrefix="主色" onSelect={(value) => onInput((current) => ({ ...current, primaryColor: value }))} />
        <ColorPicker label="辅助色" value={input.accentColor} ariaPrefix="辅助色" onSelect={(value) => onInput((current) => ({ ...current, accentColor: value }))} />

        <div className="form-section">
          <span className="section-label">造型要求</span>
          <textarea className="text-area" maxLength={500} value={input.description} onChange={(event) => onInput((current) => ({ ...current, description: event.target.value }))} />
          <span className="tiny-label">{input.description.length}/500</span>
        </div>
      </div>
      <div className="sticky-action">
        <div className="active-preview-note">
          <strong>{activePreview.title}</strong>
          <span>{activePreview.description}</span>
        </div>
        <button className="button primary full-width" type="button" onClick={onGenerate}>
          <Wand2 size={18} />
          {busy ? "正在生成概念图..." : "生成概念图"}
        </button>
        {progress ? <ConceptProgressMeter progress={progress} /> : null}
      </div>
    </section>
  );
}

function ColorPicker({ label, value, ariaPrefix, onSelect }: { label: string; value: string; ariaPrefix: string; onSelect: (value: string) => void }) {
  return (
    <div className="form-section color-section">
      <span className="section-label">{label}</span>
      <div className="color-grid compact">
        {colors.map((color) => (
          <button aria-label={`${ariaPrefix} ${color.name}`} title={color.name} className={value === color.value ? "swatch-button active" : "swatch-button"} key={color.value} type="button" onClick={() => onSelect(color.value)}>
            <span className="swatch" style={{ backgroundColor: color.value }} />
          </button>
        ))}
      </div>
      <label className="custom-color-field">
        <span className="swatch custom-preview" style={{ backgroundColor: value }} />
        <input aria-label={`${ariaPrefix} 自定义颜色`} type="color" value={value} onChange={(event) => onSelect(event.currentTarget.value)} />
      </label>
    </div>
  );
}

function ConceptProgressMeter({ progress }: { progress: ConceptProgressEvent }) {
  return (
    <div className="concept-progress" role="status" aria-live="polite">
      <div className="concept-progress-meta">
        <span>{progress.message}</span>
        <strong>{Math.round(progress.progress)}%</strong>
      </div>
      <div className="concept-progress-track" role="progressbar" aria-label="概念图生成进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.progress)}>
        <div style={{ width: `${progress.progress}%` }} />
      </div>
    </div>
  );
}

function RevisionProgressPanel({ progress, busy }: { progress: ConceptProgressEvent; busy: boolean }) {
  const steps = [
    { phase: "queued", label: "锁定原图", copy: "读取当前建模图和第一步固定输入。" },
    { phase: "validating", label: "混合描述", copy: "将你的局部修改与模型参数合并。" },
    { phase: "image", label: "重新生图", copy: "调用图片编辑接口，只改指定区域。" },
    { phase: "complete", label: "更新产物", copy: "保存新确认图并切换为当前建模图。" }
  ] as const;
  const currentIndex = Math.max(0, steps.findIndex((step) => step.phase === progress.phase));

  return (
    <div className="revision-progress workspace-event" role="status" aria-live="polite">
      <div className="revision-progress-head">
        <span className="section-label">再确认进度</span>
        <strong>{Math.round(progress.progress)}%</strong>
      </div>
      <div className="concept-progress-track" role="progressbar" aria-label="再确认生成进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.progress)}>
        <div style={{ width: `${progress.progress}%` }} />
      </div>
      <p>{progress.message}</p>
      <div className="revision-steps" aria-label="再确认阶段">
        {steps.map((step, index) => {
          const state = index < currentIndex || (!busy && progress.phase === "complete" && index === currentIndex) ? "done" : index === currentIndex ? "active" : "pending";
          return (
            <div className={`revision-step ${state}`} key={step.phase}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{step.label}</strong>
              <em>{step.copy}</em>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConceptPreview({ input, preview, mode }: { input: ModelRequest; preview: (typeof conceptPreviewAssets)[ModelSubtype]; mode: PreviewMode }) {
  const yAxis = Math.round(input.targetLengthMm * 0.46);
  const zAxis = Math.round(input.targetLengthMm * 0.32);

  return (
    <section className={`concept-preview-stage ${mode}`} aria-label={preview.title}>
      {mode === "wireframe" ? (
        <div className="wireframe-preview">
          <ModelViewer category={input.category} primaryColor={input.primaryColor} accentColor={input.accentColor} dimensions={{ length: input.targetLengthMm, width: yAxis, height: zAxis }} wireframe pending />
          <div className="blueprint-layer visible" aria-hidden="true">
            <div className="outline-box">
              <span className="measure measure-x">{input.targetLengthMm} mm</span>
              <span className="measure measure-y">{yAxis} mm</span>
              <span className="measure measure-z">{zAxis} mm</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="preview-image-shell">
          <img alt={preview.title} src={preview.imageUrl} />
        </div>
      )}
      <div className="preview-overlay">
        <div className="preview-copy">
          <span className="section-label">{mode === "wireframe" ? "尺寸网格" : "当前方向"}</span>
          <h2>{preview.title}</h2>
          <p>{mode === "wireframe" ? "已按当前 X/Y/Z 建立比例网格。生成完成后会切换到 STL 查看器。" : preview.description}</p>
        </div>
        <div className="preview-specs">
          <span>{input.style}</span>
          <span>{input.targetLengthMm} mm</span>
          <span>{yAxis} x {zAxis}</span>
        </div>
      </div>
    </section>
  );
}

function ConceptPage({
  concepts,
  selectedConceptId,
  progress,
  revisionProgress,
  busy,
  revisionBusy,
  revisionText,
  onSelect,
  onCreate,
  onRevisionText,
  onRevise,
  onBack
}: {
  concepts: Concept[];
  selectedConceptId: string | null;
  progress: ConceptProgressEvent | null;
  revisionProgress: ConceptProgressEvent | null;
  busy: boolean;
  revisionBusy: boolean;
  revisionText: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRevisionText: (value: string) => void;
  onRevise: () => void;
  onBack: () => void;
}) {
  const selectedConcept = concepts.find((concept) => concept.id === selectedConceptId) ?? concepts[0];

  return (
    <main className="concept-page">
      <div className="page-frame">
        <header className="page-title">
          <h1>确认建模输入图</h1>
          <p>系统默认选中这一张建模图。需要再确认时，可以用自然语言只修改局部，其余部分会尽量保持和第一张一致。</p>
        </header>
        {progress ? <ConceptProgressMeter progress={progress} /> : null}
        <section className="concept-grid" aria-label="概念图方案">
          {concepts.map((concept, index) => {
            const selected = selectedConceptId === concept.id;
            return (
              <button className={selected ? "concept-card selected" : "concept-card"} key={concept.id} type="button" onClick={() => onSelect(concept.id)} aria-pressed={selected}>
                <span className={index === 0 ? "concept-card-kicker recommended" : "concept-card-kicker"}>{index === 0 ? "当前建模图" : "历史修改版"}</span>
                <img alt={concept.title} src={concept.imageUrl} />
                <div className="concept-card-body">
                  <h2>{concept.title}</h2>
                  <p>{concept.feedback ?? "已生成建模图。请以外形比例、细节清晰度和可打印结构为准。"}</p>
                  <div className="concept-actions">
                    <span className="concept-select-label">{selected ? "当前使用" : "改用这一版"}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </section>
        <section className="concept-revision" aria-label="再确认">
          <div>
            <span className="section-label">再确认</span>
            <p>可以写“机翼调高 5 到 8 度”“为船只增加船锚”“在后方增加载机空间”等；系统会与第一步固定输入混合后重新生成一张。</p>
          </div>
          <textarea
            className="text-area"
            aria-label="再确认修改描述"
            maxLength={260}
            placeholder="写下想改的局部，未提到的部分会尽量保持不变。"
            value={revisionText}
            onChange={(event) => onRevisionText(event.target.value)}
          />
          {revisionProgress ? <RevisionProgressPanel progress={revisionProgress} busy={revisionBusy} /> : null}
          <button className="button secondary" type="button" disabled={busy || revisionBusy || !selectedConcept} onClick={onRevise}>
            <Wand2 size={18} />
            {revisionBusy ? "正在重新生成..." : "重新生成确认图"}
          </button>
        </section>
        <div className="action-row">
          <button className="button secondary" type="button" onClick={onBack}>
            返回修改参数
          </button>
          <button className="button primary" type="button" disabled={revisionBusy} onClick={onCreate}>
            <Sparkles size={18} />
            {busy ? "正在提交给 Tripo..." : "使用这张图生成 STL"}
          </button>
        </div>
      </div>
    </main>
  );
}

const imageWaveDots = Array.from({ length: 84 }, (_, index) => index);

function ProgressPage({ events, busy, ready, onCancel }: { events: ModelJobEvent[]; busy: boolean; ready: boolean; onCancel: () => void }) {
  const displayBusy = busy && !ready;
  const timeline = buildModelTimeline(events, displayBusy);
  const completedEvents = events.filter((event) =>
    event.type === "tool.completed" ||
    event.type === "artifact.created" ||
    event.type === "artifact.patch" ||
    (event.type === "job.completed" && event.response?.run.status === "Ready")
  ).length;
  const failedSteps = timeline.filter((item) => item.state === "error").length;
  const activeTokens = Array.from({ length: 54 }, (_, index) => modelBuildTokens[(events.length + index * 7) % modelBuildTokens.length]);
  const pipelineStages = [
    { label: "图像提交", copy: "锁定所选概念图和打印参数。", keys: ["select_concept", "job.started"] },
    { label: "Tripo 建模", copy: "调用 Tripo image-to-model，等待外部任务返回模型资产。", keys: ["tripo_generate_model"] },
    { label: "STL 校验", copy: "下载 STL 并执行基础可打印文件校验。", keys: ["validate_stl"] },
    { label: "局部渲染与细节取样", copy: "3D 渲染过程中同步准备局部视角，模型拆解图会和 STL 一起进入检查台。", keys: ["artifact.created", "save_run"] }
  ];

  return (
    <main className="progress-page">
      <section className="progress-stack">
        <div className="progress-preview workspace-breathing" aria-label="AI 工作区呼吸预览">
          <div className="image-wave-field" aria-hidden="true">
            {imageWaveDots.map((dot) => (
              <span key={dot} style={{ animationDelay: `${(dot % 12) * 0.08 + Math.floor(dot / 12) * 0.05}s` }} />
            ))}
          </div>
          <div className="image-wave-core" aria-hidden="true">
            <span />
            <span />
            <span />
            <i />
          </div>
        </div>
        <div className="progress-copy">
          <h1>正在生成 STL 模型</h1>
          <p>这里显示真实任务事件：外部工具调用、STL 校验、文件保存和产物创建。Tripo 运行中会保持连接，不展示无法验证的精确百分比。</p>
        </div>
        <div className="segmented-progress event-summary" role="status" aria-live="polite">
          <div className="metric-row">
            <span className="section-label">真实任务进度</span>
            <strong className="mono">{completedEvents} 个事件完成</strong>
          </div>
          <div className={displayBusy ? "event-pulse-track active" : failedSteps ? "event-pulse-track error" : "event-pulse-track done"} aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <p>{failedSteps ? "检测到失败事件，请查看日志详情。" : displayBusy ? "任务正在运行，等待下一个工具事件。" : "任务事件已收束。"}</p>
        </div>
        <section className="render-pipeline" aria-label="模型生成阶段">
          {pipelineStages.map((stage, index) => {
            const state = getPipelineState(events, stage.keys, displayBusy, index);
            return (
              <article className={`pipeline-step ${state}`} key={stage.label}>
                <span className="pipeline-index">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{stage.label}</strong>
                  <p>{stage.copy}</p>
                </div>
              </article>
            );
          })}
        </section>
        <div className="system-log">
          <div className="log-head">
            <div className="spec-title">
              <Terminal size={18} />
              生成日志
            </div>
            <span>{displayBusy ? "event stream connected" : "complete"}</span>
          </div>
          <div className="token-stream" aria-label="活跃任务词元">
            {activeTokens.map((token, index) => (
              <span key={`${token}-${index}`} style={{ animationDelay: `${(index % 10) * 0.08}s` }}>
                {token}
              </span>
            ))}
          </div>
          <div className="log-lines progress-events" role="log" aria-live="polite" aria-label="最近生成日志">
            {timeline.map((log, index) => {
              const latest = index === timeline.length - 1;
              return (
                <div className={latest ? `log-line progress-event latest ${log.state}` : `log-line progress-event ${log.state}`} key={log.id}>
                  <span>[{log.tag}]</span>
                  <span>{log.message}</span>
                  <em>{log.detail}</em>
                </div>
              );
            })}
          </div>
        </div>
        <button className="button secondary" type="button" onClick={onCancel}>
          继续等待
        </button>
      </section>
    </main>
  );
}

function DownloadPage({ run, stlHref, onNew, onBack }: { run: ModelRun | null; stlHref: string; onNew: () => void; onBack: () => void }) {
  if (!run) return <MissingRunPage onBack={onBack} />;
  const dimensions = getModelDimensions(run.input.targetLengthMm);
  const inspection = getInspectionProfile(run.input.category, dimensions);
  const [activeView, setActiveView] = useState<DetailRenderView>(inspection.renders[0]?.view ?? "front");
  const activeRender = inspection.renders.find((render) => render.view === activeView) ?? inspection.renders[0];

  return (
    <main className="result-page">
      <section className="success-card">
        <div className="success-view">
          <div className="inspection-toolbar" aria-label="检查台视角">
            <span>STL 几何预览</span>
            {inspection.renders.map((render) => (
              <button className="view-chip" key={render.view} type="button" aria-pressed={activeView === render.view} onClick={() => setActiveView(render.view)}>
                {viewLabel(render.view)}
              </button>
            ))}
          </div>
          <ModelViewer category={run.input.category} primaryColor={run.input.primaryColor} accentColor={run.input.accentColor} status="Ready" stlUrl={stlHref} dimensions={dimensions} viewMode={activeView} />
          <div className="inspection-readout" aria-label="模型读数">
            <span>{`${dimensions.length}mm X-axis`}</span>
            <span>{activeRender?.label ?? "局部视图"}</span>
          </div>
        </div>
        <aside className="inspection-panel">
          <div className="inspection-head">
            <div className="success-icon">
              <CheckCircle2 size={34} />
            </div>
            <div>
              <h1>模型检查台</h1>
              <p>当前显示的是 STL 几何预览，不是概念图材质还原。预览色只是单色检查材质，不代表 STL 自带颜色。</p>
            </div>
          </div>
          <div className="inspection-section fidelity-note">
            <h2>概念图仅作建模参考</h2>
            <p>最终 STL 只保留可打印网格，不包含概念图里的贴图、车窗材质、轮胎黑色、标志文字色彩或真实 PBR 材质。想在 3D 打印时接近效果图，可以后期喷涂、贴水贴纸，或改走 GLB/PBR 与多材料打印通道。</p>
          </div>
          <div className="spec-grid">
            <Spec icon={<Ruler size={18} />} label="尺寸 (X, Y, Z)" value={`${dimensions.length} x ${dimensions.width} x ${dimensions.height} mm`} />
            <Spec icon={<Clock size={18} />} label="预计打印时长" value={inspection.printTime} />
            <Spec icon={<Sparkles size={18} />} label="输出格式" value="STL geometry only" />
            <Spec icon={<Box size={18} />} label="runId" value={run.runId.slice(0, 8)} />
          </div>
          <section className="inspection-section">
            <h2>局部渲染样张</h2>
            <div className="detail-render-grid">
              {inspection.renders.map((render) => (
                <button className={activeView === render.view ? "detail-render-card active" : "detail-render-card"} key={render.label} type="button" aria-pressed={activeView === render.view} onClick={() => setActiveView(render.view)}>
                  <div className={`detail-render ${render.view}`} aria-hidden="true">
                    <span className="detail-body" />
                    <span className="detail-marker" />
                    <span className="detail-ruler" />
                  </div>
                  <strong>{render.label}</strong>
                  <span>{render.note}</span>
                </button>
              ))}
            </div>
            <p className="inspection-current" role="status" aria-label="当前局部渲染">
              当前查看：<strong>{activeRender?.label}</strong>，{activeRender?.note}
            </p>
          </section>
          <section className="inspection-section">
            <h2>打印建议</h2>
            <ul className="print-advice">
              {inspection.advice.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          <div className="action-row">
            <a className="button primary" href={stlHref}>
              <Download size={19} />
              下载 STL 文件
            </a>
            <button className="button secondary" type="button" onClick={onNew}>
              再做一版
            </button>
          </div>
        </aside>
      </section>
    </main>
  );
}

function FailedPage({ run, isLoading = false, onRetry, onBack }: { run: ModelRun | null; isLoading?: boolean; onRetry: () => void; onBack: () => void }) {
  const reasons = isLoading ? [] : run?.reasons ?? ["模型生成失败，后端未返回更详细的错误。"];
  const failure = summarizeModelFailure(reasons);
  return (
    <main className="failed-page">
      <section className="failure-card">
        <div className="failure-icon">
          <AlertTriangle size={34} />
        </div>
        <h1>{failure.title}</h1>
        <p>{failure.action}</p>
        {reasons.length ? (
          <>
            <span className="section-label">原始错误</span>
            <pre className="error-log">{reasons.map((reason, index) => `[${index + 1}] ${reason}`).join("\n")}</pre>
          </>
        ) : null}
        <div className="action-row">
          <button className="button secondary" type="button" onClick={onRetry}>
            调整参数重试
          </button>
          <button className="button primary" type="button" onClick={onBack}>
            返回参数页
          </button>
        </div>
      </section>
    </main>
  );
}

function MissingRunPage({ runId, onBack }: { runId?: string; onBack: () => void }) {
  return (
    <main className="download-missing">
      <section className="missing-card">
        <h1>找不到这次生成</h1>
        <p>{runId ? `runId ${runId} 不存在或已被清理。` : "下载页需要一个可恢复的 runId。"}</p>
        <button className="button primary" type="button" onClick={onBack}>
          回到参数页
        </button>
      </section>
    </main>
  );
}

type UtilityRouteName = "files" | "settings" | "help" | "profile" | "history" | "storage" | "invite";

function UtilityPage({
  routeName,
  historyEntries,
  membership,
  supabaseSyncState,
  onBack,
  onUpgrade
}: {
  routeName: UtilityRouteName;
  historyEntries: LocalHistoryEntry[];
  membership: MembershipSnapshot;
  supabaseSyncState: ReturnType<typeof getSupabaseSyncState>;
  onBack: () => void;
  onUpgrade: (plan: "free" | "pro") => void;
}) {
  if (routeName === "history") return <HistoryPage entries={historyEntries} onBack={onBack} />;
  if (routeName === "storage") return <StoragePage entries={historyEntries} membership={membership} supabaseSyncState={supabaseSyncState} onBack={onBack} onUpgrade={onUpgrade} />;
  if (routeName === "invite") return <InvitePage onBack={onBack} />;

  const content = utilityRouteContent[routeName];
  return (
    <main className="utility-page">
      <section className="utility-panel">
        <div className="utility-icon">{content.icon}</div>
        <div>
          <span className="section-label" role="heading" aria-level={2}>{content.kicker}</span>
          <h1>{content.title}</h1>
          <p>{content.copy}</p>
        </div>
        <div className="utility-list">
          {content.items.map((item) => (
            <div key={item}>
              <CheckCircle2 size={16} />
              <span>{item}</span>
            </div>
          ))}
        </div>
        <div className="action-row">
          <button className="button primary" type="button" onClick={onBack}>
            回到参数页
          </button>
        </div>
      </section>
    </main>
  );
}

function HistoryPage({ entries, onBack }: { entries: LocalHistoryEntry[]; onBack: () => void }) {
  const latest = entries[0];
  return (
    <main className="utility-page history-workspace">
      <section className="utility-panel wide">
        <div className="utility-icon">
          <History size={30} />
        </div>
        <div>
          <span className="section-label">Local history</span>
          <h1>本地历史</h1>
          <p>每次生成概念图、生成 STL 或手动保存，都会追加到当前浏览器的历史记录里。</p>
        </div>
        <div className="history-summary">
          <Spec icon={<Database size={18} />} label="本地快照" value={`${entries.length} 条`} />
          <Spec icon={<Clock size={18} />} label="最近更新" value={latest ? formatLocalTime(latest.updatedAt) : "暂无"} />
          <Spec icon={<ShieldCheck size={18} />} label="保存策略" value="本地优先" />
        </div>
        {entries.length ? (
          <div className="history-list" aria-label="本地生成历史">
            {entries.map((entry) => (
              <article className="history-card" key={entry.id}>
                <div className="history-thumb">{entry.previewImageUrl ? <img alt="" src={entry.previewImageUrl} /> : <Box size={22} />}</div>
                <div>
                  <div className="history-card-head">
                    <strong>{entry.title}</strong>
                    <span>{historyStatusLabel(entry.status)}</span>
                  </div>
                  <p>{entry.input.description}</p>
                  <div className="history-meta">
                    <span>{entry.label}</span>
                    <span>{entry.input.targetLengthMm} mm</span>
                    <span>{entry.runId ?? "local-only"}</span>
                    <span>{formatLocalTime(entry.updatedAt)}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Clock size={24} />
            <strong>暂无生成历史</strong>
            <span>生成概念图或点击保存配置后，这里会出现第一条记录。</span>
          </div>
        )}
        <BackRow onBack={onBack} />
      </section>
    </main>
  );
}

function StoragePage({
  entries,
  membership,
  supabaseSyncState,
  onBack,
  onUpgrade
}: {
  entries: LocalHistoryEntry[];
  membership: MembershipSnapshot;
  supabaseSyncState: ReturnType<typeof getSupabaseSyncState>;
  onBack: () => void;
  onUpgrade: (plan: "free" | "pro") => void;
}) {
  const isPro = membership.plan === "pro";
  return (
    <main className="utility-page storage-workspace">
      <section className="utility-panel wide">
        <div className="utility-icon">
          <Database size={30} />
        </div>
        <div>
          <span className="section-label">Local storage</span>
          <h1>本地存储</h1>
          <p>先保证浏览器本地历史可靠，再用 Supabase 做可选云同步。</p>
        </div>
        <div className="storage-status-grid">
          <Spec icon={<Database size={18} />} label="本地已保存" value={`${entries.length} 个项目快照`} />
          <Spec icon={<ShieldCheck size={18} />} label="当前版本" value={isPro ? "Pro" : "Free"} />
          <Spec icon={<Link size={18} />} label="Supabase" value={supabaseSyncState === "ready" ? "已绑定" : "未配置"} />
        </div>
        <section className="plan-grid" aria-label="会员订阅">
          <PlanCard active={!isPro} title="Free" price="¥0" items={["保留最近 10 条本地历史", "手动保存配置", "当前浏览器内可恢复"]} actionLabel={isPro ? "切回 Free" : "当前方案"} disabled={!isPro} onClick={() => onUpgrade("free")} />
          <PlanCard active={isPro} title="Pro" price="¥29/月" items={["保留最近 30 条生成记录", "Supabase 云同步准备", "优先展示 STL 交付记录"]} actionLabel={isPro ? "已启用 Pro" : "升级 Pro"} disabled={isPro} onClick={() => onUpgrade("pro")} />
        </section>
        <div className="supabase-panel">
          <div>
            <span className="section-label">Supabase binding</span>
            <strong>{supabaseSyncState === "ready" ? "前端 publish key 已绑定" : "等待环境变量"}</strong>
          </div>
          <p>已按 publish key 接入 REST 同步；如果 toybox_history 表或 RLS 还没开放，生成记录仍会稳定落到本地历史。</p>
        </div>
        <BackRow onBack={onBack} />
      </section>
    </main>
  );
}

function PlanCard({ active, title, price, items, actionLabel, disabled, onClick }: { active: boolean; title: string; price: string; items: string[]; actionLabel: string; disabled: boolean; onClick: () => void }) {
  return (
    <article className={active ? "plan-card active" : "plan-card"}>
      <div>
        <span className="section-label">{title}</span>
        <strong>{price}</strong>
      </div>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <button className="button primary" disabled={disabled} type="button" onClick={onClick}>
        {actionLabel}
      </button>
    </article>
  );
}

function InvitePage({ onBack }: { onBack: () => void }) {
  const inviteCode = "LUSIE-PILOT";
  const inviteLink = `${window.location.origin}/?ref=${inviteCode}`;
  const [copied, setCopied] = useState(false);

  async function copyInviteLink() {
    await navigator.clipboard?.writeText(inviteLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main className="utility-page invite-workspace">
      <section className="utility-panel wide">
        <div className="utility-icon">
          <Users size={30} />
        </div>
        <div>
          <span className="section-label">Invite alliance</span>
          <h1>邀请联盟</h1>
          <p>复刻轻量 Typeless 邀请模式：一个邀请码、一条邀请链接、清晰的奖励阶梯和可追踪状态。</p>
        </div>
        <div className="invite-hero">
          <div>
            <span className="section-label">Your code</span>
            <strong>{inviteCode}</strong>
            <p>{inviteLink}</p>
          </div>
          <button className="button primary" type="button" onClick={copyInviteLink}>
            <Copy size={17} />
            {copied ? "已复制" : "复制链接"}
          </button>
        </div>
        <div className="invite-grid">
          {[
            ["1 位好友", "解锁 Pro 试用 3 天"],
            ["3 位好友", "额外增加 20 条云同步额度"],
            ["10 位好友", "进入创作者联盟名单"]
          ].map(([title, copy]) => (
            <article className="invite-tier" key={title}>
              <strong>{title}</strong>
              <span>{copy}</span>
            </article>
          ))}
        </div>
        <section className="invite-ledger" aria-label="邀请记录">
          {[
            ["等待邀请", "复制链接发给第一位用户"],
            ["注册归因", "通过 ref 参数绑定邀请来源"],
            ["奖励发放", "达成阶梯后升级本地权益"]
          ].map(([title, copy]) => (
            <div key={title}>
              <CheckCircle2 size={16} />
              <span>
                <strong>{title}</strong>
                <small>{copy}</small>
              </span>
            </div>
          ))}
        </section>
        <BackRow onBack={onBack} />
      </section>
    </main>
  );
}

function BackRow({ onBack }: { onBack: () => void }) {
  return (
    <div className="action-row">
      <button className="button primary" type="button" onClick={onBack}>
        回到参数页
      </button>
    </div>
  );
}

function Spec({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="spec-card">
      <div className="spec-title">
        {icon}
        {label}
      </div>
      <strong>{value}</strong>
    </div>
  );
}

function StatusMessages({ toast, alert }: { toast: { tone: ToastTone; message: string } | null; alert: string | null }) {
  return (
    <div className="status-region">
      {alert ? (
        <div className="toast error" role="alert">
          {alert}
        </div>
      ) : null}
      {toast ? (
        <div className={toast.tone === "error" ? "toast error" : "toast"} role="status">
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}

const utilityRouteContent: Record<Exclude<UtilityRouteName, "history" | "storage" | "invite">, { icon: ReactNode; kicker: string; title: string; copy: string; items: string[] }> = {
  files: {
    icon: <FileDown size={30} />,
    kicker: "文件中枢",
    title: "把灵感收拢成可交付文件",
    copy: "保存配置、追踪 runId、导出 STL。这里管的是项目资产，不打断当前生成流程。",
    items: ["配置快照写入本地浏览器", "STL 就绪后可直接下载", "下载页可按 runId 自动恢复"]
  },
  settings: {
    icon: <Settings size={30} />,
    kicker: "系统设置",
    title: "让生成链路保持可控",
    copy: "OpenAI 图片生成、Tripo 建模状态、生成偏好和本地缓存都在这里管理。",
    items: ["OpenAI 图片生成", "Tripo 3D 生成", "Supabase 可选同步"]
  },
  help: {
    icon: <HelpCircle size={30} />,
    kicker: "提问中心",
    title: "问清楚，再把模型做出来",
    copy: "把模糊需求拆成可生成、可比较、可下载的工作流。",
    items: ["界面功能介绍", "AI 生成逻辑介绍", "从想法到可打印 STL 的工作流介绍"]
  },
  profile: {
    icon: <Box size={30} />,
    kicker: "个人空间",
    title: "创作者工作台",
    copy: "这里承载本地身份、最近项目和生成偏好。",
    items: ["用户标识：Lusie", "本地项目快照", "会员状态保存在当前浏览器"]
  }
};

function isUtilityRoute(routeName: RouteName): routeName is UtilityRouteName {
  return ["files", "settings", "help", "profile", "history", "storage", "invite"].includes(routeName);
}

function getTargetLengthError(targetLengthMm: number) {
  if (!Number.isFinite(targetLengthMm) || targetLengthMm < targetLengthLimitsMm.min || targetLengthMm > targetLengthLimitsMm.max) {
    return `外接盒 X 轴尺寸需在 ${targetLengthLimitsMm.min}-${targetLengthLimitsMm.max} mm 内。`;
  }
  return null;
}

function getModelDimensions(length: number) {
  return {
    length,
    width: Math.round(length * 0.46),
    height: Math.round(length * 0.32)
  };
}

function viewLabel(view: DetailRenderView) {
  const labels: Record<DetailRenderView, string> = {
    front: "正视",
    side: "侧视",
    top: "俯视",
    joint: "连接位"
  };
  return labels[view];
}

function getInspectionProfile(category: ModelCategory, dimensions: ReturnType<typeof getModelDimensions>): InspectionProfile {
  const sharedAdvice = [
    "下载后先在切片软件里检查非流形边、孤立壳体和过薄区域。",
    `建议先按 ${dimensions.length}mm 长度打印小样，确认支撑和细节比例后再放大。`,
    "先按单色 STL 打印几何体，再通过打磨、底漆、遮盖喷涂和手涂细节还原效果图配色。"
  ];

  if (category === "aircraft") {
    return {
      printTime: "约 4h 40m @ 0.2mm",
      renders: [
        { label: "正视轮廓", note: "检查机翼展开和机身对称", view: "front" },
        { label: "侧视姿态", note: "确认鼻锥、尾段和落地角度", view: "side" },
        { label: "俯视比例", note: "核对主翼、尾翼和中轴线", view: "top" },
        { label: "连接位", note: "重点看翼根、起落架和短舱", view: "joint" }
      ],
      advice: [
        ...sharedAdvice,
        "飞行器建议斜放或机腹朝下，减少翼尖悬空并保护机鼻细节。"
      ]
    };
  }

  if (category === "ship") {
    return {
      printTime: "约 5h 10m @ 0.2mm",
      renders: [
        { label: "正视轮廓", note: "检查船首、舰桥和高度层级", view: "front" },
        { label: "侧视水线", note: "确认船底平整和展示站姿", view: "side" },
        { label: "俯视甲板", note: "核对甲板设备是否连成整体", view: "top" },
        { label: "连接位", note: "重点看桅杆、桥楼和薄片结构", view: "joint" }
      ],
      advice: [
        ...sharedAdvice,
        "舰船建议船底朝下打印，桥楼区域使用轻支撑，拆支撑时从甲板边缘开始。"
      ]
    };
  }

  return {
    printTime: "约 4h 15m @ 0.2mm",
    renders: [
      { label: "正视轮廓", note: "检查车宽、前脸和轮距", view: "front" },
      { label: "侧视姿态", note: "确认车顶、座舱和尾翼比例", view: "side" },
      { label: "俯视比例", note: "核对车身中轴和四角外扩", view: "top" },
      { label: "连接位", note: "重点看轮拱、尾翼支架和防护件", view: "joint" }
    ],
    advice: [
      ...sharedAdvice,
      "车辆建议底盘朝下打印，轮拱内侧使用可拆支撑，前后防护件适当提高填充率。"
    ]
  };
}

function historyStatusLabel(status: LocalHistoryEntry["status"]) {
  const labels: Record<LocalHistoryEntry["status"], string> = {
    saved: "已保存",
    concept: "概念图",
    ready: "STL 就绪",
    failed: "生成失败"
  };
  return labels[status];
}

function formatLocalTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未知";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function replacePath(path: string) {
  window.history.replaceState({}, "", path);
}
