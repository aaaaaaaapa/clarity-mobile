import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';

import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { MapScreen } from '../screens/MapScreen';
import { StatsScreen } from '../screens/StatsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { PinsListScreen } from '../screens/PinsListScreen';
import { PinDetailsScreen } from '../screens/PinDetailsScreen';
import { CreatePinScreen } from '../screens/CreatePinScreen';

import type { AppStackParamList, AppTabsParamList, AuthStackParamList } from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();
const Tabs = createBottomTabNavigator<AppTabsParamList>();

function AppTabs() {
  return (
    <Tabs.Navigator screenOptions={{ headerShown: true }}>
      <Tabs.Screen name="Map" component={MapScreen} options={{ title: 'Карта' }} />
      <Tabs.Screen name="List" component={PinsListScreen} options={{ title: 'Список' }} />
      <Tabs.Screen name="Stats" component={StatsScreen} options={{ title: 'Статистика' }} />
      <Tabs.Screen name="Profile" component={ProfileScreen} options={{ title: 'Профиль' }} />
    </Tabs.Navigator>
  );
}

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
