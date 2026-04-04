import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ShadowingContent } from '@/types/shadowing';

type Props = {
  content: ShadowingContent;
  onPress: () => void;
  completed?: boolean;
};

const LEVEL_STYLE: Record<ShadowingContent['level'], { bg: string; text: string; label: string }> = {
  easy:   { bg: 'bg-green-50',  text: 'text-green-600',  label: 'Easy' },
  medium: { bg: 'bg-yellow-50', text: 'text-yellow-600', label: 'Medium' },
  hard:   { bg: 'bg-red-50',    text: 'text-red-500',    label: 'Hard' },
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function ContentCard({ content, onPress, completed }: Props) {
  const level = LEVEL_STYLE[content.level];

  return (
    <Pressable
      onPress={onPress}
      className="bg-white rounded-2xl mb-4 overflow-hidden active:opacity-70"
      style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}
    >
      {/* 썸네일 */}
      <View className="w-full bg-gray-100" style={{ aspectRatio: 16 / 9 }}>
        {content.thumbnail_url ? (
          <Image
            source={{ uri: content.thumbnail_url }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
          />
        ) : (
          <View className="flex-1 items-center justify-center bg-gray-900">
            <Ionicons name="play-circle-outline" size={48} color="white" />
          </View>
        )}
        {/* 재생 시간 뱃지 */}
        <View className="absolute bottom-2 right-2 bg-black/70 rounded px-1.5 py-0.5">
          <Text className="text-white text-xs font-medium">
            {formatDuration(content.duration)}
          </Text>
        </View>
        {/* 완료 뱃지 */}
        {completed && (
          <View className="absolute top-2 left-2 bg-green-500 rounded-full px-2.5 py-0.5">
            <Text className="text-white text-xs font-bold">완료</Text>
          </View>
        )}
      </View>

      {/* 콘텐츠 정보 */}
      <View className="px-4 py-3">
        <View className="flex-row items-center gap-2 mb-1.5">
          <View className={`px-2 py-0.5 rounded-full ${level.bg}`}>
            <Text className={`text-xs font-semibold ${level.text}`}>{level.label}</Text>
          </View>
          <Text className="text-xs text-gray-400 capitalize">{content.category}</Text>
        </View>
        <Text className="text-base font-bold text-gray-900" numberOfLines={2}>
          {content.title}
        </Text>
        {content.description && (
          <Text className="text-sm text-gray-400 mt-1" numberOfLines={1}>
            {content.description}
          </Text>
        )}
      </View>
    </Pressable>
  );
}
