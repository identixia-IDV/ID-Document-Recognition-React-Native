import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
} from 'react-native-vision-camera';
import { recognize } from '../index';
import {
  LocateSession,
  type LocateSettings,
} from './LocateSession';
import { GuideOverlay } from './GuideOverlay';
import type { Point } from '../resultParser';

const HIGH_THRESHOLD = 85;

export type DocumentCaptureProps = {
  settings?: LocateSettings;
  onRecognized: (json: string) => void;
  onCancel?: () => void;
  authenticity?: boolean | string;
};

/** Drop-in document camera: live locate + Capture → recognize. */
export function DocumentCapture({
  settings,
  onRecognized,
  onCancel,
  authenticity = false,
}: DocumentCaptureProps) {
  const device = useCameraDevice('back');
  const format = useCameraFormat(device, [
    { videoResolution: { width: 1280, height: 720 } },
  ]);
  const { hasPermission, requestPermission } = useCameraPermission();
  const cameraRef = useRef<Camera>(null);
  const sessionRef = useRef<LocateSession | null>(null);
  const latestUri = useRef<string | null>(null);
  const viewSizeRef = useRef({ w: 0, h: 0 });
  const [viewSize, setViewSize] = useState({ w: 0, h: 0 });
  const [scorePct, setScorePct] = useState(0);
  const [corners, setCorners] = useState<Point[] | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  // TEMPORARY CROP PREVIEW — start
  // Delete only this block when asked to "Delete temporary preview".
  const [cropPreviewUri, setCropPreviewUri] = useState<string | null>(null);
  // TEMPORARY CROP PREVIEW — end

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  useEffect(() => {
    if (!hasPermission || !device || busy) return;
    const session = new LocateSession({
      settings,
      onFrame: (frame) => {
        setScorePct(frame.scorePct);
        setCorners(frame.corners);
        setEnabled(frame.scorePct >= (settings?.keepCaptureMin ?? 50));
        if (frame.scorePct >= (settings?.keepCaptureMin ?? 50)) {
          latestUri.current = frame.path;
          // TEMPORARY CROP PREVIEW — start
          // Delete only this line when asked to "Delete temporary preview".
          setCropPreviewUri(frame.path);
          // TEMPORARY CROP PREVIEW — end
        }
      },
    });
    session.updateViewSize(viewSizeRef.current.w, viewSizeRef.current.h);
    if (format) {
      session.updatePreviewSize(format.videoWidth, format.videoHeight);
    }
    sessionRef.current = session;
    const attach = setInterval(() => {
      const cam = cameraRef.current;
      if (cam) {
        session.attach(cam);
        session.start();
        clearInterval(attach);
      }
    }, 80);
    return () => {
      clearInterval(attach);
      session.dispose();
      sessionRef.current = null;
    };
  }, [hasPermission, device, busy, settings, format?.videoWidth, format?.videoHeight]);

  const onCapture = useCallback(async () => {
    const uri = latestUri.current;
    if (!uri || busy) return;
    setBusy(true);
    sessionRef.current?.stop();
    try {
      const json = await recognize(uri, null, authenticity, false);
      onRecognized(json);
    } catch {
      sessionRef.current?.start();
      setBusy(false);
    }
  }, [authenticity, busy, onRecognized]);

  if (!hasPermission || !device) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#D0BCFF" />
      </View>
    );
  }

  const locked = scorePct >= HIGH_THRESHOLD && corners != null;

  return (
    <View
      style={styles.root}
      onLayout={(e) => {
        const { width: w, height: h } = e.nativeEvent.layout;
        viewSizeRef.current = { w, h };
        setViewSize({ w, h });
        sessionRef.current?.updateViewSize(w, h);
      }}
    >
      <Camera
        ref={cameraRef}
        device={device}
        format={format}
        isActive={!busy}
        photo
        video
        resizeMode="cover"
        outputOrientation="device"
        androidPreviewViewType="texture-view"
        style={[StyleSheet.absoluteFill, { zIndex: 0 }]}
      />
      <GuideOverlay
        corners={corners}
        locked={locked}
        width={viewSize.w}
        height={viewSize.h}
      />
      {onCancel ? (
        <TouchableOpacity style={styles.close} onPress={onCancel}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      ) : null}
      {/* TEMPORARY CROP PREVIEW — start
          Delete only this block when asked to "Delete temporary preview". */}
      {cropPreviewUri ? (
        <View style={styles.tmpCropPreview} pointerEvents="none">
          <Text style={styles.tmpCropLabel}>Crop preview (temporary)</Text>
          <Image
            source={{
              uri: cropPreviewUri.startsWith('file:')
                ? cropPreviewUri
                : `file://${cropPreviewUri}`,
            }}
            style={styles.tmpCropImage}
            resizeMode="contain"
          />
        </View>
      ) : null}
      {/* TEMPORARY CROP PREVIEW — end */}
      <Text style={styles.badge}>{scorePct}%</Text>
      <TouchableOpacity
        style={[styles.capture, !enabled && styles.disabled]}
        disabled={!enabled || busy}
        onPress={() => {
          void onCapture();
        }}
      >
        <Text style={styles.captureText}>{busy ? 'Reading…' : 'Capture'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  close: {
    position: 'absolute',
    top: 56,
    left: 16,
    zIndex: 3,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4F378B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  badge: {
    position: 'absolute',
    top: 56,
    alignSelf: 'center',
    zIndex: 3,
    color: '#D0BCFF',
    fontSize: 20,
    fontWeight: '700',
  },
  capture: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    zIndex: 3,
    width: 180,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#D0BCFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  captureText: { color: '#000', fontWeight: '700', fontSize: 16 },
  // TEMPORARY CROP PREVIEW — start
  // Delete only this block when asked to "Delete temporary preview".
  tmpCropPreview: {
    position: 'absolute',
    right: 12,
    bottom: 108,
    zIndex: 4,
    alignItems: 'flex-end',
  },
  tmpCropLabel: { color: '#fff', fontSize: 11, fontWeight: '700', marginBottom: 4 },
  tmpCropImage: {
    width: 148,
    height: 104,
    backgroundColor: '#00000099',
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  // TEMPORARY CROP PREVIEW — end
});
