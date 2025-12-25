import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';

import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { PinDetailsScreen } from '../screens/PinDetailsScreen';
import { CreatePinScreen } from '../screens/CreatePinScreen';
import { PickLocationScreen } from '../screens/PickLocationScreen';

import type { AppStackParamList, AuthStackParamList } from './types';
import { AppTabs } from './tabs';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

function AppStackScreens() {
  return (
    <AppStack.Navigator>
      <AppStack.Screen name="Tabs" component={AppTabs} options={{ headerShown: false }} />
      <AppStack.Screen name="PinDetails" component={PinDetailsScreen} options={{ title: 'Заявка' }} />
      <AppStack.Screen
        name="CreatePin"
        component={CreatePinScreen}
        options={{ title: 'Новая заявка', presentation: 'modal' }}
      />
      <AppStack.Screen
        name="PickLocation"
        component={PickLocationScreen}
        options={{ title: 'Выбор места', presentation: 'modal' }}
      />
    </AppStack.Navigator>
  );
}

export function RootNavigator() {
  const { token } = useAuth();

  return (
    <NavigationContainer>
      {token ? (
        <AppStackScreens />
      ) : (
        <AuthStack.Navigator>
          <AuthStack.Screen name="Login" component={LoginScreen} options={{ title: 'Вход' }} />
          <AuthStack.Screen name="Register" component={RegisterScreen} options={{ title: 'Регистрация' }} />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}
