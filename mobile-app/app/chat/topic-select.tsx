import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { createConversation } from '@/api/conversations';
import { useAppStore } from '@/store/useAppStore';
import { SITUATIONS, type Situation } from '@/constants/situations';

type SituationCardProps = {
  situation: Situation;
  onPress: (situation: Situation) => void;
  isLoading: boolean;
  disabled: boolean;
};

function SituationCard({ situation, onPress, isLoading, disabled }: SituationCardProps) {
  return (
    <Pressable
      className={`flex-1 bg-white rounded-2xl p-4 m-1.5 border border-gray-100 shadow-sm active:opacity-70 active:scale-95 ${disabled ? 'opacity-50' : ''}`}
      onPress={() => onPress(situation)}
      disabled={disabled}
    >
      {isLoading ? (
        <View className="h-8 mb-2 items-start justify-center">
          <ActivityIndicator size="small" color="#6366f1" />
        </View>
      ) : (
        <Text className="text-3xl mb-2">{situation.emoji}</Text>
      )}
      <Text className="text-base font-bold text-gray-900 mb-1">{situation.label}</Text>
      <Text className="text-xs text-gray-400 leading-4">{situation.desc}</Text>
    </Pressable>
  );
}

export default function TopicSelectScreen() {
  const router = useRouter();
  const showToast = useAppStore((s) => s.showToast);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleSituationPress(situation: Situation) {
    if (loadingId) return;
    setLoadingId(situation.id);
    try {
      const conversation = await createConversation(situation.id, situation.label);
      router.push({
        pathname: '/chat/[id]',
        params: { id: conversation.id, topicLabel: situation.label },
      });
    } catch {
      showToast('대화를 시작하지 못했어요. 다시 시도해주세요.');
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-5 pt-14 pb-4 border-b border-gray-100">
        <Pressable className="mb-3 active:opacity-60" onPress={() => router.back()}>
          <Text className="text-sm text-blue-500 font-medium">← 뒤로</Text>
        </Pressable>
        <Text className="text-2xl font-bold text-gray-900">상황 선택</Text>
        <Text className="text-sm text-gray-400 mt-1">연습할 상황을 골라보세요</Text>
      </View>

      {/* Situation grid */}
      <FlatList
        data={SITUATIONS}
        keyExtractor={(item) => item.id}
        numColumns={2}
        renderItem={({ item }) => (
          <SituationCard
            situation={item}
            onPress={handleSituationPress}
            isLoading={loadingId === item.id}
            disabled={loadingId !== null}
          />
        )}
        contentContainerClassName="px-2.5 pt-4 pb-8"
        columnWrapperClassName="justify-between"
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
