<script lang="ts">
  import { onMount } from 'svelte';
  import { hapticFeedback } from '$lib/tauri/haptics';
  import HierarchyTree from '$lib/components/HierarchyTree.svelte';
  import WorkersStatusGrid from '$lib/components/WorkersStatusGrid.svelte';
  import type { HierarchyNode } from '$lib/hierarchy';

  // Tab state
  let activeTab = $state<'reports' | 'heatmap' | 'hierarchy' | 'ai-review' | 'workers'>('reports');

  // Reports data
  let reports: any[] = $state([]);
  let loading = $state(true);
  let errorMsg: string | null = $state(null);

  // Heatmap data
  let mapLoaded = $state(false);
  let mapInstance: any = null;

  // Hierarchy data
  let hierarchyNodes: HierarchyNode[] = $state([]);
  let selectedNode: HierarchyNode | null = $state(null);

  // AI Review queue
  let aiReviewQueue: any[] = $state([]);

  // Workers status
  let workers: any[] = $state([]);
  let workersSummary: any = $state(null);
  let workersLoading = $state(false);

  // Contractors
  let contractors: any[] = $state([]);
  let selectedContractor = $state('');
  let showDeployModal = $state(false);
  let selectedReportForDeploy: any = null;

  async function fetchBoard() {
    loading = true;
    try {
      const res = await fetch('http://localhost:8787/api/v2/reports');
      if (!res.ok) throw new Error('API Sync Failed');
      const data = await res.json();
      reports = data.data;
    } catch (err: any) {
      errorMsg = err.message;
    } finally {
      loading = false;
    }
  }

  async function fetchHierarchy() {
    try {
      const res = await fetch('http://localhost:8787/api/v1/hierarchy/tree');
      if (res.ok) {
        const data = await res.json();
        hierarchyNodes = data.nodes || [];
      }
    } catch (err) {
      console.error('Failed to fetch hierarchy:', err);
    }
  }

  async function fetchAIReviewQueue() {
    try {
      const res = await fetch('http://localhost:8787/api/v1/reports/ai-review');
      if (res.ok) {
        const data = await res.json();
        aiReviewQueue = data.reports || [];
      }
    } catch (err) {
      console.error('Failed to fetch AI review queue:', err);
    }
  }

  async function fetchContractors() {
    try {
      const res = await fetch('http://localhost:8787/api/v1/users?role=contractor');
      if (res.ok) {
        const data = await res.json();
        contractors = data.users || [];
      }
    } catch (err) {
      console.error('Failed to fetch contractors:', err);
    }
  }

  async function fetchWorkers() {
    workersLoading = true;
    try {
      const res = await fetch('http://localhost:8787/api/v1/workers/status');
      if (res.ok) {
        const data = await res.json();
        workers = data.workers || [];
        workersSummary = data.summary || null;
      }
    } catch (err) {
      console.error('Failed to fetch workers status:', err);
    } finally {
      workersLoading = false;
    }
  }

  onMount(() => {
    fetchBoard();
    fetchHierarchy();
    fetchAIReviewQueue();
    fetchContractors();
    fetchWorkers();

    // Initialize Mappls map when heatmap tab is active
    return () => {
      if (mapInstance) {
        mapInstance.remove();
      }
    };
  });

  function initHeatmap() {
    if (mapLoaded || !(window as any).mappls) return;

    try {
      (window as any).mappls.initialize('sfqsbabulouduoadafgwyaqwezmfyppmvjqz', () => {
        mapInstance = new (window as any).mappls.Map('heatmap-container', {
          center: [28.6139, 77.2090], // Default to Delhi
          zoom: 12
        });

        mapLoaded = true;

        // Add heatmap layer for reports
        const pendingReports = reports.filter(r => r.status !== 'resolved');

        if (pendingReports.length > 0) {
          const heatmapData = pendingReports.map(r => ({
            lat: r.latitude,
            lng: r.longitude,
            weight: r.severity_weight || 1
          }));

          // Create heatmap overlay
          // Note: Mappls heatmap requires their HeatmapLayer plugin
          // This is a placeholder for the actual implementation
          console.log('Heatmap data:', heatmapData);

          // Add markers for each report
          pendingReports.forEach(report => {
            const marker = new (window as any).mappls.Marker({
              position: [report.latitude, report.longitude],
              map: mapInstance,
              icon: {
                url: report.status === 'resolved'
                  ? 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiPjxjaXJjbGUgY3g9IjEwIiBjeT0iMTAiIHI9IjgiIGZpbGw9IiMwMEZGMDAiLz48L3N2Zz4='
                  : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiPjxjaXJjbGUgY3g9IjEwIiBjeT0iMTAiIHI9IjgiIGZpbGw9IiNGRjAwMDAiLz48L3N2Zz4=',
                size: [20, 20]
              }
            });

            marker.addListener('click', () => {
              alert(`Report: ${report.digipin}\nStatus: ${report.status}\nSeverity: ${report.severity_weight}`);
            });
          });
        }
      });
    } catch (err) {
      console.error('Map initialization error:', err);
    }
  }

  $effect(() => {
    if (activeTab === 'heatmap' && reports.length > 0) {
      initHeatmap();
    }
  });

  async function actionFix(reportId: string) {
    hapticFeedback.onTap();
    const fixLat = parseFloat(prompt("Enter Fix Latitude (Simulate Contractor GPS):") || "0");
    const fixLon = parseFloat(prompt("Enter Fix Longitude (Simulate Contractor GPS):") || "0");

    if (!fixLat || !fixLon) return;

    try {
      const res = await fetch('http://localhost:8787/api/v2/interventions/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_id: reportId,
          contractor_id: 'mock-contractor-01',
          repair_tier: 1,
          fix_latitude: fixLat,
          fix_longitude: fixLon,
          r2_proof_url: 'mock-proof.jpg'
        })
      });
      const data = await res.json();
      alert(data.status || data.error);
      fetchBoard();
    } catch(err) {
      alert("Intervention Network Error");
    }
  }

  async function actionVerify(reportId: string) {
    hapticFeedback.onTap();
    const isResolved = confirm("Does the ground-truth match the contractor proof?");

    try {
      const res = await fetch('http://localhost:8787/api/v2/interventions/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_id: reportId,
          verifier_id: 'mock-crony-02',
          is_resolved: isResolved,
          r2_verification_url: 'mock-eval.jpg'
        })
      });
      const data = await res.json();
      alert(data.status || data.error);
      fetchBoard();
    } catch (err) {
      alert("Verification Network Error");
    }
  }

  function openDeployModal(report: any) {
    hapticFeedback.onTap();
    selectedReportForDeploy = report;
    showDeployModal = true;
  }

  async function deployContractor() {
    if (!selectedContractor || !selectedReportForDeploy) return;

    hapticFeedback.onTap();

    try {
      const res = await fetch('http://localhost:8787/api/v1/deployments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_id: selectedReportForDeploy.id,
          contractor_id: selectedContractor
        })
      });

      if (res.ok) {
        alert('Contractor deployed successfully!');
        showDeployModal = false;
        selectedReportForDeploy = null;
        selectedContractor = '';
        fetchBoard();
      } else {
        const data = await res.json();
        alert(data.error || 'Deployment failed');
      }
    } catch (err) {
      alert('Deployment Network Error');
    }
  }

  async function approveAIReview(reportId: string) {
    hapticFeedback.onTap();

    try {
      const res = await fetch(`http://localhost:8787/api/v1/reports/${reportId}/approve`, {
        method: 'POST'
      });

      if (res.ok) {
        fetchAIReviewQueue();
      }
    } catch (err) {
      alert('Approval failed');
    }
  }

  async function rejectAIReview(reportId: string) {
    hapticFeedback.onTap();

    try {
      const res = await fetch(`http://localhost:8787/api/v1/reports/${reportId}/reject`, {
        method: 'POST'
      });

      if (res.ok) {
        fetchAIReviewQueue();
      }
    } catch (err) {
      alert('Rejection failed');
    }
  }

  function handleNodeSelect(node: HierarchyNode) {
    hapticFeedback.onTap();
    selectedNode = node;
  }
</script>

<main class="min-h-screen bg-[#171717] text-white font-sans selection:bg-[#00FF00] selection:text-black">
  <!-- Header -->
  <header class="p-4 border-b-4 border-[#0a0a0a]">
    <div class="max-w-6xl mx-auto flex justify-between items-end">
      <div>
        <h1 class="text-4xl md:text-6xl font-black uppercase tracking-tighter drop-shadow-[4px_4px_0px_#0a0a0a] text-white">War Room</h1>
        <p class="font-mono text-[#00FF00] font-bold tracking-widest uppercase text-sm">Control Dashboard</p>
      </div>
      <button onclick={fetchBoard} class="bg-[#0a0a0a] text-white px-4 py-2 font-mono text-sm border-2 border-white/20 active:translate-y-1">
        FORCE SYNC
      </button>
    </div>
  </header>

  <!-- Tab Navigation -->
  <nav class="border-b-4 border-[#0a0a0a] bg-black">
    <div class="max-w-6xl mx-auto flex">
      <button
        onclick={() => { hapticFeedback.onTap(); activeTab = 'reports'; }}
        class="flex-1 py-3 font-bold uppercase text-sm border-r-2 border-[#0a0a0a]
               {activeTab === 'reports' ? 'bg-[#00FF00] text-black' : 'bg-[#171717] text-white/60 hover:text-white'}"
      >
        Reports
      </button>
      <button
        onclick={() => { hapticFeedback.onTap(); activeTab = 'heatmap'; }}
        class="flex-1 py-3 font-bold uppercase text-sm border-r-2 border-[#0a0a0a]
               {activeTab === 'heatmap' ? 'bg-[#00FF00] text-black' : 'bg-[#171717] text-white/60 hover:text-white'}"
      >
        Heatmap
      </button>
      <button
        onclick={() => { hapticFeedback.onTap(); activeTab = 'hierarchy'; }}
        class="flex-1 py-3 font-bold uppercase text-sm border-r-2 border-[#0a0a0a]
               {activeTab === 'hierarchy' ? 'bg-[#00FF00] text-black' : 'bg-[#171717] text-white/60 hover:text-white'}"
      >
        Hierarchy
      </button>
      <button
        onclick={() => { hapticFeedback.onTap(); activeTab = 'ai-review'; }}
        class="flex-1 py-3 font-bold uppercase text-sm border-r-2 border-[#0a0a0a]
               {activeTab === 'ai-review' ? 'bg-[#00FF00] text-black' : 'bg-[#171717] text-white/60 hover:text-white'}"
      >
        AI Review {#if aiReviewQueue.length > 0}<span class="ml-1 bg-[#FF0000] text-white px-1 text-xs">{aiReviewQueue.length}</span>{/if}
      </button>
      <button
        onclick={() => { hapticFeedback.onTap(); activeTab = 'workers'; }}
        class="flex-1 py-3 font-bold uppercase text-sm
               {activeTab === 'workers' ? 'bg-[#00FF00] text-black' : 'bg-[#171717] text-white/60 hover:text-white'}"
      >
        Workers {#if workersSummary && !workersSummary.healthy}<span class="ml-1 bg-[#FF0000] text-white px-1 text-xs">!</span>{/if}
      </button>
    </div>
  </nav>

  <!-- Content Area -->
  <div class="max-w-6xl mx-auto p-6">
    {#if activeTab === 'reports'}
      <!-- Reports List -->
      {#if loading}
        <div class="text-[#00FF00] font-mono text-2xl font-bold animate-pulse">ACQUIRING TELEMETRY...</div>
      {:else if errorMsg}
        <div class="text-[#FF0000] font-mono bg-black p-4 border-4 border-[#FF0000] font-bold uppercase">
          FATAL ERROR: {errorMsg}
        </div>
      {:else}
        <div class="grid gap-6">
          {#each reports as report}
            <div class="bg-black border-4 border-[#0a0a0a] shadow-[8px_8px_0px_0px_#0a0a0a] p-6 flex flex-col md:flex-row gap-6 relative overflow-hidden">

              <!-- Severity Indicator -->
              <div class="absolute top-0 right-0 w-16 h-16 bg-[#0a0a0a] flex items-center justify-center font-black text-2xl border-l-4 border-b-4 border-black/50 text-[#00FF00]">
                {report.severity_weight}
              </div>

              <!-- Image Stub -->
              <div class="w-full md:w-48 h-48 bg-[#171717] border-4 border-[#0a0a0a] flex flex-col items-center justify-center font-mono opacity-80">
                <span class="text-[0.6rem] text-white/50">{report.id.split('-')[0]}</span>
                <span class="text-xs font-bold text-[#00FF00]">R2 BLOB SECURED</span>
              </div>

              <div class="flex-1 flex flex-col justify-between">
                <div>
                  <h2 class="text-3xl font-black uppercase tracking-tight mb-1">{report.digipin}</h2>
                  <div class="font-mono text-sm mb-4 space-y-1 text-white/70">
                    <p>LAT: <span class="text-white">{report.latitude}</span></p>
                    <p>LON: <span class="text-white">{report.longitude}</span></p>
                    <p>STATUS: <span class="px-2 py-0.5 bg-white text-black font-bold uppercase inline-block ml-2">{report.status.replace('_', ' ')}</span></p>
                  </div>
                </div>

                <div class="flex gap-4 mt-4">
                  {#if report.status === 'pending' || report.status === 'approved' || report.status === 'pending_review'}
                    <button
                      onclick={() => openDeployModal(report)}
                      class="flex-1 bg-blue-500 text-white font-bold uppercase text-sm h-12 border-2 border-[#0a0a0a] shadow-[4px_4px_0px_0px_#0a0a0a] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all"
                    >
                      Deploy Contractor
                    </button>
                    <button
                      onclick={() => actionFix(report.id)}
                      class="flex-1 bg-white text-black font-black uppercase text-sm h-12 border-2 border-[#0a0a0a] shadow-[4px_4px_0px_0px_#0a0a0a] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all"
                    >
                      Action Fix
                    </button>
                  {/if}

                  {#if report.status === 'fixed_pending_verification'}
                    <button
                      onclick={() => actionVerify(report.id)}
                      class="flex-1 bg-[#00FF00] text-black font-black uppercase text-sm h-12 border-2 border-[#0a0a0a] shadow-[4px_4px_0px_0px_#0a0a0a] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all"
                    >
                      Verify Fix
                    </button>
                  {/if}

                  {#if report.status === 'resolved'}
                    <div class="flex-1 bg-[#171717] text-white/50 flex items-center justify-center font-mono font-bold uppercase text-sm border-2 border-white/10">
                      Resolved
                    </div>
                  {/if}
                </div>
              </div>
            </div>
          {/each}

          {#if reports.length === 0}
            <div class="p-12 text-center text-white/50 font-mono text-xl uppercase border-4 border-dashed border-white/20">
              No active anomalies detected
            </div>
          {/if}
        </div>
      {/if}

    {:else if activeTab === 'heatmap'}
      <!-- 2D Tactical Heatmap -->
      <div class="bg-black border-4 border-[#0a0a0a] shadow-[8px_8px_0px_0px_#0a0a0a]">
        <div class="p-4 border-b-2 border-[#0a0a0a] flex justify-between items-center">
          <h2 class="text-xl font-black uppercase">Tactical Heatmap</h2>
          <div class="flex gap-4 text-xs font-mono">
            <span class="flex items-center gap-1">
              <span class="w-3 h-3 bg-[#FF0000] rounded-full"></span> Pending
            </span>
            <span class="flex items-center gap-1">
              <span class="w-3 h-3 bg-[#00FF00] rounded-full"></span> Resolved
            </span>
          </div>
        </div>
        <div id="heatmap-container" class="w-full h-[500px] bg-[#0a0a0a]">
          {#if !mapLoaded}
            <div class="w-full h-full flex items-center justify-center text-white/50 font-mono">
              {#if (window as any).mappls}
                Loading map...
              {:else}
                Mappls SDK not loaded. Add API key to +layout.svelte
              {/if}
            </div>
          {/if}
        </div>
      </div>

      <!-- Stats Panel -->
      <div class="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="bg-black border-2 border-[#0a0a0a] p-4">
          <p class="text-xs font-mono text-white/50 uppercase">Total Reports</p>
          <p class="text-3xl font-black text-white">{reports.length}</p>
        </div>
        <div class="bg-black border-2 border-[#0a0a0a] p-4">
          <p class="text-xs font-mono text-white/50 uppercase">Pending</p>
          <p class="text-3xl font-black text-[#FF0000]">{reports.filter(r => r.status === 'pending').length}</p>
        </div>
        <div class="bg-black border-2 border-[#0a0a0a] p-4">
          <p class="text-xs font-mono text-white/50 uppercase">In Progress</p>
          <p class="text-3xl font-black text-yellow-400">{reports.filter(r => r.status === 'fixed_pending_verification').length}</p>
        </div>
        <div class="bg-black border-2 border-[#0a0a0a] p-4">
          <p class="text-xs font-mono text-white/50 uppercase">Resolved</p>
          <p class="text-3xl font-black text-[#00FF00]">{reports.filter(r => r.status === 'resolved').length}</p>
        </div>
      </div>

    {:else if activeTab === 'hierarchy'}
      <!-- Power Hierarchy Tree -->
      <div class="grid md:grid-cols-3 gap-6">
        <div class="md:col-span-2 bg-black border-4 border-[#0a0a0a] shadow-[8px_8px_0px_0px_#0a0a0a]">
          <div class="p-4 border-b-2 border-[#0a0a0a]">
            <h2 class="text-xl font-black uppercase">Organization Hierarchy</h2>
            <p class="text-xs font-mono text-white/50">Apex to Field structure</p>
          </div>
          <div class="p-4 max-h-[500px] overflow-y-auto">
            <HierarchyTree
              nodes={hierarchyNodes}
              selectedId={selectedNode?.id}
              onselect={handleNodeSelect}
            />
          </div>
        </div>

        <!-- Selected Node Details -->
        <div class="bg-black border-4 border-[#0a0a0a] shadow-[8px_8px_0px_0px_#0a0a0a]">
          <div class="p-4 border-b-2 border-[#0a0a0a]">
            <h2 class="text-xl font-black uppercase">Node Details</h2>
          </div>
          <div class="p-4">
            {#if selectedNode}
              <div class="space-y-3">
                <div>
                  <p class="text-xs font-mono text-white/50 uppercase">Phone</p>
                  <p class="font-mono text-white">{selectedNode.phone_number || 'N/A'}</p>
                </div>
                <div>
                  <p class="text-xs font-mono text-white/50 uppercase">Role</p>
                  <p class="font-bold uppercase text-white">{selectedNode.role}</p>
                </div>
                <div>
                  <p class="text-xs font-mono text-white/50 uppercase">Depth</p>
                  <p class="text-white">{selectedNode.hierarchy_depth}</p>
                </div>
                {#if selectedNode.children && selectedNode.children.length > 0}
                  <div>
                    <p class="text-xs font-mono text-white/50 uppercase">Descendants</p>
                    <p class="text-white">{selectedNode.children.length} direct reports</p>
                  </div>
                {/if}
              </div>
            {:else}
              <p class="text-white/50 font-mono text-sm">Select a node to view details</p>
            {/if}
          </div>
        </div>
      </div>

    {:else if activeTab === 'ai-review'}
      <!-- AI Review Queue (Phase 2 Placeholder) -->
      <div class="bg-black border-4 border-[#0a0a0a] shadow-[8px_8px_0px_0px_#0a0a0a]">
        <div class="p-4 border-b-2 border-[#0a0a0a]">
          <div class="flex justify-between items-center">
            <div>
              <h2 class="text-xl font-black uppercase">AI Review Queue</h2>
              <p class="text-xs font-mono text-white/50">65-89% confidence reports requiring manual review</p>
            </div>
            <span class="px-3 py-1 bg-yellow-400 text-black font-bold text-sm uppercase">
              Phase 2 Feature
            </span>
          </div>
        </div>

        <div class="p-4">
          {#if aiReviewQueue.length > 0}
            <div class="space-y-4">
              {#each aiReviewQueue as report}
                <div class="border-2 border-[#0a0a0a] p-4 bg-[#171717]">
                  <div class="flex justify-between items-start">
                    <div>
                      <p class="font-mono text-sm text-white/60">{report.digipin}</p>
                      <p class="text-xs text-white/40">Confidence: {report.ai_confidence}%</p>
                    </div>
                    <div class="flex gap-2">
                      <button
                        onclick={() => approveAIReview(report.id)}
                        class="px-4 py-2 bg-[#00FF00] text-black font-bold uppercase text-xs border-2 border-[#0a0a0a]"
                      >
                        Approve
                      </button>
                      <button
                        onclick={() => rejectAIReview(report.id)}
                        class="px-4 py-2 bg-[#FF0000] text-white font-bold uppercase text-xs border-2 border-[#0a0a0a]"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="text-center py-12">
              <p class="text-white/50 font-mono text-lg uppercase">No reports pending AI review</p>
              <p class="text-xs text-white/30 mt-2">Reports with 65-89% AI confidence will appear here in Phase 2</p>
            </div>
          {/if}
        </div>
      </div>

    {:else if activeTab === 'workers'}
      <!-- Workers Status Grid -->
      <div class="bg-black border-4 border-[#0a0a0a] shadow-[8px_8px_0px_0px_#0a0a0a]">
        <div class="p-4 border-b-2 border-[#0a0a0a]">
          <div class="flex justify-between items-center">
            <div>
              <h2 class="text-xl font-black uppercase">Infrastructure Status</h2>
              <p class="text-xs font-mono text-white/50">Cloudflare Workers Health Monitor</p>
            </div>
            {#if workersSummary}
              <div class="flex gap-2">
                <div class="px-3 py-1 bg-[#00FF00]/20 border border-[#00FF00] text-[#00FF00] font-mono text-xs">
                  {workersSummary.online} Online
                </div>
                {#if workersSummary.degraded > 0}
                  <div class="px-3 py-1 bg-yellow-400/20 border border-yellow-400 text-yellow-400 font-mono text-xs">
                    {workersSummary.degraded} Degraded
                  </div>
                {/if}
                {#if workersSummary.offline > 0}
                  <div class="px-3 py-1 bg-[#FF0000]/20 border border-[#FF0000] text-[#FF0000] font-mono text-xs">
                    {workersSummary.offline} Offline
                  </div>
                {/if}
                {#if workersSummary.planned > 0}
                  <div class="px-3 py-1 bg-white/10 border border-white/30 text-white/50 font-mono text-xs">
                    {workersSummary.planned} Planned
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        </div>

        <div class="p-4">
          {#if workersLoading}
            <div class="text-[#00FF00] font-mono text-2xl font-bold animate-pulse">CHECKING WORKER STATUS...</div>
          {:else}
            <WorkersStatusGrid workers={workers} onrefresh={fetchWorkers} />
          {/if}
        </div>
      </div>
    {/if}
  </div>

  <!-- Deploy Contractor Modal -->
  {#if showDeployModal && selectedReportForDeploy}
    <div class="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
      <div class="bg-[#171717] border-4 border-[#00FF00] p-6 max-w-md w-full shadow-[8px_8px_0px_0px_#0a0a0a]">
        <h3 class="text-xl font-black uppercase text-[#00FF00] mb-4">Deploy Contractor</h3>

        <div class="mb-4 p-3 bg-black/50 border-2 border-[#0a0a0a]">
          <p class="text-xs font-mono text-white/50">Report</p>
          <p class="font-mono text-white">{selectedReportForDeploy.digipin}</p>
        </div>

        <div class="mb-6">
          <label class="block text-xs font-mono text-white/50 uppercase mb-2">Select Contractor</label>
          {#if contractors.length > 0}
            <select bind:value={selectedContractor} class="w-full p-3 bg-black border-2 border-[#0a0a0a] text-white font-mono">
              <option value="">Choose contractor...</option>
              {#each contractors as contractor}
                <option value={contractor.id}>{contractor.phone_number || contractor.id}</option>
              {/each}
            </select>
          {:else}
            <p class="text-white/50 font-mono text-sm">No contractors available</p>
          {/if}
        </div>

        <div class="flex gap-4">
          <button
            onclick={() => { hapticFeedback.onTap(); showDeployModal = false; }}
            class="flex-1 py-3 bg-transparent border-2 border-white/20 text-white font-bold uppercase text-sm"
          >
            Cancel
          </button>
          <button
            onclick={deployContractor}
            disabled={!selectedContractor}
            class="flex-1 py-3 bg-[#00FF00] text-black font-bold uppercase text-sm border-2 border-[#00FF00] disabled:opacity-50"
          >
            Deploy
          </button>
        </div>
      </div>
    </div>
  {/if}

  <footer class="p-6 border-t-4 border-[#0a0a0a]">
    <div class="max-w-6xl mx-auto">
      <a href="/" class="text-[#00FF00] font-mono uppercase hover:underline">
        ← Return to Field Interface
      </a>
    </div>
  </footer>
</main>
