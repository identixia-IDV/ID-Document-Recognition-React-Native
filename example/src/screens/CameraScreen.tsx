import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
} from 'react-native-vision-camera';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { recognize, type Point } from 'document-reader-sdk';
import { GuideOverlay, LocateSession } from 'document-reader-sdk/locate';
import { colors, radiusPill } from '../theme';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Camera'>;

const HIGH_THRESHOLD = 85;
const KEEP_CAPTURE_MIN = 50;

export default function CameraScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const device = useCameraDevice('back');
  const format = useCameraFormat(device, [
    { videoResolution: { width: 1280, height: 720 } },
  ]);
  const { hasPermission, requestPermission } = useCameraPermission();
  const cameraRef = useRef<Camera>(null);
  const capturedRef = useRef(false);
  const latestUriRef = useRef<string | null>(null);
  const lastStillMsRef = useRef(0);
  const sessionRef = useRef<LocateSession | null>(null);
  const viewSizeRef = useRef({ w: 0, h: 0 });
  const [viewSize, setViewSize] = useState({ w: 0, h: 0 });

  const [scorePct, setScorePct] = useState(0);
  const [corners, setCorners] = useState<Point[] | null>(null);
  const [hint, setHint] = useState('Align the ID inside the frame');
  const [busy, setBusy] = useState(false);
  const [captureEnabled, setCaptureEnabled] = useState(false);
  // TEMPORARY CROP PREVIEW — start
  // Delete only this block when asked to "Delete temporary preview".
  const [cropPreviewUri, setCropPreviewUri] = useState<string | null>(null);
  // TEMPORARY CROP PREVIEW — end

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  const beginRecognize = useCallback(
    async (uri: string) => {
      if (capturedRef.current) return;
      capturedRef.current = true;
      setBusy(true);
      setHint('Reading document…');
      try {
        sessionRef.current?.stop();
        const json = await recognize(uri, null, false, false);
        navigation.replace('Result', { json });
      } catch (e: any) {
        capturedRef.current = false;
        setBusy(false);
        setHint(e?.message ?? String(e));
      }
    },
    [navigation]
  );

  useEffect(() => {
    if (!hasPermission || !device || busy) return;
    const session = new LocateSession({
      onFrame: (frame) => {
        if (capturedRef.current) return;
        setScorePct(frame.scorePct);
        setCorners(frame.corners);
        if (frame.scorePct >= KEEP_CAPTURE_MIN) {
          const now = Date.now();
          if (frame.high || now - lastStillMsRef.current > 500) {
            latestUriRef.current = frame.path;
            lastStillMsRef.current = now;
            // TEMPORARY CROP PREVIEW — start
            // Delete only this line when asked to "Delete temporary preview".
            setCropPreviewUri(frame.path);
            // TEMPORARY CROP PREVIEW — end
          }
          setCaptureEnabled(true);
          setHint('Ready — tap Capture or keep holding');
        } else {
          setCaptureEnabled(false);
          setHint('Align the ID inside the frame');
        }
      },
      onError: (message) => {
        if (capturedRef.current) return;
        setCaptureEnabled(false);
        setHint(message);
      },
    });
    session.updateViewSize(viewSizeRef.current.w, viewSizeRef.current.h);
    if (format) {
      session.updatePreviewSize(format.videoWidth, format.videoHeight);
    }
    sessionRef.current = session;
    const attachTimer = setInterval(() => {
      const cam = cameraRef.current;
      if (cam) {
        session.attach(cam);
        session.start();
        clearInterval(attachTimer);
      }
    }, 80);
    return () => {
      clearInterval(attachTimer);
      session.dispose();
      sessionRef.current = null;
    };
  }, [hasPermission, device, busy, format?.videoWidth, format?.videoHeight]);

  const onCapture = useCallback(() => {
    const uri = latestUriRef.current;
    if (!uri) return;
    beginRecognize(uri);
  }, [beginRecognize]);

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>Camera permission is required</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Allow camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.link}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>No back camera found</Text>
        <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.link}>Close</Text>
        </TouchableOpacity>
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
        photo={true}
        video={true}
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

      <View style={[styles.topBar, { top: insets.top + 12 }]}>
        <TouchableOpacity style={styles.close} onPress={() => navigation.goBack()}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.badge, { top: insets.top + 76 }]}>
        <Text style={styles.badgeText}>{scorePct}%</Text>
      </View>

      <Text style={[styles.hint, { bottom: 64 + 20 + 16 + Math.max(insets.bottom, 8) }]}>
        {hint}
      </Text>

      <TouchableOpacity
        style={[
          styles.capture,
          { bottom: 20 + Math.max(insets.bottom - 8, 0) },
          !captureEnabled && styles.captureDisabled,
        ]}
        disabled={!captureEnabled || busy}
        onPress={onCapture}
      >
        {busy ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={styles.captureText}>Capture</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 16,
  },
  msg: { color: colors.text, fontSize: 16, textAlign: 'center' },
  btn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    height: 52,
    minWidth: 180,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radiusPill,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  linkBtn: {
    height: 48,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radiusPill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  link: { color: colors.accent, fontWeight: '700' },
  topBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  close: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: colors.text, fontSize: 18, fontWeight: '700' },
  badge: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 3,
    minWidth: 80,
    height: 36,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  badgeText: { color: colors.text, fontSize: 20, fontWeight: '700' },
  hint: {
    position: 'absolute',
    left: 24,
    right: 24,
    zIndex: 3,
    color: '#fff',
    fontSize: 15,
    textAlign: 'center',
  },
  capture: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 3,
    height: 64,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
  },
  captureDisabled: { opacity: 0.4 },
  captureText: { color: '#fff', fontWeight: '700', fontSize: 17 },
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
