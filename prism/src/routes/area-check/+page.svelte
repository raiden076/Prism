<script lang="ts">
  import { onMount } from 'svelte';

  let phoneNumber = $state('');
  let isAuthenticated = $state(false);
  let userRole = $state<string | null>(null);
  let userRegion = $state<string | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let reportsInArea: any[] = $state([]);
  let location: GeolocationPosition | null = $state(null);
  let locationError: string | null = $state(null);

  function simulateHardwareToggle() {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(30);
    }
  }

  async function authenticate() {
    if (!phoneNumber.trim()) {
      error = 'Phone number required';
      return;
    }

    simulateHardwareToggle();
    loading = true;
    error = null;

    try {
      // Get user info from backend
      const response = await fetch('http://localhost:8787/api/v2/user/info', {
        method: 'GET',
        headers: {
          'Authorization': phoneNumber.trim()
        }
      });

      if (response.status === 401 || response.status === 403 || response.status === 404) {
        error = 'Unauthorized. Phone number not whitelisted or not found.';
        return;
      }

      if (!response.ok) {
        error = 'Authentication failed. Please try again.';
        return;
      }

      const userData = await response.json();
      
      // If we get here, auth succeeded
      isAuthenticated = true;
      userRole = userData.role;
      userRegion = userData.region_scope || 'Zone-Unknown';
      
      // Get current location for area checking
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            location = pos;
            fetchReportsInArea();
          },
          (err) => {
            locationError = err.message;
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      } else {
        locationError = 'Geolocation not supported';
      }

    } catch (err: any) {
      error = 'Network error: ' + err.message;
    } finally {
      loading = false;
    }
  }

  async function fetchReportsInArea() {
    if (!location) return;

    try {
      const response = await fetch('http://localhost:8787/api/v2/reports');
      if (!response.ok) throw new Error('Failed to fetch reports');
      
      const data = await response.json();
      
      // Filter reports within 5km radius (simplified)
      reportsInArea = data.data.filter((report: any) => {
        const distance = calculateDistance(
          location!.coords.latitude,
          location!.coords.longitude,
          report.latitude,
          report.longitude
        );
        return distance <= 5; // 5km radius
      });
    } catch (err: any) {
      console.error('Failed to fetch reports:', err);
    }
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

  function logout() {
    simulateHardwareToggle();
    isAuthenticated = false;
    phoneNumber = '';
    userRole = null;
    userRegion = null;
    reportsInArea = [];
    location = null;
    locationError = null;
  }
</script>

<main class="max-w-4xl mx-auto">
  <!-- Header -->
  <div class="mb-8 pb-4 border-b-4 border-[#0a0a0a]">
    <h1 class="text-5xl font-black uppercase tracking-tighter text-white drop-shadow-[3px_3px_0px_#0a0a0a]">
      Area Check
    </h1>
    <p class="text-sm font-bold font-mono tracking-widest text-white/70 uppercase">
      Authorized Zone Monitoring
    </p>
  </div>

  {#if !isAuthenticated}
    <!-- Authentication Section -->
    <div class="bg-black border-4 border-[#0a0a0a] shadow-[8px_8px_0px_0px_#0a0a0a] p-8">
      <div class="mb-6">
        <h2 class="text-2xl font-black uppercase text-white mb-2">Authorization Required</h2>
        <p class="font-mono text-white/70">
          This interface requires whitelisted phone number authentication.
          Enter your registered phone number to access area monitoring.
        </p>
      </div>

      <div class="space-y-4">
        <div>
          <label for="phone-input" class="block font-mono text-sm uppercase text-white/50 mb-2">Phone Number</label>
          <input
            id="phone-input"
            type="tel"
            bind:value={phoneNumber}
            placeholder="+1234567890"
            class="w-full p-4 bg-[#171717] border-4 border-[#0a0a0a] text-white font-mono
                   focus:outline-none focus:border-[#00FF00] focus:shadow-[0_0_0_4px_rgba(0,255,0,0.2)]"
          />
        </div>

        {#if error}
          <div class="p-4 bg-[#FF0000]/10 border-2 border-[#FF0000] text-[#FF0000] font-mono">
            {error}
          </div>
        {/if}

        <button
          onclick={authenticate}
          disabled={loading}
          class="w-full h-16 bg-[#00FF00] border-4 border-[#0a0a0a] shadow-[6px_6px_0px_0px_#0a0a0a]
                 active:shadow-none active:translate-y-1 active:translate-x-1
                 text-[#0a0a0a] text-xl font-black uppercase tracking-wider transition-all duration-75
                 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'AUTHENTICATING...' : 'AUTHORIZE ACCESS'}
        </button>

        <div class="pt-4 border-t border-white/10">
          <p class="font-mono text-xs text-white/40 text-center">
            Only whitelisted numbers from trusted sources can access this interface.
            Contact your administrator for authorization.
          </p>
        </div>
      </div>
    </div>

  {:else}
    <!-- Authenticated Area Monitoring -->
    <div class="space-y-6">
      <!-- User Info Bar -->
      <div class="bg-black border-4 border-[#0a0a0a] p-4 flex justify-between items-center">
        <div>
          <p class="font-mono text-sm text-white/50 uppercase">Authorized User</p>
          <p class="text-xl font-black text-white">{phoneNumber}</p>
          <div class="flex gap-4 mt-2">
            <span class="px-3 py-1 bg-[#00FF00] text-black text-xs font-black uppercase">
              {userRole}
            </span>
            <span class="px-3 py-1 bg-[#171717] border-2 border-white/20 text-white text-xs font-mono uppercase">
              {userRegion}
            </span>
          </div>
        </div>
        <button
          onclick={logout}
          class="px-6 py-3 bg-transparent border-2 border-[#FF0000] text-[#FF0000] font-mono font-bold uppercase
                 active:bg-[#FF0000] active:text-black transition-colors"
        >
          Logout
        </button>
      </div>

      <!-- Location Status -->
      <div class="bg-black border-4 border-[#0a0a0a] p-6">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-2xl font-black uppercase text-white">Current Position</h3>
          <button
            onclick={() => {
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    location = pos;
                    fetchReportsInArea();
                  },
                  (err) => locationError = err.message,
                  { enableHighAccuracy: true }
                );
              }
            }}
            class="px-4 py-2 bg-[#171717] border-2 border-white/20 text-white font-mono text-sm uppercase
                   active:translate-y-1"
          >
            Refresh
          </button>
        </div>

        {#if location}
          <div class="grid grid-cols-2 gap-4">
            <div class="p-4 bg-[#171717] border-2 border-[#0a0a0a]">
              <p class="font-mono text-sm text-white/50 uppercase">Latitude</p>
              <p class="text-xl font-mono text-white">{location.coords.latitude.toFixed(6)}</p>
            </div>
            <div class="p-4 bg-[#171717] border-2 border-[#0a0a0a]">
              <p class="font-mono text-sm text-white/50 uppercase">Longitude</p>
              <p class="text-xl font-mono text-white">{location.coords.longitude.toFixed(6)}</p>
            </div>
            <div class="p-4 bg-[#171717] border-2 border-[#0a0a0a]">
              <p class="font-mono text-sm text-white/50 uppercase">Accuracy</p>
              <p class="text-xl font-mono text-white">{Math.round(location.coords.accuracy)}m</p>
            </div>
            <div class="p-4 bg-[#171717] border-2 border-[#0a0a0a]">
              <p class="font-mono text-sm text-white/50 uppercase">Zone Status</p>
              <p class="text-xl font-mono text-[#00FF00] font-bold">ACTIVE</p>
            </div>
          </div>
        {:else if locationError}
          <div class="p-4 bg-[#FF0000]/10 border-2 border-[#FF0000]">
            <p class="font-mono text-[#FF0000]">GPS Error: {locationError}</p>
          </div>
        {:else}
          <div class="p-8 text-center">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-[#00FF00] mb-4"></div>
            <p class="font-mono text-white/70">Acquiring GPS position...</p>
          </div>
        {/if}
      </div>

      <!-- Reports in Area -->
      <div class="bg-black border-4 border-[#0a0a0a] p-6">
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-2xl font-black uppercase text-white">Reports in Your Area</h3>
          <div class="px-4 py-2 bg-[#00FF00] text-black font-mono font-bold uppercase">
            {reportsInArea.length} ACTIVE
          </div>
        </div>

        {#if reportsInArea.length === 0}
          <div class="p-12 text-center border-4 border-dashed border-white/20">
            <p class="text-2xl font-black uppercase text-white/30 mb-2">NO REPORTS DETECTED</p>
            <p class="font-mono text-white/50">Your assigned zone appears to be clear.</p>
          </div>
        {:else}
          <div class="space-y-4">
            {#each reportsInArea as report}
              <div class="p-4 bg-[#171717] border-2 border-[#0a0a0a]">
                <div class="flex justify-between items-start mb-2">
                  <div>
                    <h4 class="text-xl font-black uppercase text-white">{report.digipin}</h4>
                    <p class="font-mono text-sm text-white/50">
                      {calculateDistance(location!.coords.latitude, location!.coords.longitude, report.latitude, report.longitude).toFixed(2)}km away
                    </p>
                  </div>
                  <div class="px-3 py-1 bg-white text-black text-xs font-black uppercase">
                    {report.status.replace('_', ' ')}
                  </div>
                </div>
                
                <div class="grid grid-cols-2 gap-2 mt-4">
                  <div>
                    <p class="font-mono text-xs text-white/50 uppercase">Coordinates</p>
                    <p class="font-mono text-sm text-white">
                      {report.latitude}, {report.longitude}
                    </p>
                  </div>
                  <div>
                    <p class="font-mono text-xs text-white/50 uppercase">Severity</p>
                    <p class="font-mono text-sm text-white">
                      Tier {report.severity_weight || 1}
                    </p>
                  </div>
                </div>

                <div class="mt-4 pt-4 border-t border-white/10">
                  <button
                    onclick={() => {
                      simulateHardwareToggle();
                      // Navigate to board for action
                      window.location.href = `/board`;
                    }}
                    class="w-full py-3 bg-transparent border-2 border-white/30 text-white font-mono font-bold uppercase
                           hover:bg-white/10 active:bg-white/20 transition-colors"
                  >
                    View in War Room →
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Quick Actions -->
      <div class="bg-black border-4 border-[#0a0a0a] p-6">
        <h3 class="text-2xl font-black uppercase text-white mb-4">Quick Actions</h3>
        <div class="grid grid-cols-2 gap-4">
          <button
            onclick={() => {
              simulateHardwareToggle();
              window.location.href = '/';
            }}
            class="p-6 bg-[#171717] border-2 border-[#0a0a0a] text-white font-black uppercase
                   active:border-[#00FF00] active:text-[#00FF00] transition-all"
          >
            Report New Issue
          </button>
          <button
            onclick={() => {
              simulateHardwareToggle();
              window.location.href = '/bounties';
            }}
            class="p-6 bg-[#171717] border-2 border-[#0a0a0a] text-white font-black uppercase
                   active:border-[#00FF00] active:text-[#00FF00] transition-all"
          >
            Find Bounties
          </button>
        </div>
      </div>
    </div>
  {/if}
</main>