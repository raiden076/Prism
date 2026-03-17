<script lang="ts">
  import { onMount } from 'svelte';

  let videoElement: HTMLVideoElement | undefined = $state();
  let canvasElement: HTMLCanvasElement | undefined = $state();
  
  let isRecording = $state(false);
  let isCaptured = $state(false);
  let capturedImageBlob: Blob | null = $state(null);
  let capturedImageUrl: string | null = $state(null);

  let location: GeolocationPosition | null = $state(null);
  let locationError: string | null = $state(null);
  
  let stream: MediaStream | null = null;

  function simulateHardwareToggle() {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(50);
    }
  }

  async function startRecording() {
    simulateHardwareToggle();
    isRecording = true;
    isCaptured = false;
    capturedImageBlob = null;
    capturedImageUrl = null;
    locationError = null;

    // 1. Get Location
    if (!navigator.geolocation) {
      locationError = "Geolocation is not supported by your browser";
    } else {
      navigator.geolocation.getCurrentPosition(
        (pos) => location = pos,
        (err) => locationError = err.message,
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }

    // 2. Start Camera
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } // Prefer rear camera
      });
      if (videoElement) {
        videoElement.srcObject = stream;
        videoElement.play();
      }
    } catch (err: any) {
      console.error("Camera error:", err);
      // Fallback or error state
    }
  }

  function burnMetadataToCanvas() {
    if (!videoElement || !canvasElement) return;

    const ctx = canvasElement.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions to match video stream
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;

    // Draw video frame
    ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

    // Burn-in metadata (Neo-Brutalism tactical style)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, canvasElement.height - 120, canvasElement.width - 20, 110);

    ctx.fillStyle = '#00FF00'; // action-success
    ctx.font = 'bold 24px monospace';
    
    const timestamp = new Date().toISOString();
    ctx.fillText(`TIMESTAMP: ${timestamp}`, 20, canvasElement.height - 85);
    
    if (location) {
      ctx.fillText(`LAT: ${location.coords.latitude.toFixed(6)}`, 20, canvasElement.height - 50);
      ctx.fillText(`LON: ${location.coords.longitude.toFixed(6)}`, 20, canvasElement.height - 20);
      ctx.fillText(`ACC: ±${Math.round(location.coords.accuracy)}m`, 350, canvasElement.height - 20);
    } else {
      ctx.fillStyle = '#FF0000'; // action-crisis
      ctx.fillText('GPS: UNAVAILABLE / ACQUIRING...', 20, canvasElement.height - 50);
    }
  }

  function captureSnapshot() {
    simulateHardwareToggle();
    
    burnMetadataToCanvas();

    // Convert canvas to Blob
    canvasElement.toBlob((blob) => {
      if (blob) {
        capturedImageBlob = blob;
        capturedImageUrl = URL.createObjectURL(blob);
        isCaptured = true;
        isRecording = false;
        
        // Stop camera tracks
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
      }
    }, 'image/jpeg', 0.9);
  }

  function discardSnapshot() {
    simulateHardwareToggle();
    isCaptured = false;
    capturedImageUrl = null;
    startRecording();
  }

  async function syncPayload() {
    simulateHardwareToggle();
    if (!capturedImageBlob || !location) return;

    try {
      const formData = new FormData();
      formData.append('media', capturedImageBlob, 'pothole_evidence.jpg');
      formData.append('latitude', location.coords.latitude.toString());
      formData.append('longitude', location.coords.longitude.toString());

      const response = await fetch('http://localhost:8787/api/v1/reports/harvest', {
        method: 'POST',
        headers: {
          'Authorization': '+1234567890' // Mock whitelisted phone number for Phase 1
        },
        body: formData
      });

      const result = await response.json();
      
      if (response.ok) {
        alert(`Success: Payload synced.\nDIGIPIN: ${result.digipin}`);
        // Reset state
        isCaptured = false;
        capturedImageUrl = null;
      } else {
        alert(`Failed: ${result.error}`);
      }
    } catch (err) {
      alert("Network Error: Could not connect to Prism Engine.");
    }
  }
</script>

<main class="min-h-screen flex flex-col items-center justify-center p-6 bg-[#171717] text-white font-sans">
  
  <!-- Header -->
  <div class="w-full max-w-lg mb-8 border-b-4 border-[#0a0a0a] pb-4 flex justify-between items-end gap-2">
    <div>
      <h1 class="text-5xl font-black uppercase tracking-tighter text-white drop-shadow-[3px_3px_0px_#0a0a0a]">
        Prism
      </h1>
      <p class="text-sm font-bold font-mono tracking-widest text-white/70 uppercase">
        Field Interface
      </p>
    </div>
    <div class="text-right font-mono text-xs font-bold uppercase">
      Status: <span class="text-[#00FF00]">Active</span>
    </div>
  </div>

  <div class="w-full max-w-lg flex-1 flex flex-col items-center justify-center relative">

    {#if !isRecording && !isCaptured}
      <!-- Initial State -->
      <button
        onclick={startRecording}
        class="w-full max-w-sm h-32 bg-[#00FF00] border-4 border-[#0a0a0a] shadow-[8px_8px_0px_0px_#0a0a0a]
               active:shadow-none active:translate-y-2 active:translate-x-2
               flex items-center justify-center text-[#0a0a0a] text-3xl font-black uppercase tracking-wider
               transition-all duration-75 ease-out outline-none"
      >
        Record Pothole
      </button>
      
      <p class="mt-8 font-mono text-sm opacity-50 uppercase tracking-widest text-center max-w-xs">
        Initiates physical device sensors (Camera & GPS)
      </p>

    {:else if isRecording && !isCaptured}
      <!-- Active Viewfinder -->
      <div class="w-full border-4 border-[#0a0a0a] bg-black relative shadow-[8px_8px_0px_0px_#0a0a0a]">
        <!-- svelte-ignore a11y_media_has_caption -->
        <video bind:this={videoElement} class="w-full h-auto object-cover" playsinline autoplay></video>
        
        <!-- UI Overlay -->
        <div class="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
          <p class="font-mono text-sm font-bold {location ? 'text-[#00FF00]' : 'text-yellow-400'}">
            {location ? `GPS LOCK: ${location.coords.accuracy.toFixed(0)}m` : 'ACQUIRING GPS...'}
          </p>
        </div>
      </div>

      <div class="w-full mt-6 grid grid-cols-2 gap-4">
        <button
          onclick={() => { isRecording = false; if(stream) stream.getTracks().forEach(t => t.stop()); }}
          class="h-16 bg-[#FF0000] border-4 border-[#0a0a0a] shadow-[4px_4px_0px_0px_#0a0a0a]
                 active:shadow-none active:translate-y-1 active:translate-x-1
                 text-white text-xl font-black uppercase tracking-wider transition-all duration-75"
        >
          Abort
        </button>
        <button
          onclick={captureSnapshot}
          disabled={!location}
          class="h-16 bg-white border-4 border-[#0a0a0a] shadow-[4px_4px_0px_0px_#0a0a0a]
                 active:shadow-none active:translate-y-1 active:translate-x-1 disabled:opacity-50 disabled:shadow-none
                 text-[#0a0a0a] text-xl font-black uppercase tracking-wider transition-all duration-75"
        >
          Capture
        </button>
      </div>

    {:else if isCaptured && capturedImageUrl}
      <!-- Review State -->
      <div class="w-full border-4 border-[#0a0a0a] bg-black shadow-[8px_8px_0px_0px_#0a0a0a]">
        <img src={capturedImageUrl} alt="Captured metadata" class="w-full h-auto object-cover" />
      </div>

      <div class="w-full mt-6 flex flex-col gap-4">
        <button
          onclick={syncPayload}
          class="w-full h-20 bg-[#00FF00] border-4 border-[#0a0a0a] shadow-[6px_6px_0px_0px_#0a0a0a]
                 active:shadow-none active:translate-y-1 active:translate-x-1
                 text-[#0a0a0a] text-2xl font-black uppercase tracking-wider transition-all duration-75"
        >
          Sync Protocol
        </button>
        <button
          onclick={discardSnapshot}
          class="w-full h-14 bg-transparent border-4 border-[#0a0a0a] shadow-[4px_4px_0px_0px_#0a0a0a]
                 active:shadow-none active:translate-y-1 active:translate-x-1
                 text-white text-lg font-bold uppercase tracking-wider transition-all duration-75"
        >
          Discard & Retake
        </button>
      </div>
    {/if}

    <!-- Hidden canvas for stamping -->
    <canvas bind:this={canvasElement} class="hidden"></canvas>
  </div>
</main>
