import { Platform } from 'react-native';
import type { Camera } from 'react-native-vision-camera';
import { cropToGuide, locateDocument } from '../index';
import {
  documentCorners,
  documentPercent,
  locateImageSize,
  mapCropCornersToView,
  uprightSnapshotSize,
  type Point,
} from '../resultParser';

export type LocateSettings = {
  showThreshold?: number;
  highThreshold?: number;
  keepCaptureMin?: number;
  pollMs?: number;
};

export type LocateFrame = {
  scorePct: number;
  corners: Point[] | null;
  path: string;
  high: boolean;
  show: boolean;
};

export type LocateSessionOptions = {
  settings?: LocateSettings;
  onFrame: (frame: LocateFrame) => void;
  onError?: (message: string) => void;
};

const HINT_AFTER_FAILURES = 3;

export class LocateSession {
  readonly settings: Required<LocateSettings>;
  readonly onFrame: (frame: LocateFrame) => void;
  readonly onError?: (message: string) => void;

  viewSize = { w: 0, h: 0 };
  previewSize = { w: 0, h: 0 };

  private camera: Camera | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private locating = false;
  private stopped = false;
  private failCount = 0;

  constructor(opts: LocateSessionOptions) {
    this.settings = {
      showThreshold: opts.settings?.showThreshold ?? 50,
      highThreshold: opts.settings?.highThreshold ?? 85,
      keepCaptureMin: opts.settings?.keepCaptureMin ?? 50,
      pollMs: opts.settings?.pollMs ?? 450,
    };
    this.onFrame = opts.onFrame;
    this.onError = opts.onError;
  }

  attach(camera: Camera): void {
    this.camera = camera;
  }

  updateViewSize(w: number, h: number): void {
    this.viewSize = { w, h };
  }

  /** Video/preview buffer size (VisionCamera format). Unused on Android snapshots. */
  updatePreviewSize(w: number, h: number): void {
    this.previewSize = { w, h };
  }

  start(): void {
    this.stopped = false;
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, this.settings.pollMs);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  dispose(): void {
    this.stop();
  }

  private async tick(): Promise<void> {
    if (this.stopped || this.locating || !this.camera) return;
    this.locating = true;
    try {
      if (this.viewSize.w <= 1 || this.viewSize.h <= 1) return;
      const photo = await this.camera.takeSnapshot({ quality: 60 });
      const uri = photo.path.startsWith('file://')
        ? photo.path
        : `file://${photo.path}`;
      // Android takeSnapshot is already a preview-view screenshot (cover FOV).
      // iOS takeSnapshot is a video-pipeline frame — map to the 1280×720 format.
      const preview =
        Platform.OS === 'android'
          ? { width: 0, height: 0 }
          : this.previewSize.w > 1 && this.previewSize.h > 1
            ? uprightSnapshotSize(this.previewSize.w, this.previewSize.h)
            : uprightSnapshotSize(photo.width, photo.height, photo.orientation);
      const cropped = await cropToGuide(
        uri,
        this.viewSize.w,
        this.viewSize.h,
        preview.width,
        preview.height
      );

      const locateJson = await locateDocument(cropped, false);
      const pct = documentPercent(locateJson);
      const pts = documentCorners(locateJson);
      const show = pct >= this.settings.showThreshold && pts != null;
      const high = pct >= this.settings.highThreshold;

      const imageSize =
        locateImageSize(locateJson) ??
        uprightSnapshotSize(photo.width, photo.height, photo.orientation);

      const mapped =
        show && pts
          ? mapCropCornersToView(
              pts,
              imageSize.width,
              imageSize.height,
              this.viewSize.w,
              this.viewSize.h
            )
          : null;

      this.failCount = 0;
      this.onFrame({
        scorePct: pct,
        corners: mapped,
        path: cropped,
        high,
        show,
      });
    } catch (e) {
      this.failCount += 1;
      if (this.failCount >= HINT_AFTER_FAILURES) {
        const message =
          e instanceof Error && e.message ? e.message : String(e ?? 'Camera locate failed');
        this.onError?.(message);
      }
    } finally {
      this.locating = false;
    }
  }
}
