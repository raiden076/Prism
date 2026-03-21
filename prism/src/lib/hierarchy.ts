/**
 * Power Hierarchy Utilities for PRISM
 * Manages the organizational tree from apex leaders to foot soldiers
 */

export interface HierarchyNode {
  id: string;
  phone_number: string;
  role: string;
  reporter_id: string | null;
  hierarchy_depth: number;
  supervisor_id?: string | null;
  tags?: string[];
  children?: HierarchyNode[];
}

export interface HierarchyTree {
  node: HierarchyNode;
  ancestors: HierarchyNode[];
  descendants: HierarchyNode[];
}

/**
 * Build ancestor chain from a node to the apex
 * @param node Starting node
 * @param allNodes All hierarchy nodes for lookup
 * @returns Array of ancestors from immediate parent to apex
 */
export function getAncestorChain(
  node: HierarchyNode,
  allNodes: Map<string, HierarchyNode>
): HierarchyNode[] {
  const ancestors: HierarchyNode[] = [];
  let currentId = node.reporter_id;

  while (currentId) {
    const ancestor = allNodes.get(currentId);
    if (!ancestor) break;

    ancestors.push(ancestor);
    currentId = ancestor.reporter_id;

    // Safety: prevent infinite loops
    if (ancestors.length > 20) {
      console.warn('Hierarchy depth exceeded 20, possible circular reference');
      break;
    }
  }

  return ancestors;
}

/**
 * Get all descendants of a node (subtree)
 * @param nodeId Starting node ID
 * @param allNodes All hierarchy nodes
 * @returns Array of all descendant nodes
 */
export function getDescendants(
  nodeId: string,
  allNodes: HierarchyNode[]
): HierarchyNode[] {
  const descendants: HierarchyNode[] = [];

  // Find all direct children
  const directChildren = allNodes.filter(
    (node) => node.reporter_id === nodeId
  );

  for (const child of directChildren) {
    descendants.push(child);
    // Recursively get their descendants
    descendants.push(...getDescendants(child.id, allNodes));
  }

  return descendants;
}

/**
 * Get all descendant IDs for access control queries
 */
export function getDescendantIds(
  nodeId: string,
  allNodes: HierarchyNode[]
): string[] {
  const descendants = getDescendants(nodeId, allNodes);
  return descendants.map((node) => node.id);
}

/**
 * Check if a user is an ancestor of another user
 */
export function isAncestorOf(
  potentialAncestorId: string,
  userId: string,
  allNodes: Map<string, HierarchyNode>
): boolean {
  const user = allNodes.get(userId);
  if (!user) return false;

  let currentId = user.reporter_id;
  while (currentId) {
    if (currentId === potentialAncestorId) return true;

    const ancestor = allNodes.get(currentId);
    if (!ancestor) break;
    currentId = ancestor.reporter_id;
  }

  return false;
}

/**
 * Check if a user has access to another user's data
 * (Either same user, descendant, or ancestor)
 */
export function hasAccessTo(
  accessorId: string,
  targetId: string,
  allNodes: Map<string, HierarchyNode>
): boolean {
  if (accessorId === targetId) return true;

  const accessor = allNodes.get(accessorId);
  const target = allNodes.get(targetId);

  if (!accessor || !target) return false;

  // Check if accessor is ancestor of target
  if (isAncestorOf(accessorId, targetId, allNodes)) return true;

  // Check if target is ancestor of accessor (for upward visibility)
  if (isAncestorOf(targetId, accessorId, allNodes)) return true;

  return false;
}

/**
 * Find users at a specific hierarchy depth
 */
export function findUsersAtDepth(
  depth: number,
  allNodes: HierarchyNode[]
): HierarchyNode[] {
  return allNodes.filter((node) => node.hierarchy_depth === depth);
}

/**
 * Get apex leaders (users at depth 0)
 */
export function getApexLeaders(allNodes: HierarchyNode[]): HierarchyNode[] {
  return findUsersAtDepth(0, allNodes);
}

/**
 * Get foot soldiers (users at maximum depth)
 */
export function getFootSoldiers(allNodes: HierarchyNode[]): HierarchyNode[] {
  const maxDepth = Math.max(...allNodes.map((n) => n.hierarchy_depth));
  return findUsersAtDepth(maxDepth, allNodes);
}

/**
 * Build a tree structure from flat node list
 */
export function buildHierarchyTree(
  rootNodeId: string,
  allNodes: HierarchyNode[]
): HierarchyTree | null {
  const nodeMap = new Map(allNodes.map((n) => [n.id, n]));
  const rootNode = nodeMap.get(rootNodeId);

  if (!rootNode) return null;

  const ancestors = getAncestorChain(rootNode, nodeMap);
  const descendants = getDescendants(rootNodeId, allNodes);

  return {
    node: rootNode,
    ancestors,
    descendants,
  };
}

/**
 * Calculate hierarchy statistics
 */
export function getHierarchyStats(allNodes: HierarchyNode[]): {
  totalUsers: number;
  maxDepth: number;
  avgDepth: number;
  apexCount: number;
  footSoldierCount: number;
} {
  if (allNodes.length === 0) {
    return {
      totalUsers: 0,
      maxDepth: 0,
      avgDepth: 0,
      apexCount: 0,
      footSoldierCount: 0,
    };
  }

  const depths = allNodes.map((n) => n.hierarchy_depth);
  const maxDepth = Math.max(...depths);
  const avgDepth = depths.reduce((a, b) => a + b, 0) / depths.length;

  return {
    totalUsers: allNodes.length,
    maxDepth,
    avgDepth: Math.round(avgDepth * 10) / 10,
    apexCount: findUsersAtDepth(0, allNodes).length,
    footSoldierCount: findUsersAtDepth(maxDepth, allNodes).length,
  };
}

/**
 * Format hierarchy path for display
 */
export function formatHierarchyPath(
  ancestors: HierarchyNode[]
): string {
  if (ancestors.length === 0) return 'Apex Leader';

  return ancestors
    .reverse()
    .map((node) => node.phone_number || node.id.substring(0, 8))
    .join(' → ');
}

/**
 * Get user's position in hierarchy description
 */
export function getHierarchyPosition(
  node: HierarchyNode,
  allNodes: HierarchyNode[]
): string {
  const stats = getHierarchyStats(allNodes);

  if (node.hierarchy_depth === 0) {
    return 'Apex Leader';
  }

  if (node.hierarchy_depth === stats.maxDepth) {
    return 'Foot Soldier';
  }

  const depthPercent = Math.round(
    (node.hierarchy_depth / stats.maxDepth) * 100
  );

  if (depthPercent < 33) {
    return 'Senior Leader';
  } else if (depthPercent < 66) {
    return 'Mid-Level';
  } else {
    return 'Field Operator';
  }
}
