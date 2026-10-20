import { NativeModules, Platform } from 'react-native';
import {
  authenticityModeValue,
  type AuthenticityArg,
} from './authenticityMode';
import {
  parseLicenseStatus,
  type LicenseStatus,
} from './licenseStatus';
import {
  normalizeResult,
  normalizeResultJson,
  type DocResult,
} from './normalizeResult';

const LINKING_ERROR =
  `The package 'document-reader-sdk' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n';

const DocumentRecognitionSdk = NativeModules.DocumentRecognitionSdk
  ? NativeModules.DocumentRecognitionSdk
  : new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      }
    );

export type ImageInput = string;

/** … machine code for license requests. */
export function getMachineCode(): Promise<string> {
  return DocumentRecognitionSdk.getMachineCode();
}

/** Activate with … bound to applicationId / bundle id. Returns SDK status code. */
export function setActivation(license: string): Promise<number> {
  return DocumentRecognitionSdk.setActivation(license);
}

/** Load engine + database (off JS thread). Returns SDK status code (0 = success). */
export function init(): Promise<number> {
  return DocumentRecognitionSdk.init();
}

export function deinit(): Promise<void> {
  return DocumentRecognitionSdk.deinit();
}

/** Open a process session. Prefer FullProcess before recognize. */
export function startNewSession(
  optionsJson: string = '{"scenario":"FullProcess","series":false}'
): Promise<string> {
  return DocumentRecognitionSdk.startNewSession(optionsJson);
}

/**
 * Live locate — JSON with score + position.corners.
 * Geometry hints (`_locateImageWidth/Height`) are already bridge-normalized.
 */
export function locateDocument(
  image: ImageInput,
  alreadyCropped: boolean = false
): Promise<string> {
  return DocumentRecognitionSdk.locateDocument(image, alreadyCropped);
}

/**
 * Still OCR / MRZ / barcode.
 * Returns **canonical iOS-shaped** JSON (Android `status` folded into `verification`).
 * `image` is a content/file URI or base64 (optionally data: URL).
 * Starts a FullProcess session automatically (same as native demos).
 * Recognition-only product: default authenticity is off (`none`), matching
 * Android / Windows / Docker. Pass `true` / `'normal'` to enable checks.
 */
/** Crop a camera still to the on-screen passport rectangle (cover-mapped). */
export async function cropToGuide(
  image: ImageInput,
  viewW: number,
  viewH: number,
  previewW = 0,
  previewH = 0
): Promise<string> {
  if (viewW <= 1 || viewH <= 1) {
    throw new Error('Guide view size is not ready');
  }
  const out = await DocumentRecognitionSdk.cropToGuide(
    image,
    viewW,
    viewH,
    previewW,
    previewH
  );
  if (typeof out !== 'string' || out.length === 0) {
    throw new Error('Could not crop to the camera rectangle');
  }
  return out;
}

export async function recognize(
  front: ImageInput,
  back?: ImageInput | null,
  // Recognition-only product: match Android / Windows / Docker (authenticity off).
  authenticity: AuthenticityArg = false,
  alreadyCropped: boolean = false
): Promise<string> {
  const json = await DocumentRecognitionSdk.recognize(
    front,
    back ?? null,
    authenticityModeValue(authenticity),
    alreadyCropped
  );
  return normalizeResultJson(typeof json === 'string' ? json : '');
}

/** OCR / MRZ / barcode only. Authenticity is always off. */
export async function documentRecognition(
  front: ImageInput,
  back?: ImageInput | null,
  alreadyCropped: boolean = false
): Promise<string> {
  const json = await DocumentRecognitionSdk.documentRecognition(
    front,
    back ?? null,
    alreadyCropped
  );
  return normalizeResultJson(typeof json === 'string' ? json : '');
}

/** Authenticity / security only. OCR / MRZ / barcode are always off. */
export async function documentLiveness(
  front: ImageInput,
  back?: ImageInput | null,
  alreadyCropped: boolean = false
): Promise<string> {
  const json = await DocumentRecognitionSdk.documentLiveness(
    front,
    back ?? null,
    alreadyCropped
  );
  return normalizeResultJson(typeof json === 'string' ? json : '');
}

/**
 * Typed recognize — same as `recognize` then `normalizeResult`.
 * Prefer this when you want a `DocResult` object instead of a JSON string.
 */
export async function recognizeResult(
  front: ImageInput,
  back?: ImageInput | null,
  authenticity: AuthenticityArg = false,
  alreadyCropped: boolean = false
): Promise<DocResult> {
  const json = await recognize(front, back, authenticity, alreadyCropped);
  return normalizeResult(json);
}

export function lastLicenseError(): Promise<string> {
  return DocumentRecognitionSdk.lastLicenseError();
}

/** Parsed license capabilities (`label` is what About / home status show). */
export async function getLicenseStatus(): Promise<LicenseStatus> {
  const json = await DocumentRecognitionSdk.getLicenseStatus();
  return parseLicenseStatus(typeof json === 'string' ? json : '');
}

/** Writes a JSON status blob to Documents/docreader_status.json (device debug). */
export function writeStatus(payload: Record<string, unknown>): Promise<void> {
  return DocumentRecognitionSdk.writeStatus(JSON.stringify(payload));
}

export {
  authenticityModeValue,
  type AuthenticityArg,
  type AuthenticityMode,
} from './authenticityMode';
export {
  parseLicenseStatus,
  readyStatusMessage,
  NOT_LICENSED,
  type LicenseStatus,
} from './licenseStatus';

export const SDK_SUCCESS = 0;
export const SDK_LICENSE_INVALID = 1;
export const SDK_LICENSE_EXPIRED = 2;
export const SDK_NOT_ACTIVATED = 3;
export const SDK_INIT_FAILED = 4;

export {
  normalizeResult,
  normalizeResultJson,
  extractImageQualityChecks,
  IMAGE_QA_ORDER,
  statusCode,
} from './normalizeResult';
export type {
  DocResult,
  DocVerification,
  DocImage,
} from './normalizeResult';
export {
  identity,
  identityLine,
  overallResults,
  fieldGroups,
  checkGroups,
  fieldRows,
  checkRows,
  rows,
  summary,
  images,
  pretty,
  securityRows,
  securitySummary,
  sourceLabel,
  kindLabel,
  documentPercent,
  documentCorners,
  locateImageSize,
  uprightSnapshotSize,
  mapUprightCornersToView,
} from './resultParser';
export type { FieldRow, ResultImage, Point, SecurityRow, OverallResult, FieldGroup, CheckGroup, IdentityLine } from './resultParser';
export { DocumentRecognitionSdk };
