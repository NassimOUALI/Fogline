import type { CategoryNodeData, LocalizedText } from '@fogline/pack-format';

/** Tri-state checkbox value derived from the set of hidden leaf ids. */
export type Visibility = 'all' | 'none' | 'mixed';

/** Anything that knows which markers are collected (a `Progress` qualifies). */
export interface CollectedLookup {
  readonly collected: Readonly<Record<string, string>>;
}

/**
 * Composite node: a `Group` (has children) or a `Category` (leaf). Every operation works on
 * either kind, so the filter tree UI never needs to know which one it holds.
 */
export interface CategoryNode {
  readonly kind: 'group' | 'category';
  readonly id: string;
  readonly name: LocalizedText;
  readonly icon?: string | undefined;
  readonly color?: string | undefined;
  readonly children: readonly CategoryNode[];
  /** Number of markers below this node. */
  count(): number;
  /** Number of collected markers below this node. */
  collectedCount(progress: CollectedLookup): number;
  /** Ids of every leaf at or below this node. */
  leafIds(): readonly string[];
  /** `all` when nothing below is hidden, `none` when everything is, otherwise `mixed`. */
  visibility(hiddenLeafIds: ReadonlySet<string>): Visibility;
  /** This node or a descendant with `id`. */
  find(id: string): CategoryNode | undefined;
}

interface NodeProps {
  readonly id: string;
  readonly name: LocalizedText;
  readonly icon?: string | undefined;
  readonly color?: string | undefined;
}

function countCollected(markerIds: readonly string[], progress: CollectedLookup): number {
  let collected = 0;
  for (const id of markerIds) {
    if (Object.hasOwn(progress.collected, id)) {
      collected += 1;
    }
  }
  return collected;
}

/** Leaf node. Holds the ids of the markers that reference it. */
export class Category implements CategoryNode {
  readonly kind = 'category';
  readonly id: string;
  readonly name: LocalizedText;
  readonly icon: string | undefined;
  readonly color: string | undefined;
  readonly children: readonly CategoryNode[] = [];
  readonly markerIds: readonly string[];

  constructor(props: NodeProps & { readonly markerIds?: readonly string[] }) {
    this.id = props.id;
    this.name = props.name;
    this.icon = props.icon;
    this.color = props.color;
    this.markerIds = Object.freeze([...(props.markerIds ?? [])]);
    Object.freeze(this);
  }

  count(): number {
    return this.markerIds.length;
  }

  collectedCount(progress: CollectedLookup): number {
    return countCollected(this.markerIds, progress);
  }

  leafIds(): readonly string[] {
    return [this.id];
  }

  visibility(hiddenLeafIds: ReadonlySet<string>): Visibility {
    return hiddenLeafIds.has(this.id) ? 'none' : 'all';
  }

  find(id: string): CategoryNode | undefined {
    return id === this.id ? this : undefined;
  }
}

/** Inner node. Counts and leaf ids roll up from its children. */
export class Group implements CategoryNode {
  readonly kind = 'group';
  readonly id: string;
  readonly name: LocalizedText;
  readonly icon: string | undefined;
  readonly color: string | undefined;
  readonly children: readonly CategoryNode[];
  private readonly leaves: readonly string[];
  private readonly total: number;

  constructor(props: NodeProps & { readonly children: readonly CategoryNode[] }) {
    this.id = props.id;
    this.name = props.name;
    this.icon = props.icon;
    this.color = props.color;
    this.children = Object.freeze([...props.children]);
    this.leaves = Object.freeze(this.children.flatMap((child) => child.leafIds()));
    this.total = this.children.reduce((sum, child) => sum + child.count(), 0);
    Object.freeze(this);
  }

  count(): number {
    return this.total;
  }

  collectedCount(progress: CollectedLookup): number {
    return this.children.reduce((sum, child) => sum + child.collectedCount(progress), 0);
  }

  leafIds(): readonly string[] {
    return this.leaves;
  }

  visibility(hiddenLeafIds: ReadonlySet<string>): Visibility {
    let sawVisible = false;
    let sawHidden = false;
    for (const child of this.children) {
      const childVisibility = child.visibility(hiddenLeafIds);
      if (childVisibility === 'mixed') {
        return 'mixed';
      }
      if (childVisibility === 'all') {
        sawVisible = true;
      } else {
        sawHidden = true;
      }
      if (sawVisible && sawHidden) {
        return 'mixed';
      }
    }
    // An empty group has nothing hidden.
    return sawHidden ? 'none' : 'all';
  }

  find(id: string): CategoryNode | undefined {
    if (id === this.id) {
      return this;
    }
    for (const child of this.children) {
      const found = child.find(id);
      if (found !== undefined) {
        return found;
      }
    }
    return undefined;
  }
}

/** A marker as the tree needs it: which leaf it belongs to. */
export interface CategorizedMarker {
  readonly id: string;
  readonly categoryId: string;
}

/** Display style of a leaf, inherited from the nearest ancestor that defines it. */
export interface CategoryStyle {
  readonly color?: string | undefined;
  readonly icon?: string | undefined;
}

/** The whole category forest with id look-ups. Immutable. */
export class CategoryTree {
  readonly roots: readonly CategoryNode[];
  private readonly byId: ReadonlyMap<string, CategoryNode>;
  private readonly parentOf: ReadonlyMap<string, CategoryNode>;

  constructor(roots: readonly CategoryNode[]) {
    this.roots = Object.freeze([...roots]);
    const byId = new Map<string, CategoryNode>();
    const parentOf = new Map<string, CategoryNode>();
    const visit = (node: CategoryNode, parent: CategoryNode | undefined): void => {
      byId.set(node.id, node);
      if (parent !== undefined) {
        parentOf.set(node.id, parent);
      }
      for (const child of node.children) {
        visit(child, node);
      }
    };
    for (const root of this.roots) {
      visit(root, undefined);
    }
    this.byId = byId;
    this.parentOf = parentOf;
    Object.freeze(this);
  }

  /**
   * Builds the composite from the pack's category data and a flat marker list.
   * Markers whose category is not a leaf of the tree are ignored (the validator reports them).
   */
  static fromData(
    nodes: readonly CategoryNodeData[],
    markers: readonly CategorizedMarker[],
    extraRoots: readonly CategoryNode[] = [],
  ): CategoryTree {
    const markerIdsByCategory = new Map<string, string[]>();
    for (const marker of markers) {
      const list = markerIdsByCategory.get(marker.categoryId);
      if (list === undefined) {
        markerIdsByCategory.set(marker.categoryId, [marker.id]);
      } else {
        list.push(marker.id);
      }
    }
    const build = (node: CategoryNodeData): CategoryNode => {
      const props = { id: node.id, name: node.name, icon: node.icon, color: node.color };
      if (node.children === undefined) {
        return new Category({ ...props, markerIds: markerIdsByCategory.get(node.id) ?? [] });
      }
      return new Group({ ...props, children: node.children.map(build) });
    };
    return new CategoryTree([...nodes.map(build), ...extraRoots]);
  }

  find(id: string): CategoryNode | undefined {
    return this.byId.get(id);
  }

  /** Ancestors of `id`, root first, excluding the node itself. */
  ancestorsOf(id: string): readonly CategoryNode[] {
    const ancestors: CategoryNode[] = [];
    let parent = this.parentOf.get(id);
    while (parent !== undefined) {
      ancestors.unshift(parent);
      parent = this.parentOf.get(parent.id);
    }
    return ancestors;
  }

  /** Color and icon of a node, inherited from the nearest ancestor when it has none. */
  styleOf(id: string): CategoryStyle {
    const chain = [...this.ancestorsOf(id), this.find(id)].reverse();
    let color: string | undefined;
    let icon: string | undefined;
    for (const node of chain) {
      color ??= node?.color;
      icon ??= node?.icon;
    }
    return { color, icon };
  }

  isLeaf(id: string): boolean {
    return this.find(id)?.kind === 'category';
  }

  count(): number {
    return this.roots.reduce((sum, root) => sum + root.count(), 0);
  }

  collectedCount(progress: CollectedLookup): number {
    return this.roots.reduce((sum, root) => sum + root.collectedCount(progress), 0);
  }

  leafIds(): readonly string[] {
    return this.roots.flatMap((root) => root.leafIds());
  }
}
