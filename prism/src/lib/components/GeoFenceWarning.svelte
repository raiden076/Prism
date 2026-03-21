<script lang="ts">
  import { hapticFeedback } from '$lib/tauri/haptics';
  import type { NearbyPothole } from '$lib/geofence';

  interface Props {
    nearbyPothole: NearbyPothole;
    onreportAnyway: (reason: string) => void;
    oncancel: () => void;
  }

  let { nearbyPothole, onreportAnyway, oncancel } = $props();

  let selectedReason = $state('');
  let showReasonSelect = $state(false);

  const reasons = [
    { value: 'different_location', label: 'Different location' },
    { value: 'still_unfixed', label: 'Still not fixed' },
    { value: 'worse_condition', label: 'Worse condition now' },
    { value: 'new_damage', label: 'New damage area' },
  ];

  function handleReportAnyway() {
    if (!selectedReason) {
      showReasonSelect = true;
      return;
    }
    hapticFeedback.onTap();
    onreportAnyway(selectedReason);
  }

  function handleCancel() {
    hapticFeedback.onTap();
    oncancel();
  }
</script>

<div class="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
    <div class="bg-[#171717] border-4 border-[#FF0000] p-6 max-w-sm w-full shadow-[4px_4px_0px_0px_#0a0a0a]">
      <!-- Warning Header -->
      <div class="flex items-center gap-3 mb-4 pb-4 border-b-2 border-[#0a0a0a]">
        <div class="w-8 h-8 bg-[#FF0000] flex items-center justify-center">
          <span class="text-white text-xl">!</span>
        </div>
        <div>
          <h3 class="text-lg font-bold uppercase text-[#FF0000]">Duplicate Alert</h3>
          <p class="text-xs text-white/60">Pothole already reported nearby</p>
        </div>
      </div>

      <!-- Existing Report Info -->
      <div class="mb-4">
        <p class="text-sm text-white/80 mb-2">
          A pothole was already exists <span class="font-bold">{nearbyPothole.distance.toFixed(0)}m</span> away:
        </p>
        <div class="p-3 bg-black/50 border-2 border-[#0a0a0a]">
          <p class="font-mono text-xs text-white/60">
            DIGIPIN: {nearbyPothole.digipin}
          </p>
          <p class="font-mono text-xs text-white/60">
            Status: <span class="uppercase">{nearbyPothole.status}</span>
          </p>
          <p class="font-mono text-xs text-white/60">
            Reported: {new Date(nearbyPothole.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <!-- Reason Selection -->
      {#if showReasonSelect}
        <p class="text-xs text-[#FF0000] mb-2">Please select a reason:</p>
      {/if}

      <div class="mb-4">
        <p class="text-xs text-white/60 uppercase font-bold mb-2">Why report anyway?</p>
        <div class="space-y-2">
          {#each reasons as reason}
            <button
              onclick={() => { selectedReason = reason.value; showReasonSelect = false; }}
              class="w-full p-2 text-left text-sm border-2 transition-colors
                {selectedReason === reason.value
                  ? 'border-[#00FF00] bg-[#00FF00]/10 text-white'
                  : 'border-[#0a0a0a] text-white/80 hover:border-white/30'}"
            >
              {reason.label}
            </button>
          {/each}
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex gap-2">
        <button
          onclick={handleCancel}
          class="flex-1 py-3 bg-transparent border-2 border-white/20 text-white font-bold uppercase text-sm
                 hover:bg-white/10 transition-colors"
        >
          Cancel
        </button>
        <button
          onclick={handleReportAnyway}
          disabled={!selectedReason}
          class="flex-1 py-3 bg-[#00FF00] text-black font-bold uppercase text-sm border-2 border-[#00FF00]
                 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Report Anyway
        </button>
      </div>
    </div>
  </div>
