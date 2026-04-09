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
      contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 32 }}
      scrollEventThrottle={16}
    >
      {scripts.map((script) => {
        const isCurrent = script.index === currentIndex;
        const englishOpacity =
          blindMode === 2 ? 0 :
          (blindMode === 1 && isCurrent) ? 0 :
          isCurrent ? 1 : 0.3;
        const koreanOpacity = blindMode >= 1 ? 0 : isCurrent ? 0.6 : 0.2;

        return (
          <Pressable
            key={script.index}
            className="mb-4 active:opacity-60"
            style={
              isCurrent
                ? {
                    backgroundColor: '#EFF6FF',
                    borderLeftWidth: 3,
                    borderLeftColor: '#3B82F6',
                    borderRadius: 12,
                    paddingLeft: 14,
                    paddingRight: 12,
                    paddingVertical: 10,
                  }
                : {
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                  }
            }
            onLayout={(e) => {
              yPositions.current[script.index] = e.nativeEvent.layout.y;
            }}
            onPress={() => onScriptPress?.(script.index)}
          >
            {/* 영어 문장 */}
            <Text
              style={{
                opacity: englishOpacity,
                fontSize: isCurrent ? 18 : 15,
                fontWeight: isCurrent ? '700' : '500',
                color: isCurrent ? '#111827' : '#6B7280',
                lineHeight: isCurrent ? 28 : 24,
                textAlign: isCurrent ? 'left' : 'center',
              }}
            >
              {script.text}
            </Text>

            {/* 한국어 번역 */}
            {script.translation && (
              <Text
                style={{ opacity: koreanOpacity }}
                className={`text-sm text-gray-400 mt-1.5 leading-5 ${isCurrent ? 'text-left' : 'text-center'}`}
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
