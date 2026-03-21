import { FlatList, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

type Topic = {
  id: string;
  label: string;
  aiRole: string;
  emoji: string;
};

const TOPICS: Topic[] = [
  { id: 'cafe', label: '카페 주문', aiRole: '카페 직원', emoji: '☕' },
  { id: 'airport', label: '공항/호텔', aiRole: '체크인 데스크 직원', emoji: '✈️' },
  { id: 'shopping', label: '쇼핑', aiRole: '매장 직원', emoji: '🛍️' },
  { id: 'restaurant', label: '레스토랑', aiRole: '웨이터', emoji: '🍽️' },
  { id: 'directions', label: '길 찾기', aiRole: '현지인', emoji: '🗺️' },
  { id: 'business', label: '비즈니스 미팅', aiRole: '비즈니스 파트너', emoji: '💼' },
];

// Dummy conversation id used before real API integration (Task 010)
const DUMMY_CONV_ID = 'conv-new';

type TopicCardProps = {
  topic: Topic;
  onPress: (topicId: string) => void;
};

function TopicCard({ topic, onPress }: TopicCardProps) {
  return (
    <Pressable
      className="flex-1 bg-white rounded-2xl p-4 m-1.5 border border-gray-100 shadow-sm active:opacity-70 active:scale-95"
      onPress={() => onPress(topic.id)}
    >
      <Text className="text-3xl mb-2">{topic.emoji}</Text>
      <Text className="text-base font-bold text-gray-900 mb-1">{topic.label}</Text>
      <Text className="text-xs text-gray-400">{topic.aiRole} 역할</Text>
    </Pressable>
  );
}

export default function TopicSelectScreen() {
  const router = useRouter();

  function handleTopicPress(_topicId: string) {
    // TODO (Task 010): POST /api/conversations with topicId, use returned id
    router.push(`/chat/${DUMMY_CONV_ID}`);
  }

  // Pair topics into rows of 2 for a 2-column grid using FlatList numColumns
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
          <TopicCard topic={item} onPress={handleTopicPress} />
        )}
        contentContainerClassName="px-2.5 pt-4 pb-8"
        columnWrapperClassName="justify-between"
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
