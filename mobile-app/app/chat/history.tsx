import { FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAppStore } from '@/store/useAppStore';
import { fetchConversations } from '@/api/conversations';
import type { Conversation } from '@/types';
import { TOPIC_EMOJI } from '@/constants/topicEmoji';

function formatRelativeTime(isoString: string): string {
  const now = new Date();
  const date = new Date(isoString);
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays}d ago`;
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const showToast = useAppStore((s) => s.showToast);
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    fetchConversations()
      .then(setConversations)
      .catch(() => showToast('대화 목록을 불러오지 못했어요.'));
  }, []);

  return (
    <View className="flex-1 bg-[#FAF9F7]">
      {/* Header */}
      <View style={{ paddingTop: insets.top + 8 }} className="bg-white px-5 pb-3 border-b border-gray-100 flex-row items-center gap-3">
        <Pressable
          onPress={() => router.back()}
          className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center active:opacity-60"
        >
          <Ionicons name="chevron-back" size={20} color="#374151" />
        </Pressable>
        <Text className="text-lg font-bold text-gray-900 flex-1">All Conversations</Text>
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const emoji = TOPIC_EMOJI[item.topic_id] ?? '💬';
          return (
            <Pressable
              className="bg-white rounded-2xl px-4 py-4 mb-3 border border-gray-100 shadow-sm flex-row items-center active:opacity-70"
              onPress={() => router.push(`/chat/${item.id}`)}
            >
              <View className="w-10 h-10 rounded-full bg-amber-50 items-center justify-center mr-3">
                <Text className="text-lg">{emoji}</Text>
              </View>
              <View className="flex-1 mr-3">
                <Text className="text-base font-semibold text-gray-900 mb-0.5">{item.topic_label}</Text>
                <Text className="text-sm text-gray-400">{formatRelativeTime(item.updated_at)}</Text>
              </View>
              <View className="bg-indigo-50 rounded-full px-3 py-1">
                <Text className="text-xs font-medium text-indigo-500">{item.turn_count} turns</Text>
              </View>
            </Pressable>
          );
        }}
        contentContainerClassName="px-4 pt-4 pb-10"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center pt-20">
            <Text className="text-4xl mb-3">💬</Text>
            <Text className="text-base font-semibold text-gray-700">No conversations yet</Text>
          </View>
        }
      />
    </View>
  );
}
