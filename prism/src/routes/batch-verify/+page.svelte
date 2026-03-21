<script lang="ts">
  import { onMount } from 'svelte';
  import { hapticFeedback } from '$lib/tauri/haptics';
  import { getCurrentPosition, type LocationData } from '$lib/tauri/geolocation';
  import { latLngToDIGIPIN } from '$lib/digipin';

  interface GeoFenceCluster {
    id: string;
    center_latitude: number;
    center_longitude: number;
    center_digipin: string;
    radius_meters: number;
    cluster_status: string;
    report_count: number;
    reports?: any[];
    distance?: number;
  }

  let clusters: GeoFenceCluster[] = $state([]);
  let selectedCluster: GeoFenceCluster | null = $state(null);
  let loading = $state(true);
  let verifying = $state(false);
  let location: LocationData | null = $state(null);

  let verificationResults: Map<string, boolean> = $state(new Map());

  async function fetchClusters() {
    loading = true;
    try {
      // Get user location first
      location = await getCurrentPosition({ enableHighAccuracy: true });

      const response = await fetch(
        `http://localhost:8787/api/v1/geofences/nearby?lat=${location.latitude}&lon=${location.longitude}&radius=1000`
      );

      if (response.ok) {
        const data = await response.json();
        clusters = data.data || [];

        // Fetch reports for each cluster
        for (const cluster of clusters) {
          await fetchClusterReports(cluster.id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch clusters:', err);
    } finally {
      loading = false;
    }
  }

  async function fetchClusterReports(clusterId: string) {
    try {
      const response = await fetch(
        `http://localhost:8787/api/v1/geofences/${clusterId}/reports`
      );

      if (response.ok) {
        const data = await response.json();
        const cluster = clusters.find(c => c.id === clusterId);
        if (cluster) {
          cluster.reports = data.reports || [];
        }
      }
    } catch (err) {
      console.error('Failed to fetch cluster reports:', err);
    }
  }

  async function selectCluster(cluster: GeoFenceCluster) {
    hapticFeedback.onTap();
    selectedCluster = cluster;
    verificationResults = new Map();

    // Initialize all as resolved
    if (cluster.reports) {
      for (const report of cluster.reports) {
        verificationResults.set(report.id, true);
      }
    }
  }

  function toggleVerification(reportId: string) {
    hapticFeedback.onTap();
    const current = verificationResults.get(reportId) ?? true;
    verificationResults.set(reportId, !current);
    // Force reactivity update
    verificationResults = verificationResults;
  }

  async function submitBatchVerification() {
    if (!selectedCluster || !location) return;

    hapticFeedback.onTap();
    verifying = true;

    const phoneNumber = localStorage.getItem('prism_phone') || '';

    const reports = Array.from(verificationResults.entries()).map(([report_id, is_resolved]) => ({
      report_id,
      is_resolved,
      verification_latitude: location?.latitude,
      verification_longitude: location?.longitude
    }));

    try {
      const response = await fetch('http://localhost:8787/api/v1/geofences/batch-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geofence_id: selectedCluster.id,
          verifier_phone: phoneNumber,
          reports
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Batch verification complete!\n${result.verified_count} reports processed`);

        // Remove verified cluster from list
        clusters = clusters.filter(c => c.id !== selectedCluster.id);
        selectedCluster = null;
      } else {
        const error = await response.json();
        alert(error.error || 'Verification failed');
      }
    } catch (err) {
      alert('Network error during verification');
    } finally {
      verifying = false;
    }
  }

  onMount(() => {
    fetchClusters();
  });
</script>

<main class="min-h-screen bg-[#171717] text-white font-sans">
  <!-- Header -->
  <header class="p-4 border-b-4 border-[#0a0a0a]">
    <div class="max-w-4xl mx-auto flex justify-between items-center">
      <div>
        <h1 class="text-3xl font-black uppercase tracking-tight">Batch Verify</h1>
        <p class="text-xs font-mono text-white/60">Geo-fence cluster verification</p>
      </div>
      <button
        onclick={fetchClusters}
        class="bg-[#0a0a0a] text-white px-4 py-2 font-mono text-sm border-2 border-white/20 active:translate-y-1"
      >
        REFRESH
      </button>
    </div>
  </header>

  <div class="max-w-4xl mx-auto p-6">
    {#if loading}
      <div class="text-[#00FF00] font-mono text-xl font-bold animate-pulse text-center py-12">
        Scanning nearby clusters...
      </div>
    {:else if selectedCluster}
      <!-- Cluster Verification View -->
      <div class="mb-6">
        <button
          onclick={() => { hapticFeedback.onTap(); selectedCluster = null; }}
          class="text-[#00FF00] font-mono text-sm hover:underline"
        >
          ← Back to clusters
        </button>
      </div>

      <div class="bg-black border-4 border-[#0a0a0a] shadow-[8px_8px_0px_0px_#0a0a0a]">
        <div class="p-4 border-b-2 border-[#0a0a0a]">
          <h2 class="text-xl font-black uppercase">{selectedCluster.center_digipin}</h2>
          <p class="text-xs font-mono text-white/50">
            {selectedCluster.report_count} reports • {selectedCluster.radius_meters}m radius
          </p>
        </div>

        <div class="p-4">
          <p class="text-sm font-mono text-white/70 mb-4">
            Mark each report as Resolved (✓) or Still Pending (✗)
          </p>

          {#if selectedCluster.reports && selectedCluster.reports.length > 0}
            <div class="space-y-2 mb-6">
              {#each selectedCluster.reports as report}
                <button
                  class="w-full flex items-center justify-between p-3 border-2 transition-colors
                         {verificationResults.get(report.id) ? 'border-[#00FF00] bg-[#00FF00]/10' : 'border-[#FF0000] bg-[#FF0000]/10'}"
                  onclick={() => toggleVerification(report.id)}
                >
                  <div class="text-left">
                    <p class="font-mono text-sm">{report.digipin}</p>
                    <p class="text-xs text-white/50">
                      {new Date(report.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div class="text-2xl font-black">
                    {verificationResults.get(report.id) ? '✓' : '✗'}
                  </div>
                </button>
              {/each}
            </div>

            <!-- Summary -->
            <div class="grid grid-cols-2 gap-4 mb-6">
              <div class="bg-[#00FF00]/10 border-2 border-[#00FF00] p-3 text-center">
                <p class="text-2xl font-black text-[#00FF00]">
                  {Array.from(verificationResults.values()).filter(v => v).length}
                </p>
                <p class="text-xs font-mono text-white/60">Resolved</p>
              </div>
              <div class="bg-[#FF0000]/10 border-2 border-[#FF0000] p-3 text-center">
                <p class="text-2xl font-black text-[#FF0000]">
                  {Array.from(verificationResults.values()).filter(v => !v).length}
                </p>
                <p class="text-xs font-mono text-white/60">Still Pending</p>
              </div>
            </div>

            <button
              onclick={submitBatchVerification}
              disabled={verifying}
              class="w-full py-4 bg-[#00FF00] text-black font-black uppercase text-lg border-4 border-[#171717]
                     shadow-[6px_6px_0px_0px_#171717] active:shadow-none active:translate-y-1 active:translate-x-1
                     disabled:opacity-50 transition-all"
            >
              {verifying ? 'VERIFYING...' : 'SUBMIT BATCH VERIFICATION'}
            </button>
          {:else}
            <p class="text-white/50 font-mono text-center py-8">No reports in this cluster</p>
          {/if}
        </div>
      </div>

    {:else if clusters.length > 0}
      <!-- Cluster List View -->
      <div class="space-y-4">
        {#each clusters as cluster}
          <button
            onclick={() => selectCluster(cluster)}
            class="w-full bg-black border-4 border-[#0a0a0a] shadow-[6px_6px_0px_0px_#0a0a0a] p-4 text-left
                   hover:border-[#00FF00] transition-colors"
          >
            <div class="flex justify-between items-start">
              <div>
                <h3 class="font-black uppercase text-lg">{cluster.center_digipin}</h3>
                <p class="text-xs font-mono text-white/50">
                  {cluster.radius_meters}m radius • {cluster.report_count} reports
                </p>
              </div>
              <div class="text-right">
                {#if cluster.distance}
                  <p class="text-sm font-mono text-[#00FF00]">
                    {cluster.distance.toFixed(0)}m away
                  </p>
                {/if}
                <p class="text-xs font-mono uppercase px-2 py-1 mt-1
                          {cluster.cluster_status === 'active' ? 'bg-[#FF0000] text-white' : 'bg-[#00FF00] text-black'}">
                  {cluster.cluster_status}
                </p>
              </div>
            </div>
          </button>
        {/each}
      </div>

    {:else}
      <div class="text-center py-12">
        <p class="text-white/50 font-mono text-xl uppercase">No nearby clusters</p>
        <p class="text-xs text-white/30 mt-2">Geo-fence clusters will appear here when reports are grouped</p>
      </div>
    {/if}
  </div>

  <footer class="p-6 border-t-4 border-[#0a0a0a]">
    <div class="max-w-4xl mx-auto">
      <a href="/" class="text-[#00FF00] font-mono uppercase hover:underline">
        ← Return to Field Interface
      </a>
    </div>
  </footer>
</main>
