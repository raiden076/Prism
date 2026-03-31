<!--
  PRISM - Decentralized Civic Infrastructure Platform
  
  Licensed under Apache License 2.0 + Commons Clause
  See LICENSE file for full terms
  
  Commercial use, sale, or hosting of this software is prohibited
  without explicit permission from the licensor.
-->

<script lang="ts">
  import '../app.css';
  import Navigation from '../components/Navigation.svelte';
  import { authService, initSuperTokens, restoreSuperTokensSession, authStore, type AuthState, type UserProfile } from '$lib/auth';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';

  let { children } = $props();

  // Local reactive state
  let isAuthenticated = $state(false);
  let isLoading = $state(true);
  let userProfile = $state<UserProfile | null>(null);

  // Routes that don't require authentication
  const publicRoutes = ['/login', '/auth/callback'];

  onMount(() => {
    // Subscribe to auth store changes
    const unsubscribe = authStore.subscribe((state: AuthState) => {
      isAuthenticated = state.isAuthenticated;
      isLoading = state.isLoading;
      userProfile = state.user;
    });

    // Initialize and restore session
    (async () => {
      // Initialize SuperTokens (Task 3.1, 3.2)
      initSuperTokens();
      
      // Restore session from storage (Task 3.10)
      await restoreSuperTokensSession();
      
      // Check authentication status
      checkAuth();
    })();

    return unsubscribe;
  });

  function checkAuth() {
    const currentPath = $page.url.pathname;

    // Check if current route is public
    if (publicRoutes.some(route => currentPath.startsWith(route))) {
      return;
    }

    // Check if user is authenticated
    if (!isAuthenticated && !isLoading) {
      // Not authenticated, redirect to login
      goto('/login');
    }
  }

  // React to auth state changes
  $effect(() => {
    if (!isLoading && !isAuthenticated) {
      const currentPath = $page.url.pathname;
      if (!publicRoutes.some(route => currentPath.startsWith(route))) {
        goto('/login');
      }
    }
  });

  function handleLogout() {
    authService.logout();
    goto('/login');
  }
</script>

<svelte:head>
  <!-- Mappls SDK - Replace YOUR_MAPPLS_KEY with actual key for production -->
  <script src="https://apis.mappls.com/advancedmaps/api/sfqsbabulouduoadafgwyaqwezmfyppmvjqz/map_load?v=3.0"></script>
</svelte:head>

{#if isLoading}
  <!-- Loading state -->
  <div class="min-h-screen bg-[#171717] flex items-center justify-center">
    <div class="text-center">
      <div class="w-12 h-12 border-4 border-[#00FF00] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p class="text-white/60 font-mono text-sm">Loading PRISM...</p>
    </div>
  </div>
{:else if !isAuthenticated && !publicRoutes.some(route => $page.url.pathname.startsWith(route))}
  <!-- Not authenticated - will redirect -->
  <div class="min-h-screen bg-[#171717] flex items-center justify-center">
    <p class="text-white/60 font-mono text-sm">Redirecting to login...</p>
  </div>
{:else}
  <!-- Authenticated or public route -->
  <div class="min-h-screen bg-[#171717] text-white font-sans">
    {#if isAuthenticated}
      <div class="container mx-auto px-4 py-6">
        <!-- User context available to all authenticated pages -->
        <Navigation />
        {@render children()}
      </div>
    {:else}
      <!-- Public route (like login) - no navigation -->
      {@render children()}
    {/if}
  </div>
{/if}