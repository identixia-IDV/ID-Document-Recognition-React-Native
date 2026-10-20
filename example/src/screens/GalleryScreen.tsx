import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { recognize } from 'document-reader-sdk';
import { colors, radiusCard, radiusPill } from '../theme';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Gallery'>;

function fileName(uri: string | null, fallback: string) {
  if (!uri) return fallback;
  const parts = uri.split(/[\\/]/);
  return parts[parts.length - 1] || fallback;
}

export default function GalleryScreen({ navigation }: Props) {
  const [front, setFront] = useState<string | null>(null);
  const [back, setBack] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pick = useCallback(async (side: 'front' | 'back') => {
    const picked = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      includeBase64: false,
    });
    if (picked.didCancel || !picked.assets?.[0]?.uri) return;
    const uri = picked.assets[0].uri;
    if (side === 'front') setFront(uri);
    else setBack(uri);
    setError('');
  }, []);

  const onRecognize = useCallback(async () => {
    if (!front || busy) return;
    setBusy(true);
    setError('');
    try {
      const json = await recognize(front, back);
      navigation.replace('Result', { json });
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }, [front, back, busy, navigation]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.stack}>
      <SideTile
        label="Front"
        uri={front}
        name={fileName(front, 'Front image')}
        onPick={() => pick('front')}
        onClear={() => setFront(null)}
      />
      <SideTile
        label="Back"
        uri={back}
        name={fileName(back, 'Back image')}
        onPick={() => pick('back')}
        onClear={() => setBack(null)}
      />
      <TouchableOpacity
        style={[styles.recognize, (!front || busy) && styles.disabled]}
        disabled={!front || busy}
        onPress={onRecognize}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.recognizeText}>Recognize</Text>
        )}
      </TouchableOpacity>
      {!!error && <Text style={styles.error}>{error}</Text>}
    </ScrollView>
  );
}

function SideTile({
  label,
  uri,
  name,
  onPick,
  onClear,
}: {
  label: string;
  uri: string | null;
  name: string;
  onPick: () => void;
  onClear: () => void;
}) {
  return (
    <View style={styles.tileWrap}>
      <TouchableOpacity style={styles.tile} onPress={onPick} activeOpacity={0.8}>
        {uri ? (
          <Image source={{ uri }} style={styles.image} resizeMode="contain" />
        ) : (
          <Text style={styles.placeholder}>{label}</Text>
        )}
        {uri ? (
          <TouchableOpacity style={styles.clear} onPress={onClear}>
            <Text style={styles.clearText}>×</Text>
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  stack: { padding: 20, gap: 16 },
  tileWrap: { width: '100%' },
  tile: {
    height: 176,
    width: '100%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: radiusCard,
  },
  image: { width: '100%', height: '100%' },
  placeholder: { color: colors.muted, fontSize: 16, fontWeight: '600' },
  name: { color: colors.muted, fontSize: 13, marginTop: 8 },
  clear: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: { color: colors.text, fontSize: 20, lineHeight: 22 },
  recognize: {
    width: '100%',
    height: 56,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radiusPill,
  },
  recognizeText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  disabled: { opacity: 0.45 },
  error: { color: colors.statusError, marginTop: 4 },
});
