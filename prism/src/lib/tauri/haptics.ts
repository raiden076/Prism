/**
 * Haptics/Vibration wrapper for PRISM
 * Uses @tauri-apps/plugin-haptics with fallback to web API
 */

export type HapticStyle = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

export interface VibrationPattern {
  duration: number;
}

/**
 * Check if Tauri haptics plugin is available
 */
async function isTauriHapticsAvailable(): Promise<boolean> {
  try {
    if (typeof window !== 'undefined' && (window as any).__TAURI__) {
      const haptics = await import('@tauri-apps/plugin-haptics');
      return !!haptics;
    }
  } catch {
    // Plugin not available
  }
  return false;
}

/**
 * Vibrate device using Tauri plugin or web API fallback
 */
export async function vibrate(duration: number = 50): Promise<void> {
  // Try Tauri haptics plugin first
  if (await isTauriHapticsAvailable()) {
    try {
      const haptics = await import('@tauri-apps/plugin-haptics');
      await haptics.vibrate(duration);
      return;
    } catch (error) {
      console.warn('Tauri haptics failed, falling back to web API:', error);
    }
  }

  // Fallback to web API
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(duration);
  }
}

/**
 * Vibrate with pattern
 */
export async function vibratePattern(pattern: number[]): Promise<void> {
  // Try Tauri haptics plugin first
  if (await isTauriHapticsAvailable()) {
    try {
      const haptics = await import('@tauri-apps/plugin-haptics');
      // Tauri haptics doesn't support patterns, so we just do a single vibration
      await haptics.vibrate(pattern[0] || 50);
      return;
    } catch (error) {
      console.warn('Tauri haptics failed, falling back to web API:', error);
    }
  }

  // Fallback to web API
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

/**
 * Predefined haptic feedback patterns
 */
export const HapticPatterns = {
  /** Light tap feedback for button presses */
  tap: () => vibrate(30),

  /** Medium feedback for selections */
  selection: () => vibrate(50),

  /** Heavy feedback for important actions */
  heavy: () => vibrate(100),

  /** Success pattern - double short vibration */
  success: () => vibratePattern([50, 50, 50]),

  /** Warning pattern - long then short */
  warning: () => vibratePattern([100, 50, 50]),

  /** Error pattern - triple vibration */
  error: () => vibratePattern([100, 50, 100, 50, 100]),

  /** Notification pattern */
  notification: () => vibratePattern([100, 30, 100]),

  /** Impact feedback */
  impact: (style: HapticStyle = 'medium') => {
    const durations: Record<HapticStyle, number> = {
      light: 20,
      medium: 50,
      heavy: 100,
      success: 50,
      warning: 75,
      error: 100,
    };
    return vibrate(durations[style]);
  },
} as const;

/**
 * Haptic feedback for UI interactions
 */
export const hapticFeedback = {
  /** Call on button tap */
  onTap: HapticPatterns.tap,

  /** Call on successful action */
  onSuccess: HapticPatterns.success,

  /** Call on error */
  onError: HapticPatterns.error,

  /** Call on selection change */
  onSelection: HapticPatterns.selection,

  /** Call for impact (e.g., reaching scroll boundary) */
  onImpact: HapticPatterns.heavy,

  /** Call on warning/alert */
  onWarning: HapticPatterns.warning,
} as const;

/**
 * Check if haptics/vibration is available
 */
export async function isHapticsAvailable(): Promise<boolean> {
  if (await isTauriHapticsAvailable()) {
    return true;
  }
  return typeof navigator !== 'undefined' && !!navigator.vibrate;
}
