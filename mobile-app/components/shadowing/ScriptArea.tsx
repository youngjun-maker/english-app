import { View, Text, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { useEffect, useRef } from 'react';
import type { ShadowingScript, BlindMode } from '@/types/shadowing';

type Props = {
  scripts: ShadowingScript[];
  currentIndex: number;
  blindMode: BlindMode;
  onScriptPress?: (index: number) => void;
};

export default function ScriptArea({ scripts, currentIndex, blindMode, onScriptPress }: Props) {
  const { height: screenHeight } = useWindowDimensions();
  const scrollViewRef = useRef<ScrollView>(null);
  const yPositions = useRef<number[]>([]);

  // currentIndex 변경 시 해당 문장으로 스크롤
  useEffect(() => {
    const y = yPositions.current[currentIndex];
    if (y !== undefined) {
      scrollViewRef.current?.scrollTo({
        y: Math.max(0, y - screenHeight / 4),
        animated: true,
      });
    }
  }, [currentIndex, screenHeight]);

  return (
    <ScrollView
      ref={scrollViewRef}
      className="flex-1"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 32 }}
      scrollEventThrottle={16}
    >
      {scripts.map((script) => {
        const isCurrent = script.index === currentIndex;
        const englishOpacity = blindMode === 2 ? 0 : isCurrent ? 1 : 0.3;
        const koreanOpacity = blindMode >= 1 ? 0 : isCurrent ? 0.6 : 0.2;

        return (
          <Pressable
            key={script.index}
            className="mb-6 active:opacity-60"
            onLayout={(e) => {
              yPositions.current[script.index] = e.nativeEvent.layout.y;
            }}
            onPress={() => onScriptPress?.(script.index)}
          >
            {/* 영어 문장 */}
            <Text
              style={{ opacity: englishOpacity }}
              className={`leading-8 text-center ${
                isCurrent
                  ? 'text-xl font-bold text-gray-900'
                  : 'text-base font-medium text-gray-500'
              }`}
            >
              {script.text}
            </Text>

            {/* 한국어 번역 */}
            {script.translation && (
              <Text
                style={{ opacity: koreanOpacity }}
                className="text-sm text-gray-400 text-center mt-1.5 leading-5"
              >
                {script.translation}
              </Text>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
