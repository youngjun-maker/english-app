import { FlatList, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { createConversation } from '@/api/conversations';

type Topic = {
  id: string;
  label: string;
  aiRole: string;
  emoji: string;
};

// id는 ai-server/prompts/ 파일명(확장자 제외)과 일치해야 함
const TOPICS: Topic[] = [
  { id: 'cafe_order', label: '카페 주문', aiRole: '카페 직원', emoji: '☕' },
  { id: 'airport_immigration', label: '공항 입국', aiRole: '입국 심사관', emoji: '✈️' },
  { id: 'hotel_checkin', label: '호텔 체크인', aiRole: '프런트 데스크 직원', emoji: '🏨' },
  { id: 'small_talk', label: '스몰 토크', aiRole: '대화 상대', emoji: '💬' },
  { id: 'opinion', label: '의견 나누기', aiRole: '토론 상대', emoji: '🗣️' },
  { id: 'free_talk', label: '자유 대화', aiRole: 'AI 친구', emoji: '🌟' },
];

type TopicCardProps = {
  topic: Topic;
  onPress: (topicId: string, topicLabel: string) => void;
  disabled: boolean;
};

function TopicCard({ topic, onPress, disabled }: TopicCardProps) {
  return (
    <Pressable
      className={`flex-1 bg-white rounded-2xl p-4 m-1.5 border border-gray-100 shadow-sm active:opacity-70 active:scale-95 ${disabled ? 'opacity-50' : ''}`}
      onPress={() => onPress(topic.id, topic.label)}
      disabled={disabled}
    >
      <Text className="text-3xl mb-2">{topic.emoji}</Text>
      <Text className="text-base font-bold text-gray-900 mb-1">{topic.label}</Text>
      <Text className="text-xs text-gray-400">{topic.aiRole} 역할</Text>
    </Pressable>
  );
}

export default function TopicSelectScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleTopicPress(topicId: string, topicLabel: string) {
    if (loading) return;
    setLoading(true);
    try {
      const conversation = await createConversation(topicId, topicLabel);
      router.push({
        pathname: '/chat/[id]',
        params: { id: conversation.id, topicLabel },
      });
    } catch (e) {
      console.error('createConversation error:', e);
      // 에러 시 그냥 navigate (오프라인 등 대비)
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-5 pt-14 pb-4 border-b border-gray-100">
        <Pressable className="mb-3 active:opacity-60" onPress={() => router.back()}>
          <Text className="text-sm text-blue-500 font-medium">← 뒤로</Text>
        </Pressable>
        <Text className="text-2xl font-bold text-gray-900">주제 선택</Text>
        <Text className="text-sm text-gray-400 mt-1">연습할 상황을 골라보세요</Text>
      </View>

      {/* Topic grid */}
      <FlatList
        data={TOPICS}
        keyExtractor={(item) => item.id}
        numColumns={2}
        renderItem={({ item }) => (
          <TopicCard topic={item} onPress={handleTopicPress} disabled={loading} />
        )}
        contentContainerClassName="px-2.5 pt-4 pb-8"
        columnWrapperClassName="justify-between"
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
