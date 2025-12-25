import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View, Platform } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';

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
  | { kind: 'pin'; key: string; pin: Pin; coord?: LatLng }
  | { kind: 'cluster'; key: string; count: number; center: LatLng; ids: number[] };

export function MapScreen() {
  const { token } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const mapRef = useRef<MapView>(null);

  // Иногда MapView (особенно на Android) может триггерить onRegionChangeComplete
  // даже без видимого движения. Если слепо сетать state — будут лишние перерендеры
  // и «дёргание» кастомных маркеров/кластеров.
  const lastRegionRef = useRef<Region>(DEFAULT_REGION);

  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const setRegionSafe = (next: Region) => {
    lastRegionRef.current = next;
    setRegion(next);
  };

  // На Android кастомные маркеры (Marker с дочерним View) могут становиться невидимыми,
  // если tracksViewChanges выключен в момент их монтирования (например, когда кластер распадается
  // на отдельные метки при зуме). Поэтому мы включаем tracksViewChanges на короткое время при:
  // - первой загрузке меток
  // - смене фильтров
  // - заметном изменении масштаба (zoom)
  const tracksTimerRef = useRef<any>(null);
  const lastZoomRef = useRef<number>(DEFAULT_REGION.latitudeDelta);
  const [tracksPins, setTracksPins] = useState<boolean>(Platform.OS === 'android');

  const enableTracksPinsTemporarily = (ms = 650) => {
    // На iOS можно держать выключенным почти всегда.
    if (Platform.OS !== 'android') return;
    setTracksPins(true);
    if (tracksTimerRef.current) clearTimeout(tracksTimerRef.current);
    tracksTimerRef.current = setTimeout(() => setTracksPins(false), ms);
  };

  const onRegionChangeComplete = (next: Region) => {
    const prev = lastRegionRef.current;
    // Достаточно «мягкого» эпсилона, чтобы игнорировать микроколебания.
    const eps = 1e-5;
    if (
      Math.abs(prev.latitude - next.latitude) < eps &&
      Math.abs(prev.longitude - next.longitude) < eps &&
      Math.abs(prev.latitudeDelta - next.latitudeDelta) < eps &&
      Math.abs(prev.longitudeDelta - next.longitudeDelta) < eps
    ) {
      return;
    }
    setRegionSafe(next);

    // Если пользователь заметно сдвинул карту (pan), на экране могут смонтироваться новые пины.
    // На Android они иногда становятся невидимыми, если tracksViewChanges выключен в момент монтирования.
    // Поэтому кратковременно включаем tracksViewChanges при существенном перемещении.
    const refDeltaLat = Math.max(prev.latitudeDelta, next.latitudeDelta, 0.001);
    const refDeltaLon = Math.max(prev.longitudeDelta, next.longitudeDelta, 0.001);
    const movedALot =
      Math.abs(next.latitude - prev.latitude) > refDeltaLat * 0.18 ||
      Math.abs(next.longitude - prev.longitude) > refDeltaLon * 0.18;
    if (movedALot) {
      enableTracksPinsTemporarily(650);
    }

    // если заметно изменился масштаб — даём меткам шанс перерендериться
    // (кластер может распасться на пины, и им нужно успеть отрисоваться до выключения tracksViewChanges)
    const prevZoom = lastZoomRef.current;
    const nextZoom = next.latitudeDelta;
    // считаем «значимым» изменение на 12% и более
    if (prevZoom > 0 && Math.abs(nextZoom - prevZoom) / prevZoom >= 0.12) {
      lastZoomRef.current = nextZoom;
      enableTracksPinsTemporarily(700);
    }
  };
  const [pins, setPins] = useState<Pin[]>([]);
  const [busy, setBusy] = useState(false);

  // фильтры (для карты)
  const [status, setStatus] = useState<RequestStatusId | 'all'>('all');
  const [category, setCategory] = useState<RequestCategoryId | 'all'>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Для кластеров на Android оставляем tracksViewChanges включённым всегда,
  // чтобы они не «пропадали» при снапшоте.
  const tracksClusters = Platform.OS === 'android';

  useEffect(() => {
    enableTracksPinsTemporarily(700);
    return () => {
      if (tracksTimerRef.current) clearTimeout(tracksTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins.length, status, category]);


  // текущая позиция пользователя
  const [userPos, setUserPos] = useState<LatLng | null>(null);

  const loadPins = useCallback(async () => {
    try {
      setBusy(true);
      const data = await PinsApi.getPins(0, 500);
      setPins(data);
    } catch (e) {
      Alert.alert('Не удалось загрузить метки', toFriendlyError(e));
    } finally {
      setBusy(false);
    }
  }, []);

  // грузим метки только когда есть токен
  useEffect(() => {
    if (token) loadPins();
  }, [token, loadPins]);

  // Обновляем карту при возврате на вкладку (например, после удаления/редактирования заявки).
  useFocusEffect(
    useCallback(() => {
      if (token) loadPins();
    }, [token, loadPins])
  );


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
    setRegionSafe(next);
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

    // На очень близком зуме кластеры могут «не распадаться» (особенно если несколько заявок
    // имеют одинаковые/очень близкие координаты). В этом режиме показываем отдельные метки,
    // а «плотные» группы слегка «расползаются» вокруг центра (spiderfy).
    const DISABLE_CLUSTER_DELTA = 0.007;
    const disableClustering = latDelta <= DISABLE_CLUSTER_DELTA && lonDelta <= DISABLE_CLUSTER_DELTA;

    // чем дальше от масштаба, тем крупнее клетки
    // (увеличили детализацию, чтобы кластеры распадались раньше)
    const grid = 14;
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
    for (const [bucketKey, b] of buckets.entries()) {
      if (b.pins.length === 1) {
        const only = b.pins[0];
        out.push({ kind: 'pin', key: `p-${only.id}`, pin: only });
        continue;
      }

      if (disableClustering) {
        // spiderfy вокруг центра бакета
        const n = b.pins.length;
        const center = { latitude: b.sumLat / n, longitude: b.sumLon / n };
        // радиус зависит от масштаба, чтобы на близком зуме «разбежались», а не улетели далеко
        const radiusLat = Math.max(latDelta, 0.001) * 0.18;
        const radiusLon = Math.max(lonDelta, 0.001) * 0.18;
        const sorted = [...b.pins].sort((a, c) => a.id - c.id);
        for (let idx = 0; idx < sorted.length; idx++) {
          const pin = sorted[idx];
          const angle = (2 * Math.PI * idx) / n;
          const coord = {
            latitude: center.latitude + radiusLat * Math.cos(angle),
            longitude: center.longitude + radiusLon * Math.sin(angle),
          };
          out.push({ kind: 'pin', key: `p-${pin.id}`, pin, coord });
        }
        continue;
      }

      {
        out.push({
          kind: 'cluster',
          key: `c-${bucketKey}`,
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
      latitudeDelta: Math.max(region.latitudeDelta / 2, 0.002),
      longitudeDelta: Math.max(region.longitudeDelta / 2, 0.002),
    };
    setRegionSafe(next);
    mapRef.current?.animateToRegion(next, 250);
  }

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={{ flex: 1 }}
        initialRegion={DEFAULT_REGION}
        onRegionChangeComplete={onRegionChangeComplete}
        onLongPress={(ev) =>
          navigation.navigate('CreatePin', {
            initialLat: ev.nativeEvent.coordinate.latitude,
            initialLon: ev.nativeEvent.coordinate.longitude,
          })
        }
      >
        {/* маркер текущей позиции */}
        {userPos && <Marker key="me" coordinate={userPos} title="Вы здесь" />}

        {clusterItems.map((it) => {
          if (it.kind === 'cluster') {
            return (
              <Marker
                key={it.key}
                coordinate={it.center}
                onPress={() => zoomToCluster(it.center)}
                tracksViewChanges={tracksClusters}
              >
                <View style={styles.clusterOuter}>
                  <View style={styles.clusterInner}>
                    <Text style={styles.clusterText}>{it.count}</Text>
                  </View>
                </View>
              </Marker>
            );
          }

          const cat = categoryById((it.pin.category_id as any) ?? 'other');
          return (
            <Marker
              key={it.key}
              coordinate={it.coord ?? { latitude: it.pin.y, longitude: it.pin.x }}
              onPress={() => navigation.navigate('PinDetails', { pinId: it.pin.id })}
              tracksViewChanges={tracksPins}
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
  // В Android кастомные маркеры могут выглядеть «обрезанными» из‑за рендера в bitmap.
  // Делаем круг через два слоя (внешний белый «бордер», внутренний тёмный круг).
  clusterOuter: {
    width: 46,
    height: 46,
    borderRadius: 999,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  clusterInner: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
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
