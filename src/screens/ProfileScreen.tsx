import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useAuth } from '../context/AuthContext';
import { toFriendlyError } from '../api/client';
import * as UsersApi from '../api/users';

export function ProfileScreen() {
  const { user, username, refreshUser, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const [phone, setPhone] = useState('+7');
  const [email, setEmail] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (user) {
      setPhone(user.phone_number || '+7');
      setEmail(user.email || '');
      setLogin(user.username || username || '');
    }
  }, [user, username]);

  async function onRefresh() {
    try {
      setBusy(true);
      await refreshUser();
    } catch (e) {
      Alert.alert('Ошибка', toFriendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onSave() {
    if (!user) return;
    if (!phone.trim() || !login.trim() || !password) {
      Alert.alert('Заполните телефон, username и пароль', 'Для PUT /users/{id} требуется модель UserCreate, включая password');
      return;
    }
    try {
      setBusy(true);
      await UsersApi.updateUser(user.id, {
        phone_number: phone.trim(),
        email: email.trim() ? email.trim() : null,
        username: login.trim(),
        password,
      });
      setEditOpen(false);
      setPassword('');
      await refreshUser();
    } catch (e) {
      Alert.alert('Не удалось сохранить', toFriendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteAccount() {
    if (!user) return;
    Alert.alert('Удалить аккаунт?', 'Действие необратимо.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          try {
            setBusy(true);
            await UsersApi.deleteUser(user.id);
            await logout();
          } catch (e) {
            Alert.alert('Не удалось удалить', toFriendlyError(e));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.h}>Профиль</Text>
        <Text style={styles.line}>ID: {user?.id ?? '—'}</Text>
        <Text style={styles.line}>Username: {user?.username ?? username ?? '—'}</Text>
        <Text style={styles.line}>Телефон: {user?.phone_number ?? '—'}</Text>
        <Text style={styles.line}>Email: {user?.email ?? '—'}</Text>
      </View>

      <Button title={busy ? 'Обновляем…' : 'Обновить'} onPress={onRefresh} disabled={busy} />
      <Button title="Редактировать" onPress={() => setEditOpen(true)} disabled={busy || !user} />
      <Button
        title="Выйти"
        onPress={() =>
          logout()
            .then(() => Alert.alert('Вы вышли'))
            .catch((e) => Alert.alert('Ошибка выхода', e?.message ?? String(e)))
        }
      />
      <Button title="Удалить аккаунт" onPress={onDeleteAccount} disabled={busy || !user} />

      <Modal visible={editOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ width: '100%' }}
          >
            <View style={styles.modalCard}>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 16 }}
              >
                <Text style={styles.modalTitle}>Редактирование профиля</Text>
                <View style={{ gap: 12, marginTop: 12 }}>
                  <Input label="Телефон" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
                  <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
                  <Input label="Username" value={login} onChangeText={setLogin} />
                  <Input label="Пароль (обязательно)" value={password} onChangeText={setPassword} secureTextEntry />

                  <Button title={busy ? 'Сохраняем…' : 'Сохранить'} onPress={onSave} disabled={busy} />
                  <Button title="Отмена" onPress={() => setEditOpen(false)} disabled={busy} />
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  card: { borderWidth: 1, borderColor: '#eee', borderRadius: 14, padding: 14, backgroundColor: '#fff', gap: 6 },
  h: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  line: { fontSize: 14 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    maxHeight: '85%',
  },
  modalTitle: { fontSize: 20, fontWeight: '800' },
});
