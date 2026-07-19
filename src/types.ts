export type EntityShape = "rounded-rectangle" | "oval";
export type ProcessDirection = "unidirectional" | "bidirectional";
export type ProcessStatus = "draft" | "partial" | "complete";
export type ProcessMapCategory = "strategic" | "core" | "support";
export type MacroprocessType = ProcessMapCategory;

export interface ProjectInfo {
  id: string;
  name: string;
  organization: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface Entity {
  id: string;
  name: string;
  type: string;
  description: string;
  isPrimary: boolean;
  shape: EntityShape;
  position: { x: number; y: number };
  size?: { width: number; height: number };
  showDescription?: boolean;
  locked?: boolean;
  tags: string[];
}

export interface Process {
  id: string;
  visibleId?: string;
  displayOrder: number;
  name: string;
  sourceEntityId: string;
  targetEntityId: string;
  direction: ProcessDirection;
  input: string;
  output: string;
  description: string;
  status: ProcessStatus;
  valueChainStageId: string | null;
  macroprocessType?: MacroprocessType | null;
  lineStyle?: "smoothstep" | "straight" | "step" | "support";
  tags: string[];
}

export interface ValueChainStage {
  id: string;
  name: string;
  order: number;
  description: string;
  category: ProcessMapCategory;
}

export interface AppStateData {
  schemaVersion: "1.0.0";
  project: ProjectInfo;
  entities: Entity[];
  processes: Process[];
  valueChainStages: ValueChainStage[];
  selectedEntityId: string | null;
  selectedProcessId: string | null;
}
