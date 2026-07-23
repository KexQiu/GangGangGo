import { Tabs } from 'expo-router';
import type { ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';
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
          tabBarIcon: ({ color, focused, size }) => (
            <TabIcon
              Icon={House}
              color={color}
              focused={focused}
              focusBackgroundColor={colors.primarySoft}
              size={size}
            />
          ),
          tabBarButtonTestID: 'tab-home',
          title: '首页',
        }}
      />
      <Tabs.Screen
        name="trends"
        options={{
          tabBarIcon: ({ color, focused, size }) => (
            <TabIcon
              Icon={ChartNoAxesColumnIncreasing}
              color={color}
              focused={focused}
              focusBackgroundColor={colors.primarySoft}
              size={size}
            />
          ),
          tabBarButtonTestID: 'tab-trends',
          title: '数据',
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          tabBarIcon: ({ color, focused, size }) => (
            <TabIcon
              Icon={UsersRound}
              color={color}
              focused={focused}
              focusBackgroundColor={colors.primarySoft}
              size={size}
            />
          ),
          tabBarButtonTestID: 'tab-friends',
          title: '好友',
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          tabBarIcon: ({ color, focused, size }) => (
            <TabIcon
              Icon={UserRound}
              color={color}
              focused={focused}
              focusBackgroundColor={colors.primarySoft}
              size={size}
            />
          ),
          tabBarButtonTestID: 'tab-me',
          title: '我的',
        }}
      />
    </Tabs>
  );
}

type TabIconProps = {
  color: string;
  focusBackgroundColor: string;
  focused: boolean;
  Icon: ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;
  size: number;
};

function TabIcon({ color, focusBackgroundColor, focused, Icon, size }: TabIconProps) {
  return (
    <View style={[styles.tabIcon, focused ? { backgroundColor: focusBackgroundColor } : null]}>
      <Icon color={color} size={size} strokeWidth={2.5} />
    </View>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    alignItems: 'center',
    borderRadius: 8,
    height: 30,
    justifyContent: 'center',
    width: 36,
  },
});
