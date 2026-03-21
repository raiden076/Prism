<script lang="ts">
  import { onMount } from 'svelte';
  import { hapticFeedback } from '$lib/tauri/haptics';

  let location: GeolocationPosition | null = $state(null);
  let locationError: string | null = $state(null);
  let loading = $state(true);
  let allBounties: any[] = $state([]);
  let filteredBounties: any[] = $state([]);
  let searchRadius = $state(10); // km
  let sortBy = $state('distance'); // distance, severity, recent
  let phoneNumber = $state('');
  let isAuthenticated = $state(false);

  onMount(() => {
    // Get location first
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          location = pos;
          locationError = null;
          fetchBounties();
        },
        (err) => {
          locationError = err.message;
          loading = false;
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      locationError = 'Geolocation not supported';
      loading = false;
    }
  });

  async function fetchBounties() {
    loading = true;
    try {
      let url = 'http://localhost:8787/api/v2/bounties';
      if (location) {
        url += `?lat=${location.coords.latitude}&lon=${location.coords.longitude}&radius=${searchRadius}`;
      }
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch bounties');
      
      const data = await response.json();
      allBounties = data.data;
      
      // Filter for bounties (reports that need verification or fixing)
      filterAndSortBounties();
    } catch (err: any) {
      console.error('Failed to fetch bounties:', err);
      // Fallback to using all reports if bounties endpoint fails
      const response = await fetch('http://localhost:8787/api/v2/reports');
      if (response.ok) {
        const data = await response.json();
        allBounties = data.data.filter((bounty: any) => 
          ['pending', 'pending_review', 'assigned', 'fixed_pending_verification'].includes(bounty.status)
        );
        filterAndSortBounties();
      }
    } finally {
      loading = false;
    }
  }

  function filterAndSortBounties() {
    if (allBounties.length === 0) {
      filteredBounties = [];
      return;
    }

    // Filter by status (these are "bounties" - tasks that need action)
    const bountyStatuses = ['pending', 'pending_review', 'assigned', 'fixed_pending_verification'];
    let bounties = allBounties.filter(bounty => 
      bountyStatuses.includes(bounty.status)
    );

    // Calculate distance for each bounty if not already provided by backend
    if (location && (!bounties[0]?.distance)) {
      bounties = bounties.map(bounty => {
        const distance = calculateDistance(
          location!.coords.latitude,
          location!.coords.longitude,
          bounty.latitude,
          bounty.longitude
        );
        return { ...bounty, distance };
      });

      // Filter by radius if we calculated distances
      bounties = bounties.filter(bounty => bounty.distance <= searchRadius);
    }

    // Sort
    switch (sortBy) {
      case 'distance':
        bounties.sort((a, b) => (a.distance || 0) - (b.distance || 0));
        break;
      case 'severity':
        bounties.sort((a, b) => (b.severity_weight || 1) - (a.severity_weight || 1));
        break;
      case 'recent':
        bounties.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }

    filteredBounties = bounties;
  }

  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  function getBountyType(status: string): { label: string, color: string, action: string } {
    switch (status) {
      case 'fixed_pending_verification':
        return { 
          label: 'VERIFICATION BOUNTY', 
          color: 'bg-[#00FF00] text-black',
          action: 'Verify Fix' 
        };
      case 'pending':
      case 'pending_review':
        return { 
          label: 'FIX BOUNTY', 
          color: 'bg-[#FF0000] text-white',
          action: 'Claim Fix' 
        };
      case 'assigned':
        return { 
          label: 'IN PROGRESS', 
          color: 'bg-yellow-500 text-black',
          action: 'View Details' 
        };
      default:
        return { 
          label: 'BOUNTY', 
          color: 'bg-white text-black',
          action: 'View' 
        };
    }
  }

  function getBountyReward(severity: number): string {
    const base = 50;
    const multiplier = severity || 1;
    return `₹${base * multiplier}`;
  }

  async function claimBounty(bountyId: string) {
    hapticFeedback.onTap();
    
    if (!phoneNumber.trim()) {
      alert('Enter your phone number to claim bounties');
      return;
    }

    // For now, just show a message
    alert(`Bounty ${bountyId} claimed! You will be notified when approved.`);
    
    // In real implementation, we'd call backend API to assign bounty
    // await fetch('http://localhost:8787/api/v2/bounties/claim', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     bounty_id: bountyId,
    //     claimant_phone: phoneNumber
    //   })
    // });
  }

  function authenticateForClaim() {
    if (phoneNumber.trim()) {
      isAuthenticated = true;
      hapticFeedback.onTap();
    }
  }
</script>

<main class="max-w-6xl mx-auto">
  <!-- Header -->
  <div class="mb-8 pb-4 border-b-4 border-[#0a0a0a]">
    <div class="flex justify-between items-end">
      <div>
        <h1 class="text-5xl font-black uppercase tracking-tighter text-white drop-shadow-[3px_3px_0px_#0a0a0a]">
          Verification Bounties
        </h1>
        <p class="text-sm font-bold font-mono tracking-widest text-white/70 uppercase">
          Find nearby tasks & earn rewards
        </p>
      </div>
      <div class="text-right">
        <div class="px-4 py-2 bg-[#00FF00] text-black font-mono font-bold uppercase inline-block">
          {filteredBounties.length} ACTIVE
        </div>
      </div>
    </div>
  </div>

  <!-- Controls Panel -->
  <div class="bg-black border-4 border-[#0a0a0a] shadow-[8px_8px_0px_0px_#0a0a0a] p-6 mb-8">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <!-- Location Status -->
      <div class="p-4 bg-[#171717] border-2 border-[#0a0a0a]">
        <p class="font-mono text-sm text-white/50 uppercase mb-2">Your Location</p>
        {#if location}
          <p class="text-lg font-mono text-white">
            {location.coords.latitude.toFixed(4)}, {location.coords.longitude.toFixed(4)}
          </p>
          <p class="text-xs font-mono text-white/50 mt-1">
            Accuracy: ±{Math.round(location.coords.accuracy)}m
          </p>
        {:else if locationError}
          <p class="text-[#FF0000] font-mono">Error: {locationError}</p>
        {:else}
          <p class="text-white/50 font-mono animate-pulse">Acquiring GPS...</p>
        {/if}
      </div>

      <!-- Search Radius -->
      <div class="p-4 bg-[#171717] border-2 border-[#0a0a0a]">
        <div class="flex justify-between items-center mb-2">
          <p class="font-mono text-sm text-white/50 uppercase">Search Radius</p>
          <p class="text-xl font-black text-[#00FF00]">{searchRadius}km</p>
        </div>
        <input
          type="range"
          min="1"
          max="50"
          bind:value={searchRadius}
          oninput={filterAndSortBounties}
          class="w-full h-2 bg-[#0a0a0a] rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00FF00]"
        />
        <div class="flex justify-between text-xs font-mono text-white/30 mt-2">
          <span>1km</span>
          <span>25km</span>
          <span>50km</span>
        </div>
      </div>

      <!-- Sort Options -->
      <div class="p-4 bg-[#171717] border-2 border-[#0a0a0a]">
        <p class="font-mono text-sm text-white/50 uppercase mb-2">Sort By</p>
        <div class="flex gap-2">
          <button
            onclick={() => { sortBy = 'distance'; filterAndSortBounties(); }}
            class={`flex-1 py-2 font-mono text-sm uppercase ${sortBy === 'distance' ? 'bg-[#00FF00] text-black' : 'bg-[#0a0a0a] text-white'}`}
          >
            Distance
          </button>
          <button
            onclick={() => { sortBy = 'severity'; filterAndSortBounties(); }}
            class={`flex-1 py-2 font-mono text-sm uppercase ${sortBy === 'severity' ? 'bg-[#00FF00] text-black' : 'bg-[#0a0a0a] text-white'}`}
          >
            Severity
          </button>
          <button
            onclick={() => { sortBy = 'recent'; filterAndSortBounties(); }}
            class={`flex-1 py-2 font-mono text-sm uppercase ${sortBy === 'recent' ? 'bg-[#00FF00] text-black' : 'bg-[#0a0a0a] text-white'}`}
          >
            Recent
          </button>
        </div>
      </div>
    </div>

    <!-- Authentication for Claiming -->
    <div class="mt-6 pt-6 border-t border-white/10">
      <div class="flex items-center gap-4">
        <div class="flex-1">
          <p class="font-mono text-sm text-white/50 uppercase mb-2">Claim Bounties With</p>
          <input
            type="tel"
            bind:value={phoneNumber}
            placeholder="+1234567890"
            class="w-full p-3 bg-[#171717] border-2 border-[#0a0a0a] text-white font-mono
                   focus:outline-none focus:border-[#00FF00]"
          />
        </div>
        <button
          onclick={authenticateForClaim}
          class="h-full px-6 bg-[#00FF00] text-black font-mono font-bold uppercase border-2 border-[#0a0a0a]
                 active:translate-y-1"
        >
          {isAuthenticated ? 'AUTHENTICATED' : 'VERIFY'}
        </button>
      </div>
      {#if isAuthenticated}
        <p class="mt-2 text-xs font-mono text-[#00FF00]">
          ✓ Ready to claim bounties. Your phone number will be used for verification.
        </p>
      {/if}
    </div>
  </div>

  <!-- Bounties Grid -->
  {#if loading}
    <div class="text-center py-16">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-[#00FF00] mb-4"></div>
      <p class="font-mono text-xl text-white/70">SCANNING FOR BOUNTIES...</p>
    </div>
  {:else if filteredBounties.length === 0}
    <div class="bg-black border-4 border-[#0a0a0a] p-16 text-center">
      <div class="text-6xl mb-4">🎯</div>
      <h2 class="text-3xl font-black uppercase text-white/30 mb-4">NO BOUNTIES FOUND</h2>
      <p class="font-mono text-white/50 max-w-md mx-auto mb-6">
        No verification or fix bounties found within {searchRadius}km of your location.
        Try increasing the search radius or check back later.
      </p>
      <button
        onclick={fetchBounties}
        class="px-8 py-4 bg-[#171717] border-2 border-white/20 text-white font-mono font-bold uppercase
               active:border-[#00FF00] active:text-[#00FF00]"
      >
        Refresh Search
      </button>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each filteredBounties as bounty}
        <div class="bg-black border-4 border-[#0a0a0a] shadow-[6px_6px_0px_0px_#0a0a0a] overflow-hidden">
          <!-- Bounty Header -->
          <div class="p-4 border-b-2 border-[#0a0a0a]">
            <div class="flex justify-between items-start mb-2">
              <div>
                <h3 class="text-xl font-black uppercase text-white truncate">{bounty.digipin}</h3>
                <p class="font-mono text-xs text-white/50">
                  {bounty.distance.toFixed(1)}km away
                </p>
              </div>
              <div class={`px-3 py-1 text-xs font-black uppercase ${getBountyType(bounty.status).color}`}>
                {getBountyType(bounty.status).label}
              </div>
            </div>
          </div>

          <!-- Bounty Details -->
          <div class="p-4">
            <div class="space-y-3">
              <div class="flex justify-between">
                <span class="font-mono text-sm text-white/50">Reward</span>
                <span class="font-mono text-lg font-bold text-[#00FF00]">
                  {getBountyReward(bounty.severity_weight)}
                </span>
              </div>
              
              <div class="flex justify-between">
                <span class="font-mono text-sm text-white/50">Severity</span>
                <span class="font-mono text-lg text-white">
                  Tier {bounty.severity_weight || 1}
                </span>
              </div>

              <div class="flex justify-between">
                <span class="font-mono text-sm text-white/50">Status</span>
                <span class="font-mono text-sm text-white uppercase">
                  {bounty.status.replace(/_/g, ' ')}
                </span>
              </div>

              <div class="pt-3 border-t border-white/10">
                <p class="font-mono text-xs text-white/50 mb-2">Coordinates</p>
                <p class="font-mono text-sm text-white truncate">
                  {bounty.latitude.toFixed(4)}, {bounty.longitude.toFixed(4)}
                </p>
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="p-4 bg-[#171717] border-t-2 border-[#0a0a0a]">
            <div class="flex gap-2">
              <button
                onclick={() => claimBounty(bounty.id)}
                disabled={!isAuthenticated}
                class="flex-1 py-3 bg-[#00FF00] text-black font-mono font-bold uppercase border-2 border-[#0a0a0a]
                       active:translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {getBountyType(bounty.status).action}
              </button>
              <button
                onclick={() => {
                  hapticFeedback.onTap();
                  window.location.href = `/board`;
                }}
                class="px-4 py-3 bg-transparent border-2 border-white/20 text-white font-mono text-sm uppercase
                       active:bg-white/10"
              >
                Details
              </button>
            </div>
            {#if !isAuthenticated}
              <p class="mt-2 text-xs font-mono text-white/50 text-center">
                Verify phone number to claim
              </p>
            {/if}
          </div>
        </div>
      {/each}
    </div>

    <!-- Stats Footer -->
    <div class="mt-8 pt-6 border-t border-white/20">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="p-4 bg-[#171717] border-2 border-[#0a0a0a] text-center">
          <p class="font-mono text-sm text-white/50 uppercase">Total Bounties</p>
          <p class="text-2xl font-black text-white">{allBounties.filter(b => ['pending', 'pending_review', 'assigned', 'fixed_pending_verification'].includes(b.status)).length}</p>
        </div>
        <div class="p-4 bg-[#171717] border-2 border-[#0a0a0a] text-center">
          <p class="font-mono text-sm text-white/50 uppercase">In Range</p>
          <p class="text-2xl font-black text-[#00FF00]">{filteredBounties.length}</p>
        </div>
        <div class="p-4 bg-[#171717] border-2 border-[#0a0a0a] text-center">
          <p class="font-mono text-sm text-white/50 uppercase">Avg Reward</p>
          <p class="text-2xl font-black text-white">
            ₹{Math.round(filteredBounties.reduce((sum, b) => sum + (50 * (b.severity_weight || 1)), 0) / (filteredBounties.length || 1))}
          </p>
        </div>
        <div class="p-4 bg-[#171717] border-2 border-[#0a0a0a] text-center">
          <p class="font-mono text-sm text-white/50 uppercase">Nearest</p>
          <p class="text-2xl font-black text-white">
            {filteredBounties.length > 0 ? filteredBounties[0].distance.toFixed(1) + 'km' : 'N/A'}
          </p>
        </div>
      </div>
    </div>
  {/if}

  <!-- How It Works -->
  <div class="mt-12 pt-8 border-t border-white/20">
    <h2 class="text-3xl font-black uppercase text-white mb-6">How Bounties Work</h2>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="p-6 bg-[#171717] border-2 border-[#0a0a0a]">
        <div class="text-4xl mb-4">1</div>
        <h3 class="text-xl font-black uppercase text-white mb-2">Find Bounties</h3>
        <p class="font-mono text-white/70">
          Use your location to discover nearby verification and fix bounties.
          Each bounty has a reward based on severity.
        </p>
      </div>
      <div class="p-6 bg-[#171717] border-2 border-[#0a0a0a]">
        <div class="text-4xl mb-4">2</div>
        <h3 class="text-xl font-black uppercase text-white mb-2">Claim & Complete</h3>
        <p class="font-mono text-white/70">
          Authenticate with your phone number to claim bounties.
          Follow the instructions to verify fixes or report completions.
        </p>
      </div>
      <div class="p-6 bg-[#171717] border-2 border-[#0a0a0a]">
        <div class="text-4xl mb-4">3</div>
        <h3 class="text-xl font-black uppercase text-white mb-2">Get Rewarded</h3>
        <p class="font-mono text-white/70">
          Once verified by the system, rewards are processed.
          Higher severity bounties offer higher rewards.
        </p>
      </div>
    </div>
  </div>
</main>