<script lang="ts">
  import { verifyPhoneOTP, resendPhoneOTP, type VerifyResponse } from '$lib/supertokens';
  
  interface Props {
    phoneNumber: string;
    channel: 'WHATSAPP' | 'SMS';
    deviceId?: string;
    onVerify: (response: VerifyResponse) => void;
    onBack: () => void;
    onError: (error: string) => void;
    onResend: (response: { success: boolean; channel?: 'WHATSAPP' | 'SMS'; error?: string }) => void;
  }
  
  let { 
    phoneNumber, 
    channel, 
    deviceId,
    onVerify, 
    onBack, 
    onError,
    onResend 
  }: Props = $props();
  
  let otp = $state('');
  let loading = $state(false);
  let resendLoading = $state(false);
  let resendTimer = $state(60);
  let canResend = $state(false);
  
  // Start resend countdown
  $effect(() => {
    canResend = false;
    resendTimer = 60;
    
    const interval = setInterval(() => {
      resendTimer--;
      if (resendTimer <= 0) {
        canResend = true;
        clearInterval(interval);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  });
  
  function hapticTap() {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(50);
    }
  }
  
  function hapticError() {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([50, 100, 50]);
    }
  }
  
  function hapticSuccess() {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([50, 50, 50]);
    }
  }
  
  async function handleVerify() {
    hapticTap();
    
    if (otp.length < 4) {
      hapticError();
      onError('Enter a valid OTP code');
      return;
    }
    
    loading = true;
    
    try {
      const response = await verifyPhoneOTP(phoneNumber, otp, deviceId);
      
      if (response.success) {
        hapticSuccess();
        onVerify(response);
      } else {
        hapticError();
        onError(response.error || 'Verification failed');
      }
    } catch (e: any) {
      hapticError();
      onError(e.message || 'Network error. Please try again.');
    } finally {
      loading = false;
    }
  }
  
  async function handleResend() {
    if (!canResend || resendLoading) return;
    
    hapticTap();
    resendLoading = true;
    
    try {
      const response = await resendPhoneOTP(phoneNumber);
      onResend(response);
      
      if (response.success) {
        // Reset timer
        canResend = false;
        resendTimer = 60;
      }
    } catch (e: any) {
      onError(e.message || 'Failed to resend OTP');
    } finally {
      resendLoading = false;
    }
  }
  
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !loading) {
      handleVerify();
    }
  }
  
  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
</script>

<div class="p-6">
  <!-- Back Button -->
  <button
    onclick={() => { hapticTap(); onBack(); }}
    class="text-sm text-gray-600 hover:text-[#171717] mb-4 flex items-center gap-1 transition-colors"
  >
    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
    </svg>
    Back
  </button>
  
  <h2 class="text-xl font-bold text-[#171717] mb-1">Enter OTP</h2>
  <p class="text-gray-600 text-sm mb-2">
    Sent via {channel === 'WHATSAPP' ? 'WhatsApp' : 'SMS'} to +91{phoneNumber}
  </p>
  <p class="text-xs text-gray-400 mb-6">
    {#if channel === 'WHATSAPP'}
      Check your WhatsApp for the 6-digit code
    {:else}
      Check your text messages for the 6-digit code
    {/if}
  </p>
  
  <!-- OTP Input -->
  <div class="mb-6">
    <label class="block text-sm font-bold text-[#171717] mb-2">
      OTP Code
    </label>
    <input
      type="text"
      bind:value={otp}
      onkeydown={handleKeydown}
      placeholder="000000"
      maxlength="6"
      inputmode="numeric"
      autocomplete="one-time-code"
      disabled={loading}
      class="w-full px-4 py-3 border-4 border-[#171717] font-mono text-2xl text-center tracking-[0.5em]
             focus:outline-none focus:bg-yellow-100 disabled:opacity-50 disabled:cursor-not-allowed
             placeholder:tracking-normal"
    />
  </div>
  
  <!-- Verify Button -->
  <button
    onclick={handleVerify}
    disabled={loading || otp.length < 4}
    class="w-full py-4 bg-[#00FF00] text-[#171717] font-black text-lg border-4 border-[#171717]
           shadow-solid-md active:shadow-none active:translate-y-1 transition-all mb-4
           disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {#if loading}
      <span class="flex items-center justify-center gap-2">
        <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        VERIFYING...
      </span>
    {:else}
      VERIFY
    {/if}
  </button>
  
  <!-- Resend Section -->
  <div class="text-center">
    {#if canResend}
      <button
        onclick={handleResend}
        disabled={resendLoading}
        class="text-sm text-[#171717] font-bold hover:underline disabled:opacity-50"
      >
        {#if resendLoading}
          Resending...
        {:else}
          Didn't receive it? Resend OTP
        {/if}
      </button>
    {:else}
      <p class="text-sm text-gray-500">
        Resend in <span class="font-mono font-bold">{formatTime(resendTimer)}</span>
      </p>
    {/if}
  </div>
</div>

<style>
  .shadow-solid-md {
    box-shadow: 4px 4px 0px 0px #171717;
  }
</style>