import Svg, { Circle, Path } from 'react-native-svg';

import type { AppIconProps } from './iconTypes';

// Match the app's line icons. Keep geometry in sync with ios/Shared/FeatureIcons.swift.
export function SquatIcon({ color = 'currentColor', size = 24, strokeWidth = 2 }: AppIconProps) {
  return (
    <Svg
      accessibilityElementsHidden
      accessible={false}
      height={size}
      importantForAccessibility="no-hide-descendants"
      viewBox="0 0 24 24"
      width={size}
      fill="none"
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
    >
      <Circle cx="13" cy="4.5" r="2" />
      <Path d="M10.5 9C9.8 11.3 8 13.8 6.5 15.5c-.8 1 .1 2.2 1.4 1.8l7.2-2.2c1.1-.3 1.9.9 1.2 1.8L12.4 21.8" />
      <Path d="m10.5 9 3.2 3c.4.4.9.5 1.5.5H20" />
    </Svg>
  );
}
