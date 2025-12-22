import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { RequestStatusId } from '../constants/requests';
import { statusById } from '../constants/requests';

export function StatusBadge({ statusId }: { statusId: RequestStatusId }) {
  const s = statusById(statusId);
  return (
    <View style={[styles.badge, { borderColor: s.color }]}> 
      <Text style={[styles.text, { color: s.color }]}>{s.title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
  },
  text: { fontSize: 12, fontWeight: '800' },
});
