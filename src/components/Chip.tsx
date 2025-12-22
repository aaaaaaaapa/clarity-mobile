import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

export function Chip({
  title,
  selected,
  onPress,
  style,
}: {
  title: string;
  selected?: boolean;
  onPress: () => void;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        selected && styles.selected,
        pressed && { opacity: 0.85 },
        style,
      ]}
    >
      <Text style={[styles.text, selected && styles.textSelected]} numberOfLines={1}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  selected: {
    backgroundColor: '#111',
    borderColor: '#111',
  },
  text: { fontSize: 12, fontWeight: '700', color: '#111' },
  textSelected: { color: '#fff' },
});
