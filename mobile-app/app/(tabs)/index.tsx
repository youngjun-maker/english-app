import { FlatList, Pressable, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '@/store/useAppStore';
import { fetchConversations } from '@/api/conversations';
import type { Conversation } from '@/types';

// ─── 토픽 이모지 매핑 ────────────────────────────────────────────────────────
const TOPIC_EMOJI: Record<string, string> = {
  cafe: '☕',
  airport: '✈️',
  shopping: '🛍️',
  restaurant: '🍽️',
  hotel: '🏨',
};

// ─── 유틸 ────────────────────────────────────────────────────────────────────
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

// ─── 서브 컴포넌트 ───────────────────────────────────────────────────────────

type ConversationItemProps = {
  item: Conversation;
  onPress: (id: string) => void;
};

function ConversationItem({ item, onPress }: ConversationItemProps) {
  const emoji = TOPIC_EMOJI[item.topic_id] ?? '💬';

  return (
    <Pressable
      className="bg-white rounded-2xl px-4 py-4 mb-3 border border-gray-100 shadow-sm flex-row items-center active:opacity-70"
      onPress={() => onPress(item.id)}
    >
      {/* 토픽 이모지 원형 배경 */}
      <View className="w-10 h-10 rounded-full bg-blue-50 items-center justify-center mr-3">
        <Text className="text-lg">{emoji}</Text>
      </View>

      {/* 토픽 라벨 + 시간 */}
      <View className="flex-1 mr-3">
        <Text className="text-base font-semibold text-gray-900 mb-1">{item.topic_label}</Text>
        <Text className="text-sm text-gray-400">{formatRelativeTime(item.updated_at)}</Text>
      </View>

      {/* 턴 수 배지 */}
      <View className="bg-blue-50 rounded-full px-3 py-1">
        <Text className="text-xs font-medium text-blue-600">{item.turn_count}턴</Text>
      </View>
    </Pressable>
  );
}

function EmptyState() {
  return (
    <View className="flex-1 items-center justify-center px-8 pt-16">
      <Text className="text-6xl mb-4">🎙️</Text>
      <Text className="text-xl font-bold text-gray-800 mb-2 text-center">
        첫 대화를 시작해볼까요?
      </Text>
      <Text className="text-sm text-gray-400 text-center leading-5">
        {'AI 선생님과 부담 없이\n영어로 대화하세요'}
      </Text>
    </View>
  );
}

// ─── 메인 화면 ───────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const todayTurnCount = useAppStore((s) => s.todayTurnCount);
  const isTurnLimitReached = useAppStore((s) => s.isTurnLimitReached);
  const user = useAppStore((s) => s.user);
  const showToast = useAppStore((s) => s.showToast);
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    fetchConversations()
      .then(setConversations)
      .catch(() => showToast('대화 목록을 불러오지 못했어요.'));
  }, []);

  const displayName = user?.display_name ?? '영준';

  const progressPercent = Math.min((todayTurnCount / 20) * 100, 100);

  function handleConversationPress(id: string) {
    router.push(`/chat/${id}`);
  }

  function handleFABPress() {
    router.push('/chat/topic-select');
  }

  // FlatList ListHeaderComponent — 헤더 + 대시보드 카드 + 섹션 타이틀
  const ListHeader = (
    <>
      {/* ── 탑 바 ── */}
      <View className="bg-white px-5 pt-14 pb-4 border-b border-gray-100 flex-row items-center justify-between">
        {/* 왼쪽: 프로필 아이콘 + 환영 인사 */}
        <View className="flex-row items-center gap-x-3">
          <View className="w-10 h-10 rounded-full bg-gray-200 items-center justify-center">
            <Text className="text-lg">🧑</Text>
          </View>
          <Text className="text-base font-semibold text-gray-900">
            반가워요, {displayName}님! 👋
          </Text>
        </View>

        {/* 오른쪽: 설정 아이콘 */}
        {/* TODO: My Page 화면으로 진입 (Phase 4) */}
        <Pressable className="p-1 active:opacity-60">
          <Ionicons name="settings-outline" size={22} color="#9CA3AF" />
        </Pressable>
      </View>

      <View className="px-4 pt-4">
        {/* ── 일일 목표 카드 ── */}
        <View className="bg-white rounded-2xl px-4 py-4 mb-4 border border-gray-100 shadow-sm">
          <Text className="text-sm font-semibold text-gray-500 mb-2">오늘의 연습 목표 🎯</Text>
          <Text className="text-2xl font-bold text-gray-900">
            {todayTurnCount} / 20턴 달성 중
          </Text>

          {/* 프로그레스 바 — Rule 5 예외: width만 인라인 style 사용 */}
          <View className="bg-gray-100 rounded-full h-2 mt-3">
            <View
              className="bg-green-400 rounded-full h-2"
              style={{ width: `${progressPercent}%` }}
            />
          </View>

          {isTurnLimitReached && (
            <Text className="text-xs text-green-500 mt-1">🎉 오늘 목표 달성!</Text>
          )}
        </View>

        {/* ── 최근 대화 섹션 타이틀 ── */}
        <Text className="text-sm font-semibold text-gray-400 mb-2">최근 대화 🕰️</Text>
      </View>
    </>
  );

  return (
    <View className="flex-1 bg-gray-50">
      {conversations.length === 0 ? (
        <>
          {ListHeader}
          <EmptyState />
        </>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ConversationItem item={item} onPress={handleConversationPress} />
          )}
          ListHeaderComponent={ListHeader}
          contentContainerClassName="px-4 pb-24"
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
