import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as PinsApi from '../api/pins';
import { toFriendlyError } from '../api/client';
import type { Pin } from '../types/api';
import { Button } from '../components/Button';
import { CATEGORIES, STATUSES } from '../constants/requests';
import { useAuth } from '../context/AuthContext';

export function StatsScreen() {
  const { user } = useAuth();
  const isAdmin = user?.role_id === 2;
  const currentUserId = user?.id ?? null;

  const [pins, setPins] = useState<Pin[]>([]);
  const [busy, setBusy] = useState(false);

  const hasOwnerInfo = useMemo(() => pins.some((p) => p.owner_id != null || p.user_id != null), [pins]);

  const scopedPins = useMemo(() => {
    if (isAdmin || !currentUserId) return pins;
    if (!hasOwnerInfo) return pins;
    return pins.filter((p) => (p.owner_id ?? p.user_id) === currentUserId || p.user_id === currentUserId);
  }, [pins, isAdmin, currentUserId, hasOwnerInfo]);

  async function load() {
    try {
      setBusy(true);
      const data = await PinsApi.getPins(
        0,
        500,
        !isAdmin && currentUserId ? { owner_id: currentUserId } : undefined
      );
      setPins(data);
    } catch (e) {
      Alert.alert('Не удалось загрузить статистику', toFriendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, currentUserId]);

  const stats = useMemo(() => {
    const total = scopedPins.length;
    const withPhoto = scopedPins.filter((p) => !!p.photo_link).length;
    const withDesc = scopedPins.filter((p) => !!p.description && p.description.trim().length > 0).length;

    const byStatus: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    for (const p of scopedPins) {
      const st = (p.status_id as any) ?? 'new';
      const cat = (p.category_id as any) ?? 'other';
      byStatus[st] = (byStatus[st] ?? 0) + 1;
      byCategory[cat] = (byCategory[cat] ?? 0) + 1;
    }

    const last = [...scopedPins].sort((a, b) => b.id - a.id)[0];
    return { total, withPhoto, withDesc, last, byStatus, byCategory };
  }, [scopedPins]);

  const scopeTitle = isAdmin ? 'Общая статистика' : 'Моя статистика';
  const scopeSubtitle = isAdmin ? 'По всем заявкам' : 'Только по вашим заявкам';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.scopeCard}>
        <Text style={styles.scopeTitle}>{scopeTitle}</Text>
        <Text style={styles.scopeSub}>{scopeSubtitle}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.h}>{isAdmin ? 'Всего заявок' : 'Мои заявки'}</Text>
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
        <Text style={styles.h}>{isAdmin ? 'Последняя заявка' : 'Моя последняя заявка'}</Text>
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
              <Text style={styles.text}>
                {c.emoji} {c.title}
              </Text>
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

  scopeCard: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#fff',
    gap: 4,
  },
  scopeTitle: { fontSize: 16, fontWeight: '800' },
  scopeSub: { fontSize: 12, opacity: 0.7 },
  scopeWarn: { fontSize: 12, opacity: 0.85, marginTop: 6 },

  card: { borderWidth: 1, borderColor: '#eee', borderRadius: 14, padding: 14, backgroundColor: '#fff' },
  h: { fontSize: 14, opacity: 0.7 },
  big: { fontSize: 34, fontWeight: '800', marginTop: 4 },
  text: { fontSize: 14 },
  mono: { fontFamily: 'Courier', fontSize: 16 },
  small: { fontSize: 12, opacity: 0.7 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
