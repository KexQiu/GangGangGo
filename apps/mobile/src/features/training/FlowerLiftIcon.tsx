import Svg, { Circle, Path } from 'react-native-svg';

type FlowerLiftIconProps = {
  color?: string;
  info?: string;
  primary?: string;
  privacy?: string;
  showLiftLine?: boolean;
  size?: number;
  strokeWidth?: number;
  surface?: string;
  variant?: 'quick' | 'soft' | 'steady';
};

export function FlowerLiftIcon({
  color,
  info = '#3C7DF0',
  primary,
  privacy = '#8D6BE8',
  showLiftLine = true,
  size = 24,
  strokeWidth = 2.4,
  surface = '#FFFFFF',
  variant = 'soft',
}: FlowerLiftIconProps) {
  const petalColor = primary ?? color ?? '#2FB77D';
  const curvePath = variant === 'quick'
    ? 'M8 17 C10.5 13.6 14.5 12.7 18.4 13.8'
    : variant === 'steady'
      ? 'M6.6 16.2 C9 13.7 12.4 12.9 18 14'
      : 'M8.3 16.8 C10 15.3 12.2 14.8 15 15.2';
  const curveOpacity = variant === 'soft' ? 0.5 : 1;
  const petalScale = variant === 'soft' ? 0.9 : 1;

  return (
    <Svg
      accessibilityElementsHidden
      height={size}
      importantForAccessibility="no-hide-descendants"
      viewBox="3 1.8 18 17.5"
      width={size}
    >
      {showLiftLine ? (
        <Path
          d={curvePath}
          fill="none"
          opacity={curveOpacity}
          stroke={privacy}
          strokeLinecap="round"
          strokeWidth={variant === 'soft' ? strokeWidth * 0.85 : strokeWidth}
        />
      ) : null}

      {showLiftLine && variant === 'steady' ? (
        <>
          <Circle cx="9.2" cy="17.3" fill={info} r="0.72" />
          <Circle cx="12" cy="16.4" fill={info} r="0.72" />
          <Circle cx="14.8" cy="15.9" fill={info} r="0.72" />
        </>
      ) : null}

      {showLiftLine && variant === 'quick' ? (
        <>
          <Path
            d="M18.2 7.2h2.2"
            fill="none"
            stroke={info}
            strokeLinecap="round"
            strokeWidth={1.8}
          />
          <Path
            d="M17.8 10.1h3.1"
            fill="none"
            stroke={info}
            strokeLinecap="round"
            strokeWidth={1.8}
          />
        </>
      ) : null}

      <Circle cx="12" cy="8" fill={petalColor} r={2.2 * petalScale} />
      <Circle cx="12" cy="4.8" fill={petalColor} r={2.4 * petalScale} />
      <Circle cx="15" cy="6.5" fill={petalColor} r={2.4 * petalScale} />
      <Circle cx="14.6" cy="10" fill={petalColor} r={2.3 * petalScale} />
      <Circle cx="9.4" cy="10" fill={petalColor} r={2.3 * petalScale} />
      <Circle cx="9" cy="6.5" fill={petalColor} r={2.4 * petalScale} />

      <Circle cx="12" cy="7.8" fill={surface} r={1.6 * petalScale} />
    </Svg>
  );
}
