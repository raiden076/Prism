<script lang="ts">
  import { page } from '$app/stores';
  
  let currentPath = $state('');
  
  $effect(() => {
    currentPath = $page.url.pathname;
  });

  import { hapticFeedback } from '$lib/tauri/haptics';

  function simulateHardwareToggle() {
    hapticFeedback.onTap();
  }

  const navItems = [
    { path: '/', label: 'Record Pothole', description: 'Initial detection & reporting' },
    { path: '/area-check', label: 'Area Check', description: 'Authorized zone monitoring' },
    { path: '/bounties', label: 'Verification Bounties', description: 'Find nearby tasks' },
  ];
</script>

<nav class="w-full max-w-2xl mx-auto mb-8">
  <div class="flex flex-col md:flex-row gap-4">
    {#each navItems as item}
      <a
        href={item.path}
        onclick={simulateHardwareToggle}
        class="flex-1 min-h-24 bg-[#171717] border-4 border-[#0a0a0a] shadow-[6px_6px_0px_0px_#0a0a0a]
               active:shadow-none active:translate-y-2 active:translate-x-2
               transition-all duration-100 ease-out
               {currentPath === item.path ? 'bg-[#0a0a0a] border-[#00FF00]' : ''}"
      >
        <div class="p-4 h-full flex flex-col justify-between">
          <div>
            <h3 class="text-xl font-black uppercase tracking-tight text-white">
              {item.label}
            </h3>
            <p class="text-xs font-mono text-white/50 mt-1">
              {item.description}
            </p>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-xs font-mono text-white/30 uppercase">
              Public Interface
            </span>
            {#if currentPath === item.path}
              <div class="w-3 h-3 bg-[#00FF00] rounded-full animate-pulse"></div>
            {/if}
          </div>
        </div>
      </a>
    {/each}
  </div>
</nav>