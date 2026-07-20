import { Tabs } from 'expo-router';
import { ChartNoAxesColumnIncreasing, House, UserRound, UsersRound } from 'lucide-react-native';

import { useAppTheme } from '../../src/theme/themeProvider';

export default function TabLayout() {
  const { colors } = useAppTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.navigationActive,
        tabBarInactiveTintColor: colors.navigationInactive,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '800',
          marginTop: 1,
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 64,
          paddingTop: 6,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color, size }) => <House color={color} size={size} strokeWidth={2.4} />,
          title: '首页',
        }}
      />
      <Tabs.Screen
        name="trends"
        options={{
          tabBarIcon: ({ color, size }) => <ChartNoAxesColumnIncreasing color={color} size={size} strokeWidth={2.4} />,
          title: '数据',
        }}
      />
      <Tabs.Screen
        name="team"
        options={{
          tabBarIcon: ({ color, size }) => <UsersRound color={color} size={size} strokeWidth={2.4} />,
          title: '好友',
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} strokeWidth={2.4} />,
          title: '我的',
        }}
      />
    </Tabs>
  );
}
