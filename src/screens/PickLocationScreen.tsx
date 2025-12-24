import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import MapView, { Marker, PROVIDER_DEFAULT, type LatLng, type Region } from 'react-native-maps';
import * as Location from 'expo-location';

import type { AppStackParamList } from '../navigation/types';
import { Button } from '../components/Button';

type Props = NativeStackScreenProps<AppStackParamList, 'PickLocation'>;

export function PickLocationScreen({ navigation, route }: Props) {
  const { initialLat, initialLon } = route.params;

  const mapRef = useRef<MapView>(null);
  const regionRef = useRef<Region>({
    latitude: initialLat,
    longitude: initialLon,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });
  const lastDragCenterTs = useRef(0);

  const [coord, setCoord] = useState<LatLng>({ latitude: initialLat, longitude: initialLon });
  const [busy, setBusy] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const coordsText = useMemo(() => {
    return `${coord.latitude.toFixed(6)}, ${coord.longitude.toFixed(6)}`;
  }, [coord.latitude, coord.longitude]);

  const animateTo = useCallback(
    (next: LatLng, duration = 180) => {
      const base = regionRef.current;
      const nextRegion: Region = {
        latitude: next.latitude,
        longitude: next.longitude,
        latitudeDelta: base.latitudeDelta,
        longitudeDelta: base.longitudeDelta,
      };
      regionRef.current = nextRegion;
      mapRef.current?.animateToRegion(nextRegion, duration);
    },
    []
  );

  // При первом открытии пытаемся центрировать карту на текущей геопозиции.
  // Если доступ к геолокации не выдан/отклонён — остаёмся на initialLat/initialLon (обычно центр города).
  useEffect(() => {
    if (!mapReady) return;

    let cancelled = false;
    (async () => {
      try {
        setBusy(true);

        // 1) Если уже есть разрешение — не показываем лишних диалогов.
        let perm = await Location.getForegroundPermissionsAsync();

        // 2) Если разрешения нет, пробуем запросить (первый запуск).
        if (perm.status !== 'granted') {
          perm = await Location.requestForegroundPermissionsAsync();
        }

        // 3) Если пользователь не дал доступ — остаёмся на центре города.
        if (perm.status !== 'granted') return;

        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;

        const next = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setCoord(next);
        animateTo(next, 280);
      } catch {
        // Молча остаёмся на initialLat/initialLon
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mapReady, animateTo]);

  async function useMyLocation() {
    try {
      setBusy(true);
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Нет доступа к геолокации', 'Разрешите доступ к геопозиции в настройках устройства.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const next = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setCoord(next);
      animateTo(next, 250);
    } catch {
      Alert.alert('Не удалось получить геопозицию');
    } finally {
      setBusy(false);
    }
  }

  function confirm() {
    // Надёжно возвращаем координаты на предыдущий экран (CreatePin) без push/duplicate route.
    // В Stack navigation navigate('CreatePin') иногда пушит новый экран, и тогда initialLat/initialLon
    // отсутствуют -> падает CreatePinScreen. Поэтому:
    // 1) выставляем params для предыдущего route
    // 2) просто goBack()
    const state = navigation.getState();
    const prev = state.routes[state.index - 1];

    if (prev?.name === 'CreatePin') {
      navigation.dispatch({
        ...CommonActions.setParams({
          pickedLat: coord.latitude,
          pickedLon: coord.longitude,
        }),
        source: prev.key,
        target: state.key,
      });
      navigation.goBack();
      return;
    }

    // Фолбэк (если вдруг стек другой): навигируемся на CreatePin и передаём все обязательные параметры.
    (navigation as any).navigate('CreatePin', {
      initialLat,
      initialLon,
      pickedLat: coord.latitude,
      pickedLon: coord.longitude,
    });
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={styles.map}
        initialRegion={regionRef.current}
        onMapReady={() => setMapReady(true)}
        onRegionChangeComplete={(r) => {
          regionRef.current = r;
        }}
        onPress={(e) => {
          const next = e.nativeEvent.coordinate;
          setCoord(next);
          // Небольшой "snap" к выбранной точке, чтобы маркер не терялся.
          animateTo(next, 180);
        }}
      >
        <Marker
          coordinate={coord}
          draggable
          onDrag={(e) => {
            const next = e.nativeEvent.coordinate;
            setCoord(next);

            // Во время перетаскивания мягко центруем карту на маркере (throttle, чтобы не дергать каждый кадр)
            const now = Date.now();
            if (now - lastDragCenterTs.current > 80) {
              lastDragCenterTs.current = now;
              animateTo(next, 100);
            }
          }}
          onDragEnd={(e) => {
            const next = e.nativeEvent.coordinate;
            setCoord(next);
            animateTo(next, 180);
          }}
          title="Выбранная точка"
        />
      </MapView>

      {/*
        На Android MapView может рендериться поверх абсолютных overlay (SurfaceView),
        из-за чего кнопки выглядят, но не нажимаются.
        Поэтому панель управления делаем обычным блоком под картой.
      */}
      <View style={styles.bottomPanel}>
        <Text style={styles.title}>Перетащите красный маркер или нажмите на карту</Text>
        <Text style={styles.coords}>{coordsText}</Text>

        <View style={styles.btnRow}>
          <View style={{ flex: 1 }}>
            <Button title={busy ? 'Определяем…' : 'Моя геопозиция'} onPress={useMyLocation} disabled={busy} />
          </View>
          <View style={{ flex: 1 }}>
            {/* "Готово" должно быть доступно даже пока система спрашивает разрешение на геолокацию */}
            <Button title="Готово" onPress={confirm} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  map: { flex: 1 },
  bottomPanel: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 8,
  },
  title: { fontSize: 12, fontWeight: '800', opacity: 0.8 },
  coords: { fontSize: 12, opacity: 0.7 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  // отдельные стили для маркера больше не нужны — используем стандартный красный pin
});
