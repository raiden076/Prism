/**
 * Geolocation wrapper for PRISM
 * Uses @tauri-apps/plugin-geolocation with fallback to web API
 */

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number | null;
  altitudeAccuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  timestamp: number;
}

export interface LocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

// GPS accuracy warning threshold (meters)
export const ACCURACY_WARNING_THRESHOLD = 30;

let watchId: number | null = null;

/**
 * Check if Tauri geolocation plugin is available
 */
async function isTauriGeolocationAvailable(): Promise<boolean> {
  try {
    if (typeof window !== 'undefined' && (window as any).__TAURI__) {
      const geolocation = await import('@tauri-apps/plugin-geolocation');
      return !!geolocation;
    }
  } catch {
    // Plugin not available
  }
  return false;
}

/**
 * Get current position using Tauri plugin or web API fallback
 */
export async function getCurrentPosition(
  options: LocationOptions = {}
): Promise<LocationData> {
  const { enableHighAccuracy = true, timeout = 10000, maximumAge = 0 } = options;

  // Try Tauri plugin first
  if (await isTauriGeolocationAvailable()) {
    try {
      const geolocation = await import('@tauri-apps/plugin-geolocation');
      const position = await geolocation.getCurrentPosition({
        enableHighAccuracy,
        timeout,
        maximumAge,
      });

      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        altitude: position.coords.altitude,
        altitudeAccuracy: position.coords.altitudeAccuracy,
        heading: position.coords.heading,
        speed: position.coords.speed,
        timestamp: position.timestamp,
      };
    } catch (error) {
      console.warn('Tauri geolocation failed, falling back to web API:', error);
    }
  }

  // Fallback to web API
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          altitudeAccuracy: position.coords.altitudeAccuracy,
          heading: position.coords.heading,
          speed: position.coords.speed,
          timestamp: position.timestamp,
        });
      },
      (error) => {
        reject(new Error(`Geolocation error: ${error.message}`));
      },
      {
        enableHighAccuracy,
        timeout,
        maximumAge,
      }
    );
  });
}

/**
 * Watch position for continuous updates
 */
export async function watchPosition(
  callback: (location: LocationData) => void,
  errorCallback?: (error: Error) => void,
  options: LocationOptions = {}
): Promise<() => void> {
  const { enableHighAccuracy = true, timeout = 10000, maximumAge = 5000 } = options;

  // Try Tauri plugin first
  if (await isTauriGeolocationAvailable()) {
    try {
      const geolocation = await import('@tauri-apps/plugin-geolocation');
      const id = await geolocation.watchPosition(
        (position: any) => {
          callback({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            altitudeAccuracy: position.coords.altitudeAccuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
            timestamp: position.timestamp,
          });
        },
        (error: any) => {
          errorCallback?.(new Error(error?.message || 'Unknown error'));
        },
        {
          enableHighAccuracy,
          timeout,
          maximumAge,
        } as any
      );

      return () => {
        geolocation.clearWatch(id as any);
      };
    } catch (error) {
      console.warn('Tauri geolocation watch failed, falling back to web API:', error);
    }
  }

  // Fallback to web API
  const webWatchId = navigator.geolocation.watchPosition(
    (position) => {
      callback({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        altitude: position.coords.altitude,
        altitudeAccuracy: position.coords.altitudeAccuracy,
        heading: position.coords.heading,
        speed: position.coords.speed,
        timestamp: position.timestamp,
      });
    },
    (error) => {
      errorCallback?.(new Error(error.message));
    },
    {
      enableHighAccuracy,
      timeout,
      maximumAge,
    }
  );

  watchId = webWatchId;

  return () => {
    navigator.geolocation.clearWatch(webWatchId);
    watchId = null;
  };
}

/**
 * Stop watching position
 */
export function stopWatching(): void {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}

/**
 * Check if GPS accuracy is poor (above threshold)
 */
export function isAccuracyPoor(accuracy: number): boolean {
  return accuracy > ACCURACY_WARNING_THRESHOLD;
}

/**
 * Get accuracy warning message
 */
export function getAccuracyWarning(accuracy: number): string | null {
  if (accuracy > ACCURACY_WARNING_THRESHOLD) {
    return `GPS accuracy is low (±${accuracy.toFixed(0)}m). For best results, move to an open area.`;
  }
  return null;
}

/**
 * Check if geolocation is available
 */
export async function isGeolocationAvailable(): Promise<boolean> {
  if (await isTauriGeolocationAvailable()) {
    return true;
  }
  return !!navigator.geolocation;
}
