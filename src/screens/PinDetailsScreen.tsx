import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';

import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { Input } from '../components/Input';
import { StatusBadge } from '../components/StatusBadge';
import { toFriendlyError } from '../api/client';
import * as PinsApi from '../api/pins';
import type { Pin, PinCreate } from '../types/api';
import { CATEGORIES, STATUSES, categoryById, statusById, type RequestCategoryId, type RequestStatusId } from '../constants/requests';
import { defaultPinMeta, getPinMeta, setPinMeta } from '../storage/pinMeta';
import type { AppStackParamList } from '../navigation/types';
import { isLocalPhotoUri, photoToImageUri } from '../utils/photo';

type Props = NativeStackScreenProps<AppStackParamList, 'PinDetails'>;

export function PinDetailsScreen({ navigation, route }: Props) {
  const { pinId } = route.params;

  const [pin, setPin] = useState<Pin | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [edit, setEdit] = useState(false);
  const [descr, setDescr] = useState('');
  // photoUri: what we show in <Image/> (can be remote or local)
  const [photoUri, setPhotoUri] = useState('');
  // photoLink: what we send to API (short link like /uploads/...)
  const [photoLink, setPhotoLink] = useState('');
  const [categoryId, setCategoryId] = useState<RequestCategoryId>('other');
  const [statusId, setStatusId] = useState<RequestStatusId>('new');

  const hasPhoto = useMemo(() => !!photoUri.trim(), [photoUri]);
  const previewUri = useMemo(() => photoToImageUri(photoUri), [photoUri]);

  async function load() {
    try {
      setLoading(true);
      // На бэке может не быть GET /pins/{id}, поэтому подтягиваем список и ищем
      const all = await PinsApi.getPins(0, 500);
      const found = all.find((p) => p.id === pinId) ?? null;
      setPin(found);

      const meta = (await getPinMeta(pinId)) ?? defaultPinMeta();
      setCategoryId(meta.categoryId);
      setStatusId(meta.statusId);

      if (found) {
        setDescr(found.description ?? '');
        setPhotoLink(found.photo_link ?? '');
        setPhotoUri(photoToImageUri(found.photo_link ?? ''));
      }
    } catch (e) {
      Alert.alert('Не удалось загрузить', toFriendlyError(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinId]);

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

      // New local image selected -> will require upload
      setPhotoUri(asset.uri);
      setPhotoLink('');
    } catch (e: any) {
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

  async function onSave() {
    if (!pin) return;
    if (!photoUri.trim()) {
      Alert.alert('Фото обязательно', 'Сфотографируйте проблему или выберите фото из галереи.');
      return;
    }

    try {
      setBusy(true);

      // If user picked a new local file, upload it first.
      let finalPhotoLink = photoLink;
      if (!finalPhotoLink || isLocalPhotoUri(photoUri)) {
        if (!isLocalPhotoUri(photoUri)) {
          Alert.alert('Ошибка фото', 'Не удалось получить локальный файл изображения. Выберите фото заново.');
          return;
        }
        finalPhotoLink = await PinsApi.uploadPinPhoto(photoUri);
      }

      const payload: PinCreate = {
        x: pin.x,
        y: pin.y,
        photo_link: finalPhotoLink,
        description: descr.trim() ? descr.trim() : null,
      };

      // 1) пытаемся обновить на сервере
      try {
        const updated = await PinsApi.updatePin(pin.id, payload);
        setPin(updated);
      } catch (e) {
        // если эндпоинта нет — не считаем это фатальной ошибкой для курсового UI
        console.log('updatePin failed, saving locally only', e);
      }

      // 2) всегда сохраняем meta локально (категория/статус)
      await setPinMeta(pin.id, { categoryId, statusId, updatedAt: Date.now() });

      setPhotoLink(finalPhotoLink);

      setEdit(false);
      Alert.alert('Готово', 'Изменения сохранены');
    } catch (e) {
      Alert.alert('Не удалось сохранить', toFriendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  function openOnMap() {
    if (!pin) return;
    // Возвращаемся на вкладку «Карта» и просим сфокусироваться на координатах
    navigation.navigate('Tabs', {
      screen: 'Map',
      params: { focus: { latitude: pin.y, longitude: pin.x, pinId: pin.id } },
    });
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.small}>Загрузка…</Text>
      </View>
    );
  }

  if (!pin) {
    return (
      <View style={styles.center}>
        <Text style={styles.small}>Заявка не найдена</Text>
        <View style={{ marginTop: 12, width: 220 }}>
          <Button title="Назад" onPress={() => navigation.goBack()} />
        </View>
      </View>
    );
  }

  const cat = categoryById(categoryId);
  const st = statusById(statusId);

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.h}>Заявка #{pin.id}</Text>
        <StatusBadge statusId={statusId} />
        <Text style={styles.small}>Категория: {cat.emoji} {cat.title}</Text>
        <Text style={styles.small}>Координаты: {pin.y.toFixed(6)}, {pin.x.toFixed(6)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.h}>Описание</Text>
        {edit ? (
          <Input label="" value={descr} onChangeText={setDescr} multiline />
        ) : (
          <Text style={styles.text}>{pin.description?.trim() ? pin.description : '—'}</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.h}>Фото</Text>
        {edit ? (
          <>
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
                <Image source={{ uri: previewUri }} style={styles.preview} />
                <Pressable
                  onPress={() => {
                    setPhotoUri('');
                    setPhotoLink('');
                  }}
                  style={({ pressed }) => [styles.remove, pressed && { opacity: 0.85 }]}
                  disabled={busy}
                >
                  <Text style={styles.removeText}>Удалить фото</Text>
                </Pressable>
              </>
            ) : (
              <Text style={styles.small}>Фото обязательно: сфотографируйте проблему или выберите из галереи.</Text>
            )}
          </>
        ) : hasPhoto ? (
          <Image source={{ uri: previewUri }} style={styles.preview} />
        ) : (
          <Text style={styles.small}>Фото не прикреплено</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.h}>Категория и статус</Text>
        {edit ? (
          <>
            <Text style={styles.small}>Категория</Text>
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

            <Text style={[styles.small, { marginTop: 10 }]}>Статус</Text>
            <View style={styles.chipsRow}>
              {STATUSES.map((s) => (
                <Chip key={s.id} title={s.title} selected={statusId === s.id} onPress={() => setStatusId(s.id)} />
              ))}
            </View>
            <Text style={[styles.small, { marginTop: 10 }]}>Цвет статуса: {st.color}</Text>
          </>
        ) : (
          <Text style={styles.text}>{cat.emoji} {cat.title} · {st.title}</Text>
        )}
      </View>

      <View style={{ gap: 10 }}>
        <Button title="Показать на карте" onPress={openOnMap} />

        {edit ? (
          <>
            <Button title={busy ? 'Сохраняем…' : 'Сохранить'} onPress={onSave} disabled={busy} />
            <Button
              title="Отмена"
              onPress={() => {
                setEdit(false);
                setDescr(pin.description ?? '');
                setPhotoLink(pin.photo_link ?? '');
                setPhotoUri(photoToImageUri(pin.photo_link ?? ''));
              }}
              disabled={busy}
            />
          </>
        ) : (
          <Button title="Редактировать" onPress={() => setEdit(true)} />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  card: { borderWidth: 1, borderColor: '#eee', borderRadius: 14, padding: 14, backgroundColor: '#fff', gap: 8 },
  h: { fontSize: 16, fontWeight: '800' },
  text: { fontSize: 14 },
  small: { fontSize: 12, opacity: 0.7 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preview: { height: 200, borderRadius: 12, backgroundColor: '#f3f4f6' },
  photoRow: { flexDirection: 'row', gap: 10 },
  remove: { paddingVertical: 8, alignItems: 'center' },
  removeText: { fontSize: 12, fontWeight: '800', opacity: 0.7 },
});
