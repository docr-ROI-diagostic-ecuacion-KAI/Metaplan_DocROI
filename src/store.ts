import { create } from "zustand";
import { applyEdgeChanges, applyNodeChanges, Edge, EdgeChange, MarkerType, Node, NodeChange } from "reactflow";
import { z } from "zod";
import { createEmptyProject, demoProject, recoveredBertelsmannProject, uid } from "./data";
import { AppStateData, Entity, MacroprocessType, Process, ProjectInfo, ValueChainStage } from "./types";

const STORAGE_KEY = "docroi-ingenieria-visual-procesos";

const projectSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  project: z.object({
    id: z.string(),
    name: z.string(),
    organization: z.string(),
    description: z.string(),
    createdAt: z.string(),
    updatedAt: z.string()
  }),
  entities: z.array(z.any()),
  processes: z.array(z.any()),
  valueChainStages: z.array(z.any()),
  selectedEntityId: z.string().nullable(),
  selectedProcessId: z.string().nullable()
});

interface AppStore extends AppStateData {
  past: AppStateData[];
  future: AppStateData[];
  hydrate: () => void;
  reset: () => void;
  loadDemo: () => void;
  loadRecoveredBertelsmann: () => void;
  importProject: (data: unknown) => void;
  updateProject: (patch: Partial<ProjectInfo>) => void;
  addEntity: (position?: { x: number; y: number }) => void;
  updateEntity: (id: string, patch: Partial<Entity>) => void;
  setPrimaryEntity: (id: string) => void;
  duplicateEntity: (id: string) => void;
  removeEntity: (id: string) => void;
  addProcess: (sourceId: string, targetId: string, name?: string) => void;
  updateProcess: (id: string, patch: Partial<Process>) => void;
  removeProcess: (id: string) => void;
  addStage: () => void;
  updateStage: (id: string, patch: Partial<ValueChainStage>) => void;
  moveProcessToStage: (processId: string, stageId: string | null) => void;
  selectEntity: (id: string | null) => void;
  selectProcess: (id: string | null) => void;
  undo: () => void;
  redo: () => void;
  autoLayout: () => void;
}

const snapshot = (state: AppStore): AppStateData => ({
  schemaVersion: state.schemaVersion,
  project: state.project,
  entities: state.entities,
  processes: state.processes,
  valueChainStages: state.valueChainStages,
  selectedEntityId: state.selectedEntityId,
  selectedProcessId: state.selectedProcessId
});

const stamp = (data: AppStateData): AppStateData => ({
  ...data,
  project: { ...data.project, updatedAt: new Date().toISOString() }
});

const commit = (set: (fn: (state: AppStore) => Partial<AppStore>) => void, change: (data: AppStateData) => AppStateData) => {
  set((state) => {
    const current = snapshot(state);
    const next = stamp(change(current));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return { ...next, past: [...state.past.slice(-49), current], future: [] };
  });
};

const initial = createEmptyProject();

const cp1252Extras: Record<string, number> = {
  "â‚¬": 0x80, "â€š": 0x82, "Æ’": 0x83, "â€ž": 0x84, "â€¦": 0x85, "â€ ": 0x86, "â€¡": 0x87,
  "Ë†": 0x88, "â€°": 0x89, "Å ": 0x8a, "â€¹": 0x8b, "Å’": 0x8c, "Å½": 0x8e,
  "â€˜": 0x91, "â€™": 0x92, "â€œ": 0x93, "â€": 0x94, "â€¢": 0x95, "â€“": 0x96, "â€”": 0x97,
  "Ëœ": 0x98, "â„¢": 0x99, "Å¡": 0x9a, "â€º": 0x9b, "Å“": 0x9c, "Å¾": 0x9e, "Å¸": 0x9f
};

const repairText = (value: string) => {
  if (!/[ÃÂâ]/.test(value)) return value;
  const bytes = Array.from(value, (char) => {
    const code = char.charCodeAt(0);
    return code <= 0xff ? code : cp1252Extras[char] ?? 0x3f;
  });
  const decoded = new TextDecoder("utf-8").decode(new Uint8Array(bytes));
  return decoded.includes("ï¿½") ? value : decoded;
};

const repairProjectText = <T>(value: T): T => {
  if (typeof value === "string") return repairText(value) as T;
  if (Array.isArray(value)) return value.map((item) => repairProjectText(item)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, repairProjectText(item)])) as T;
  }
  return value;
};

const stageToMacroprocess = (stage?: ValueChainStage): MacroprocessType | null => stage?.category ?? null;

const normalizeProject = (data: AppStateData): AppStateData => ({
  ...data,
  processes: data.processes.map((process) => ({
    ...process,
    macroprocessType: process.macroprocessType ?? stageToMacroprocess(data.valueChainStages.find((stage) => stage.id === process.valueChainStageId))
  }))
});

export const useAppStore = create<AppStore>((set) => ({
  ...initial,
  past: [],
  future: [],
  hydrate: () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = normalizeProject(repairProjectText(projectSchema.parse(JSON.parse(raw)) as AppStateData));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      set({ ...parsed, past: [], future: [] });
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  },
  reset: () => commit(set, () => createEmptyProject()),
  loadDemo: () => commit(set, () => normalizeProject(demoProject())),
  loadRecoveredBertelsmann: () => commit(set, () => normalizeProject(recoveredBertelsmannProject())),
  importProject: (data) => {
    const parsed = normalizeProject(projectSchema.parse(data) as AppStateData);
    commit(set, () => parsed);
  },
  updateProject: (patch) => commit(set, (data) => ({ ...data, project: { ...data.project, ...patch } })),
  addEntity: (position = { x: 260, y: 220 }) =>
    commit(set, (data) => {
      const isPrimary = data.entities.length === 0;
      const entity: Entity = {
        id: uid(),
        name: isPrimary ? "Entidad principal" : "Nueva entidad",
        type: "",
        description: "",
        isPrimary,
        shape: "rounded-rectangle",
        position,
        size: { width: 170, height: 82 },
        showDescription: true,
        locked: false,
        tags: []
      };
      return { ...data, entities: [...data.entities, entity], selectedEntityId: entity.id, selectedProcessId: null };
    }),
  updateEntity: (id, patch) =>
    commit(set, (data) => ({
      ...data,
      entities: data.entities.map((entity) => (entity.id === id ? { ...entity, ...patch } : entity))
    })),
  setPrimaryEntity: (id) =>
    commit(set, (data) => ({
      ...data,
      entities: data.entities.map((entity) => ({ ...entity, isPrimary: entity.id === id })),
      selectedEntityId: id,
      selectedProcessId: null
    })),
  duplicateEntity: (id) =>
    commit(set, (data) => {
      const original = data.entities.find((entity) => entity.id === id);
      if (!original) return data;
      const copy = {
        ...original,
        id: uid(),
        name: `${original.name} copia`,
        isPrimary: false,
        position: { x: original.position.x + 60, y: original.position.y + 60 }
      };
      return { ...data, entities: [...data.entities, copy], selectedEntityId: copy.id, selectedProcessId: null };
    }),
  removeEntity: (id) =>
    commit(set, (data) => ({
      ...data,
      entities: data.entities.filter((entity) => entity.id !== id),
      processes: data.processes.filter((process) => process.sourceEntityId !== id && process.targetEntityId !== id),
      selectedEntityId: null,
      selectedProcessId: null
    })),
  addProcess: (sourceId, targetId, name = "Nueva relación") =>
    commit(set, (data) => {
      const process: Process = {
        id: uid(),
        visibleId: String(data.processes.length + 1),
        displayOrder: data.processes.length + 1,
        name,
        sourceEntityId: sourceId,
        targetEntityId: targetId,
        direction: "unidirectional",
        input: "",
        output: "",
        description: "",
        status: "draft",
        valueChainStageId: data.valueChainStages[0]?.id ?? null,
        macroprocessType: "core",
        lineStyle: "smoothstep",
        tags: []
      };
      return { ...data, processes: [...data.processes, process], selectedEntityId: null, selectedProcessId: process.id };
    }),
  updateProcess: (id, patch) =>
    commit(set, (data) => ({
      ...data,
      processes: data.processes.map((process) => {
        if (process.id !== id) return process;
        const next = { ...process, ...patch };
        const hasCore = next.name.trim() && next.input.trim() && next.output.trim();
        return { ...next, status: hasCore ? "complete" : next.name.trim() ? "partial" : "draft" };
      })
    })),
  removeProcess: (id) =>
    commit(set, (data) => ({
      ...data,
      processes: data.processes
        .filter((process) => process.id !== id)
        .map((process, index) => ({ ...process, displayOrder: index + 1 })),
      selectedProcessId: null
    })),
  addStage: () =>
    commit(set, (data) => ({
      ...data,
      valueChainStages: [
        ...data.valueChainStages,
        { id: uid(), name: "Nuevo macroproceso", order: data.valueChainStages.length, description: "", category: "core" }
      ]
    })),
  updateStage: (id, patch) =>
    commit(set, (data) => ({
      ...data,
      valueChainStages: data.valueChainStages.map((stage) => (stage.id === id ? { ...stage, ...patch } : stage))
    })),
  moveProcessToStage: (processId, stageId) =>
    commit(set, (data) => ({
      ...data,
      processes: data.processes.map((process) =>
        process.id === processId ? { ...process, valueChainStageId: stageId } : process
      )
    })),
  selectEntity: (id) => set({ selectedEntityId: id, selectedProcessId: null }),
  selectProcess: (id) => set({ selectedProcessId: id, selectedEntityId: null }),
  undo: () =>
    set((state) => {
      const previous = state.past.at(-1);
      if (!previous) return {};
      const nextFuture = [snapshot(state), ...state.future].slice(0, 50);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(previous));
      return { ...previous, past: state.past.slice(0, -1), future: nextFuture };
    }),
  redo: () =>
    set((state) => {
      const next = state.future[0];
      if (!next) return {};
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return { ...next, past: [...state.past, snapshot(state)].slice(-50), future: state.future.slice(1) };
    }),
  autoLayout: () =>
    commit(set, (data) => {
      const center = { x: 430, y: 260 };
      const radiusX = Math.max(260, data.entities.length * 45);
      const radiusY = 190;
      const primary = data.entities.find((entity) => entity.isPrimary);
      const others = data.entities.filter((entity) => !entity.isPrimary);
      const arranged = [
        ...(primary ? [{ ...primary, position: center }] : []),
        ...others.map((entity, index) => {
          const angle = (Math.PI * 2 * index) / Math.max(others.length, 1) - Math.PI / 2;
          return {
            ...entity,
            position: {
              x: center.x + Math.cos(angle) * radiusX,
              y: center.y + Math.sin(angle) * radiusY
            }
          };
        })
      ];
      return { ...data, entities: arranged };
    })
}));

export const toFlowNodes = (entities: Entity[], selectedEntityId: string | null): Node[] =>
  entities.map((entity) => ({
    id: entity.id,
    type: "entityNode",
    position: entity.position,
    selected: entity.id === selectedEntityId,
    draggable: !entity.locked,
    data: {
      entity,
      width: entity.size?.width ?? 170,
      height: entity.size?.height ?? 82,
      inputs: useAppStore.getState().processes.filter((process) => process.targetEntityId === entity.id).length,
      outputs: useAppStore.getState().processes.filter((process) => process.sourceEntityId === entity.id).length
    },
    style: {
      width: entity.size?.width ?? 170,
      height: entity.size?.height ?? 82
    },
    className: [
      "entity-node",
      entity.isPrimary ? "entity-node-primary" : "",
      entity.shape === "oval" ? "entity-node-oval" : ""
    ].join(" ")
  }));

export const toFlowEdges = (processes: Process[], selectedProcessId: string | null): Edge[] =>
  processes.map((process) => {
    const entities = useAppStore.getState().entities;
    const sourceEntity = entities.find((entity) => entity.id === process.sourceEntityId);
    const targetEntity = entities.find((entity) => entity.id === process.targetEntityId);
    const sourceCenter = {
      x: (sourceEntity?.position.x ?? 0) + (sourceEntity?.size?.width ?? 170) / 2,
      y: (sourceEntity?.position.y ?? 0) + (sourceEntity?.size?.height ?? 82) / 2
    };
    const targetCenter = {
      x: (targetEntity?.position.x ?? 0) + (targetEntity?.size?.width ?? 170) / 2,
      y: (targetEntity?.position.y ?? 0) + (targetEntity?.size?.height ?? 82) / 2
    };
    const dx = targetCenter.x - sourceCenter.x;
    const dy = targetCenter.y - sourceCenter.y;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const sourceHandle = horizontal ? (dx >= 0 ? "right-out" : "left-out") : (dy >= 0 ? "bottom-out" : "top-out");
    const targetHandle = horizontal ? (dx >= 0 ? "left-in" : "right-in") : (dy >= 0 ? "top-in" : "bottom-in");
    const siblings = processes.filter(
      (item) =>
        (item.sourceEntityId === process.sourceEntityId && item.targetEntityId === process.targetEntityId) ||
        (item.sourceEntityId === process.targetEntityId && item.targetEntityId === process.sourceEntityId)
    );
    const orderedSiblings = [...siblings].sort((a, b) => a.displayOrder - b.displayOrder);
    const sameLaneBefore = orderedSiblings.filter(
      (item) => item.id !== process.id && item.displayOrder < process.displayOrder && item.displayOrder % 2 === process.displayOrder % 2
    ).length;
    const laneDistance = 96 + sameLaneBefore * 82;
    const visualOffset = process.displayOrder % 2 === 1 ? laneDistance : -laneDistance;
    const parallelOffset = siblings.length > 1
      ? horizontal
        ? (dx >= 0 ? visualOffset : -visualOffset)
        : (dy >= 0 ? -visualOffset : visualOffset)
      : 0;
    return {
      id: process.id,
      source: process.sourceEntityId,
      target: process.targetEntityId,
      sourceHandle,
      targetHandle,
      label: process.direction === "bidirectional"
        ? `${process.visibleId ?? process.displayOrder}↔`
        : process.visibleId ?? String(process.displayOrder),
      selected: process.id === selectedProcessId,
      type: "processEdge",
      data: { lineStyle: process.lineStyle ?? "smoothstep", status: process.status, parallelOffset },
      markerEnd: { type: MarkerType.ArrowClosed },
      markerStart: process.direction === "bidirectional" ? { type: MarkerType.ArrowClosed } : undefined,
      className: [
        process.status === "complete" ? "process-edge" : "process-edge-draft",
        process.lineStyle === "support" ? "process-edge-support" : ""
      ].join(" ")
    };
  });

export const applyFlowNodeChanges = (changes: NodeChange[]) => {
  const state = useAppStore.getState();
  const nodes = applyNodeChanges(changes, toFlowNodes(state.entities, state.selectedEntityId));
  const moved = nodes.reduce<Record<string, { x: number; y: number }>>((acc, node) => {
    acc[node.id] = node.position;
    return acc;
  }, {});
  changes.forEach((change) => {
    if (change.type === "position" && "dragging" in change && change.dragging === false) {
      state.updateEntity(change.id, { position: moved[change.id] });
    }
  });
};

export const applyFlowEdgeChanges = (changes: EdgeChange[]) => {
  const state = useAppStore.getState();
  const removed = changes.filter((change) => change.type === "remove");
  removed.forEach((change) => state.removeProcess(change.id));
  applyEdgeChanges(changes, toFlowEdges(state.processes, state.selectedProcessId));
};

export const createFlowConnection = (source?: string | null, target?: string | null) => {
  if (!source || !target || source === target) return;
  const state = useAppStore.getState();
  state.addProcess(source, target, "Intercambio pendiente de nombrar");
};

