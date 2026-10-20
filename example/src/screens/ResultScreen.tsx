import { useMemo, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { checkGroups, fieldGroups, identityLine, images, kindLabel, overallResults, pretty, sourceLabel } from '../resultParser';
import { colors, radiusCard } from '../theme';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Result'>;

function resultColor(label: string) {
  if (label.startsWith('fail')) return colors.statusError;
  if (label.startsWith('pass')) return colors.accent;
  return colors.muted;
}

function GroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <View style={styles.groupHead}>
      <Text style={styles.pill}>{label}</Text>
      <Text style={styles.count}>{count}</Text>
    </View>
  );
}

export default function ResultScreen({ route }: Props) {
  const { json } = route.params;
  const { width } = useWindowDimensions();
  const [rawOpen, setRawOpen] = useState(false);
  const ident = useMemo(() => identityLine(json), [json]);
  const overall = useMemo(() => overallResults(json), [json]);
  const fields = useMemo(() => fieldGroups(json), [json]);
  const checks = useMemo(() => checkGroups(json), [json]);
  const imgs = useMemo(() => images(json), [json]);
  const rawText = useMemo(() => pretty(json), [json]);
  const thumbW = (width - 40 - 12) / 2;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.pad}>
      <View style={styles.ident}>
        <Text style={styles.identTitle}>{ident.title}</Text>
        <Text style={styles.identBody}>
          <Text style={styles.identState}>{ident.status.split(' ·')[0]}</Text>
          <Text>{ident.status.includes(' ·') ? ident.status.slice(ident.status.indexOf(' ·')) : ''}</Text>
        </Text>
        <Text style={styles.identBody}>{ident.counts}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Overall</Text>
        {overall.map((r) => (
          <View key={r.kind} style={styles.row}>
            <Text style={styles.colKey}>{kindLabel(r.kind)}</Text>
            <Text style={[styles.colStatus, { color: resultColor(r.result) }]}>{r.result}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Fields</Text>
        {fields.length === 0 ? (
          <Text style={styles.muted}>No fields in this response</Text>
        ) : (
          fields.map((group) => (
            <View key={group.source}>
              <GroupHeader label={sourceLabel(group.source)} count={group.items.length} />
              {group.items.map((item, i) => (
                <View key={`${item.id}-${i}`} style={styles.item}>
                  <Text style={styles.label}>{item.id}</Text>
                  <Text style={styles.value} selectable>
                    {item.value}
                  </Text>
                  {item.score ? <Text style={styles.extra}>{item.score}</Text> : null}
                </View>
              ))}
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Checks</Text>
        {checks.length === 0 ? (
          <Text style={styles.muted}>No checks in this response</Text>
        ) : (
          checks.map((group) => (
            <View key={group.kind}>
              <GroupHeader label={kindLabel(group.kind)} count={group.items.length} />
              {group.items.map((item, i) => (
                <View key={`${item.id}-${i}`} style={styles.item}>
                  <View style={styles.checkRow}>
                    <Text style={styles.colKey}>{item.id}</Text>
                    <Text style={[styles.colStatus, { color: resultColor(item.result) }]}>{item.result}</Text>
                  </View>
                  {item.extra ? <Text style={styles.extra}>{item.extra}</Text> : null}
                </View>
              ))}
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Images</Text>
        {imgs.length === 0 ? (
          <Text style={styles.muted}>No images in response.</Text>
        ) : (
          <View style={styles.imagesWrap}>
            {imgs.map((img, i) => (
              <View key={`${img.category}-${i}`} style={[styles.thumb, { width: thumbW }]}>
                <Image source={{ uri: img.uri }} style={styles.thumbImg} resizeMode="contain" />
                <Text style={styles.muted} numberOfLines={1}>
                  {img.category}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.rawBtn} onPress={() => setRawOpen((v) => !v)}>
        <Text style={styles.rawTitle}>Raw JSON</Text>
      </TouchableOpacity>
      {rawOpen ? (
        <View style={styles.rawBox}>
          <Text style={styles.raw} selectable>
            {rawText}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: 20, paddingBottom: 40, gap: 16 },
  ident: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  identTitle: { color: colors.text, fontSize: 20, fontWeight: '600', marginBottom: 4, flexShrink: 1 },
  identBody: { color: colors.text, fontSize: 13, lineHeight: 19, flexShrink: 1 },
  identState: { color: colors.text, fontSize: 13, fontWeight: '700' },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radiusCard,
    padding: 16,
  },
  section: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 10 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 6 },
  pill: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(15, 118, 110, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(15, 118, 110, 0.35)',
  },
  count: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  item: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  label: { color: colors.muted, fontSize: 12, flexShrink: 1 },
  value: { color: colors.text, fontSize: 15, fontWeight: '500', flexShrink: 1, width: '100%' },
  extra: { color: colors.muted, fontSize: 12, marginTop: 2, flexShrink: 1 },
  checkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  row: { flexDirection: 'row', paddingVertical: 10, alignItems: 'flex-start' },
  colKey: { flex: 1, color: colors.text, fontSize: 13, paddingRight: 8, flexShrink: 1 },
  colStatus: { fontSize: 13 },
  muted: { color: colors.muted, fontSize: 12, marginTop: 6 },
  imagesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  thumb: {},
  thumbImg: {
    width: '100%',
    height: 148,
    backgroundColor: colors.bg,
    borderRadius: 16,
  },
  rawBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    borderRadius: radiusCard,
  },
  rawTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  rawBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radiusCard,
    padding: 16,
  },
  raw: { color: colors.text, fontFamily: 'Menlo', fontSize: 12, lineHeight: 18 },
});
