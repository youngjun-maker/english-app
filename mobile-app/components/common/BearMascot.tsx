import { View } from 'react-native';
import Svg, { Ellipse, Circle, Path } from 'react-native-svg';

type BearMascotProps = {
  size: 'small' | 'medium' | 'large';
};

const SIZE_MAP = {
  small: 28,
  medium: 40,
  large: 160,
};

// viewBox: 0 0 100 100 기준으로 모든 좌표 정의
// small/medium: glow circle 없음, large: glow circle 포함
export default function BearMascot({ size }: BearMascotProps) {
  const px = SIZE_MAP[size];
  const isLarge = size === 'large';

  return (
    <View style={{ width: px, height: px }}>
      <Svg width={px} height={px} viewBox="0 0 100 100">
        {/* Glow circle — large 사이즈만 */}
        {isLarge && (
          <Circle cx="50" cy="52" r="46" fill="#FFF1F2" />
        )}

        {/* 귀 왼쪽 outer */}
        <Circle cx="25" cy="30" r="13" fill="#E53E3E" />
        {/* 귀 왼쪽 inner */}
        <Circle cx="25" cy="30" r="7" fill="#B91C1C" />

        {/* 귀 오른쪽 outer */}
        <Circle cx="75" cy="30" r="13" fill="#E53E3E" />
        {/* 귀 오른쪽 inner */}
        <Circle cx="75" cy="30" r="7" fill="#B91C1C" />

        {/* 머리 타원 (가로가 조금 넓게) */}
        <Ellipse cx="50" cy="55" rx="32" ry="28" fill="#E53E3E" />

        {/* 주둥이 muzzle */}
        <Ellipse cx="50" cy="67" rx="14" ry="10" fill="#FC8181" />

        {/* 눈 왼쪽 */}
        <Ellipse cx="40" cy="53" rx="4" ry="4.5" fill="#1a1a1a" />
        {/* 눈 왼쪽 하이라이트 */}
        <Circle cx="41.5" cy="51.5" r="1.3" fill="white" />

        {/* 눈 오른쪽 */}
        <Ellipse cx="60" cy="53" rx="4" ry="4.5" fill="#1a1a1a" />
        {/* 눈 오른쪽 하이라이트 */}
        <Circle cx="61.5" cy="51.5" r="1.3" fill="white" />

        {/* 코 */}
        <Ellipse cx="50" cy="62" rx="4.5" ry="3" fill="#1a1a1a" />
        {/* 코 하이라이트 */}
        <Ellipse cx="49" cy="61" rx="1.5" ry="1" fill="white" fillOpacity="0.28" />

        {/* 입 — 코 아래로 내려와서 Y자 갈라짐 */}
        <Path
          d="M50 65 L50 68 M50 68 Q46 72 43 71 M50 68 Q54 72 57 71"
          stroke="#1a1a1a"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}
