import { FlatList, Modal, Pressable, ScrollView, Text, View, ActivityIndicator } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
import { fetchConversations, createConversation } from '@/api/conversations';
import BearMascot from '@/components/common/BearMascot';
import { fetchWeeklyReport } from '@/api/reports';
import type { Conversation } from '@/types';
import type { WeeklyReport } from '@/api/reports';

// ─── 상수 ────────────────────────────────────────────────────────────────────
const TOPIC_EMOJI: Record<string, string> = {
  cafe: '☕',
  airport: '✈️',
  shopping: '🛍️',
  restaurant: '🍽️',
  hotel: '🏨',
};

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const LOADING_MSGS = [
  '일주일치 대화를 열심히 분석하고 있어요... 🤖',
  '틀린 패턴을 찾고 있어요... 🔍',
  '선생님이 꼼꼼히 살펴보는 중이에요... 📝',
];

// ─── 유틸 ────────────────────────────────────────────────────────────────────
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
}

function EmptyState() {
  return (
    <View className="flex-1 items-center justify-center px-8 pt-16">
      <Text className="text-6xl mb-4">🎙️</Text>
      <Text className="text-xl font-bold text-gray-800 mb-2 text-center">
        Start your first conversation
      </Text>
      <Text className="text-sm text-gray-400 text-center leading-5">
  {"Practice English with your AI tutor.\nTap the button below to begin."}
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
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchConversations()
      .then(setConversations)
      .catch(() => showToast('대화 목록을 불러오지 못했어요.'));
  }, []);


  async function handleReportPress() {
    setReportModalVisible(true);
    setReportLoading(true);
    setLoadingMsgIndex(0);
    loadingIntervalRef.current = setInterval(() => {
      setLoadingMsgIndex((i) => (i + 1) % LOADING_MSGS.length);
    }, 500);
    try {
      const { report: data } = await fetchWeeklyReport();
      setReport(data);
    } catch {
      showToast('리포트를 불러오지 못했어요.');
      setReportModalVisible(false);
    } finally {
      setReportLoading(false);
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
        loadingIntervalRef.current = null;
      }
    }
  }

  const displayName = user?.display_name ?? 'there';
  const progressPercent = Math.min((todayTurnCount / 20) * 100, 100);

  // 오늘 요일 (0=일~6=토, 월요일부터 표시하기 위해 shift)
  const todayIndex = (new Date().getDay() + 6) % 7; // Mon=0 ... Sun=6

  function handleConversationPress(id: string) {
    router.push(`/chat/${id}`);
  }

  async function handleFABPress() {
    try {
      const conversation = await createConversation('free_talk', 'Free Talking');
      router.push({ pathname: '/chat/[id]', params: { id: conversation.id, topicLabel: 'Free Talking', topicId: 'free_talk' } });
    } catch {
      showToast('대화를 시작하지 못했어요. 다시 시도해주세요.');
    }
  }

  // FlatList ListHeaderComponent
  const ListHeader = (
    <>
      {/* ── 탑 바 ── */}
      <View className="px-5 pt-14 pb-3 flex-row items-center gap-x-3">
        <View className="w-9 h-9 rounded-full bg-red-50 items-center justify-center">
          <BearMascot size="small" />
        </View>
        <Text className="text-base font-bold text-gray-900 flex-1">
          Good morning, {displayName}!
        </Text>
      </View>

      <View className="px-4 pt-2">
        {/* ── 스트릭 + 목표 카드 ── */}
        <View className="bg-white rounded-2xl px-4 py-3.5 mb-4 border border-gray-100">
          {/* 스트릭 행 + BearMascot */}
          <View className="flex-row items-center mb-1">
            <Text className="text-sm">🔥</Text>
            <Text className="text-sm font-bold text-gray-800 ml-2">3-day streak!</Text>
            <Text className="text-xs text-gray-400 ml-1 flex-1">Keep it going today</Text>
            <BearMascot size="small" />
          </View>

          {/* 요일 도트 */}
          <View className="flex-row gap-1.5 mb-3">
            {WEEKDAYS.map((day, i) => (
              <View key={i} className="items-center gap-0.5">
                <View
                  className={`w-5 h-5 rounded-full ${i <= todayIndex ? 'bg-orange-400' : 'bg-gray-100'}`}
                />
                <Text className="text-[9px] text-gray-400">{day}</Text>
              </View>
            ))}
          </View>

          <View className="border-t border-gray-100 mb-3" />

          {/* 오늘 목표 */}
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              {"Today's Goal"}
            </Text>
            <Text className="text-sm font-bold text-indigo-600">
              {todayTurnCount} / 20 turns
            </Text>
          </View>

          {/* 프로그레스 바 — Rule 5 예외: width는 동적값이라 인라인 style 사용 */}
          <View className="bg-gray-100 rounded-full h-2">
            <View
              className="bg-indigo-500 rounded-full h-2"
              style={{ width: `${progressPercent}%` }}
            />
          </View>

          {isTurnLimitReached && (
            <Text className="text-xs text-indigo-500 mt-1.5 font-medium">
              Great job! Daily goal completed!
            </Text>
          )}
        </View>

        {/* ── 주간 리포트 버튼 ── */}
        <Pressable
          className="bg-white rounded-2xl px-4 py-3.5 mb-4 border border-gray-100 flex-row items-center active:opacity-70"
          onPress={handleReportPress}
        >
          <Text className="text-lg mr-2">📊</Text>
          <Text className="flex-1 text-sm font-semibold text-gray-800">이번 주 리포트 보기</Text>
          <Text className="text-xs text-indigo-500 font-medium">분석 →</Text>
        </Pressable>

        {/* ── Practice 섹션 ── */}
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Practice
        </Text>
        <View className="flex-row gap-3 mb-5">
          {/* Free Talking */}
          <Pressable
            className="flex-1 bg-white rounded-2xl p-5 border border-gray-100 items-center active:opacity-70"
            onPress={handleFABPress}
          >
            <Text className="text-3xl mb-2.5">💬</Text>
            <Text className="text-sm font-bold text-gray-800 text-center">Free Talking</Text>
            <Text className="text-xs text-gray-400 text-center mt-0.5">Open chat</Text>
          </Pressable>

          {/* Shadowing */}
          <Pressable
            className="flex-1 bg-white rounded-2xl p-5 border border-gray-100 items-center active:opacity-70"
            onPress={() => router.push('/(tabs)/shadowing')}
          >
            <Text className="text-3xl mb-2.5">🎧</Text>
            <Text className="text-sm font-bold text-gray-800 text-center">Shadowing</Text>
            <Text className="text-xs text-gray-400 text-center mt-0.5">Practice</Text>
          </Pressable>

          {/* Situation */}
          <Pressable
            className="flex-1 bg-white rounded-2xl p-5 border border-gray-100 items-center active:opacity-70"
            onPress={() => router.push('/chat/topic-select')}
          >
            <Text className="text-3xl mb-2.5">✈️</Text>
            <Text className="text-sm font-bold text-gray-800 text-center">Situation</Text>
            <Text className="text-xs text-gray-400 text-center mt-0.5">Role play</Text>
          </Pressable>
        </View>

        {/* ── Recent History 섹션 타이틀 ── */}
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Recent History
          </Text>
          {conversations.length > 5 && (
            <Pressable
              className="active:opacity-60"
              onPress={() => router.push('/chat/history')}
            >
              <Text className="text-xs font-medium text-indigo-500">See all</Text>
            </Pressable>
          )}
        </View>
      </View>
    </>
  );

  const recentConversations = conversations.slice(0, 5);

  return (
    <View className="flex-1 bg-[#FAF9F7]">
      {conversations.length === 0 ? (
        <>
          {ListHeader}
          <EmptyState />
        </>
      ) : (
        <FlatList
          data={recentConversations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ConversationItem item={item} onPress={handleConversationPress} />
          )}
          ListHeaderComponent={ListHeader}
          contentContainerClassName="px-4 pb-28"
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* 주간 리포트 모달 */}
      <Modal
        visible={reportModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setReportModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-3xl px-5 pt-5 pb-10 max-h-[80%]">
            <Text className="text-lg font-black text-gray-900 mb-4 text-center">
              📊 이번 주 학습 리포트
            </Text>

            {reportLoading ? (
              <View className="items-center py-10">
                <ActivityIndicator size="large" color="#6366F1" />
                <Text className="text-sm text-gray-400 mt-4 text-center">
                  {LOADING_MSGS[loadingMsgIndex]}
                </Text>
              </View>
            ) : report ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* 총평 */}
                <View className="bg-indigo-50 rounded-2xl px-4 py-3 mb-4">
                  <Text className="text-sm text-indigo-700 leading-5">{report.summary}</Text>
                </View>

                {/* 약점 TOP 3 */}
                {report.weak_points?.length > 0 && (
                  <View className="mb-4">
                    <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                      약점 TOP {report.weak_points.length}
                    </Text>
                    {report.weak_points.map((wp, i) => (
                      <View key={i} className="bg-red-50 rounded-xl px-4 py-3 mb-2">
                        <Text className="text-sm font-bold text-red-600 mb-1">
                          {wp.category} ({wp.count}번)
                        </Text>
                        {wp.examples.map((ex, j) => (
                          <View key={j} className="mt-1">
                            <Text className="text-xs text-gray-500">{'원: "' + ex.original + '"'}</Text>
                            <Text className="text-xs text-emerald-600">{'교: "' + ex.corrected + '"'}</Text>
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                )}

                {/* 칭찬 + 목표 */}
                <View className="bg-emerald-50 rounded-xl px-4 py-3 mb-2">
                  <Text className="text-xs font-semibold text-emerald-600 mb-1">👍 잘한 점</Text>
                  <Text className="text-sm text-gray-700">{report.praise}</Text>
                </View>
                <View className="bg-amber-50 rounded-xl px-4 py-3 mb-4">
                  <Text className="text-xs font-semibold text-amber-600 mb-1">🎯 다음 주 목표</Text>
                  <Text className="text-sm text-gray-700">{report.next_goal}</Text>
                </View>
              </ScrollView>
            ) : (
              <View className="items-center py-10">
                <Text className="text-4xl mb-3">📭</Text>
                <Text className="text-sm text-gray-400 text-center">이번 주 교정 내역이 없어요!</Text>
              </View>
            )}

            <Pressable
              className="mt-4 bg-gray-100 rounded-2xl py-3.5 items-center active:opacity-70"
              onPress={() => setReportModalVisible(false)}
            >
              <Text className="text-sm font-semibold text-gray-600">닫기</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* FAB — BearMascot + 마이크 배지 */}
      <Pressable
        className="absolute bottom-8 right-6 w-14 h-14 bg-red-500 rounded-full items-center justify-center active:opacity-80"
        style={{ elevation: 6 }}
        onPress={handleFABPress}
      >
        <BearMascot size="small" />
        {/* 마이크 배지 */}
        <View className="absolute -bottom-1 -right-1 w-6 h-6 bg-gray-900 rounded-full items-center justify-center border-2 border-white">
          <Text className="text-white text-[8px]">🎤</Text>
        </View>
      </Pressable>
    </View>
  );
}
