import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import * as PinsApi from '../api/pins';
import { toFriendlyError } from '../api/client';
import type { Pin } from '../types/api';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { Input } from '../components/Input';
import { StatusBadge } from '../components/StatusBadge';
import { CATEGORIES, STATUSES, categoryById, type RequestCategoryId, type RequestStatusId } from '../constants/requests';
import { getManyPinMeta, defaultPinMeta, type PinMeta } from '../storage/pinMeta';
import type { AppStackParamList, AppTabsParamList } from '../navigation/types';
import { DEFAULT_REGION } from '../utils/config';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<AppTabsParamList, 'List'>,
  NativeStackNavigationProp<AppStackParamList>
>;

export function PinsListScreen() {
  const navigation = useNavigation<Nav>();
  const [pins, setPins] = useState<Pin[]>([]);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<RequestStatusId | 'all'>('all');
  const [category, setCategory] = useState<RequestCategoryId | 'all'>('all');

  async function load() {
    try {
      setBusy(true);
      const data = await PinsApi.getPins(0, 500);
      // сортировка «новые сверху»
      setPins([...data].sort((a, b) => b.id - a.id));
    } catch (e) {
      Alert.alert('Не удалось загрузить список', toFriendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const [metaById, setMetaById] = useState<Record<number, PinMeta>>({});

  useEffect(() => {
    (async () => {
      const ids = pins.map((p) => p.id);
      const m = await getManyPinMeta(ids);
      setMetaById(m);
    })();
  }, [pins]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return pins
      .map((pin) => ({ pin, meta: metaById[pin.id] ?? defaultPinMeta() }))
      .filter(({ pin, meta }) => {
        if (status !== 'all' && meta.statusId !== status) return false;
        if (category !== 'all' && meta.categoryId !== category) return false;
        if (query) {
          // Не включаем photo_link в поиск: при хранении base64 это может быть очень большая строка
          const hay = `${pin.description ?? ''} #${pin.id}`.toLowerCase();
          if (!hay.includes(query)) return false;
        }
        return true;
      });
  }, [pins, metaById, status, category, q]);

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={filtered}
        keyExtractor={(i) => String(i.pin.id)}
        contentContainerStyle={styles.container}
        ListHeaderComponent={
          <View style={{ gap: 10 }}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>Заявки</Text>
              <Pressable onPress={load} style={({ pressed }) => [styles.refresh, pressed && { opacity: 0.85 }]}>
                <Text style={styles.refreshText}>{busy ? '…' : 'Обновить'}</Text>
              </Pressable>
            </View>

            <Input label="Поиск" value={q} onChangeText={setQ} placeholder="описание, #id" />

            <Text style={styles.small}>Статус</Text>
            <View style={styles.chipsRow}>
              <Chip title="Все" selected={status === 'all'} onPress={() => setStatus('all')} />
              {STATUSES.map((s) => (
                <Chip key={s.id} title={s.title} selected={status === s.id} onPress={() => setStatus(s.id)} />
              ))}
            </View>

            <Text style={styles.small}>Категория</Text>
            <View style={styles.chipsRow}>
              <Chip title="Все" selected={category === 'all'} onPress={() => setCategory('all')} />
              {CATEGORIES.map((c) => (
                <Chip
                  key={c.id}
                  title={`${c.emoji} ${c.title}`}
                  selected={category === c.id}
                  onPress={() => setCategory(c.id)}
                />
              ))}
            </View>

            <View style={{ marginTop: 6 }}>
              <Button
                title="Создать заявку"
                onPress={() =>
                  navigation.navigate('CreatePin', {
                    initialLat: DEFAULT_REGION.latitude,
                    initialLon: DEFAULT_REGION.longitude,
                  })
                }
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.small}>Заявок не найдено</Text>
          </View>
        }
        renderItem={({ item }) => {
          const meta = item.meta ?? defaultPinMeta();
          const cat = categoryById(meta.categoryId);
          return (
            <Pressable
              onPress={() => navigation.navigate('PinDetails', { pinId: item.pin.id })}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {cat.emoji} {cat.title}
                </Text>
                <StatusBadge statusId={meta.statusId} />
              </View>
              <Text style={styles.text} numberOfLines={2}>
                {item.pin.description?.trim() ? item.pin.description : '—'}
              </Text>
              <Text style={styles.small} numberOfLines={1}>
                #{item.pin.id} · {item.pin.y.toFixed(4)}, {item.pin.x.toFixed(4)}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '900' },
  refresh: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: 'rgba(17,17,17,0.9)' },
  refreshText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { borderWidth: 1, borderColor: '#eee', borderRadius: 14, padding: 14, backgroundColor: '#fff', gap: 8 },
  cardTitle: { fontSize: 14, fontWeight: '900', flex: 1 },
  text: { fontSize: 14 },
  small: { fontSize: 12, opacity: 0.7 },
  empty: { paddingVertical: 30, alignItems: 'center' },
});
