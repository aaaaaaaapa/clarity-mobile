import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// useHeaderHeight lives in @react-navigation/elements (pulled in by react-navigation).
// When a screen is rendered outside a navigator, the hook can throw.
let useHeaderHeightSafe: (() => number) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  useHeaderHeightSafe = require('@react-navigation/elements').useHeaderHeight;
} catch {
  useHeaderHeightSafe = null;
}

type Props = {
  children: React.ReactNode;
  /** Extra styles applied to ScrollView content container */
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Extra bottom padding (in addition to safe-area) */
  extraBottomPadding?: number;
  /** Hide scroll indicator */
  hideIndicator?: boolean;
};

/**
 * A small helper for screens with forms so the keyboard doesn't cover inputs/buttons.
 * Uses only React Native primitives (no extra dependencies).
 */
export function KeyboardForm({
  children,
  contentContainerStyle,
  extraBottomPadding = 16,
  hideIndicator = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeightSafe ? useHeaderHeightSafe() : 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        showsVerticalScrollIndicator={!hideIndicator}
        contentContainerStyle={[
          { flexGrow: 1, paddingBottom: insets.bottom + extraBottomPadding },
          contentContainerStyle,
        ]}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
