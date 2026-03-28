import { View, Text, FlatList, ActivityIndicator, ListRenderItem } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { fetchContents } from '@/api/shadowing';
import ContentCard from '@/components/shadowing/ContentCard';
import { useAppStore } from '@/store/useAppStore';
import type { ShadowingContent } from '@/types/shadowing';

function EmptyState() {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <Text className="text-5xl mb-4">🎬</Text>
      <Text className="text-xl font-bold text-gray-900 mb-2 text-center">
        콘텐츠가 없어요
      </Text>
      <Text className="text-sm text-gray-400 text-center leading-5">
        곧 새로운 섀도잉 콘텐츠가 추가될 예정이에요.
      </Text>
    </View>
  );
}

export default function ShadowingScreen() {
  const router = useRouter();
  const showToast = useAppStore((s) => s.showToast);
  const [contents, setContents] = useState<ShadowingContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchContents()
      .then(setContents)
      .catch(() => showToast('콘텐츠를 불러오지 못했어요.'))
      .finally(() => setIsLoading(false));
  }, []);

  const renderItem: ListRenderItem<ShadowingContent> = ({ item }) => (
    <ContentCard
      content={item}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onPress={() => router.push({ pathname: '/shadowing/[id]' as any, params: { id: item.id } })}
    />
  );

  return (
    <View className="flex-1 bg-white">
      {/* 헤더 */}
      <View className="px-5 pt-14 pb-4">
        <Text className="text-2xl font-black text-gray-900">Shadowing</Text>
        <Text className="text-xs text-gray-400 mt-0.5">
          원어민처럼 따라 말하기 훈련
        </Text>
      </View>

      {/* 콘텐츠 목록 */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : (
        <FlatList
          data={contents}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          className="flex-1 px-5"
          ListEmptyComponent={<EmptyState />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={
            contents.length === 0 ? { flex: 1 } : { paddingBottom: 24 }
          }
        />
      )}
    </View>
  );
}
