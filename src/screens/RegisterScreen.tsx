import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { KeyboardForm } from '../components/KeyboardForm';
import { register } from '../api/auth';
import type { AuthStackParamList } from '../navigation/types';
import { toFriendlyError } from '../api/client';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export function RegisterScreen({ navigation }: Props) {
  const [phone, setPhone] = useState('+7');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    if (!phone.trim() || !username.trim() || !password) {
      Alert.alert('Заполните обязательные поля');
      return;
    }
    try {
      setBusy(true);
      await register({
        phone_number: phone.trim(),
        email: email.trim() ? email.trim() : undefined, // важно: undefined, а не null
        username: username.trim(),
        password,
      });
      Alert.alert('Успешно', 'Аккаунт создан');
      navigation.navigate('Login');
    } catch (e) {
      Alert.alert('Не удалось зарегистрироваться', toFriendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardForm contentContainerStyle={styles.container}>
      <View style={styles.form}>
        <Input label="Телефон" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+7XXXXXXXXXX" />
        <Input label="Email (необязательно)" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="name@example.com" />
        <Input label="Username" value={username} onChangeText={setUsername} placeholder="например: artem" />
        <Input label="Пароль" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" />

        <Button title={busy ? 'Создаём…' : 'Зарегистрироваться'} onPress={onSubmit} disabled={busy} />
        <Button title="Уже есть аккаунт" onPress={() => navigation.navigate('Login')} disabled={busy} />
      </View>
    </KeyboardForm>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  form: { gap: 14 },
});
