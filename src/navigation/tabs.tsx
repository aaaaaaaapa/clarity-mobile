import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { MapScreen } from '../screens/MapScreen';
import { StatsScreen } from '../screens/StatsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { PinsListScreen } from '../screens/PinsListScreen';

import type { AppTabsParamList } from './types';

const Tabs = createBottomTabNavigator<AppTabsParamList>();

// Если хотите убрать иконки совсем (оставить только подписи), поставьте false.
const USE_TAB_ICONS = true;

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<keyof AppTabsParamList, { focused: IoniconName; unfocused: IoniconName }> = {
  Map: { focused: 'map', unfocused: 'map-outline' },
  List: { focused: 'list', unfocused: 'list-outline' },
  Stats: { focused: 'stats-chart', unfocused: 'stats-chart-outline' },
  Profile: { focused: 'person', unfocused: 'person-outline' },
};

export function AppTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        tabBarShowLabel: true,
        // Когда иконки выключены, убираем слот под них, чтобы не оставалось «пустого прямоугольника».
        tabBarIconStyle: USE_TAB_ICONS ? undefined : { display: 'none' },
        tabBarIcon: USE_TAB_ICONS
          ? ({ color, size, focused }) => {
              const icon = TAB_ICONS[route.name as keyof AppTabsParamList];
              return <Ionicons name={focused ? icon.focused : icon.unfocused} size={size} color={color} />;
            }
          : undefined,
      })}
    >
      <Tabs.Screen name="Map" component={MapScreen} options={{ title: 'Карта' }} />
      <Tabs.Screen name="List" component={PinsListScreen} options={{ title: 'Список' }} />
      <Tabs.Screen name="Stats" component={StatsScreen} options={{ title: 'Статистика' }} />
      <Tabs.Screen name="Profile" component={ProfileScreen} options={{ title: 'Профиль' }} />
    </Tabs.Navigator>
  );
}
