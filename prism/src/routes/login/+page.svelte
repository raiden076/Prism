<script lang="ts">
  import { goto } from '$app/navigation';
  import { initSuperTokens, authStore, type InitiateResponse, type VerifyResponse } from '$lib/supertokens';
  import PhoneInput from '$lib/components/PhoneInput.svelte';
  import OtpInput from '$lib/components/OtpInput.svelte';
  import { onMount } from 'svelte';
  
  // Initialize SuperTokens on mount
  onMount(() => {
    initSuperTokens();
  });
  
  let step = $state<'phone' | 'otp'>('phone');
  let phoneNumber = $state('');
  let channel = $state<'WHATSAPP' | 'SMS'>('WHATSAPP');
  let deviceId = $state('');
  let error = $state('');
  
  function handleInitiate(response: InitiateResponse, phone: string) {
    if (response.success) {
      phoneNumber = phone;
      channel = response.channel || 'WHATSAPP';
      deviceId = response.orderId || '';
      step = 'otp';
      error = '';
    }
  }
  
  function handleVerify(response: VerifyResponse) {
    if (response.success) {
      // Auth store is already updated by verifyPhoneOTP
      // Redirect to home
      goto('/');
    }
  }
  
  function handleBack() {
    step = 'phone';
    error = '';
  }
  
  function handleError(errorMessage: string) {
    error = errorMessage;
  }
  
  function handleResend(response: { success: boolean; channel?: 'WHATSAPP' | 'SMS'; error?: string }) {
    if (response.success && response.channel) {
      channel = response.channel;
    }
  }
</script>

<svelte:head>
  <title>Login - PRISM</title>
</svelte:head>

<div class="min-h-screen bg-[#171717] flex items-center justify-center p-4">
  <div class="w-full max-w-sm">
    <!-- Logo/Title -->
    <div class="text-center mb-8">
      <h1 class="text-4xl font-black text-white tracking-tight">PRISM</h1>
      <p class="text-gray-400 mt-2 text-sm">Civic Infrastructure Tracker</p>
    </div>
    
    <!-- Auth Card -->
    <div class="bg-[#FAFAFA] border-4 border-[#171717] shadow-solid-lg">
      <!-- Error Display -->
      {#if error}
        <div class="px-6 pt-6">
          <div class="bg-red-100 border-2 border-red-500 p-3 flex items-start gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
            <p class="text-red-700 text-sm font-medium">{error}</p>
          </div>
        </div>
      {/if}
      
      {#if step === 'phone'}
        <PhoneInput
          onInitiate={handleInitiate}
          onError={handleError}
        />
      {:else}
        <OtpInput
          phoneNumber={phoneNumber}
          channel={channel}
          deviceId={deviceId}
          onVerify={handleVerify}
          onBack={handleBack}
          onError={handleError}
          onResend={handleResend}
        />
      {/if}
    </div>
    
    <!-- Footer -->
    <p class="text-center text-gray-500 text-xs mt-6">
      By continuing, you agree to our Terms of Service
    </p>
  </div>
</div>

<style>
  .shadow-solid-lg {
    box-shadow: 6px 6px 0px 0px #171717;
  }
</style>