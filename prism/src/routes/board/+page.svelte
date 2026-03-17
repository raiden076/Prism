<script lang="ts">
  import { onMount } from 'svelte';

  let reports: any[] = $state([]);
  let loading = $state(true);
  let errorMsg: string | null = $state(null);

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

  onMount(() => {
    fetchBoard();
  });

  function simulateHardwareToggle() {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(20);
    }
  }

  async function actionFix(reportId: string) {
    simulateHardwareToggle();
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
    simulateHardwareToggle();
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
</script>

<main class="min-h-screen p-6 bg-[#171717] text-white font-sans selection:bg-[#00FF00] selection:text-black">
  <div class="max-w-4xl mx-auto">
    
    <header class="mb-10 pb-4 border-b-4 border-[#0a0a0a] flex justify-between items-end">
      <div>
        <h1 class="text-6xl font-black uppercase tracking-tighter drop-shadow-[4px_4px_0px_#0a0a0a] text-white">War Room</h1>
        <p class="font-mono text-[#00FF00] font-bold tracking-widest uppercase">Live Interventions Board</p>
      </div>
      <div>
        <button onclick={fetchBoard} class="bg-[#0a0a0a] text-white px-4 py-2 font-mono text-sm border-2 border-white/20 active:translate-y-1">
          FORCE SYNC
        </button>
      </div>
    </header>

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

            <!-- Conceptual Image Stub -->
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
                    onclick={() => actionFix(report.id)}
                    class="flex-1 bg-white text-black font-black uppercase text-lg h-12 border-2 border-[#0a0a0a] shadow-[4px_4px_0px_0px_#0a0a0a] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all"
                  >
                    Action Fix
                  </button>
                {/if}

                {#if report.status === 'fixed_pending_verification'}
                  <button 
                    onclick={() => actionVerify(report.id)}
                    class="flex-1 bg-[#00FF00] text-black font-black uppercase text-lg h-12 border-2 border-[#0a0a0a] shadow-[4px_4px_0px_0px_#0a0a0a] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all"
                  >
                    Verify Fix
                  </button>
                {/if}

                {#if report.status === 'resolved'}
                   <div class="flex-1 bg-[#171717] text-white/50 flex items-center justify-center font-mono font-bold uppercase text-lg border-2 border-white/10 decoration-line-through">
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

    <a href="/" class="block mt-12 text-[#00FF00] font-mono uppercase hover:underline">
      ← Return to Field Interface
    </a>
  </div>
</main>
