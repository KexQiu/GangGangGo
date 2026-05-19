import Svg, { Circle, Path } from 'react-native-svg';

type SquatIconProps = {
  color?: string;
  size?: number;
  strokeWidth?: number;
};

export function SquatIcon({ color = '#2FB77D', size = 22, strokeWidth = 2.3 }: SquatIconProps) {
  return (
    <Svg
      accessibilityElementsHidden
      fill="none"
      height={size}
      importantForAccessibility="no-hide-descendants"
      viewBox="0 0 24 24"
      width={size}
    >
      <Circle cx="10" cy="4.6" r="2.2" stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M8.7 8.1c2.6.3 4.3 1.8 5.1 4.3"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Path
        d="M13.8 12.4l-3.9 2.9 4.4 1.3"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Path
        d="M9.9 15.3H5.6"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Path
        d="M14.3 16.6l3.9 2.2"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Path
        d="M8.1 9.2l-2.6 2.2"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Path
        d="M5.2 19.2h13.6"
        opacity={0.35}
        stroke={color}
        strokeLinecap="round"
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}
