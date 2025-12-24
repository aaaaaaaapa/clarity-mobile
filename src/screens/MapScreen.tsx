import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { useNavigation, useRoute } from '@react-navigation/native';

import { toFriendlyError } from '../api/client';
import * as PinsApi from '../api/pins';
import type { Pin } from '../types/api';
import { DEFAULT_REGION } from '../utils/config';
import { useAuth } from '../context/AuthContext';
import { CATEGORIES, STATUSES, categoryById, type RequestCategoryId, type RequestStatusId } from '../constants/requests';
import { Chip } from '../components/Chip';
// Category and status are stored server-side.

type LatLng = { latitude: number; longitude: number };

type FocusParams = { latitude: number; longitude: number; pinId?: number };

// route params из Tab
type MapRouteParams = { focus?: FocusParams } | undefined;

type ClusterItem =
  | { kind: 'pin'; pin: Pin }
  | { kind: 'cluster'; count: number; center: LatLng; ids: number[] };

export function MapScreen() {
  const { token } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const mapRef = useRef<MapView>(null);

  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [pins, setPins] = useState<Pin[]>([]);
  const [busy, setBusy] = useState(false);

  // фильтры (для карты)
  const [status, setStatus] = useState<RequestStatusId | 'all'>('all');
  const [category, setCategory] = useState<RequestCategoryId | 'all'>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);

  // текущая позиция пользователя
  const [userPos, setUserPos] = useState<LatLng | null>(null);

  async function loadPins() {
    try {
      setBusy(true);
      const data = await PinsApi.getPins(0, 500);
      setPins(data);
    } catch (e) {
      Alert.alert('Не удалось загрузить метки', toFriendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  // грузим метки только когда есть токен
  useEffect(() => {
    if (token) loadPins();
  }, [token]);


  // геолокация + маркер текущего местоположения (с обновлением)
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        // 1) сразу получаем позицию
        const loc = await Location.getCurrentPositionAsync({});
        const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setUserPos(coords);

        // 2) подписка на обновления позиции
        sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 5000,
            distanceInterval: 10,
          },
          (l) => setUserPos({ latitude: l.coords.latitude, longitude: l.coords.longitude })
        );
      } catch {
        // геолокация необязательна
      }
    })();

    return () => {
      sub?.remove();
    };
  }, []);

  // фокус с другого экрана (например, из деталей)
  useEffect(() => {
    const params = (route.params as MapRouteParams) ?? undefined;
    const focus = params?.focus;
    if (!focus) return;

    const next: Region = {
      latitude: focus.latitude,
      longitude: focus.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };
    setRegion(next);
    mapRef.current?.animateToRegion(next, 350);
  }, [route.params]);

  const filteredPins = useMemo(() => {
    return pins.filter((p) => {
      if (status !== 'all' && (p.status_id as any) !== status) return false;
      if (category !== 'all' && (p.category_id as any) !== category) return false;
      return true;
    });
  }, [pins, status, category]);

  /**
   * Простая «кластеризация» без внешних библиотек:
   * группируем точки по сетке, зависящей от масштаба (latitudeDelta).
   */
  const clusterItems: ClusterItem[] = useMemo(() => {
    if (filteredPins.length === 0) return [];

    const latDelta = Math.max(region.latitudeDelta, 0.001);
    const lonDelta = Math.max(region.longitudeDelta, 0.001);

    // чем дальше от масштаба, тем крупнее клетки
    const grid = 10;
    const cellLat = latDelta / grid;
    const cellLon = lonDelta / grid;

    const minLat = region.latitude - latDelta / 2;
    const minLon = region.longitude - lonDelta / 2;

    const buckets = new Map<string, { ids: number[]; pins: Pin[]; sumLat: number; sumLon: number }>();

    for (const pin of filteredPins) {
      const i = Math.floor((pin.y - minLat) / cellLat);
      const j = Math.floor((pin.x - minLon) / cellLon);
      const key = `${i}:${j}`;
      const b = buckets.get(key) ?? { ids: [], pins: [], sumLat: 0, sumLon: 0 };
      b.ids.push(pin.id);
      b.pins.push(pin);
      b.sumLat += pin.y;
      b.sumLon += pin.x;
      buckets.set(key, b);
    }

    const out: ClusterItem[] = [];
    for (const b of buckets.values()) {
      if (b.pins.length === 1) {
        const only = b.pins[0];
        out.push({ kind: 'pin', pin: only });
      } else {
        out.push({
          kind: 'cluster',
          count: b.pins.length,
          ids: b.ids,
          center: { latitude: b.sumLat / b.pins.length, longitude: b.sumLon / b.pins.length },
        });
      }
    }
    return out;
  }, [filteredPins, region.latitude, region.longitude, region.latitudeDelta, region.longitudeDelta]);

  function zoomToCluster(center: LatLng) {
    const next: Region = {
      latitude: center.latitude,
      longitude: center.longitude,
      latitudeDelta: Math.max(region.latitudeDelta / 2, 0.01),
      longitudeDelta: Math.max(region.longitudeDelta / 2, 0.01),
    };
    setRegion(next);
    mapRef.current?.animateToRegion(next, 250);
  }

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={{ flex: 1 }}
        initialRegion={DEFAULT_REGION}
        region={region}
        onRegionChangeComplete={setRegion}
        onLongPress={(ev) =>
          navigation.navigate('CreatePin', {
            initialLat: ev.nativeEvent.coordinate.latitude,
            initialLon: ev.nativeEvent.coordinate.longitude,
          })
        }
      >
        {/* маркер текущей позиции */}
        {userPos && <Marker key="me" coordinate={userPos} title="Вы здесь" />}

        {clusterItems.map((it, idx) => {
          if (it.kind === 'cluster') {
            return (
              <Marker
                key={`c-${idx}`}
                coordinate={it.center}
                onPress={() => zoomToCluster(it.center)}
              >
                <View style={styles.cluster}>
                  <Text style={styles.clusterText}>{it.count}</Text>
                </View>
              </Marker>
            );
          }

          const cat = categoryById((it.pin.category_id as any) ?? 'other');
          return (
            <Marker
              key={it.pin.id}
              coordinate={{ latitude: it.pin.y, longitude: it.pin.x }}
              onPress={() => navigation.navigate('PinDetails', { pinId: it.pin.id })}
            >
              <View style={styles.pinMarker}>
                <Text style={styles.pinEmoji}>{cat.emoji}</Text>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {clusterItems.length === 0 && !busy ? (
        <View style={styles.emptyOverlay} pointerEvents="none">
          <Text style={styles.emptyText}>Заявок пока нет — нажмите «+», чтобы создать первую</Text>
        </View>
      ) : null}

      {/* FAB / кнопки */}
      <View style={styles.fabWrap} pointerEvents="box-none">
        <Pressable
          onPress={() => navigation.navigate('CreatePin', { initialLat: region.latitude, initialLon: region.longitude })}
          style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.fabText}>+</Text>
        </Pressable>

        <Pressable onPress={loadPins} style={({ pressed }) => [styles.smallBtn, pressed && { opacity: 0.85 }]}>
          <Text style={styles.smallBtnText}>{busy ? '…' : 'Обновить'}</Text>
        </Pressable>

        <Pressable onPress={() => setFiltersOpen((v) => !v)} style={({ pressed }) => [styles.smallBtn, pressed && { opacity: 0.85 }]}>
          <Text style={styles.smallBtnText}>{filtersOpen ? 'Скрыть фильтры' : 'Фильтры'}</Text>
        </Pressable>
      </View>

      {filtersOpen ? (
        <View style={styles.filtersPanel}>
          <Text style={styles.filtersTitle}>Статус</Text>
          <View style={styles.chipsRow}>
            <Chip title="Все" selected={status === 'all'} onPress={() => setStatus('all')} />
            {STATUSES.map((s) => (
              <Chip key={s.id} title={s.title} selected={status === s.id} onPress={() => setStatus(s.id)} />
            ))}
          </View>

          <Text style={[styles.filtersTitle, { marginTop: 10 }]}>Категория</Text>
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
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fabWrap: { position: 'absolute', right: 14, bottom: 14, alignItems: 'flex-end', gap: 10 },
  fab: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  fabText: { color: '#fff', fontSize: 30, marginTop: -2 },
  smallBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: 'rgba(17,17,17,0.9)' },
  smallBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  cluster: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  clusterText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  pinMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#111',
  },
  pinEmoji: { fontSize: 18 },
  filtersPanel: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 90,
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  filtersTitle: { fontSize: 12, opacity: 0.7, marginBottom: 6, fontWeight: '700' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emptyOverlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  emptyText: { fontSize: 12, opacity: 0.8, fontWeight: '700' },
});
