export const SCHEMA_VERSION = '1.0.0';

export interface Node {
  id: string;
  label: string;
  /** Open, extensible metadata bag (FR-005). Always carries `command` (FR-006). */
  metadata: Record<string, unknown> & { command: string };
}

export interface Edge {
  source: string;
  target: string;
}

export interface Artifact {
  schemaVersion: string;
  nodes: Node[];
  edges: Edge[];
}
