import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';

import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { Input } from '../components/Input';
import { toFriendlyError } from '../api/client';
import * as PinsApi from '../api/pins';
import type { PinCreate } from '../types/api';
import { CATEGORIES, STATUSES, type RequestCategoryId, type RequestStatusId } from '../constants/requests';
import { setPinMeta } from '../storage/pinMeta';
import type { AppStackParamList } from '../navigation/types';
import { isLocalPhotoUri, photoToImageUri } from '../utils/photo';

type Props = NativeStackScreenProps<AppStackParamList, 'CreatePin'>;

export function CreatePinScreen({ navigation, route }: Props) {
  const { initialLat, initialLon } = route.params;

  const [lat, setLat] = useState(initialLat);
  const [lon, setLon] = useState(initialLon);

  const [categoryId, setCategoryId] = useState<RequestCategoryId | null>(null);
  const [statusId, setStatusId] = useState<RequestStatusId>('new');

  const [descr, setDescr] = useState('');
  const [photoUri, setPhotoUri] = useState('');
  const [busy, setBusy] = useState(false);

  const dirty = useMemo(() => {
    return !!categoryId || !!descr.trim() || !!photoUri.trim() || lat !== initialLat || lon !== initialLon;
  }, [categoryId, descr, photoUri, lat, lon, initialLat, initialLon]);

  // предупреждение о несохранённом черновике
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (!dirty || busy) return;
      e.preventDefault();
      Alert.alert('Закрыть форму?', 'Данные не сохранены.', [
        { text: 'Остаться', style: 'cancel' },
        {
          text: 'Закрыть',
          style: 'destructive',
          onPress: () => navigation.dispatch(e.data.action),
        },
      ]);
    });
    return unsub;
  }, [navigation, dirty, busy]);

  const hasPhoto = useMemo(() => !!photoUri.trim(), [photoUri]);
  const previewUri = useMemo(() => photoToImageUri(photoUri), [photoUri]);

  async function pickImage(source: 'camera' | 'library') {
    try {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Нет доступа к камере', 'Разрешите доступ к камере в настройках устройства.');
          return;
        }
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Нет доступа к галерее', 'Разрешите доступ к фото в настройках устройства.');
          return;
        }
      }

      // Совместимость между версиями expo-image-picker:
      // - старые версии: ImagePicker.MediaTypeOptions.Images
      // - новые версии:  ImagePicker.MediaType.Images
      const imageMediaTypes: any = (ImagePicker as any).MediaType?.Images
        ? (ImagePicker as any).MediaType.Images
        : (ImagePicker as any).MediaTypeOptions?.Images;

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: imageMediaTypes,
              allowsEditing: true,
              quality: 0.7,
              base64: false,
              exif: false,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: imageMediaTypes,
              allowsEditing: true,
              quality: 0.7,
              base64: false,
              exif: false,
            });

      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset) return;

      setPhotoUri(asset.uri);
    } catch (e: any) {
      // Частый кейс: камера недоступна на симуляторе/эмуляторе.
      const msg = String(e?.message ?? '');
      console.warn('[pickImage]', source, e);

      if (
        source === 'camera' &&
        /simulator|emulator|no\s+camera|camera\s+is\s+not\s+available|not\s+available/i.test(msg)
      ) {
        Alert.alert(
          'Камера недоступна',
          'Камера может не работать в эмуляторе/симуляторе. Выберите фото из галереи или протестируйте на реальном устройстве.',
          [
            { text: 'Открыть галерею', onPress: () => pickImage('library') },
            { text: 'Ок', style: 'cancel' },
          ]
        );
        return;
      }

      Alert.alert('Не удалось выбрать фото', msg || 'Попробуйте ещё раз.');
    }
  }

  async function useMyLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Нет доступа к геолокации');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setLat(loc.coords.latitude);
      setLon(loc.coords.longitude);
    } catch {
      Alert.alert('Не удалось получить геопозицию');
    }
  }

  async function onSubmit() {
    if (!categoryId) {
      Alert.alert('Выберите категорию');
      return;
    }
    if (!photoUri.trim()) {
      Alert.alert('Добавьте фото', 'Сфотографируйте проблему или выберите фото из галереи.');
      return;
    }

    if (!isLocalPhotoUri(photoUri)) {
      Alert.alert('Ошибка фото', 'Не удалось получить локальный файл изображения. Попробуйте выбрать фото заново.');
      return;
    }

    try {
      setBusy(true);

      // 1) загрузка файла -> получаем короткую ссылку (/uploads/..)
      const photo_link = await PinsApi.uploadPinPhoto(photoUri);

      // 2) создаём заявку уже с ссылкой
      const payload: PinCreate = {
        x: lon,
        y: lat,
        photo_link,
        description: descr.trim() ? descr.trim() : null,
      };

      const created = await PinsApi.createPin(payload);
      await setPinMeta(created.id, { categoryId, statusId, updatedAt: Date.now() });
      Alert.alert('Готово', 'Заявка создана');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Не удалось создать', toFriendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.h}>Местоположение</Text>
        <Text style={styles.small}>Координаты: {lat.toFixed(6)}, {lon.toFixed(6)}</Text>
        <View style={{ marginTop: 10 }}>
          <Button title="Использовать мою геопозицию" onPress={useMyLocation} disabled={busy} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.h}>Категория</Text>
        <View style={styles.chipsRow}>
          {CATEGORIES.map((c) => (
            <Chip
              key={c.id}
              title={`${c.emoji} ${c.title}`}
              selected={categoryId === c.id}
              onPress={() => setCategoryId(c.id)}
            />
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.h}>Статус</Text>
        <View style={styles.chipsRow}>
          {STATUSES.map((s) => (
            <Chip key={s.id} title={s.title} selected={statusId === s.id} onPress={() => setStatusId(s.id)} />
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.h}>Описание</Text>
        <Input
          label="Кратко опишите проблему"
          value={descr}
          onChangeText={setDescr}
          placeholder="Например: мусор у остановки"
          multiline
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.h}>Фото</Text>
        <View style={styles.photoRow}>
          <View style={{ flex: 1 }}>
            <Button title="Сделать фото" onPress={() => pickImage('camera')} disabled={busy} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Из галереи" onPress={() => pickImage('library')} disabled={busy} />
          </View>
        </View>

        {hasPhoto ? (
          <>
            <Image source={{ uri: previewUri }} style={styles.preview} resizeMode="cover" />
            <Pressable
              onPress={() => setPhotoUri('')}
              style={({ pressed }) => [styles.remove, pressed && { opacity: 0.85 }]}
              disabled={busy}
            >
              <Text style={styles.removeText}>Удалить фото</Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.small}>Фото обязательно: сфотографируйте проблему или выберите из галереи.</Text>
        )}
      </View>

      <Button
        title={busy ? 'Сохраняем…' : 'Отправить'}
        onPress={onSubmit}
        disabled={busy || !categoryId || !photoUri.trim()}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  card: { borderWidth: 1, borderColor: '#eee', borderRadius: 14, padding: 14, backgroundColor: '#fff', gap: 10 },
  h: { fontSize: 16, fontWeight: '800' },
  small: { fontSize: 12, opacity: 0.7 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preview: { height: 180, borderRadius: 12, marginTop: 10, backgroundColor: '#f3f4f6' },
  photoRow: { flexDirection: 'row', gap: 10 },
  remove: { paddingVertical: 8, alignItems: 'center' },
  removeText: { fontSize: 12, fontWeight: '800', opacity: 0.7 },
});
