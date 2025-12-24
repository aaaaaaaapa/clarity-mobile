import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as PinsApi from '../api/pins';
import { toFriendlyError } from '../api/client';
import type { Pin } from '../types/api';
import { Button } from '../components/Button';
import { CATEGORIES, STATUSES } from '../constants/requests';

export function StatsScreen() {
  const [pins, setPins] = useState<Pin[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setBusy(true);
      const data = await PinsApi.getPins(0, 500);
      setPins(data);
    } catch (e) {
      Alert.alert('Не удалось загрузить статистику', toFriendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Category/status are stored server-side.

  const stats = useMemo(() => {
    const total = pins.length;
    const withPhoto = pins.filter((p) => !!p.photo_link).length;
    const withDesc = pins.filter((p) => !!p.description && p.description.trim().length > 0).length;

    const byStatus: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    for (const p of pins) {
      const st = (p.status_id as any) ?? 'new';
      const cat = (p.category_id as any) ?? 'other';
      byStatus[st] = (byStatus[st] ?? 0) + 1;
      byCategory[cat] = (byCategory[cat] ?? 0) + 1;
    }

    const last = [...pins].sort((a, b) => b.id - a.id)[0];
    return { total, withPhoto, withDesc, last, byStatus, byCategory };
  }, [pins]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.h}>Всего меток</Text>
        <Text style={styles.big}>{stats.total}</Text>
      </View>

      <View style={styles.row}>
        <View style={[styles.card, { flex: 1 }]}>
          <Text style={styles.h}>С фото</Text>
          <Text style={styles.big}>{stats.withPhoto}</Text>
        </View>
        <View style={[styles.card, { flex: 1 }]}>
          <Text style={styles.h}>С описанием</Text>
          <Text style={styles.big}>{stats.withDesc}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.h}>Последняя метка</Text>
        {stats.last ? (
          <View style={{ gap: 6, marginTop: 8 }}>
            <Text style={styles.mono}>#{stats.last.id}</Text>
            <Text style={styles.text}>{stats.last.description || 'без описания'}</Text>
            <Text style={styles.small}>x={stats.last.x.toFixed(5)}, y={stats.last.y.toFixed(5)}</Text>
          </View>
        ) : (
          <Text style={styles.text}>Пока нет данных</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.h}>По статусам</Text>
        <View style={{ gap: 8, marginTop: 8 }}>
          {STATUSES.map((s) => (
            <View key={s.id} style={styles.statRow}>
              <Text style={styles.text}>{s.title}</Text>
              <Text style={styles.mono}>{stats.byStatus[s.id] ?? 0}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.h}>По категориям</Text>
        <View style={{ gap: 8, marginTop: 8 }}>
          {CATEGORIES.map((c) => (
            <View key={c.id} style={styles.statRow}>
              <Text style={styles.text}>{c.emoji} {c.title}</Text>
              <Text style={styles.mono}>{stats.byCategory[c.id] ?? 0}</Text>
            </View>
          ))}
        </View>
      </View>

      <Button title={busy ? 'Обновляем…' : 'Обновить'} onPress={load} disabled={busy} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  row: { flexDirection: 'row', gap: 12 },
  card: { borderWidth: 1, borderColor: '#eee', borderRadius: 14, padding: 14, backgroundColor: '#fff' },
  h: { fontSize: 14, opacity: 0.7 },
  big: { fontSize: 34, fontWeight: '800', marginTop: 4 },
  text: { fontSize: 14 },
  mono: { fontFamily: 'Courier', fontSize: 16 },
  small: { fontSize: 12, opacity: 0.7 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
