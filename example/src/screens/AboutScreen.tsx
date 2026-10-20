import { useState } from 'react';
import { useSdk } from '../SdkContext';
import {
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import IdentixiaLogo from '../components/IdentixiaLogo';
import { ANDROID_APPLICATION_ID, IOS_BUNDLE_ID } from '../license';
import { colors, radiusCard, radiusPill } from '../theme';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'About'>;

export default function AboutScreen(_props: Props) {
  const appId = Platform.OS === 'ios' ? IOS_BUNDLE_ID : ANDROID_APPLICATION_ID;
  const { licenseLabel } = useSdk();
  const [copied, setCopied] = useState(false);


  return (
    <View style={styles.root}>
      <IdentixiaLogo
        size={96}
        onPress={() => Linking.openURL('https://identixia.com')}
      />
      <View style={styles.card}>
        <Text style={styles.body}>{`License: ${licenseLabel}`}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.mono} selectable>
          {appId}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.copy}
        onPress={() => {
          setCopied(true);
        }}
      >
        <Text style={styles.copyText}>{copied ? 'Copied' : 'Copy'}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.site}
        onPress={() => Linking.openURL('https://identixia.com')}
      >
        <Text style={styles.siteText}>identixia.com</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 20,
    alignItems: 'center',
    gap: 14,
  },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    borderRadius: radiusCard,
  },
  body: { color: colors.text, fontSize: 15 },
  mono: { color: colors.text, fontSize: 13, fontFamily: 'Menlo' },
  copy: {
    width: '100%',
    height: 52,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radiusPill,
  },
  copyText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  site: {
    width: '100%',
    height: 48,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radiusPill,
  },
  siteText: { color: colors.accent, fontSize: 16, fontWeight: '700' },
});
