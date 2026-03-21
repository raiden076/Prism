<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authService } from '$lib/auth';
  import { requestCameraPermissions, capturePhoto, stopCamera, burnMetadata } from '$lib/tauri/camera';
  import { getCurrentPosition, isAccuracyPoor, getAccuracyWarning, type LocationData } from '$lib/tauri/geolocation';
  import { hapticFeedback } from '$lib/tauri/haptics';
  import { latLngToDIGIPIN } from '$lib/digipin';
  import { filterNearbyPotholes, type NearbyPothole } from '$lib/geofence';
  import GeoFenceWarning from '$lib/components/GeoFenceWarning.svelte';
  import {
    storeReportOffline,
    getPendingReports,
    isOnline
  } from '$lib/offline/db';

  // State
  let videoElement: HTMLVideoElement | undefined = $state();
  let canvasElement: HTMLCanvasElement | undefined = $state();

  let isRecording = $state(false);
  let isCaptured = $state(false);
  let isSubmitting = $state(false);
  let submitted = $state(false);
  let savedOffline = $state(false);

  let capturedImageUrl: string | null = $state(null);
  let capturedBlob: Blob | null = $state(null);
  let burnedDataUrl: string | null = $state(null);

  let location: LocationData | null = $state(null);
  let locationError: string | null = $state(null);
  let accuracyWarning: string | null = $state(null);

  let stream: MediaStream | null = null;
  let nearbyPotholes: NearbyPothole[] = $state([]);
  let pendingCount = $state(0);

  // Geo-fence warning state
  let showGeoFenceWarning = $state(false);
  let geoFencePothole: NearbyPothole | null = $state(null);

  // Mini-map state
  let showMiniMap = $state(false);
  let miniMapInstance: any = null;

  // Get user profile
  const userProfile = authService.getUserProfile();

  onMount(async () => {
    // Check pending reports count
    const pending = await getPendingReports();
    pendingCount = pending.length;
  });

  async function fetchNearbyPotholes(lat: number, lon: number) {
    try {
      const response = await fetch(
        `http://localhost:8787/api/v1/reports/nearby?lat=${lat}&lon=${lon}&radius=200`
      );

      if (response.ok) {
        const data = await response.json();
        nearbyPotholes = data.data || [];

        // Check if any pothole is within 50m (geo-fence)
        const closePotholes = filterNearbyPotholes(
        { latitude: lat, longitude: lon },
        nearbyPotholes,
        50
      );
        if (closePotholes.length > 0) {
          geoFencePothole = closePotholes[0];
          showGeoFenceWarning = true;
          hapticFeedback.onWarning();
        }
      }
    } catch (err) {
      console.error('Failed to fetch nearby potholes:', err);
    }
  }

  async function startRecording() {
    hapticFeedback.onTap();
    isRecording = true;
    isCaptured = false;
    submitted = false;
    savedOffline = false;
    capturedImageUrl = null;
    capturedBlob = null;
    burnedDataUrl = null;
    locationError = null;
    accuracyWarning = null;
    showGeoFenceWarning = false;

    // Get location first
    try {
      location = await getCurrentPosition({ enableHighAccuracy: true });

      if (isAccuracyPoor(location.accuracy)) {
        accuracyWarning = getAccuracyWarning(location.accuracy) || '';
        hapticFeedback.onWarning();
      }

      // Fetch nearby potholes for mini-map and geo-fence check
      await fetchNearbyPotholes(location.latitude, location.longitude);
    } catch (err: any) {
      locationError = err.message || 'Failed to get location';
      hapticFeedback.onError();
    }

    // Start camera
    try {
      stream = await requestCameraPermissions({ facingMode: 'environment' });
      if (videoElement && stream) {
        videoElement.srcObject = stream;
        await videoElement.play();
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      locationError = locationError || 'Camera access denied';
    }
  }

  function toggleMiniMap() {
    hapticFeedback.onTap();
    showMiniMap = !showMiniMap;

    if (showMiniMap && location && (window as any).mappls) {
      // Capture location in local variable for closure
      const loc = location;
      setTimeout(() => {
        try {
          (window as any).mappls.initialize('sfqsbabulouduoadafgwyaqwezmfyppmvjqz', () => {
            miniMapInstance = new (window as any).mappls.Map('minimap-container', {
              center: [loc.latitude, loc.longitude],
              zoom: 16
            });

            // Add user location marker
            new (window as any).mappls.Marker({
              position: [loc.latitude, loc.longitude],
              map: miniMapInstance,
              icon: {
                url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiPjxjaXJjbGUgY3g9IjEwIiBjeT0iMTAiIHI9IjgiIGZpbGw9IiMwMEZGMDAiLz48L3N2Zz4=',
                size: [20, 20]
              }
            });

            // Add nearby pothole markers
            nearbyPotholes.forEach(pothole => {
              new (window as any).mappls.Marker({
                position: [pothole.latitude, pothole.longitude],
                map: miniMapInstance,
                icon: {
                  url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiPjxjaXJjbGUgY3g9IjEwIiBjeT0iMTAiIHI9IjgiIGZpbGw9IiNGRjAwMDAiLz48L3N2Zz4=',
                  size: [16, 16]
                }
              });
            });
          });
        } catch (err) {
          console.error('Mini-map error:', err);
        }
      }, 100);
    }
  }

  async function captureSnapshot() {
    if (!videoElement) return;

    hapticFeedback.onTap();

    try {
      const result = await capturePhoto(videoElement);
      capturedImageUrl = result.dataUrl;
      capturedBlob = result.blob;

      // Burn metadata onto image
      if (location) {
        burnedDataUrl = await burnMetadata(result.dataUrl, {
          timestamp: new Date().toISOString(),
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
        });
      } else {
        burnedDataUrl = result.dataUrl;
      }

      isCaptured = true;
      isRecording = false;

      // Stop camera
      stopCamera();
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        stream = null;
      }

      hapticFeedback.onSuccess();
    } catch (err) {
      console.error('Capture error:', err);
      hapticFeedback.onError();
    }
  }

  function discardSnapshot() {
    hapticFeedback.onTap();
    isCaptured = false;
    capturedImageUrl = null;
    capturedBlob = null;
    burnedDataUrl = null;
    startRecording();
  }

  async function submitReport(reason?: string) {
    if (!capturedBlob || !location) return;

    hapticFeedback.onTap();
    isSubmitting = true;

    const digipin = latLngToDIGIPIN(location.latitude, location.longitude);
    const phoneNumber = authService.getPhoneNumber();

    try {
      const formData = new FormData();
      formData.append('media', capturedBlob, 'pothole_evidence.jpg');
      formData.append('latitude', location.latitude.toString());
      formData.append('longitude', location.longitude.toString());
      if (reason) {
        formData.append('duplicate_reason', reason);
      }

      const response = await fetch('http://localhost:8787/api/v1/reports/harvest', {
        method: 'POST',
        headers: {
          Authorization: phoneNumber || '',
        },
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        submitted = true;
        hapticFeedback.onSuccess();

        // Reset after delay
        setTimeout(() => {
          isCaptured = false;
          capturedImageUrl = null;
          burnedDataUrl = null;
          submitted = false;
        }, 3000);
      } else {
        throw new Error(result.error || 'Submission failed');
      }
    } catch (err: any) {
      // Check if offline - save for later
      if (!isOnline()) {
        await storeReportOffline({
        latitude: location.latitude,
        longitude: location.longitude,
        digipin,
        imageDataUrl: burnedDataUrl || capturedImageUrl || '',
        timestamp: Date.now(),
      });

        savedOffline = true;
        hapticFeedback.onSuccess();

        pendingCount++;

        setTimeout(() => {
          isCaptured = false;
          capturedImageUrl = null;
          burnedDataUrl = null;
          savedOffline = false;
        }, 2000);
      } else {
        alert(`Error: ${err.message}`);
        hapticFeedback.onError();
      }
    } finally {
      isSubmitting = false;
    }
  }

  function cancelRecording() {
    hapticFeedback.onTap();
    isRecording = false;
    showMiniMap = false;
    stopCamera();
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }
  }

  function handleReportAnyway(reason: string) {
    showGeoFenceWarning = false;
    hapticFeedback.onSuccess();
  }

  function handleGeoFenceCancel() {
    showGeoFenceWarning = false;
    cancelRecording();
  }
</script>

<main class="min-h-screen flex flex-col bg-[#171717] text-white font-sans">
  <!-- Header -->
  <div class="w-full p-4 border-b-4 border-[#0a0a0a] flex justify-between items-center">
    <div>
      <h1 class="text-2xl font-black uppercase tracking-tight">PRISM</h1>
      <p class="text-xs font-mono text-white/60">Foot Soldier Interface</p>
    </div>
    <div class="text-right">
      <p class="text-xs font-mono">
        {userProfile?.phone_number || 'Unknown'}
      </p>
      <p class="text-xs font-mono text-[#00FF00]">
        {pendingCount > 0 ? `${pendingCount} pending` : 'Online'}
      </p>
    </div>
  </div>

  <!-- Main Content -->
  <div class="flex-1 flex flex-col items-center justify-center p-6">
    {#if !isRecording && !isCaptured && !submitted}
      <!-- Initial State - Massive CTA -->
      <button
        onclick={startRecording}
        class="w-full max-w-sm h-40 bg-[#00FF00] border-4 border-[#171717] shadow-[8px_8px_0px_0px_#171717]
               active:shadow-none active:translate-y-2 active:translate-x-2
               flex flex-col items-center justify-center text-[#171717] transition-all duration-75"
      >
        <span class="text-4xl font-black uppercase tracking-wider">REPORT</span>
        <span class="text-4xl font-black uppercase tracking-wider">POTHOLE</span>
      </button>

      <p class="mt-6 text-center text-white/50 text-sm font-mono max-w-xs">
        Tap to start camera and GPS capture
      </p>

      {#if pendingCount > 0}
        <p class="mt-4 text-[#00FF00] text-sm font-mono">
          {pendingCount} report(s) pending sync
        </p>
      {/if}

    {:else if isRecording && !isCaptured}
      <!-- Active Viewfinder -->
      <div class="w-full max-w-lg border-4 border-[#171717] bg-black shadow-[6px_6px_0px_0px_#171717] relative">
        <!-- svelte-ignore a11y_media_has_caption -->
        <video bind:this={videoElement} class="w-full h-auto object-cover" playsinline></video>

        <!-- Mini-map Toggle Button -->
        {#if nearbyPotholes.length > 0}
          <button
            onclick={toggleMiniMap}
            class="absolute top-2 right-2 bg-black/80 border-2 border-[#00FF00] px-3 py-1 text-xs font-mono text-[#00FF00]"
          >
            {showMiniMap ? 'HIDE' : 'SHOW'} MAP ({nearbyPotholes.length})
          </button>
        {/if}

        <!-- Mini-map Overlay -->
        {#if showMiniMap}
          <div class="absolute inset-0 bg-black/90 p-2">
            <div id="minimap-container" class="w-full h-full bg-[#0a0a0a] border-2 border-[#00FF00]">
              <!-- Map container - SDK check handled in toggleMiniMap -->
            </div>
          </div>
        {/if}

        <!-- Status Overlay -->
        <div class="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
          {#if location}
            <p class="font-mono text-sm {accuracyWarning ? 'text-yellow-400' : 'text-[#00FF00]'}">
              GPS: ±{location.accuracy.toFixed(0)}m
              {accuracyWarning ? ' ⚠️' : ' ✓'}
            </p>
            {#if accuracyWarning}
              <p class="text-xs text-yellow-400 mt-1">{accuracyWarning}</p>
            {/if}
            {#if nearbyPotholes.length > 0}
              <p class="text-xs text-[#FF0000] mt-1">
                {nearbyPotholes.length} pothole(s) within 200m
              </p>
            {/if}
          {:else if locationError}
            <p class="font-mono text-sm text-[#FF0000]">{locationError}</p>
          {:else}
            <p class="font-mono text-sm text-white/60 animate-pulse">ACQUIRING GPS...</p>
          {/if}
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="w-full max-w-lg mt-6 grid grid-cols-2 gap-4">
        <button
          onclick={cancelRecording}
          class="h-16 bg-[#FF0000] border-4 border-[#171717] shadow-[4px_4px_0px_0px_#171717]
                 active:shadow-none active:translate-y-1 active:translate-x-1
                 text-white text-xl font-black uppercase transition-all"
        >
          ABORT
        </button>
        <button
          onclick={captureSnapshot}
          disabled={!location}
          class="h-16 bg-white border-4 border-[#171717] shadow-[4px_4px_0px_0px_#171717]
                 active:shadow-none active:translate-y-1 active:translate-x-1
                 disabled:opacity-50 disabled:cursor-not-allowed
                 text-[#171717] text-xl font-black uppercase transition-all"
        >
          CAPTURE
        </button>
      </div>

    {:else if isCaptured && burnedDataUrl}
      <!-- Review State -->
      {#if submitted}
        <div class="w-full max-w-lg p-8 bg-[#00FF00] border-4 border-[#171717] shadow-[6px_6px_0px_0px_#171717] text-center">
          <p class="text-3xl font-black text-[#171717] uppercase mb-2">Submitted!</p>
          <p class="text-lg font-bold text-[#171717]">₹50 reward pending verification</p>
        </div>
      {:else if savedOffline}
        <div class="w-full max-w-lg p-8 bg-yellow-400 border-4 border-[#171717] shadow-[6px_6px_0px_0px_#171717] text-center">
          <p class="text-2xl font-black text-[#171717] uppercase">Saved Offline</p>
          <p class="text-sm font-mono text-[#171717]">Will sync when online</p>
        </div>
      {:else}
        <div class="w-full max-w-lg border-4 border-[#171717] bg-black shadow-[6px_6px_0px_0px_#171717]">
          <img src={burnedDataUrl} alt="Captured evidence" class="w-full h-auto" />
        </div>

        <!-- Submission Buttons -->
        <div class="w-full max-w-lg mt-6 flex flex-col gap-4">
          <button
            onclick={() => submitReport()}
            disabled={isSubmitting}
            class="h-20 bg-[#00FF00] border-4 border-[#171717] shadow-[6px_6px_0px_0px_#171717]
                   active:shadow-none active:translate-y-1 active:translate-x-1
                   disabled:opacity-50
                   text-[#171717] text-2xl font-black uppercase transition-all"
          >
            {isSubmitting ? 'SUBMITTING...' : 'SUBMIT REPORT'}
          </button>
          <button
            onclick={discardSnapshot}
            class="h-14 bg-transparent border-4 border-[#171717] shadow-[4px_4px_0px_0px_#171717]
                   active:shadow-none active:translate-y-1 active:translate-x-1
                   text-white text-lg font-bold uppercase transition-all"
          >
            Retake Photo
          </button>
        </div>

        <!-- Location Info -->
        {#if location}
          <div class="w-full max-w-lg mt-4 p-3 bg-black/50 border-2 border-[#171717]">
            <p class="font-mono text-xs text-white/60">
              DIGIPIN: {latLngToDIGIPIN(location.latitude, location.longitude)}
            </p>
            <p class="font-mono text-xs text-white/60">
              GPS: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
            </p>
          </div>
        {/if}
      {/if}
    {/if}
  </div>

  <!-- Geo-fence Warning Modal -->
  {#if showGeoFenceWarning && geoFencePothole}
    <GeoFenceWarning
      nearbyPothole={geoFencePothole}
      onreportAnyway={handleReportAnyway}
      oncancel={handleGeoFenceCancel}
    />
  {/if}

  <!-- Hidden canvas -->
  <canvas bind:this={canvasElement} class="hidden"></canvas>
</main>
