import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import * as Location from 'expo-location';

import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { toFriendlyError } from '../api/client';
import * as PinsApi from '../api/pins';
import type { Pin, PinCreate } from '../types/api';
import { DEFAULT_REGION } from '../utils/config';
import { useAuth } from '../context/AuthContext';

type Draft = { latitude: number; longitude: number };
type LatLng = { latitude: number; longitude: number };

export function MapScreen() {
  const { token } = useAuth();

  const mapRef = useRef<MapView>(null);

  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [pins, setPins] = useState<Pin[]>([]);
  const [busy, setBusy] = useState(false);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [descr, setDescr] = useState('');
  const [photoLink, setPhotoLink] = useState('');

  // ✅ текущая позиция пользователя
  const [userPos, setUserPos] = useState<LatLng | null>(null);

  const markers = useMemo(
    () =>
      pins.map((p) => ({
        id: p.id,
        latitude: p.y,
        longitude: p.x,
        title: p.description || `Метка #${p.id}`,
        photo_link: p.photo_link,
      })),
    [pins]
  );

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

  // ✅ Геолокация + маркер текущего местоположения (с обновлением)
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

        // (опционально) чуть приблизим карту к пользователю
        const next: Region = {
          latitude: coords.latitude,
          longitude: coords.longitude,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        };
        setRegion(next);
        mapRef.current?.animateToRegion(next, 350);

        // 2) подписка на обновления позиции
        sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 5000,      // раз в ~5 секунд
            distanceInterval: 10,    // или каждые 10 метров
          },
          (l) => {
            setUserPos({ latitude: l.coords.latitude, longitude: l.coords.longitude });
          }
        );
      } catch {
        // геолокация необязательна
      }
    })();

    return () => {
      sub?.remove();
    };
  }, []);

  function openCreateAt(lat: number, lon: number) {
    setDraft({ latitude: lat, longitude: lon });
    setDescr('');
    setPhotoLink('');
  }

  async function submitCreate() {
    if (!draft) return;

    if (!photoLink.trim()) {
      Alert.alert('Укажите ссылку на фото', 'В бэке поле photo_link обязательное');
      return;
    }

    const payload: PinCreate = {
      x: draft.longitude,
      y: draft.latitude,
      photo_link: photoLink.trim(),
      description: descr.trim() ? descr.trim() : null,
    };

    try {
      setBusy(true);
      const created = await PinsApi.createPin(payload);
      setPins((prev) => [created, ...prev]);
      setDraft(null);
    } catch (e) {
      Alert.alert('Не удалось создать метку', toFriendlyError(e));
    } finally {
      setBusy(false);
    }
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
        onLongPress={(ev) => openCreateAt(ev.nativeEvent.coordinate.latitude, ev.nativeEvent.coordinate.longitude)}
      >
        {/* ✅ маркер текущей позиции */}
        {userPos && (
          <Marker
            key="me"
            coordinate={userPos}
            title="Вы здесь"
            description="Текущая геопозиция"
          />
        )}

        {markers.map((m) => (
          <Marker
            key={m.id}
            coordinate={{ latitude: m.latitude, longitude: m.longitude }}
            title={m.title}
            description={m.photo_link}
          />
        ))}
      </MapView>

      <View style={styles.fabWrap} pointerEvents="box-none">
        <Pressable
          onPress={() => openCreateAt(region.latitude, region.longitude)}
          style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.fabText}>+</Text>
        </Pressable>

        <Pressable onPress={loadPins} style={({ pressed }) => [styles.smallBtn, pressed && { opacity: 0.85 }]}>
          <Text style={styles.smallBtnText}>{busy ? '…' : 'Обновить'}</Text>
        </Pressable>
      </View>

      <Modal visible={!!draft} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Новая метка</Text>
            <Text style={styles.modalSub}>
              Координаты: {draft?.latitude.toFixed(6)}, {draft?.longitude.toFixed(6)}
            </Text>

            <View style={{ gap: 12, marginTop: 12 }}>
              <Input
                label="Описание (необязательно)"
                value={descr}
                onChangeText={setDescr}
                placeholder="Например: мусор у остановки"
                multiline
              />
              <Input
                label="Ссылка на фото (обязательно)"
                value={photoLink}
                onChangeText={setPhotoLink}
                placeholder="https://..."
              />

              <Button title={busy ? 'Сохраняем…' : 'Создать'} onPress={submitCreate} disabled={busy} />
              <Button title="Отмена" onPress={() => setDraft(null)} disabled={busy} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fabWrap: { position: 'absolute', right: 14, bottom: 14, alignItems: 'flex-end', gap: 10 },
  fab: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  fabText: { color: '#fff', fontSize: 30, marginTop: -2 },
  smallBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: 'rgba(17,17,17,0.9)' },
  smallBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16 },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  modalSub: { fontSize: 12, opacity: 0.7, marginTop: 4 },
});
