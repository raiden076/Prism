<script lang="ts">
  import { initiatePhoneOTP, resendPhoneOTP, type InitiateResponse } from '$lib/supertokens';
  
  interface Props {
    onInitiate: (response: InitiateResponse, phoneNumber: string) => void;
    onError: (error: string) => void;
  }
  
  let { onInitiate, onError }: Props = $props();
  
  let phoneNumber = $state('');
  let loading = $state(false);
  let selectedChannel = $state<'WHATSAPP' | 'SMS' | 'AUTO'>('AUTO');
  
  function hapticTap() {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(50);
    }
  }
  
  function validatePhone(phone: string): boolean {
    const cleanPhone = phone.replace(/\D/g, '');
    return cleanPhone.length === 10;
  }
  
  async function handleSubmit() {
    hapticTap();
    
    if (!validatePhone(phoneNumber)) {
      onError('Enter a valid 10-digit phone number');
      return;
    }
    
    loading = true;
    
    try {
      const response = await initiatePhoneOTP(phoneNumber);
      
      if (response.success) {
        onInitiate(response, phoneNumber);
      } else {
        onError(response.error || 'Failed to send OTP');
      }
    } catch (e: any) {
      onError(e.message || 'Network error. Please try again.');
    } finally {
      loading = false;
    }
  }
  
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !loading) {
      handleSubmit();
    }
  }
</script>

<div class="p-6">
  <h2 class="text-xl font-bold text-[#171717] mb-1">Enter Phone</h2>
  <p class="text-gray-600 text-sm mb-6">
    We'll send an OTP via WhatsApp or SMS
  </p>
  
  <!-- Channel Selection -->
  <div class="mb-4">
    <label class="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">
      Delivery Method
    </label>
    <div class="flex gap-2">
      <button
        onclick={() => { hapticTap(); selectedChannel = 'AUTO'; }}
        class="flex-1 py-2 px-3 border-2 border-[#171717] text-sm font-bold transition-all
               {selectedChannel === 'AUTO' ? 'bg-[#00FF00] shadow-solid-sm' : 'bg-white hover:bg-gray-50'}"
      >
        Auto
      </button>
      <button
        onclick={() => { hapticTap(); selectedChannel = 'WHATSAPP'; }}
        class="flex-1 py-2 px-3 border-2 border-[#171717] text-sm font-bold transition-all
               {selectedChannel === 'WHATSAPP' ? 'bg-[#00FF00] shadow-solid-sm' : 'bg-white hover:bg-gray-50'}"
      >
        WhatsApp
      </button>
      <button
        onclick={() => { hapticTap(); selectedChannel = 'SMS'; }}
        class="flex-1 py-2 px-3 border-2 border-[#171717] text-sm font-bold transition-all
               {selectedChannel === 'SMS' ? 'bg-[#00FF00] shadow-solid-sm' : 'bg-white hover:bg-gray-50'}"
      >
        SMS
      </button>
    </div>
    <p class="text-xs text-gray-400 mt-2">
      {#if selectedChannel === 'AUTO'}
        We'll try WhatsApp first, then SMS if needed
      {:else if selectedChannel === 'WHATSAPP'}
        OTP will be sent via WhatsApp
      {:else}
        OTP will be sent via SMS
      {/if}
    </p>
  </div>
  
  <!-- Phone Input -->
  <div class="mb-6">
    <label class="block text-sm font-bold text-[#171717] mb-2">
      Phone Number
    </label>
    <div class="flex">
      <span class="inline-flex items-center px-4 bg-[#171717] text-white border-4 border-[#171717] font-mono">
        +91
      </span>
      <input
        type="tel"
        bind:value={phoneNumber}
        onkeydown={handleKeydown}
        placeholder="9876543210"
        maxlength="10"
        inputmode="numeric"
        autocomplete="tel"
        disabled={loading}
        class="flex-1 px-4 py-3 border-4 border-[#171717] border-l-0 font-mono text-lg 
               focus:outline-none focus:bg-yellow-100 disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>
  </div>
  
  <!-- Submit Button -->
  <button
    onclick={handleSubmit}
    disabled={loading || phoneNumber.length < 10}
    class="w-full py-4 bg-[#00FF00] text-[#171717] font-black text-lg border-4 border-[#171717]
           shadow-solid-md active:shadow-none active:translate-y-1 transition-all
           disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {#if loading}
      <span class="flex items-center justify-center gap-2">
        <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        SENDING...
      </span>
    {:else}
      GET OTP
    {/if}
  </button>
</div>

<style>
  .shadow-solid-sm {
    box-shadow: 2px 2px 0px 0px #171717;
  }
  .shadow-solid-md {
    box-shadow: 4px 4px 0px 0px #171717;
  }
</style>