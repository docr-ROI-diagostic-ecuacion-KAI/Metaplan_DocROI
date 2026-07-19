import { MouseEvent, PointerEvent as ReactPointerEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, { Background, ConnectionMode, Controls, EdgeLabelRenderer, EdgeProps, Handle, NodeProps, NodeResizer, PanOnScrollMode, Panel, Position, useReactFlow } from "reactflow";
import { ArrowRight, CheckCircle2, Download, Eye, FileSpreadsheet, Hand, Maximize, Menu, MousePointer2, Plus, Printer, RotateCcw, RotateCw, Save, Share2, SquarePlus, Trash2 } from "lucide-react";
import { DndContext, DragEndEvent, useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import * as htmlToImage from "html-to-image";
import * as XLSX from "xlsx";
import { academicTabs } from "./data";
import { applyFlowEdgeChanges, applyFlowNodeChanges, toFlowEdges, toFlowNodes, useAppStore } from "./store";
import { Entity, MacroprocessType, Process, ProcessMapCategory } from "./types";

const logoUrl = "/assets/docroi-logo.jpg";
const nodeTypes = { entityNode: EntityNode };
const edgeTypes = { processEdge: ProcessEdge };
type LabView = "metaplan" | "inventory" | "map";
type CanvasTool = "select" | "move" | "entity" | "relation";
type EntityDialogState = { open: boolean; position: { x: number; y: number }; primary: boolean; nearId?: string };
type RelationDraft = { sourceId: string; targetId: string; direction: "source-target" | "target-source" | "bidirectional"; name: string; reverseName: string; macroprocessType: MacroprocessType };

const macroprocessOptions: { value: MacroprocessType; label: string }[] = [
  { value: "strategic", label: "Procesos estratégicos" },
  { value: "core", label: "Procesos clave / operativos / negocio" },
  { value: "support", label: "Procesos de apoyo / soporte" }
];

export function App() {
  const store = useAppStore();
  const flow = useReactFlow();
  const [activeTab, setActiveTab] = useState(0);
  const [labView, setLabView] = useState<LabView>("metaplan");
  const [entityDialog, setEntityDialog] = useState<EntityDialogState>({ open: false, position: { x: 420, y: 260 }, primary: true });
  const [entityName, setEntityName] = useState("");
  const [entityType, setEntityType] = useState("Área interna");
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [relationDraft, setRelationDraft] = useState<RelationDraft | null>(null);
  const [toast, setToast] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const [demoGuide, setDemoGuide] = useState(false);
  const [tool, setTool] = useState<CanvasTool>("select");
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [pendingConnection, setPendingConnection] = useState<string | null>(null);
  const pendingConnectionRef = useRef<string | null>(null);
  const navCloseTimerRef = useRef<number | null>(null);
  const headerMenuRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const labRef = useRef<HTMLDivElement>(null);
  const moduleContainerRef = useRef<HTMLDivElement>(null);
  const moduleTitleRef = useRef<HTMLHeadingElement>(null);
  const metaplanRef = useRef<HTMLDivElement>(null);
  const exportFrameRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  const openAcademicTab = (index: number) => {
    setActiveTab(index);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  useEffect(() => {
    store.hydrate();
  }, []);

  useEffect(() => {
    const openInspector = () => setRightPanelOpen(true);
    window.addEventListener("docroi:open-inspector", openInspector);
    return () => window.removeEventListener("docroi:open-inspector", openInspector);
  }, []);

  const nodes = useMemo(() => toFlowNodes(store.entities, store.selectedEntityId), [store.entities, store.selectedEntityId, store.processes]);
  const edges = useMemo(() => toFlowEdges(store.processes, store.selectedProcessId), [store.processes, store.selectedProcessId]);
  const selectedEntity = store.entities.find((entity) => entity.id === store.selectedEntityId) ?? null;
  const selectedProcess = store.processes.find((process) => process.id === store.selectedProcessId) ?? null;
  const progress = getProgress(store.entities, store.processes);

  const cancelNavClose = () => {
    if (navCloseTimerRef.current) {
      window.clearTimeout(navCloseTimerRef.current);
      navCloseTimerRef.current = null;
    }
  };

  const scheduleNavClose = () => {
    cancelNavClose();
    navCloseTimerRef.current = window.setTimeout(() => {
      setNavOpen(false);
      navCloseTimerRef.current = null;
    }, 1500);
  };

  const goToSection = (target: "top" | "formation" | "transition" | "lab" | "results-title") => {
    cancelNavClose();
    setNavOpen(false);
    if (target === "top") {
      window.history.replaceState(null, "", window.location.pathname);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const goToLabBlock = (view: LabView) => {
    cancelNavClose();
    setLabView(view);
    setNavOpen(false);
    requestAnimationFrame(() => {
      labRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  useEffect(() => {
    requestAnimationFrame(() => {
      moduleContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      moduleTitleRef.current?.focus({ preventScroll: true });
    });
  }, [labView]);

  useEffect(() => () => cancelNavClose(), []);

  useEffect(() => {
    if (!navOpen) return;
    const handlePointerMove = (event: PointerEvent) => {
      const box = headerMenuRef.current?.getBoundingClientRect();
      if (!box) return;
      const inside = event.clientX >= box.left - 8 && event.clientX <= box.right + 8 && event.clientY >= box.top - 8 && event.clientY <= box.bottom + 8;
      if (inside) cancelNavClose();
      else scheduleNavClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [navOpen]);

  useEffect(() => {
    const element = metaplanRef.current;
    if (!element || labView !== "metaplan") return;
    const onWheel = (event: WheelEvent) => {
      const target = document.elementFromPoint(event.clientX, event.clientY);
      if (!target?.closest(".free-canvas")) return;
      event.preventDefault();
      event.stopPropagation();
      const viewport = flow.getViewport();
      if (event.ctrlKey || event.metaKey) {
        const zoom = Math.min(1.6, Math.max(0.4, viewport.zoom - event.deltaY * 0.0015));
        flow.zoomTo(zoom, { duration: 80 });
        return;
      }
      const deltaX = event.shiftKey ? event.deltaY : event.deltaX;
      const deltaY = event.shiftKey ? 0 : event.deltaY;
      flow.setViewport({ x: viewport.x - deltaX, y: viewport.y - deltaY, zoom: viewport.zoom }, { duration: 0 });
    };
    window.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => window.removeEventListener("wheel", onWheel, { capture: true });
  }, [flow, labView]);

  const openEntityDialog = (position = { x: 420, y: 260 }, primary = store.entities.length === 0, nearId?: string) => {
    setToast("");
    setEntityName("");
    setEntityType(primary ? "Área interna" : "Otra");
    setEntityDialog({ open: true, position, primary, nearId });
  };

  const createEntityFromDialog = () => {
    if (!entityName.trim()) return;
    const near = store.entities.find((entity) => entity.id === entityDialog.nearId);
    const position = near ? { x: near.position.x + 310, y: near.position.y + 30 } : entityDialog.position;
    store.addEntity(position);
    setTimeout(() => {
      const created = useAppStore.getState().entities.at(-1);
      if (!created) return;
      store.updateEntity(created.id, { name: entityName.trim(), type: entityType, isPrimary: entityDialog.primary });
      if (entityDialog.primary) store.setPrimaryEntity(created.id);
      setToast(entityDialog.primary ? "Entidad principal creada. Ahora identifica con quién se relaciona." : "Entidad añadida. Puedes conectarla desde el mapa.");
      flow.setCenter(position.x + 95, position.y + 45, { zoom: 1, duration: 260 });
    }, 0);
    setEntityDialog((current) => ({ ...current, open: false }));
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (event.key === "Escape") {
        setConnectFrom(null);
        setRelationDraft(null);
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && event.shiftKey) {
        event.preventDefault();
        store.redo();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        store.undo();
      } else if (event.key.toLowerCase() === "n") {
        openEntityDialog({ x: 360 + Math.random() * 180, y: 220 + Math.random() * 120 }, store.entities.length === 0, store.selectedEntityId ?? undefined);
      } else if (event.key.toLowerCase() === "f") {
        flow.fitView({ padding: 0.25, duration: 220 });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [flow, store, store.entities.length, store.selectedEntityId]);

  const handleNodeClick = (nodeId: string) => {
    if (connectFrom && connectFrom !== nodeId) {
      setToast("");
      setRelationDraft({ sourceId: connectFrom, targetId: nodeId, direction: "source-target", name: "", reverseName: "", macroprocessType: "core" });
      setConnectFrom(null);
      return;
    }
    setRightPanelOpen(true);
    store.selectEntity(nodeId);
  };

  const createRelation = () => {
    if (!relationDraft || !relationDraft.name.trim()) return;
    const sourceId = relationDraft.direction === "target-source" ? relationDraft.targetId : relationDraft.sourceId;
    const targetId = relationDraft.direction === "target-source" ? relationDraft.sourceId : relationDraft.targetId;
    store.addProcess(sourceId, targetId, relationDraft.name.trim());
    setTimeout(() => {
      const created = useAppStore.getState().processes.at(-1);
      if (created) store.updateProcess(created.id, {
        status: "partial",
        macroprocessType: relationDraft.macroprocessType,
        direction: relationDraft.direction === "bidirectional" ? "bidirectional" : "unidirectional",
        description: relationDraft.direction === "bidirectional" && relationDraft.reverseName.trim()
          ? `Sentido inverso: ${relationDraft.reverseName.trim()}`
          : created.description
      });
      store.selectEntity(targetId);
      setToast(`Proceso ${created?.displayOrder ?? ""} creado: ${relationDraft.name.trim()}. ¿Qué ocurre después?`);
    }, 0);
    setRelationDraft(null);
  };

  const draftConnection = (sourceId?: string | null, targetId?: string | null) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    setRelationDraft({ sourceId, targetId, direction: "source-target", name: "", reverseName: "", macroprocessType: "core" });
    setConnectFrom(null);
    setPendingConnection(null);
    pendingConnectionRef.current = null;
  };

  const saveProject = () => {
    localStorage.setItem("docroi-ingenieria-visual-procesos", JSON.stringify(snapshotStore(store)));
    setToast("Proyecto guardado en este equipo.");
  };

  const clearCanvas = () => {
    if (!window.confirm("Se borrarán todas las entidades, relaciones y fases del lienzo actual. ¿Quieres empezar de cero?")) return;
    store.reset();
    setTool("select");
    setLabView("metaplan");
    setToast("Lienzo limpio. Puedes empezar un nuevo Metaplan.");
  };

  const loadGuidedExample = () => {
    store.loadDemo();
    setDemoGuide(true);
    setLabView("metaplan");
    setToast("Ejemplo cargado paso a paso: Unidad/Proyectos, Comunicación, proveedores, canales y audiencia.");
    setTimeout(() => flow.fitView({ padding: 0.16, duration: 400 }), 120);
  };

  const importJson = async (file: File | null) => {
    if (!file) return;
    store.importProject(JSON.parse(await file.text()));
    setToast("Proyecto cargado. Puedes seguir editándolo en el mapa.");
  };

  const exportJson = () => downloadFile("docroi-metaplan-project.json", JSON.stringify(snapshotStore(store), null, 2), "application/json");
  const exportCsv = () => downloadFile("docroi-inventario-procesos.csv", toCsv(store), "text/csv");
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["README"], ["Ingeniería Visual de Procesos · Doc ROI"], ["RASCI_INPUT queda preparado sin asignar R, A, S, C ni I."]]), "README");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(store.entities), "ENTIDADES");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(enrichedProcesses(store)), "PROCESOS");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(store.valueChainStages), "CADENA_VALOR");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["process_id", "proceso", "supplier", "customer", "R", "A", "S", "C", "I"], ...enrichedProcesses(store).map((p) => [p.id, p.name, p.supplier, p.customer, "", "", "", "", ""])]), "RASCI_INPUT");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ schemaVersion: store.schemaVersion, exportedAt: new Date().toISOString() }]), "METADATA");
    XLSX.writeFile(wb, "docroi-procesos.xlsx");
  };
  const exportPng = async (kind: "metaplan" | "map") => {
    const element = kind === "metaplan" ? metaplanRef.current : mapRef.current;
    if (!element) return;
    const dataUrl = await htmlToImage.toPng(element, { cacheBust: true, backgroundColor: "#ffffff" });
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = kind === "metaplan" ? "docroi-metaplan.png" : "docroi-mapa-procesos.png";
    link.click();
  };

  const createCanvasSheet = async () => {
    if (!exportFrameRef.current) return null;
    const canvasImage = await htmlToImage.toPng(exportFrameRef.current, {
      cacheBust: true,
      backgroundColor: "#ffffff",
      pixelRatio: 2,
      filter: (node) => !(node instanceof HTMLElement && node.classList.contains("canvas-export-actions"))
    });
    const sheet = document.createElement("div");
    sheet.className = "export-sheet";
    sheet.innerHTML = `
      <header>
        <img src="${logoUrl}" alt="DocROI" />
        <strong>${escapeHtml(store.project.name || "Metaplan DocROI")}</strong>
      </header>
      <main>
        <img src="${canvasImage}" alt="Metaplan exportado" />
      </main>
    `;
    document.body.appendChild(sheet);
    try {
      return await htmlToImage.toPng(sheet, {
        cacheBust: true,
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        width: 1600,
        height: 1000
      });
    } finally {
      sheet.remove();
    }
  };

  const openPrintableCanvas = async (mode: "print" | "pdf") => {
    const sheetImage = await createCanvasSheet();
    if (!sheetImage) return;
    const printWindow = window.open("", "_blank", "width=1200,height=820");
    if (!printWindow) {
      downloadDataUrl("docroi-metaplan-lamina.png", sheetImage);
      setToast("No se pudo abrir la ventana de impresión. He descargado la imagen.");
      return;
    }
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${mode === "pdf" ? "PDF" : "Imprimir"} · ${escapeHtml(store.project.name || "Metaplan DocROI")}</title>
          <style>
            @page { size: A4 landscape; margin: 8mm; }
            * { box-sizing: border-box; }
            body { margin: 0; background: #fff; }
            img { display: block; width: 100%; height: auto; }
          </style>
        </head>
        <body><img src="${sheetImage}" alt="Metaplan DocROI" /></body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => printWindow.print();
  };

  const shareCanvasImage = async () => {
    const sheetImage = await createCanvasSheet();
    if (!sheetImage) return;
    const blob = await (await fetch(sheetImage)).blob();
    const file = new File([blob], "docroi-metaplan.png", { type: "image/png" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: store.project.name, text: "Metaplan DocROI", files: [file] });
      return;
    }
    downloadDataUrl("docroi-metaplan.png", sheetImage);
    setToast("Imagen preparada para compartir.");
  };

  const alignSelection = (mode: "left" | "top") => {
    const selected = store.entities.find((entity) => entity.id === store.selectedEntityId);
    if (!selected) return;
    const value = mode === "left" ? selected.position.x : selected.position.y;
    store.entities
      .filter((entity) => entity.id !== selected.id && Math.abs((mode === "left" ? entity.position.x : entity.position.y) - value) < 120)
      .forEach((entity) => store.updateEntity(entity.id, { position: mode === "left" ? { ...entity.position, x: value } : { ...entity.position, y: value } }));
  };

  const distributeEntities = () => {
    const ordered = [...store.entities].sort((a, b) => a.position.x - b.position.x);
    if (ordered.length < 3) return;
    const min = ordered[0].position.x;
    const max = ordered[ordered.length - 1].position.x;
    const step = (max - min) / (ordered.length - 1);
    ordered.forEach((entity, index) => store.updateEntity(entity.id, { position: { ...entity.position, x: min + step * index } }));
  };

  return (
    <div className="app-shell" id="top">
      <header className={navOpen ? "global-header nav-open" : "global-header"}>
        <a className="brand-link" href="https://doc-roi-executive.vercel.app/" aria-label="Ir a DocROI Executive">
          <img src={logoUrl} alt="DocROI" />
        </a>
        <nav className="primary-nav" aria-label="Navegación principal">
          <button type="button" onClick={() => goToSection("formation")}>Consulta</button>
          <button type="button" onClick={() => goToSection("lab")}>Tratamiento</button>
        </nav>
        <div ref={headerMenuRef} className="header-menu" onMouseEnter={cancelNavClose} onMouseLeave={scheduleNavClose} onFocus={cancelNavClose} onBlur={scheduleNavClose}>
          <button className="menu-toggle" aria-label={navOpen ? "Cerrar menú" : "Abrir menú"} aria-expanded={navOpen} onClick={() => setNavOpen((value) => {
            const next = !value;
            if (next) cancelNavClose();
            return next;
          })}>
            <Menu size={25} strokeWidth={2.8} />
          </button>
          {navOpen && (
            <div className="nav-drawer" role="menu" aria-label="Accesos rápidos">
              <button type="button" onClick={() => goToSection("top")}>Inicio</button>
              <button type="button" onClick={() => goToSection("formation")}>Consulta formativa</button>
              <button type="button" onClick={() => goToSection("transition")}>Antes del laboratorio</button>
              <button type="button" onClick={() => goToLabBlock("metaplan")}>Mapa operativo</button>
              <button type="button" onClick={() => goToLabBlock("inventory")}>Inventario de procesos</button>
              <button type="button" onClick={() => goToLabBlock("map")}>Mapa de procesos</button>
              <button type="button" onClick={() => goToSection("results-title")}>Resultados y exportación</button>
            </div>
          )}
        </div>
      </header>

      <section className="hero-treatment">
        <div className="hero-photo" aria-hidden="true" />
        <div className="hero-grid">
          <div>
            <div className="hero-pills">
              <span>Especialidad · Transformación</span>
              <span>Unidad · Organización y procesos</span>
              <span>Píldora · BASIC</span>
            </div>
            <h1>Identifica tus procesos clave</h1>
            <strong>Ingeniería Visual de Procesos</strong>
            <p>Identifica quién participa, cómo se relaciona y qué procesos existen realmente. Construye un Metaplan visual, convierte cada conexión en un proceso gestionable y organiza el resultado dentro de un mapa de procesos.</p>
            <div className="hero-actions">
              <button className="light-btn filled" onClick={() => labRef.current?.scrollIntoView({ behavior: "smooth" })}>Iniciar tratamiento</button>
              <button className="light-btn" onClick={() => formRef.current?.scrollIntoView({ behavior: "smooth" })}>Ver cómo funciona</button>
            </div>
          </div>
          <aside className="objective-card">
            <span>Objetivo de esta píldora</span>
            <h2>Que puedas levantar una arquitectura operativa completa sin comenzar por diagramas complejos.</h2>
            <dl>
              <div><dt>Nivel</dt><dd>BASIC · C-Level / Máster</dd></div>
              <div><dt>Metodología</dt><dd>Metaplan interactivo</dd></div>
              <div><dt>Resultado</dt><dd>Mapa operativo + inventario + mapa de procesos</dd></div>
              <div><dt>Duración orientativa</dt><dd>20-40 minutos</dd></div>
            </dl>
          </aside>
        </div>
      </section>

      <main>
        <section id="formation" className="formation" ref={formRef}>
          <aside className="formation-nav">
            <span className="section-chip">Consulta formativa</span>
            {academicTabs.map((tab, index) => (
              <button key={tab.title} className={activeTab === index ? "lesson active" : "lesson"} onClick={() => openAcademicTab(index)}>
                {String(index + 1).padStart(2, "0")} · {tab.title}
              </button>
            ))}
          </aside>
          <AcademicModule activeTab={activeTab} setActiveTab={setActiveTab} openLab={() => labRef.current?.scrollIntoView({ behavior: "smooth" })} />
        </section>

        <section id="transition" className="transition">
          <span className="section-chip">Iniciar tratamiento</span>
          <h2>Construye tu mapa operativo</h2>
          <p>Comienza identificando la entidad principal. Después añade las entidades que participan, conecta sus relaciones y deja que la aplicación transforme cada interacción en un proceso gestionable.</p>
        </section>

        <section id="lab" className="lab-shell free-editor" ref={labRef}>
          <div className="editor-toolbar" role="toolbar" aria-label="Herramientas del Metaplan">
            <div className="toolbar-row toolbar-context">
              <label className="project-field">Proyecto<input value={store.project.name} onChange={(event) => store.updateProject({ name: event.target.value })} /><small>Nombra el caso de trabajo como lo presentaría un CEO o un alumno de máster.</small></label>
              <button title="Guardar proyecto en este equipo" onClick={saveProject}><Save size={16} /> Guardar</button>
              <button className="ghost-danger" title="Limpiar lienzo" onClick={clearCanvas}><Trash2 size={16} /> Limpiar lienzo</button>
              <button title="Nuevo lienzo limpio" onClick={clearCanvas}><SquarePlus size={16} /> Nuevo lienzo</button>
              <button title="Vista completa" onClick={() => flow.fitView({ padding: 0.18, duration: 220 })}><Maximize size={16} /> Vista completa</button>
              <button title="Mostrar u ocultar panel de configuración" onClick={() => setRightPanelOpen((value) => !value)}><Eye size={16} /> Panel</button>
            </div>
            <div className="toolbar-row toolbar-tools">
              <div className="tool-group"><button title="Seleccionar" className={tool === "select" ? "active" : ""} onClick={() => setTool("select")}><MousePointer2 size={16} /> Seleccionar</button><button title="Mover lienzo" className={tool === "move" ? "active" : ""} onClick={() => setTool("move")}><Hand size={16} /> Mover</button></div>
              <div className="tool-group"><button title="Entidad" className={tool === "entity" ? "active" : ""} onClick={() => setTool("entity")}><SquarePlus size={16} /> Entidad</button><button title="Relación" className={tool === "relation" ? "active" : ""} onClick={() => setTool("relation")}><ArrowRight size={16} /> Relación</button></div>
              <div className="tool-group"><button title="Deshacer" onClick={store.undo}><RotateCcw size={16} /> Deshacer</button><button title="Rehacer" onClick={store.redo}><RotateCw size={16} /> Rehacer</button><button className="danger ghost-danger" title="Eliminar selección" disabled={!selectedEntity && !selectedProcess} onClick={() => selectedEntity ? store.removeEntity(selectedEntity.id) : selectedProcess && store.removeProcess(selectedProcess.id)}><Trash2 size={15} /> Eliminar</button>{selectedEntity && <button title="Duplicar entidad" onClick={() => store.duplicateEntity(selectedEntity.id)}>Duplicar</button>}</div>
              <div className="tool-group">{selectedEntity && <button title="Alinear" onClick={() => alignSelection("left")}>Alinear</button>}<button title="Distribuir" onClick={() => distributeEntities()}>Distribuir</button></div>
              <div className="tool-group view-group"><label className="zoom-control">Zoom<input type="range" min="40" max="160" defaultValue="100" onChange={(event) => flow.zoomTo(Number(event.target.value) / 100)} /></label></div>
              {selectedProcess && <div className="tool-group contextual-group"><button title="Invertir dirección" onClick={() => store.updateProcess(selectedProcess.id, { sourceEntityId: selectedProcess.targetEntityId, targetEntityId: selectedProcess.sourceEntityId })}>Invertir</button></div>}

            </div>
          </div>
          <div className="editor-status-top"><span><CheckCircle2 size={16} /> Proyecto activo</span><span>Modo: {tool === "entity" ? "haz clic en el lienzo para colocar una entidad" : tool === "relation" ? "arrastra desde un puerto para conectar" : "manual"}</span></div>
          <div className="lab-tabs progressive-tabs" role="tablist" aria-label="Vistas del laboratorio">
            <button className={labView === "metaplan" ? "active" : ""} onClick={() => setLabView("metaplan")}>1 <span>Mapa operativo</span></button>
            <button disabled={store.processes.length === 0} className={labView === "inventory" ? "active" : ""} onClick={() => setLabView("inventory")}>2 <span>Inventario</span></button>
            <button disabled={store.processes.length === 0} className={labView === "map" ? "active" : ""} onClick={() => setLabView("map")}>3 <span>Mapa de procesos</span></button>

          </div>
          <div className="module-container" ref={moduleContainerRef}>
            <h2 ref={moduleTitleRef} tabIndex={-1} className="module-title">{labView === "metaplan" ? "Mapa operativo" : labView === "inventory" ? "Inventario de procesos" : "Mapa de procesos"}</h2>

          {labView === "metaplan" && (
            <div ref={exportFrameRef} className={rightPanelOpen ? "free-workspace" : "free-workspace panel-hidden"}>
              <div
                className="canvas-wrap free-canvas"
                ref={metaplanRef}
                onWheelCapture={(event) => {
                  event.stopPropagation();
                  if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    const zoom = Math.min(1.6, Math.max(0.4, flow.getZoom() - event.deltaY * 0.0015));
                    flow.zoomTo(zoom, { duration: 80 });
                  }
                }}
              >
                {store.entities.length === 0 && (
                  <div className="empty-canvas-hint">
                    <h2>Metaplan libre</h2>
                    <p>Pulsa <strong>Nueva entidad</strong> y haz clic donde quieras colocarla. Después arrastra desde un puerto para crear relaciones.</p>
                    <button className="dark-btn" onClick={() => setTool("entity")}>Nueva entidad</button>
                    <button onClick={loadGuidedExample}>Cargar ejemplo complejo</button>
                  </div>
                )}
                <ReactFlow
                  nodeTypes={nodeTypes}
                  edgeTypes={edgeTypes}
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={applyFlowNodeChanges}
                  onEdgesChange={applyFlowEdgeChanges}
                  onConnect={(connection) => draftConnection(connection.source, connection.target)}
                  onConnectStart={(_, params) => {
                    pendingConnectionRef.current = params.nodeId ?? null;
                    setPendingConnection(params.nodeId ?? null);
                  }}
                  onConnectEnd={(event) => {
                    const point = "clientX" in event ? { x: event.clientX, y: event.clientY } : null;
                    const targetNode = point ? document.elementFromPoint(point.x, point.y)?.closest(".react-flow__node") : null;
                    const targetId = targetNode?.getAttribute("data-id");
                    const sourceId = pendingConnectionRef.current ?? pendingConnection;
                    if (sourceId && targetId && sourceId !== targetId) draftConnection(sourceId, targetId);
                    pendingConnectionRef.current = null;
                    setPendingConnection(null);
                  }}
                  onNodeClick={(_, node) => handleNodeClick(node.id)}
                  onNodeDoubleClick={(_, node) => handleNodeClick(node.id)}
                  onEdgeClick={(_, edge) => { setRightPanelOpen(true); store.selectProcess(edge.id); }}
                  onEdgeDoubleClick={(_, edge) => { setRightPanelOpen(true); store.selectProcess(edge.id); }}
                  onPaneClick={(event: MouseEvent) => {
                    if (tool !== "entity") return;
                    const point = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
                    store.addEntity(point);
                    setTimeout(() => {
                      const created = useAppStore.getState().entities.at(-1);
                      if (created) store.updateEntity(created.id, { name: "Nueva entidad", type: "Otra", size: { width: 220, height: 120 } });
                    }, 0);
                    setTool("select");
                  }}
                  onDoubleClick={(event: MouseEvent) => {
                    if ((event.target as HTMLElement).classList.contains("react-flow__pane")) {
                      const point = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
                      store.addEntity(point);
                    }
                  }}
                  panOnDrag={tool !== "entity"}
                  panOnScroll
                  panOnScrollMode={PanOnScrollMode.Free}
                  zoomOnScroll={false}
                  zoomOnPinch
                  zoomOnDoubleClick={false}
                  preventScrolling
                  selectionOnDrag
                  multiSelectionKeyCode={["Shift", "Meta", "Control"]}
                  snapToGrid={snapToGrid}
                  snapGrid={[20, 20]}
                  connectionMode={ConnectionMode.Loose}
                  fitView
                >
                  {showGrid && <Background gap={20} size={1} />}
                  <Controls position="top-right" className="canvas-controls" />
                  <Panel position="top-left" className="canvas-mode-chip">{tool === "entity" ? "Haz clic para colocar entidad" : "Modo manual"}</Panel>
                </ReactFlow>
                {relationDraft && (
                  <RelationDialog
                    draft={relationDraft}
                    onChange={setRelationDraft}
                    onCancel={() => setRelationDraft(null)}
                    onSubmit={createRelation}
                  />
                )}
              </div>
              {!rightPanelOpen && <button className="reopen-panel" onClick={() => setRightPanelOpen(true)}>Mostrar configuración</button>}
              {rightPanelOpen && <RightLegendPanel selectedEntity={selectedEntity} selectedProcess={selectedProcess} setLabView={setLabView} onClose={() => setRightPanelOpen(false)} />}
              <div className="bottom-bar canvas-export-actions" aria-label="Salidas del Metaplan">
                <button onClick={() => openPrintableCanvas("print")}><Printer size={16} /> Imprimir canvas</button>
                <button onClick={() => openPrintableCanvas("pdf")}><Download size={16} /> PDF horizontal</button>
                <button onClick={shareCanvasImage}><Share2 size={16} /> Compartir imagen</button>
              </div>
            </div>
          )}

          {labView === "inventory" && (store.processes.length > 0 ? <InventoryCards setLabView={setLabView} /> : <LockedView title="Tus relaciones se convertirán aquí en procesos." />)}
          {labView === "map" && (store.processes.length > 0 ? <ProcessMap mapRef={mapRef} /> : <LockedView title="El mapa ejecutivo se generará después de clasificar las relaciones." />)}
          </div>
        </section>

        {store.processes.length > 0 && (
          <section className="results-section" aria-labelledby="results-title">
            <div className="section-heading">
              <div>
                <span className="section-chip">Salida final</span>
                <h2 id="results-title">Tu arquitectura operativa está preparada</h2>
                <p>{store.entities.length} entidades · {store.processes.length} procesos · 3 tipos de macroproceso · 1 mapa de procesos.</p>
              </div>
              <div className="toolbar export-actions">
                <button onClick={exportExcel}><FileSpreadsheet size={16} /> Descargar Excel</button>
                <button onClick={() => exportPng("map")}><Download size={16} /> Descargar mapa</button>
                <button onClick={exportJson}>Guardar proyecto</button>
                <details>
                  <summary>Más formatos</summary>
                  <button onClick={exportJson}>JSON</button>
                  <button onClick={exportCsv}>CSV</button>
                  <button onClick={() => exportPng("metaplan")}>PNG Metaplan</button>
                  <button onClick={() => window.print()}>Imprimir</button>
                </details>
              </div>
            </div>
          </section>
        )}
      </main>
      {entityDialog.open && (
        <EntityDialog
          name={entityName}
          type={entityType}
          primary={entityDialog.primary}
          onName={setEntityName}
          onType={setEntityType}
          onCancel={() => setEntityDialog((current) => ({ ...current, open: false }))}
          onSubmit={createEntityFromDialog}
        />
      )}
      {toast && <div className="toast-message">{toast}</div>}
    </div>
  );
}

function ProcessEdge(props: EdgeProps<{ lineStyle?: Process["lineStyle"]; status?: Process["status"]; parallelOffset?: number }>) {
  const { id, sourceX, sourceY, targetX, targetY, markerEnd, markerStart, label, selected, data } = props;
  const store = useAppStore();
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const length = Math.max(Math.hypot(dx, dy), 1);
  const offset = data?.lineStyle === "straight" ? 0 : data?.parallelOffset ?? 0;
  const normalX = -dy / length;
  const normalY = dx / length;
  const controlX = (sourceX + targetX) / 2 + normalX * offset;
  const controlY = (sourceY + targetY) / 2 + normalY * offset;
  const edgePath = data?.lineStyle === "straight"
    ? `M ${sourceX},${sourceY} L ${targetX},${targetY}`
    : `M ${sourceX},${sourceY} Q ${controlX},${controlY} ${targetX},${targetY}`;
  const labelX = data?.lineStyle === "straight" ? (sourceX + targetX) / 2 : 0.25 * sourceX + 0.5 * controlX + 0.25 * targetX;
  const labelY = data?.lineStyle === "straight" ? (sourceY + targetY) / 2 : 0.25 * sourceY + 0.5 * controlY + 0.25 * targetY;
  const classes = ["custom-process-edge", selected ? "edge-selected" : ""].join(" ");
  const visibleStyle = {
    stroke: data?.status !== "complete" ? "#b7791f" : "#3f3f3f",
    strokeWidth: selected ? 3 : 2.2,
    strokeDasharray: data?.lineStyle === "support" ? "8 7" : undefined,
    filter: selected ? "drop-shadow(0 0 3px rgba(31, 126, 174, 0.38))" : undefined
  };

  return (
    <g className={classes}>
      <path className="edge-interaction" d={edgePath} fill="none" stroke="transparent" strokeWidth={18} />
      <path id={id} d={edgePath} fill="none" markerEnd={markerEnd} markerStart={markerStart} style={visibleStyle} />
      <EdgeLabelRenderer>
        <button
          className="edge-label-pill"
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          onClick={(event) => {
            event.stopPropagation();
            window.dispatchEvent(new CustomEvent("docroi:open-inspector"));
            store.selectProcess(id);
          }}
        >
          {label}
        </button>
      </EdgeLabelRenderer>
    </g>
  );
}

function EntityNode({ data, selected }: NodeProps<{ entity: Entity; inputs: number; outputs: number }>) {
  const entity = data.entity;
  const store = useAppStore();
  const flow = useReactFlow();
  const dragStartRef = useRef<{ pointerId: number; x: number; y: number; position: Entity["position"] } | null>(null);
  const mouseDragRef = useRef<{ x: number; y: number; position: Entity["position"] } | null>(null);
  const openInspector = () => window.dispatchEvent(new CustomEvent("docroi:open-inspector"));

  const startManualDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (entity.locked || target.closest(".entity-handle") || target.closest(".react-flow__resize-control")) return;
    event.preventDefault();
    event.stopPropagation();
    openInspector();
    store.selectEntity(entity.id);
    dragStartRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, position: entity.position };
    target.setPointerCapture?.(event.pointerId);
  };

  const moveManualDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragStartRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const zoom = flow.getZoom();
    store.updateEntity(entity.id, {
      position: {
        x: drag.position.x + (event.clientX - drag.x) / zoom,
        y: drag.position.y + (event.clientY - drag.y) / zoom
      }
    });
  };

  const endManualDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStartRef.current?.pointerId === event.pointerId) {
      dragStartRef.current = null;
      (event.target as HTMLElement).releasePointerCapture?.(event.pointerId);
    }
  };

  const startMouseDrag = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (entity.locked || target.closest(".entity-handle") || target.closest(".react-flow__resize-control")) return;
    event.preventDefault();
    event.stopPropagation();
    openInspector();
    store.selectEntity(entity.id);
    mouseDragRef.current = { x: event.clientX, y: event.clientY, position: entity.position };

    const move = (moveEvent: globalThis.MouseEvent) => {
      const drag = mouseDragRef.current;
      if (!drag) return;
      const zoom = flow.getZoom();
      store.updateEntity(entity.id, {
        position: {
          x: drag.position.x + (moveEvent.clientX - drag.x) / zoom,
          y: drag.position.y + (moveEvent.clientY - drag.y) / zoom
        }
      });
    };
    const end = () => {
      mouseDragRef.current = null;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", end);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", end);
  };

  return (
    <div
      className={selected ? "entity-card selected" : "entity-card"}
      onMouseDown={startMouseDrag}
      onPointerDown={startManualDrag}
      onPointerMove={moveManualDrag}
      onPointerUp={endManualDrag}
      onPointerCancel={endManualDrag}
      onDoubleClick={(event) => {
        event.stopPropagation();
        openInspector();
        store.selectEntity(entity.id);
      }}
    >
      <button
        className="entity-edit-dot"
        title="Editar entidad"
        aria-label={`Editar ${entity.name}`}
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          openInspector();
          store.selectEntity(entity.id);
        }}
      >
        <span />
      </button>
      <NodeResizer
        isVisible={selected}
        minWidth={150}
        minHeight={70}
        color="#1f7eae"
        handleClassName="entity-resize-handle"
        lineClassName="entity-resize-line"
        handleStyle={{ width: 13, height: 13, borderRadius: 999, border: "2px solid #fff", background: "#1f7eae" }}
        lineStyle={{ borderColor: "#1f7eae", borderWidth: 2 }}
        onResize={(_, params) => store.updateEntity(entity.id, { size: { width: params.width, height: params.height } })}
        onResizeEnd={(_, params) => store.updateEntity(entity.id, { size: { width: params.width, height: params.height } })}
      />
      <Handle id="left-in" type="target" position={Position.Left} className="entity-handle entity-handle-left" title="Crear relación" />
      <Handle id="left-out" type="source" position={Position.Left} className="entity-handle entity-handle-left source" title="Crear relación" />
      <Handle id="top-in" type="target" position={Position.Top} className="entity-handle entity-handle-top" title="Crear relación" />
      <Handle id="top-out" type="source" position={Position.Top} className="entity-handle entity-handle-top source" title="Crear relación" />
      <div className="entity-main">
        <strong>{entity.name}</strong>
        <span>{entity.type || "Sin tipo"}</span>
        {entity.isPrimary && <em>Principal</em>}
      </div>
      {entity.showDescription !== false && entity.description && <ul className="entity-notes">{entity.description.split("\n").filter(Boolean).map((line) => <li key={line}>{line}</li>)}</ul>}
      <div className="entity-counts"><small>Entran {data.inputs}</small><small>Salen {data.outputs}</small></div>
      <Handle id="right-in" type="target" position={Position.Right} className="entity-handle entity-handle-right" title="Crear relación" />
      <Handle id="right-out" type="source" position={Position.Right} className="entity-handle entity-handle-right source" title="Crear relación" />
      <Handle id="bottom-in" type="target" position={Position.Bottom} className="entity-handle entity-handle-bottom" title="Crear relación" />
      <Handle id="bottom-out" type="source" position={Position.Bottom} className="entity-handle entity-handle-bottom source" title="Crear relación" />
    </div>
  );
}

function RightLegendPanel({ selectedEntity, selectedProcess, setLabView, onClose }: { selectedEntity: Entity | null; selectedProcess: Process | null; setLabView: (view: LabView) => void; onClose: () => void }) {
  const store = useAppStore();
  return (
    <aside className="right-legend">
      <button className="collapse-panel" onClick={onClose}>Plegar panel</button>
      {selectedProcess ? <RelationInspector process={selectedProcess} setLabView={setLabView} /> : selectedEntity ? <EntityInspector entity={selectedEntity} /> : <LegendList />}
      {(selectedProcess || selectedEntity) && <LegendList compact />}
    </aside>
  );
}

function LegendList({ compact = false }: { compact?: boolean }) {
  const store = useAppStore();
  return (
    <section className={compact ? "legend-panel compact-legend" : "legend-panel"}>
      <h3>Relaciones numeradas</h3>
      <div className="legend-list">
        {store.processes.map((p) => (
          <button key={p.id} className={store.selectedProcessId === p.id ? "legend-item active" : "legend-item"} onClick={() => store.selectProcess(p.id)}>
            <span className="legend-number">{p.visibleId ?? p.displayOrder}</span>
            <span><strong>{p.name}</strong><small>{p.description || `${entityName(store.entities, p.sourceEntityId)} → ${entityName(store.entities, p.targetEntityId)}`}</small></span>
          </button>
        ))}
      </div>
    </section>
  );
}

function EntityInspector({ entity }: { entity: Entity }) {
  const store = useAppStore();
  const nameInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    nameInputRef.current?.focus({ preventScroll: true });
    nameInputRef.current?.select();
  }, [entity.id]);
  return (
    <section className="inspector">
      <h3>Entidad</h3>
      <label>Nombre<input ref={nameInputRef} value={entity.name} onChange={(event) => store.updateEntity(entity.id, { name: event.target.value })} /></label>
      <label>Tipo<select value={entity.type} onChange={(event) => store.updateEntity(entity.id, { type: event.target.value })}>{["Área interna", "Cliente", "Proveedor", "Partner", "Sistema", "Otra"].map((type) => <option key={type}>{type}</option>)}</select></label>
      <label>Descripción<textarea value={entity.description} onChange={(event) => store.updateEntity(entity.id, { description: event.target.value })} /></label>
      <label>Forma<select value={entity.shape} onChange={(event) => store.updateEntity(entity.id, { shape: event.target.value as Entity["shape"] })}><option value="rounded-rectangle">Rectángulo redondeado</option><option value="oval">Óvalo</option></select></label>
      <div className="inspector-row"><label><input type="checkbox" checked={entity.showDescription !== false} onChange={(event) => store.updateEntity(entity.id, { showDescription: event.target.checked })} /> Mostrar descripción</label></div>
      <div className="inspector-row"><label><input type="checkbox" checked={!!entity.locked} onChange={(event) => store.updateEntity(entity.id, { locked: event.target.checked })} /> Bloquear posición</label></div>
      <button onClick={() => store.setPrimaryEntity(entity.id)}>Establecer como principal</button>
    </section>
  );
}

function RelationInspector({ process, setLabView }: { process: Process; setLabView: (view: LabView) => void }) {
  const store = useAppStore();
  const titleInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    titleInputRef.current?.focus({ preventScroll: true });
    titleInputRef.current?.select();
  }, [process.id]);
  return (
    <section className="inspector">
      <h3>Relación</h3>
      <label>Identificador visible<input value={process.visibleId ?? String(process.displayOrder)} onChange={(event) => store.updateProcess(process.id, { visibleId: event.target.value })} /></label>
      <label>Título del proceso<input ref={titleInputRef} value={process.name} onChange={(event) => store.updateProcess(process.id, { name: event.target.value })} /></label>
      <label>Descripción / lista<textarea value={process.description} onChange={(event) => store.updateProcess(process.id, { description: event.target.value })} placeholder={"Eventos\nPromoción\nComunicación en medios\n3.1 Redes sociales"} /></label>
      <label>Input<input value={process.input} onChange={(event) => store.updateProcess(process.id, { input: event.target.value })} /></label>
      <label>Output<input value={process.output} onChange={(event) => store.updateProcess(process.id, { output: event.target.value })} /></label>
      <label>Dirección<select value={process.direction} onChange={(event) => store.updateProcess(process.id, { direction: event.target.value as Process["direction"] })}><option value="unidirectional">Un sentido</option><option value="bidirectional">Bidireccional</option></select></label>
      <label>Tipo de línea<select value={process.lineStyle ?? "smoothstep"} onChange={(event) => store.updateProcess(process.id, { lineStyle: event.target.value as Process["lineStyle"] })}><option value="smoothstep">Curva</option><option value="straight">Recta</option><option value="step">Escalonada</option><option value="support">Apoyo discontinua</option></select></label>
      <label>Estado<select value={process.status} onChange={(event) => store.updateProcess(process.id, { status: event.target.value as Process["status"] })}><option value="draft">Pendiente</option><option value="partial">En revisión</option><option value="complete">Revisado</option></select></label>
      <label>Tipo de macroproceso<select value={process.macroprocessType ?? ""} onChange={(event) => store.updateProcess(process.id, { macroprocessType: event.target.value ? event.target.value as MacroprocessType : null })}><option value="">Sin clasificar</option>{macroprocessOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <div className="inspector-actions">
        <button onClick={() => store.updateProcess(process.id, { sourceEntityId: process.targetEntityId, targetEntityId: process.sourceEntityId })}>Invertir dirección</button>
        <button onClick={() => setLabView("inventory")}>Ver en inventario</button>
      </div>
    </section>
  );
}

function EntityDialog({ name, type, primary, onName, onType, onCancel, onSubmit }: { name: string; type: string; primary: boolean; onName: (value: string) => void; onType: (value: string) => void; onCancel: () => void; onSubmit: () => void }) {
  return (
    <div className="overlay-card entity-dialog">
      <h3>{primary ? "¿Cuál es la entidad desde la que comienza el análisis?" : "Añade una entidad relacionada"}</h3>
      <label>Nombre de la entidad<input autoFocus value={name} onChange={(event) => onName(event.target.value)} placeholder="Comunicación" /></label>
      <div className="example-row">{["Comunicación", "Operaciones", "Unidad de negocio", "Cliente", "Dirección comercial"].map((item) => <button key={item} onClick={() => onName(item)}>{item}</button>)}</div>
      <label>Tipo de entidad<select value={type} onChange={(event) => onType(event.target.value)}>{["Área interna", "Cliente", "Proveedor", "Partner", "Sistema", "Otra"].map((item) => <option key={item}>{item}</option>)}</select></label>
      <div className="dialog-actions"><button onClick={onCancel}>Cancelar</button><button className="dark-btn" onClick={onSubmit}>Crear y continuar</button></div>
    </div>
  );
}

function RelationDialog({ draft, onChange, onCancel, onSubmit }: { draft: RelationDraft; onChange: (draft: RelationDraft) => void; onCancel: () => void; onSubmit: () => void }) {
  const store = useAppStore();
  const source = entityName(store.entities, draft.sourceId);
  const target = entityName(store.entities, draft.targetId);
  const isBidirectional = draft.direction === "bidirectional";
  return (
    <div className="overlay-card relation-dialog">
      <h3>¿Qué sucede entre {source} y {target}?</h3>
      <label>{isBidirectional ? `Sentido 1 · ${source} → ${target}` : "Nombre de la interacción"}<input autoFocus value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} placeholder="Solicitud de material" /></label>
      {isBidirectional && <label>{`Sentido 2 · ${target} → ${source}`}<input value={draft.reverseName} onChange={(event) => onChange({ ...draft, reverseName: event.target.value })} placeholder="Respuesta, validación o devolución" /></label>}
      <div className="example-row">{["Solicitud de material", "Entrega de documentación", "Validación de campaña", "Aprobación de presupuesto"].map((item) => <button key={item} onClick={() => onChange({ ...draft, name: item })}>{item}</button>)}</div>
      <p>¿Quién inicia la interacción?</p>
      <div className="direction-row">
        <button className={draft.direction === "source-target" ? "active" : ""} onClick={() => onChange({ ...draft, direction: "source-target" })}>{source} → {target}</button>
        <button className={draft.direction === "target-source" ? "active" : ""} onClick={() => onChange({ ...draft, direction: "target-source" })}>{target} → {source}</button>
        <button className={draft.direction === "bidirectional" ? "active" : ""} onClick={() => onChange({ ...draft, direction: "bidirectional" })}>{source} ↔ {target}</button>
      </div>
      {isBidirectional && <p className="muted">Se dibuja una sola línea con flecha en ambos extremos. La leyenda conserva los dos sentidos para que no se dupliquen trazos.</p>}
      <label>Tipo de macroproceso<select value={draft.macroprocessType} onChange={(event) => onChange({ ...draft, macroprocessType: event.target.value as MacroprocessType })}>{macroprocessOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <div className="dialog-actions"><button onClick={onCancel}>Cancelar</button><button className="dark-btn" onClick={onSubmit}>Crear relación</button></div>
    </div>
  );
}

function EntityContext({ entity, onConnect, onAddRelated }: { entity: Entity; onConnect: () => void; onAddRelated: () => void }) {
  const store = useAppStore();
  return (
    <div className="context-card">
      <h3>{entity.name}</h3>
      <button onClick={onConnect}>Conectar con otra entidad</button>
      <button onClick={onAddRelated}>Añadir entidad relacionada</button>
      <button onClick={() => store.duplicateEntity(entity.id)}>Duplicar</button>
      <button onClick={() => store.setPrimaryEntity(entity.id)}>Establecer como principal</button>
      <details><summary>Más detalles</summary><PropertyFields entity={entity} /></details>
      <button className="danger" onClick={() => window.confirm("Se eliminarán las relaciones asociadas. ¿Continuar?") && store.removeEntity(entity.id)}>Eliminar</button>
    </div>
  );
}

function PropertyFields({ entity }: { entity: Entity }) {
  const store = useAppStore();
  return (
    <div className="detail-fields">
      <label>Editar nombre<input value={entity.name} onChange={(event) => store.updateEntity(entity.id, { name: event.target.value })} /></label>
      <label>Cambiar tipo<select value={entity.type} onChange={(event) => store.updateEntity(entity.id, { type: event.target.value })}>{["Área interna", "Cliente", "Proveedor", "Partner", "Sistema", "Otra"].map((type) => <option key={type}>{type}</option>)}</select></label>
      <label>Notas<textarea value={entity.description} onChange={(event) => store.updateEntity(entity.id, { description: event.target.value })} /></label>
    </div>
  );
}

function ProcessContext({ process }: { process: Process }) {
  const store = useAppStore();
  const source = entityName(store.entities, process.sourceEntityId);
  const target = entityName(store.entities, process.targetEntityId);
  return (
    <div className="context-card process-context">
      <h3>Proceso {process.displayOrder} · {process.name}</h3>
      <p>{source} → {target}</p>
      <p>Estado: {process.status === "complete" ? "revisado" : "pendiente"}</p>
      <p>Input: {process.input || "sin completar"} · Output: {process.output || "sin completar"}</p>
      <details>
        <summary>Completar proceso</summary>
        <ProcessDetails process={process} />
      </details>
      <button onClick={() => store.updateProcess(process.id, { sourceEntityId: process.targetEntityId, targetEntityId: process.sourceEntityId })}>Invertir dirección</button>
      <button onClick={() => store.selectProcess(process.id)}>Localizar en inventario</button>
      <button className="danger" onClick={() => store.removeProcess(process.id)}>Eliminar</button>
    </div>
  );
}

function ProcessDetails({ process }: { process: Process }) {
  const store = useAppStore();
  return (
    <div className="detail-fields">
      <label>Input<input value={process.input} onChange={(event) => store.updateProcess(process.id, { input: event.target.value })} /></label>
      <label>Output<input value={process.output} onChange={(event) => store.updateProcess(process.id, { output: event.target.value })} /></label>
      <label>Descripción<textarea value={process.description} onChange={(event) => store.updateProcess(process.id, { description: event.target.value })} /></label>
      <label>Estado<select value={process.status} onChange={(event) => store.updateProcess(process.id, { status: event.target.value as Process["status"] })}><option value="draft">Pendiente</option><option value="partial">En revisión</option><option value="complete">Revisado</option></select></label>
    </div>
  );
}

function JourneyPrompt({ message, selectedEntity, onConnect, onAdd, onClose }: { message: string; selectedEntity: Entity | null; onConnect: () => void; onAdd: () => void; onClose: () => void }) {
  return (
    <div className="journey-card">
      <strong>{message}</strong>
      <p>¿Qué ocurre después?</p>
      <button disabled={!selectedEntity} onClick={onConnect}>Conectar esta entidad con otra</button>
      <button onClick={onAdd}>Añadir una nueva entidad</button>
      <button onClick={onClose}>Volver al mapa</button>
      <button onClick={onClose}>Finalizar este recorrido</button>
    </div>
  );
}

function ProgressStrip({ progress }: { progress: ReturnType<typeof getProgress> }) {
  return (
    <div className="progress-strip">
      <strong>Tu mapa</strong>
      <span>{progress.entities} entidades</span>
      <span>{progress.relations} relaciones</span>
      <span>{progress.processes} procesos</span>
      <span>{progress.complete} revisados</span>
      <span>{progress.pending} pendientes</span>
      {progress.pendingMessages.length > 0 && <small>Pendiente: {progress.pendingMessages.join("; ")}</small>}
    </div>
  );
}

function LockedView({ title }: { title: string }) {
  return <div className="locked-view"><h2>{title}</h2><p>Vuelve al mapa operativo y crea relaciones para desbloquear esta vista.</p></div>;
}

function ProcessLegend() {
  const store = useAppStore();
  return (
    <aside className="legend-panel friendly-legend">
      <h3>Relaciones numeradas</h3>
      <div className="legend-list">
        {store.processes.map((p) => (
          <button key={p.id} className={store.selectedProcessId === p.id ? "legend-item active" : "legend-item"} onClick={() => store.selectProcess(p.id)}>
            <span className="legend-number">{p.displayOrder}</span>
            <span><strong>{p.name}</strong><small>{p.description || `${entityName(store.entities, p.sourceEntityId)} → ${entityName(store.entities, p.targetEntityId)}`}</small></span>
          </button>
        ))}
      </div>
    </aside>
  );
}

function InventoryCards({ setLabView }: { setLabView: (view: LabView) => void }) {
  const store = useAppStore();
  const [table, setTable] = useState(false);
  if (table) return <InventoryTable />;
  return (
    <div className="inventory-cards">
      <div className="inventory-head"><h2>Procesos descubiertos</h2><button onClick={() => setTable(true)}>Vista tabla</button></div>
      {store.processes.map((process) => (
        <article key={process.id} className="process-card">
          <h3>{process.displayOrder} · {process.name}</h3>
          <p>{entityName(store.entities, process.sourceEntityId)} → {entityName(store.entities, process.targetEntityId)}</p>
          <span>Estado: {process.status === "complete" ? "revisado" : "pendiente de completar"}</span>
          <div>
            <button onClick={() => store.selectProcess(process.id)}>Completar</button>
            <button onClick={() => { store.selectProcess(process.id); setLabView("metaplan"); }}>Ver en el mapa</button>
            <button onClick={() => setLabView("map")}>Ver en mapa de procesos</button>
          </div>
        </article>
      ))}
    </div>
  );
}

function InventoryTable() {
  const store = useAppStore();
  const rows = enrichedProcesses(store);
  return (
    <div className="inventory-view">
      <table><thead><tr>{["Nº", "Proceso", "Supplier", "Customer", "Estado", "Macroproceso"].map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((p) => <tr key={p.id} className={store.selectedProcessId === p.id ? "active" : ""} onClick={() => store.selectProcess(p.id)}><td>{p.displayOrder}</td><td><strong>{p.name}</strong><details><summary>Input / Output</summary>{p.input || "Sin input"} → {p.output || "Sin output"}</details></td><td>{p.supplier}</td><td>{p.customer}</td><td>{p.status}</td><td>{p.stage}</td></tr>)}</tbody></table>
    </div>
  );
}

function ValueChain() {
  const store = useAppStore();
  const [started, setStarted] = useState(store.processes.some((process) => process.valueChainStageId));
  const onDragEnd = (event: DragEndEvent) => {
    const processId = String(event.active.id);
    const stageId = event.over?.id ? String(event.over.id) : null;
    if (stageId) store.moveProcessToStage(processId, stageId);
  };
  if (!started) {
    return (
      <div className="chain-start">
        <h2>Organiza tus procesos</h2>
        <p>Agrupa los procesos que cumplen una finalidad similar.</p>
        <div>
          <button onClick={() => { loadTemplate("commercial"); setStarted(true); }}>Usar una plantilla</button>
          <button onClick={() => setStarted(true)}>Crear mi cadena</button>
          <button onClick={() => { loadTemplate("service"); setStarted(true); }}>Ayudarme a clasificar</button>
        </div>
      </div>
    );
  }
  return (
    <div className="chain-view">
      <div className="toolbar"><button onClick={store.addStage}>Nuevo macroproceso</button><button onClick={() => loadTemplate("commercial")}>Comercial</button><button onClick={() => loadTemplate("operations")}>Operaciones</button><button onClick={() => loadTemplate("service")}>Servicio</button></div>
      <DndContext onDragEnd={onDragEnd}><div className="kanban">{[...store.valueChainStages].sort((a, b) => a.order - b.order).map((stage) => <StageColumn key={stage.id} stageId={stage.id} name={stage.name}><input className="stage-title" value={stage.name} onChange={(event) => store.updateStage(stage.id, { name: event.target.value })} /><select value={stage.category} onChange={(event) => store.updateStage(stage.id, { category: event.target.value as ProcessMapCategory })}><option value="strategic">Estratégico</option><option value="core">Clave / Operativo</option><option value="support">Apoyo / Soporte</option></select><div className="stage-cards">{store.processes.filter((process) => process.valueChainStageId === stage.id).map((process) => <DraggableCard key={process.id} process={process} />)}</div></StageColumn>)}</div></DndContext>
    </div>
  );
}

function loadTemplate(kind: "commercial" | "operations" | "service") {
  const names = kind === "commercial" ? ["Estrategia", "Preventa", "Venta", "Entrega", "Postventa"] : kind === "operations" ? ["Planificación", "Aprovisionamiento", "Producción", "Control", "Entrega"] : ["Solicitud", "Diagnóstico", "Prestación", "Validación", "Seguimiento"];
  const store = useAppStore.getState();
  names.forEach((name, index) => store.updateStage(store.valueChainStages[index]?.id ?? "", { name, category: index === 0 ? "strategic" : index === names.length - 1 ? "support" : "core" }));
}

function StageColumn({ stageId, name, children }: { stageId: string; name: string; children: ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id: stageId });
  return <div className={isOver ? "stage over" : "stage"} ref={setNodeRef} aria-label={`Macroproceso ${name}`}>{children}</div>;
}

function DraggableCard({ process }: { process: Process }) {
  const store = useAppStore();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: process.id });
  return <button ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform) }} className={isDragging ? "value-card dragging" : "value-card"} onClick={() => store.selectProcess(process.id)} {...listeners} {...attributes}><strong>{process.displayOrder}. {process.name}</strong><span>{entityName(store.entities, process.sourceEntityId)} → {entityName(store.entities, process.targetEntityId)}</span></button>;
}

function ProcessMap({ mapRef }: { mapRef: React.RefObject<HTMLDivElement> }) {
  const store = useAppStore();
  const exportRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<MacroprocessType | "all">("all");
  const [sheetProcessId, setSheetProcessId] = useState<string | null>(null);
  const classified = store.processes.filter((process) => process.macroprocessType);
  const visibleProcesses = classified.filter((process) => filter === "all" || process.macroprocessType === filter);
  const pendingCount = store.processes.length - classified.length;
  const selectedIndex = sheetProcessId ? visibleProcesses.findIndex((process) => process.id === sheetProcessId) : -1;
  const sheetProcess = selectedIndex >= 0 ? visibleProcesses[selectedIndex] : null;
  const zones = macroprocessOptions;
  const suppliers = countEntities(store.entities, visibleProcesses, "sourceEntityId");
  const customers = countEntities(store.entities, visibleProcesses, "targetEntityId");
  const makeMapImage = async () => {
    if (!exportRef.current) return null;
    return htmlToImage.toPng(exportRef.current, {
      cacheBust: true,
      backgroundColor: "#ffffff",
      pixelRatio: 2,
      filter: (node) => !(node instanceof HTMLElement && node.classList.contains("process-map-export-actions"))
    });
  };
  const downloadMapImage = async () => {
    const image = await makeMapImage();
    if (image) downloadDataUrl(`${safeFileName(store.project.name)}-mapa-procesos.png`, image);
  };
  const downloadMapPdf = async () => {
    const image = await makeMapImage();
    if (!image) return;
    const printWindow = window.open("", "_blank", "width=1200,height=820");
    if (!printWindow) {
      downloadDataUrl(`${safeFileName(store.project.name)}-mapa-procesos.png`, image);
      return;
    }
    printWindow.document.write(`<!doctype html><html><head><title>Mapa de procesos · ${escapeHtml(store.project.name)}</title><style>@page{size:A4 landscape;margin:8mm}body{margin:0;background:#fff}img{display:block;width:100%;height:auto}</style></head><body><img src="${image}" alt="Mapa de procesos DocROI" /></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => printWindow.print();
  };
  const shareMapImage = async () => {
    const image = await makeMapImage();
    if (!image) return;
    const blob = await (await fetch(image)).blob();
    const file = new File([blob], `${safeFileName(store.project.name)}-mapa-procesos.png`, { type: "image/png" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: store.project.name, text: "Mapa de procesos DocROI", files: [file] });
      return;
    }
    downloadDataUrl(file.name, image);
  };

  return (
    <>
      <div className="process-map-shell" ref={mapRef}>
        <div className="process-map-export-frame" ref={exportRef}>
          <header className="process-map-brand">
            <img src={logoUrl} alt="DocROI" />
            <strong>{store.project.name || "Mapa de procesos DocROI"}</strong>
          </header>
          <div className="process-map">
            <aside className="map-side">
              <h3>Suppliers</h3>
              {suppliers.map((item) => <button key={item.id} onClick={() => setFilter("all")}><strong>{item.name}</strong><span>{item.count} relación(es)</span></button>)}
            </aside>
            <main className="map-zones">
              <div className="process-map-toolbar">
                <div>
                  <h3>Mapa de procesos</h3>
                  {pendingCount > 0 && <p>{pendingCount} relación(es) pendientes de clasificar.</p>}
                </div>
                <div className="map-filter">
                  <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Todo</button>
                  {zones.map((zone) => <button key={zone.value} className={filter === zone.value ? "active" : ""} onClick={() => setFilter(zone.value)}>{zone.label.replace("Procesos ", "")}</button>)}
                </div>
              </div>
              {zones.map((zone) => {
                const zoneProcesses = visibleProcesses.filter((process) => process.macroprocessType === zone.value);
                return (
                  <section key={zone.value} className={`map-zone ${zone.value}`}>
                    <h3>{zone.label}</h3>
                    <div>{zoneProcesses.length ? zoneProcesses.map((process) => (
                      <button key={process.id} className="map-stage" onClick={() => { store.selectProcess(process.id); setSheetProcessId(process.id); }}>
                        <strong>{process.visibleId ?? process.displayOrder} · {process.name}</strong>
                        <span>{entityName(store.entities, process.sourceEntityId)} → {entityName(store.entities, process.targetEntityId)}</span>
                        {process.input && <small>Input: {process.input}</small>}
                        {process.output && <small>Output: {process.output}</small>}
                      </button>
                    )) : <p className="empty-zone">Sin relaciones clasificadas.</p>}</div>
                  </section>
                );
              })}
            </main>
            <aside className="map-side">
              <h3>Customers</h3>
              {customers.map((item) => <button key={item.id} onClick={() => setFilter("all")}><strong>{item.name}</strong><span>{item.count} resultado(s)</span></button>)}
            </aside>
          </div>
        </div>
        <div className="bottom-bar process-map-export-actions">
          <button onClick={downloadMapImage}><Download size={16} /> Descargar imagen</button>
          <button onClick={downloadMapPdf}><Printer size={16} /> Descargar PDF</button>
          <button onClick={shareMapImage}><Share2 size={16} /> Compartir</button>
        </div>
      </div>
      {sheetProcess && (
        <div className="process-sheet" role="dialog" aria-modal="true">
          <div>
            <button className="sheet-close" onClick={() => setSheetProcessId(null)}>Cerrar</button>
            <span className="section-chip">Relación {selectedIndex + 1} de {visibleProcesses.length}</span>
            <h3>{sheetProcess.visibleId ?? sheetProcess.displayOrder} · {sheetProcess.name}</h3>
            <p>{entityName(store.entities, sheetProcess.sourceEntityId)} → {entityName(store.entities, sheetProcess.targetEntityId)}</p>
            <dl>
              {sheetProcess.input && <><dt>Input</dt><dd>{sheetProcess.input}</dd></>}
              {sheetProcess.output && <><dt>Output</dt><dd>{sheetProcess.output}</dd></>}
              {sheetProcess.description && <><dt>Descripción</dt><dd>{sheetProcess.description}</dd></>}
              <dt>Tipo de macroproceso</dt><dd>{macroprocessLabel(sheetProcess.macroprocessType)}</dd>
            </dl>
            <div className="dialog-actions">
              <button disabled={selectedIndex <= 0} onClick={() => setSheetProcessId(visibleProcesses[selectedIndex - 1]?.id ?? null)}>Anterior</button>
              <button disabled={selectedIndex >= visibleProcesses.length - 1} onClick={() => setSheetProcessId(visibleProcesses[selectedIndex + 1]?.id ?? null)}>Siguiente</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ProcessTrace() {
  const store = useAppStore();
  const process = store.processes.find((p) => p.id === store.selectedProcessId);
  if (!process) return null;
  return <div className="trace-card"><h3>Ficha trazable</h3><p><strong>{process.displayOrder}. {process.name}</strong></p><p>{entityName(store.entities, process.sourceEntityId)} · {process.input || "sin input"} → {process.output || "sin output"} · {entityName(store.entities, process.targetEntityId)}</p></div>;
}

function AcademicModule({ activeTab, setActiveTab, openLab }: { activeTab: number; setActiveTab: (value: number) => void; openLab: () => void }) {
  const tab = academicTabs[activeTab];
  const moduleRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const hasMounted = useRef(false);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const title = titleRef.current;
        if (!title) return;
        const targetTop = title.getBoundingClientRect().top + window.scrollY - 112;
        window.scrollTo({ top: Math.max(targetTop, 0), behavior: "smooth" });
        title.focus({ preventScroll: true });
      });
    });
  }, [activeTab]);

  const goToTab = (index: number) => {
    setActiveTab(index);
  };
  return (
    <article className="academic-module" ref={moduleRef}>
      <div>
        <span className="section-chip">Sesión {activeTab + 1}</span>
        <h2 ref={titleRef} tabIndex={-1}>{tab.objective}</h2>
        <h3>Objetivo de aprendizaje</h3>
        <p>{tab.body}</p>
        <div className="rule-box"><strong>Regla metodológica</strong><p>{tab.rule}</p></div>
        <p><strong>Conceptos clave:</strong> {tab.concepts}</p>
        <div className="academic-references" aria-label="Referencias académicas">
          {(tab.references ?? [{ label: tab.source, url: tab.url }]).map((reference) => (
            <a key={reference.label} href={reference.url} target="_blank" rel="noreferrer">{reference.label}</a>
          ))}
        </div>
        <div className="academic-nav"><button disabled={activeTab === 0} onClick={() => goToTab(activeTab - 1)}>Anterior</button><button disabled={activeTab === academicTabs.length - 1} onClick={() => goToTab(activeTab + 1)}>Siguiente</button><button className="dark-btn" onClick={openLab}>Pasar al laboratorio</button></div>
      </div>
      <ModuleVisual index={activeTab} />
    </article>
  );
}

function ModuleVisual({ index }: { index: number }) {
  const visual = [
    {
      title: "De entidades separadas al primer mapa",
      items: ["Unidad de negocio", "Comunicación", "Proveedor"],
      kind: "entities"
    },
    {
      title: "Qué cuenta como entidad",
      items: ["Cliente interno", "Comunicación", "Proveedor", "Sistema SaaS"],
      kind: "entities"
    },
    {
      title: "Relaciones numeradas",
      items: ["1 · Solicitud de servicio", "2 · Validación", "3 · Entrega de resultado"],
      kind: "relations"
    },
    {
      title: "Journey operativo",
      items: ["Unidad de negocio", "Comunicación", "Proveedor", "Audiencia"],
      kind: "journey"
    },
    {
      title: "Del Metaplan al mapa de procesos",
      items: ["Metaplan", "Inventario", "Macroproceso", "Mapa de procesos"],
      kind: "process-map"
    }
  ][index];
  return (
    <aside className="module-visual">
      <h3>{visual.title}</h3>
      <div className="visual-schema">
        {visual.items.map((label) => <span key={label} className="visual-node">{label}</span>)}
      </div>
      {visual.kind === "process-map" ? <ProcessMapMini /> : <MetaplanMini mode={visual.kind as "entities" | "relations" | "journey"} />}
    </aside>
  );
}

function MetaplanMini({ mode }: { mode: "entities" | "relations" | "journey" }) {
  const showRelations = mode !== "entities";
  return (
    <figure className={`metaplan-slide metaplan-slide-${mode}`}>
      <figcaption>Ejemplo visual de Metaplan</figcaption>
      <div>
        <svg className="metaplan-svg" viewBox="0 0 300 210" role="img" aria-label="Ejemplo conceptual de Metaplan">
          <defs>
            <marker id="miniArrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#384652" />
            </marker>
          </defs>
          {showRelations && (
            <g>
              <path d="M 92 56 C 110 68, 116 88, 126 102" fill="none" stroke="#384652" strokeWidth="2" markerEnd="url(#miniArrow)" />
              <path d="M 208 56 C 190 68, 184 88, 174 102" fill="none" stroke="#384652" strokeWidth="2" markerEnd="url(#miniArrow)" />
              <path d="M 150 128 C 150 140, 150 150, 150 160" fill="none" stroke="#384652" strokeWidth="2" markerEnd="url(#miniArrow)" />
              <g transform="translate(111 75)"><circle r="12" fill="#f6fbfd" stroke="#002b3d" strokeWidth="2" /><text y="4" textAnchor="middle" fill="#071a2b" fontSize="11" fontWeight="900">1</text></g>
              <g transform="translate(189 75)"><circle r="12" fill="#f6fbfd" stroke="#002b3d" strokeWidth="2" /><text y="4" textAnchor="middle" fill="#071a2b" fontSize="11" fontWeight="900">2</text></g>
              <g transform="translate(170 144)"><circle r="12" fill="#f6fbfd" stroke="#002b3d" strokeWidth="2" /><text y="4" textAnchor="middle" fill="#071a2b" fontSize="11" fontWeight="900">3</text></g>
            </g>
          )}
          <g>
            <rect x="18" y="26" width="82" height="40" rx="20" fill="#ffffff" stroke="#384652" strokeWidth="1.6" />
            <text x="59" y="50" textAnchor="middle" fill="#071a2b" fontSize="10" fontWeight="900">Unidad</text>
          </g>
          <g>
            <rect x="112" y="92" width="76" height="40" rx="20" fill="#ffffff" stroke="#384652" strokeWidth="1.6" />
            <text x="150" y="116" textAnchor="middle" fill="#071a2b" fontSize="9.3" fontWeight="900">Comunicación</text>
          </g>
          <g>
            <rect x="200" y="26" width="82" height="40" rx="20" fill="#ffffff" stroke="#384652" strokeWidth="1.6" />
            <text x="241" y="50" textAnchor="middle" fill="#071a2b" fontSize="10" fontWeight="900">Proveedor</text>
          </g>
          <g>
            <rect x="108" y="162" width="84" height="28" rx="14" fill="#ffffff" stroke="#384652" strokeWidth="1.6" />
            <text x="150" y="180" textAnchor="middle" fill="#071a2b" fontSize="10" fontWeight="900">Cliente</text>
          </g>
          {mode === "journey" && <text x="18" y="176" fill="#607789" fontSize="10" fontStyle="italic" fontWeight="850">secuencia real</text>}
        </svg>
      </div>
    </figure>
  );
}

function ProcessMapMini() {
  return (
    <figure className="process-map-mini">
      <figcaption>Ejemplo visual de mapa de procesos</figcaption>
      <div>
        <section className="mini-band strategic"><strong>Estratégicos</strong><span>Gobierno</span><span>Indicadores</span></section>
        <section className="mini-band core"><strong>Clave / operativos</strong><span>Solicitud</span><span>Diseño</span><span>Entrega</span></section>
        <section className="mini-band support"><strong>Soporte</strong><span>Sistemas</span><span>Proveedor</span></section>
      </div>
    </figure>
  );
}

function getProgress(entities: Entity[], processes: Process[]) {
  const complete = processes.filter((process) => process.status === "complete").length;
  const pending = processes.length - complete;
  const missingInput = processes.filter((process) => !process.input).length;
  const missingOutput = processes.filter((process) => !process.output).length;
  const pendingMessages = [missingInput ? `completar input de ${missingInput} proceso(s)` : "", missingOutput ? `completar output de ${missingOutput} proceso(s)` : ""].filter(Boolean);
  return { entities: entities.length, relations: processes.length, processes: processes.length, complete, pending, pendingMessages };
}

function entityName(entities: Entity[], id: string) {
  return entities.find((entity) => entity.id === id)?.name ?? "Sin entidad";
}

function macroprocessLabel(type?: MacroprocessType | null) {
  return macroprocessOptions.find((option) => option.value === type)?.label ?? "Sin clasificar";
}

function countEntities(entities: Entity[], processes: Process[], field: "sourceEntityId" | "targetEntityId") {
  const counts = new Map<string, number>();
  processes.forEach((process) => counts.set(process[field], (counts.get(process[field]) ?? 0) + 1));
  return [...counts.entries()]
    .map(([id, count]) => ({ id, name: entityName(entities, id), count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function enrichedProcesses(store: ReturnType<typeof useAppStore.getState>) {
  return store.processes.map((process) => {
    const stage = store.valueChainStages.find((item) => item.id === process.valueChainStageId);
    return { ...process, supplier: entityName(store.entities, process.sourceEntityId), customer: entityName(store.entities, process.targetEntityId), stage: macroprocessLabel(process.macroprocessType ?? stage?.category), category: process.macroprocessType ?? stage?.category ?? "core" };
  });
}

function toCsv(store: ReturnType<typeof useAppStore.getState>) {
  const rows = [["Nº", "ID", "Proceso", "Supplier", "Input", "Output", "Customer", "Macroproceso", "Estado"], ...enrichedProcesses(store).map((p) => [p.displayOrder, p.id, p.name, p.supplier, p.input, p.output, p.customer, p.stage, p.status])];
  return rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
}

function snapshotStore(store: ReturnType<typeof useAppStore.getState>) {
  return { schemaVersion: store.schemaVersion, project: store.project, entities: store.entities, processes: store.processes, valueChainStages: store.valueChainStages, selectedEntityId: store.selectedEntityId, selectedProcessId: store.selectedProcessId };
}

function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadDataUrl(name: string, dataUrl: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = name;
  link.click();
}

function safeFileName(value: string) {
  return (value || "docroi-mapa-procesos").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

