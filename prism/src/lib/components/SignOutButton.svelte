<script lang="ts">
  import { goto } from '$app/navigation';
  import { authService } from '$lib/auth';
  
  interface Props {
    variant?: 'primary' | 'secondary' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    showIcon?: boolean;
    className?: string;
  }
  
  let { 
    variant = 'secondary',
    size = 'md',
    showIcon = true,
    className = ''
  }: Props = $props();
  
  let loading = $state(false);
  
  function hapticTap() {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(50);
    }
  }
  
  async function handleSignOut() {
    hapticTap();
    loading = true;
    
    try {
      await authService.logout();
      goto('/login');
    } catch (error) {
      console.error('Sign out failed:', error);
    } finally {
      loading = false;
    }
  }
  
  const variantClasses = {
    primary: 'bg-[#00FF00] text-[#171717] border-[#171717]',
    secondary: 'bg-white text-[#171717] border-[#171717] hover:bg-gray-50',
    danger: 'bg-red-500 text-white border-[#171717] hover:bg-red-600'
  };
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };
</script>

<button
  onclick={handleSignOut}
  disabled={loading}
  class="inline-flex items-center gap-2 font-bold border-2 
         shadow-solid-sm active:shadow-none active:translate-y-0.5 transition-all
         disabled:opacity-50 disabled:cursor-not-allowed
         {variantClasses[variant]}
         {sizeClasses[size]}
         {className}"
>
  {#if showIcon}
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      class="h-5 w-5" 
      fill="none" 
      viewBox="0 0 24 24" 
      stroke="currentColor"
    >
      <path 
        stroke-linecap="round" 
        stroke-linejoin="round" 
        stroke-width="2" 
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" 
      />
    </svg>
  {/if}
  
  {#if loading}
    <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  {:else}
    Sign Out
  {/if}
</button>

<style>
  .shadow-solid-sm {
    box-shadow: 2px 2px 0px 0px #171717;
  }
</style>