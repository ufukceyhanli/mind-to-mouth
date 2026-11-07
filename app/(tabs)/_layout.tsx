import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import type { IconName } from '../../src/components/ui';
import { colors, fonts } from '../../src/theme';

function TabIcon({
  active,
  inactive,
  color,
  focused,
}: {
  active: IconName;
  inactive: IconName;
  color: ColorValue;
  focused: boolean;
}) {
  return <Ionicons name={focused ? active : inactive} size={26} color={color} />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          height: 84,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontFamily: fonts.bold, fontSize: 12, marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Today', tabBarIcon: (p) => <TabIcon active="star" inactive="star-outline" {...p} /> }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: 'Talks', tabBarIcon: (p) => <TabIcon active="albums" inactive="albums-outline" {...p} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarIcon: (p) => <TabIcon active="settings" inactive="settings-outline" {...p} /> }}
      />
    </Tabs>
  );
}
