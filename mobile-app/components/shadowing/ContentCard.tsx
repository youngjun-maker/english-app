import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ShadowingContent } from '@/types/shadowing';

type Props = {
  content: ShadowingContent;
  onPress: () => void;
  completed?: boolean;
  progressPercent?: number;
};

const LEVEL_CONFIG: Record<
  ShadowingContent['level'],
  {
    badgeBg: string;
    label: string;
    borderColor: string;
    placeholderBg: string;
  }
> = {
  easy: {
    badgeBg: '#22c55e',
    label: 'Easy',
    borderColor: '#22c55e',
    placeholderBg: '#0a0f1e',
  },
  medium: {
    badgeBg: '#f59e0b',
    label: 'Medium',
    borderColor: '#f59e0b',
    placeholderBg: '#16213e',
  },
  hard: {
    badgeBg: '#ef4444',
    label: 'Hard',
    borderColor: '#ef4444',
    placeholderBg: '#1a1a2e',
  },
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function ContentCard({ content, onPress, completed, progressPercent }: Props) {
  const cfg = LEVEL_CONFIG[content.level];

  // progressPercent prop 우선, completed fallback
  const resolvedProgress = progressPercent !== undefined
    ? progressPercent
    : completed ? 100 : 0;

  return (
    <Pressable
      onPress={onPress}
      className="bg-white rounded-2xl mb-4 overflow-hidden active:opacity-70"
      style={{
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
        borderLeftWidth: 4,
        borderLeftColor: cfg.borderColor,
      }}
    >
      {/* 썸네일 */}
      <View className="w-full" style={{ aspectRatio: 16 / 9 }}>
        {content.thumbnail_url ? (
          <Image
            source={{ uri: content.thumbnail_url }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
          />
        ) : (
          /* 짙은 단색 배경 플레이스홀더 */
          <View
            className="flex-1 items-center justify-center"
            style={{ backgroundColor: cfg.placeholderBg }}
          >
            <Ionicons name="play-circle-outline" size={48} color="rgba(255,255,255,0.4)" />
          </View>
        )}

        {/* 썸네일 하단 오버레이: 카테고리 + 제목 */}
        <View
          className="absolute bottom-0 left-0 right-0 px-3 py-2"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
        >
          <Text className="text-white/60 text-xs capitalize mb-0.5">{content.category}</Text>
          <Text className="text-white text-sm font-semibold" numberOfLines={2}>
            {content.title}
          </Text>
        </View>

        {/* 재생 시간 뱃지 */}
        <View className="absolute bottom-2 right-2 bg-black/70 rounded px-1.5 py-0.5">
          <Text className="text-white text-xs font-medium">
            {formatDuration(content.duration)}
          </Text>
        </View>

        {/* 레벨 배지 — 좌상단 */}
        <View
          className="absolute top-2 left-2 rounded-full px-2.5 py-0.5"
          style={{ backgroundColor: cfg.badgeBg }}
        >
          <Text className="text-xs font-bold text-white">
            {cfg.label}
          </Text>
        </View>

        {/* 완료 뱃지 */}
        {completed && (
          <View className="absolute top-2 right-2 bg-green-500 rounded-full px-2.5 py-0.5">
            <Text className="text-white text-xs font-bold">완료</Text>
          </View>
        )}
      </View>

      {/* 카드 하단 — 설명 + 카테고리 뱃지 */}
      <View className="px-4 pt-3 pb-2 flex-row items-start justify-between gap-2">
        <View className="flex-1">
          {content.description ? (
            <Text className="text-sm text-gray-500 leading-5" numberOfLines={2}>
              {content.description}
            </Text>
          ) : (
            <Text className="text-sm text-gray-400 capitalize">{content.category}</Text>
          )}
        </View>
        <View
          className="px-2 py-0.5 rounded-full mt-0.5"
          style={{ backgroundColor: cfg.badgeBg + '22' }}
        >
          <Text className="text-xs font-semibold" style={{ color: cfg.badgeBg }}>
            {cfg.label}
          </Text>
        </View>
      </View>

      {/* 진행률 바 */}
      <View className="px-4 pb-3">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-xs text-gray-400">
            {resolvedProgress === 0
              ? '시작 전'
              : resolvedProgress >= 100
              ? '완료'
              : `${Math.round(resolvedProgress)}%`}
          </Text>
          {resolvedProgress > 0 && resolvedProgress < 100 && (
            <Text className="text-xs text-blue-500 font-medium">진행 중</Text>
          )}
        </View>
        <View className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <View
            style={{
              height: '100%',
              width: `${Math.min(resolvedProgress, 100)}%`,
              borderRadius: 999,
              backgroundColor:
                resolvedProgress >= 100
                  ? '#22c55e'
                  : resolvedProgress > 0
                  ? '#3B82F6'
                  : '#E5E7EB',
            }}
          />
        </View>
      </View>
    </Pressable>
  );
}
