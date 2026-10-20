import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import TileIcon, { type TileIconName } from '../components/TileIcons';
import { useSdk } from '../SdkContext';
import { colors, radiusCard } from '../theme';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const { status, ready, licenseLabel } = useSdk();

  const guard = (go: () => void) => {
    if (!ready) {
      Alert.alert('SDK is not ready', status);
      return;
    }
    go();
  };

  const license = `License: ${licenseLabel}`;
  const readyLabel = ready ? 'Ready' : status.toLowerCase().includes('loading') ? '…' : status;

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.top}>
        <Text style={styles.chip} numberOfLines={1}>
          {license}
        </Text>
        <Text style={[styles.chip, styles.chipBold]}>{readyLabel}</Text>
      </View>

      <TouchableOpacity
        style={[styles.camera, !ready && styles.disabled]}
        disabled={!ready}
        onPress={() => guard(() => navigation.navigate('Camera'))}
        activeOpacity={0.8}
      >
        <TileIcon name="camera" size={72} color="#fff" />
        <Text style={styles.cameraTitle}>Camera</Text>
      </TouchableOpacity>

      <View style={styles.row}>
        <SmallTile
          title="Gallery"
          icon="gallery"
          disabled={!ready}
          onPress={() => guard(() => navigation.navigate('Gallery'))}
        />
        <SmallTile title="About" icon="about" onPress={() => navigation.navigate('About')} />
      </View>
    </SafeAreaView>
  );
}

function SmallTile({
  title,
  icon,
  disabled,
  onPress,
}: {
  title: string;
  icon: TileIconName;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.small, disabled && styles.disabled]}
      disabled={disabled}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <TileIcon name={icon} size={36} color={colors.accent} />
      <Text style={styles.smallTitle}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: 20 },
  top: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  chip: {
    flexShrink: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13,
    borderRadius: 20,
    overflow: 'hidden',
  },
  chipBold: { fontWeight: '700' },
  camera: {
    flex: 1,
    marginTop: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 248,
    borderRadius: radiusCard,
  },
  cameraTitle: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 16 },
  row: { flexDirection: 'row', gap: 14, marginTop: 14, height: 124 },
  small: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radiusCard,
  },
  smallTitle: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 10 },
  disabled: { opacity: 0.45 },
});
