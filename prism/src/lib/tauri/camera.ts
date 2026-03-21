/**
 * Camera wrapper for PRISM
 * Uses web API (navigator.mediaDevices) with proper permissions
 * Note: Tauri v2 doesn't have an official camera plugin
 */

export interface CameraCaptureResult {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
}

export interface CameraOptions {
  facingMode?: 'user' | 'environment';
  width?: number;
  height?: number;
}

let videoStream: MediaStream | null = null;

/**
 * Request camera permissions and get stream
 */
export async function requestCameraPermissions(options: CameraOptions = {}): Promise<MediaStream> {
  const { facingMode = 'environment', width = 1920, height = 1080 } = options;

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode,
      width: { ideal: width },
      height: { ideal: height },
    },
    audio: false,
  });

  videoStream = stream;
  return stream;
}

/**
 * Capture photo from video stream
 */
export async function capturePhoto(video: HTMLVideoElement): Promise<CameraCaptureResult> {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to capture photo'));
          return;
        }

        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        resolve({
          blob,
          dataUrl,
          width: canvas.width,
          height: canvas.height,
        });
      },
      'image/jpeg',
      0.9
    );
  });
}

/**
 * Burn metadata onto image (timestamp + GPS)
 */
export async function burnMetadata(
  imageDataUrl: string,
  metadata: {
    timestamp: string;
    latitude: number;
    longitude: number;
    accuracy?: number;
  }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height + 60; // Add space for metadata

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Draw original image
      ctx.drawImage(img, 0, 0);

      // Draw metadata bar at bottom
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(0, img.height, canvas.width, 60);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 16px monospace';

      const timestampText = `📅 ${metadata.timestamp}`;
      const locationText = `📍 ${metadata.latitude.toFixed(6)}, ${metadata.longitude.toFixed(6)}`;
      const accuracyText = metadata.accuracy ? ` (±${metadata.accuracy.toFixed(0)}m)` : '';

      ctx.fillText(timestampText, 10, img.height + 22);
      ctx.fillText(locationText + accuracyText, 10, img.height + 45);

      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageDataUrl;
  });
}

/**
 * Stop camera stream
 */
export function stopCamera(): void {
  if (videoStream) {
    videoStream.getTracks().forEach((track) => track.stop());
    videoStream = null;
  }
}

/**
 * Check if camera is available
 */
export async function isCameraAvailable(): Promise<boolean> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.some((device) => device.kind === 'videoinput');
  } catch {
    return false;
  }
}
