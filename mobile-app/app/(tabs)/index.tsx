import { FlatList, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Conversation } from '@/types';

const DUMMY_CONVERSATIONS: (Conversation & { last_message_at: string })[] = [
  {
    id: 'conv-001',
    user_id: 'dummy-user',
    topic_id: 'cafe',
    topic_label: '카페 주문',
    updated_at: '2026-03-22T10:30:00Z',
    last_message_at: '2026-03-22T10:30:00Z',
    turn_count: 6,
  },
  {
    id: 'conv-002',
    user_id: 'dummy-user',
    topic_id: 'airport',
    topic_label: '공항/호텔',
    updated_at: '2026-03-21T18:00:00Z',
    last_message_at: '2026-03-21T18:00:00Z',
    turn_count: 12,
  },
  {
    id: 'conv-003',
    user_id: 'dummy-user',
    topic_id: 'shopping',
    topic_label: '쇼핑',
    updated_at: '2026-03-20T09:15:00Z',
    last_message_at: '2026-03-20T09:15:00Z',
    turn_count: 4,
  },
];

function formatRelativeTime(isoString: string): string {
  const now = new Date();
  const date = new Date(isoString);
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return '방금 전';
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays === 1) return '어제';
  return `${diffDays}일 전`;
}

type ConversationItemProps = {
  item: (typeof DUMMY_CONVERSATIONS)[number];
  onPress: (id: string) => void;
};

function ConversationItem({ item, onPress }: ConversationItemProps) {
  return (
    <Pressable
      className="flex-row items-center justify-between bg-white rounded-2xl px-4 py-4 mb-3 shadow-sm border border-gray-100 active:opacity-70"
      onPress={() => onPress(item.id)}
    >
      <View className="flex-1 mr-3">
        <Text className="text-base font-semibold text-gray-900 mb-1">{item.topic_label}</Text>
        <Text className="text-sm text-gray-400">{formatRelativeTime(item.last_message_at)}</Text>
      </View>
      <View className="items-end">
        <View className="bg-blue-50 rounded-full px-3 py-1">
          <Text className="text-xs font-medium text-blue-600">{item.turn_count}턴</Text>
        </View>
      </View>
    </Pressable>
  );
}

function EmptyState() {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <Text className="text-5xl mb-4">💬</Text>
      <Text className="text-xl font-bold text-gray-800 mb-2 text-center">
        아직 대화가 없어요
      </Text>
      <Text className="text-sm text-gray-400 text-center leading-5">
        아래 + 버튼을 눌러{'\n'}첫 번째 영어 대화를 시작해 보세요
      </Text>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const conversations = DUMMY_CONVERSATIONS;

  function handleConversationPress(id: string) {
    router.push(`/chat/${id}`);
  }

  function handleFABPress() {
    router.push('/chat/topic-select');
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-5 pt-14 pb-4 border-b border-gray-100">
        <Text className="text-2xl font-bold text-gray-900">내 대화</Text>
        <Text className="text-sm text-gray-400 mt-1">오늘의 영어 연습을 시작하세요</Text>
      </View>

      {/* Conversation list or empty state */}
      {conversations.length === 0 ? (
        <EmptyState />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ConversationItem item={item} onPress={handleConversationPress} />
          )}
          contentContainerClassName="px-4 pt-4 pb-24"
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      <Pressable
        className="absolute bottom-8 right-6 w-14 h-14 bg-blue-500 rounded-full items-center justify-center shadow-lg active:bg-blue-600"
        onPress={handleFABPress}
      >
        <Text className="text-white text-3xl leading-none mt-[-2px]">+</Text>
      </Pressable>
    </View>
  );
}
