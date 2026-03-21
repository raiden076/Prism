<script lang="ts">
  import type { HierarchyNode } from '$lib/hierarchy';

  interface Props {
    nodes: HierarchyNode[];
    selectedId?: string;
    onselect?: (node: HierarchyNode) => void;
  }

  let { nodes, selectedId, onselect } = $props();

  function getNodeColor(role: string, depth: number): string {
    if (role === 'admin') return 'bg-[#00FF00] text-black';
    if (role === 'contractor') return 'bg-blue-500 text-white';
    if (depth === 0) return 'bg-yellow-500 text-black';
    return 'bg-white/20 text-white';
  }

  function getDepthLabel(depth: number): string {
    if (depth === 0) return 'Apex';
    if (depth <= 2) return 'Senior';
    if (depth <= 4) return 'Mid';
    return 'Field';
  }
</script>

<div class="hierarchy-tree">
  {#if nodes.length === 0}
    <p class="text-white/50 font-mono text-sm text-center py-8">No hierarchy data available</p>
  {:else}
    <div class="space-y-2">
      {#each nodes as node}
        <button
          onclick={() => onselect?.(node)}
          class="w-full p-3 border-2 transition-all
            {selectedId === node.id ? 'border-[#00FF00] bg-[#00FF00]/10' : 'border-[#0a0a0a] bg-[#171717] hover:border-white/30'}"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <!-- Depth indicator -->
              <div class="flex items-center gap-1">
                {#each Array(node.hierarchy_depth) as _, i}
                  <div class="w-1 h-4 bg-white/30"></div>
                {/each}
              </div>

              <!-- User info -->
              <div>
                <p class="font-mono text-sm text-white truncate">
                  {node.phone_number || node.id.substring(0, 8)}
                </p>
                <p class="text-xs text-white/50">
                  {getDepthLabel(node.hierarchy_depth)}
                </p>
              </div>
            </div>

            <!-- Role badge -->
            <span class="px-2 py-1 text-xs font-bold uppercase {getNodeColor(node.role, node.hierarchy_depth)}">
              {node.role}
            </span>
          </div>

          <!-- Children count -->
          {#if node.children && node.children.length > 0}
            <p class="text-xs text-white/40 mt-2">
              {node.children.length} descendants
            </p>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .hierarchy-tree {
    max-height: 400px;
    overflow-y: auto;
  }
</style>
