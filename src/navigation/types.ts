import type { NavigatorScreenParams } from '@react-navigation/native';

export type FocusParams = { latitude: number; longitude: number; pinId?: number };

export type AppTabsParamList = {
  Map: { focus?: FocusParams } | undefined;
  List: undefined;
  Stats: undefined;
  Profile: undefined;
};

export type AppStackParamList = {
  Tabs: NavigatorScreenParams<AppTabsParamList>;
  PinDetails: { pinId: number };
  CreatePin: { initialLat: number; initialLon: number };
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};
