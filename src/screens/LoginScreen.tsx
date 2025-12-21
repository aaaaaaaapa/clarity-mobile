import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { useAuth } from '../context/AuthContext';
import type { AuthStackParamList } from '../navigation/authStack';
import { toFriendlyError } from '../api/client';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    if (!username || !password) {
      Alert.alert('Заполните поля');
      return;
    }
    try {
      setBusy(true);
      await login(username.trim(), password);
    } catch (e) {
      Alert.alert('Не удалось войти', toFriendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.h1}>Clarity</Text>
      <Text style={styles.sub}>Войдите, чтобы увидеть карту и метки</Text>

      <View style={styles.form}>
        <Input label="Логин (username)" value={username} onChangeText={setUsername} placeholder="например: artem" />
        <Input label="Пароль" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" />
        <Button title={busy ? 'Входим…' : 'Войти'} onPress={onSubmit} disabled={busy} />
      </View>

      <Text style={styles.link} onPress={() => navigation.navigate('Register')}>
        Нет аккаунта? Регистрация
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', gap: 16 },
  h1: { fontSize: 34, fontWeight: '800' },
  sub: { fontSize: 14, opacity: 0.7 },
  form: { gap: 14, marginTop: 8 },
  link: { marginTop: 10, fontSize: 14, opacity: 0.8 },
});
