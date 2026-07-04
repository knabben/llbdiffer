// Only this file (and adapt.ts, its sibling) may import the DOT parsing
// library. No other module in this project should know Graphviz syntax
// exists, per Constitution Principle I (adapter isolation).
import { parse as parseDotAst } from '@ts-graphviz/ast';

export interface ParsedDotNode {
  id: string;
  attributes: Record<string, string>;
}

export interface ParsedDotEdge {
  source: string;
  target: string;
}

export interface ParsedDotGraph {
  nodes: ParsedDotNode[];
  edges: ParsedDotEdge[];
}

export class DotParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DotParseError';
  }
}

interface AstAttributeNode {
  type: 'Attribute';
  key: { value: string };
  value: { value: string };
}

interface AstNodeStatement {
  type: 'Node';
  id: { value: string };
  children: AstAttributeNode[];
}

interface AstNodeRef {
  id?: { value: string };
}

interface AstEdgeStatement {
  type: 'Edge';
  targets: AstNodeRef[];
}

type AstGraphStatement = AstNodeStatement | AstEdgeStatement | { type: string };

interface AstGraph {
  type: 'Graph';
  children: AstGraphStatement[];
}

interface AstRoot {
  type: 'Dot';
  children: Array<AstGraph | { type: string }>;
}

/**
 * Parses raw Graphviz DOT text into a flat node/edge structure.
 *
 * Deliberately does NOT auto-vivify nodes that are only ever referenced by an
 * edge (unlike Graphviz's own semantics) so that `adapt.ts` can detect and
 * reject dangling edge references (FR-004) instead of silently accepting
 * them.
 */
export function parseDot(dotText: string): ParsedDotGraph {
  let ast: AstRoot;
  try {
    ast = parseDotAst(dotText) as unknown as AstRoot;
  } catch (err) {
    throw new DotParseError(err instanceof Error ? err.message : String(err));
  }

  const graph = ast.children.find((c): c is AstGraph => c.type === 'Graph');
  if (!graph) {
    throw new DotParseError('No graph statement found in DOT source');
  }

  const nodeAttributes = new Map<string, Record<string, string>>();
  const edges: ParsedDotEdge[] = [];

  for (const stmt of graph.children) {
    if (stmt.type === 'Node') {
      const nodeStmt = stmt as AstNodeStatement;
      const id = nodeStmt.id.value;
      const attributes = nodeAttributes.get(id) ?? {};
      for (const attr of nodeStmt.children) {
        if (attr.type === 'Attribute') {
          attributes[attr.key.value] = attr.value.value;
        }
      }
      nodeAttributes.set(id, attributes);
    } else if (stmt.type === 'Edge') {
      const edgeStmt = stmt as AstEdgeStatement;
      const ids = edgeStmt.targets.map((t) => t.id?.value).filter((id): id is string => Boolean(id));
      for (let i = 0; i < ids.length - 1; i++) {
        edges.push({ source: ids[i], target: ids[i + 1] });
      }
    }
  }

  const nodes: ParsedDotNode[] = Array.from(nodeAttributes.entries()).map(([id, attributes]) => ({
    id,
    attributes,
  }));

  return { nodes, edges };
}
