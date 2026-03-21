<script lang="ts" module>
  export interface WorkerStatus {
    id: string;
    name: string;
    url: string | null;
    region: string;
    type: string;
    description: string;
    status: 'online' | 'offline' | 'degraded' | 'planned';
    healthy: boolean | null;
    lastChecked: number;
    responseTime: number | null;
    uptime: number | null;
    phase?: number | null;
    error: string | null;
  }
</script>

<script lang="ts">
  import { hapticFeedback } from '$lib/tauri/haptics';

  interface Props {
    workers: WorkerStatus[];
    onrefresh?: () => void;
  }

  let { workers, onrefresh } = $props();

  function getStatusColor(status: string): string {
    switch (status) {
      case 'online':
        return 'bg-[#00FF00] text-black';
      case 'degraded':
        return 'bg-yellow-400 text-black';
      case 'offline':
        return 'bg-[#FF0000] text-white';
      case 'planned':
        return 'bg-white/20 text-white/50';
      default:
        return 'bg-white/20 text-white';
    }
  }

  function getStatusIcon(status: string): string {
    switch (status) {
      case 'online':
        return '●';
      case 'degraded':
        return '◐';
      case 'offline':
        return '✕';
      case 'planned':
        return '○';
      default:
        return '?';
    }
  }

  function formatResponseTime(ms: number | null): string {
    if (ms === null) return 'N/A';
    if (ms < 100) return `${ms}ms`;
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  function formatUptime(seconds: number | null): string {
    if (seconds === null) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  function handleRefresh() {
    hapticFeedback.onTap();
    onrefresh?.();
  }
</script>

<div class="workers-grid">
  <!-- Grid Header -->
  <div class="mb-6 flex justify-between items-center">
    <div>
      <h2 class="text-xl font-black uppercase">Worker Fleet Status</h2>
      <p class="text-xs font-mono text-white/50">Cloudflare Workers Health Monitor</p>
    </div>
    <button
      onclick={handleRefresh}
      class="bg-[#0a0a0a] text-white px-4 py-2 font-mono text-sm border-2 border-white/20 
             hover:border-[#00FF00] hover:text-[#00FF00] active:translate-y-1 transition-all"
    >
      REFRESH
    </button>
  </div>

  <!-- Workers Grid -->
  {#if workers.length === 0}
    <div class="p-12 text-center text-white/50 font-mono text-xl uppercase border-4 border-dashed border-white/20">
      No Workers configured
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-4">
      {#each workers as worker}
        <div class="bg-black border-4 border-[#0a0a0a] shadow-[4px_4px_0px_0px_#0a0a0a] p-4 relative overflow-hidden
                    {worker.status === 'offline' ? 'border-[#FF0000]/50' : ''}
                    {worker.status === 'degraded' ? 'border-yellow-400/50' : ''}">
          <!-- Status Indicator -->
          <div class="absolute top-0 right-0 w-12 h-12 flex items-center justify-center font-black text-xl
                      {getStatusColor(worker.status)}">
            {getStatusIcon(worker.status)}
          </div>

          <!-- Worker Header -->
          <div class="mb-3 pr-14">
            <h3 class="text-lg font-black uppercase tracking-tight">{worker.name}</h3>
            <div class="flex items-center gap-2 mt-1">
              <span class="px-2 py-0.5 bg-[#0a0a0a] text-white/70 text-xs font-mono uppercase">
                {worker.type}
              </span>
              <span class="px-2 py-0.5 bg-[#0a0a0a] text-white/70 text-xs font-mono uppercase">
                {worker.region}
              </span>
            </div>
          </div>

          <!-- Description -->
          <p class="text-sm text-white/60 mb-4 font-mono">{worker.description}</p>

          <!-- Metrics -->
          <div class="grid grid-cols-2 gap-2 text-xs">
            <!-- Response Time -->
            <div class="bg-[#0a0a0a] p-2">
              <p class="text-white/40 font-mono uppercase">Response</p>
              <p class="font-mono text-white {worker.responseTime && worker.responseTime > 1000 ? 'text-yellow-400' : ''}">
                {formatResponseTime(worker.responseTime)}
              </p>
            </div>

            <!-- Uptime -->
            <div class="bg-[#0a0a0a] p-2">
              <p class="text-white/40 font-mono uppercase">Uptime</p>
              <p class="font-mono text-white">{formatUptime(worker.uptime)}</p>
            </div>
          </div>

          <!-- Phase Badge (if applicable) -->
          {#if worker.phase}
            <div class="mt-3">
              <span class="px-2 py-1 bg-[#00FF00]/20 text-[#00FF00] text-xs font-bold uppercase border border-[#00FF00]/30">
                Phase {worker.phase}
              </span>
            </div>
          {/if}

          <!-- Error Message -->
          {#if worker.error}
            <div class="mt-3 p-2 bg-[#FF0000]/10 border border-[#FF0000]/30">
              <p class="text-xs text-[#FF0000] font-mono uppercase">{worker.error}</p>
            </div>
          {/if}

          <!-- Planned Badge -->
          {#if worker.status === 'planned'}
            <div class="mt-3">
              <span class="px-2 py-1 bg-white/10 text-white/50 text-xs font-bold uppercase border border-white/20">
                Coming Soon
              </span>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
