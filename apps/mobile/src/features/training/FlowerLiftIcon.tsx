import Svg, { Circle, Path } from 'react-native-svg';

import type { AppIconProps } from '../../components/icons/iconTypes';
import type { TrainingPresetId } from './trainingTypes';

type FlowerLiftIconProps = AppIconProps & {
  presetId?: TrainingPresetId;
};

const liftArcPath = 'M4 16.5C5.5 19.3 8.5 21 12 21C15.5 21 18.5 19.3 20 16.5';
const accentPaths: Record<TrainingPresetId | 'default', string> = {
  default: `M3 12.5C2.3 11.7 2 10.8 2 9.5M21 10.5C21.7 9.7 22 8.8 22 7.5 ${liftArcPath}`,
  beginner: liftArcPath,
  standard:
    'M7 16.5C8.4 17.6 10.1 18 12 18C13.9 18 15.6 17.6 17 16.5M4 17.5C5.8 20.1 8.6 21.5 12 21.5C15.4 21.5 18.2 20.1 20 17.5',
  quick: `M2 12C2.25 11.3 2.65 10.6 3.1 10M20.9 8.8C21.35 8.2 21.75 7.5 22 6.8 ${liftArcPath}`,
};

// Keep the flower and default accents in sync with ios/Shared/FeatureIcons.swift.
export function FlowerLiftIcon({ color = 'currentColor', size = 24, strokeWidth = 2, presetId }: FlowerLiftIconProps) {
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
      <Path d="M10 5C9.3 1.3 14.7 1.3 14 5C16.9 2.5 19.7 7.1 16.4 8.6C19.7 10.1 16.9 14.7 14 12.2C14.7 15.9 9.3 15.9 10 12.2C7.1 14.7 4.3 10.1 7.6 8.6C4.3 7.1 7.1 2.5 10 5Z" />
      <Circle cx="12" cy="8.6" r="1" fill={color} stroke="none" />
      <Path d={accentPaths[presetId ?? 'default']} />
    </Svg>
  );
}
