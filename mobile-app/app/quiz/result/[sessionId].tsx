import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { fetchQuizSessionDetail } from '@/api/quiz';
import { useAppStore } from '@/store/useAppStore';
import type { QuizSession, QuizQuestion } from '@/types/quiz';

export default function QuizResultScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showToast = useAppStore((s) => s.showToast);

  const [session, setSession] = useState<QuizSession | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;
    fetchQuizSessionDetail(sessionId)
      .then(({ session: s, questions: q }) => {
        setSession(s);
        setQuestions(q);
      })
      .catch(() => showToast('결과를 불러오지 못했어요.'))
      .finally(() => setIsLoading(false));
  }, [sessionId]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  if (!session) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-8">
        <Text className="text-gray-400 text-center">결과를 불러올 수 없어요.</Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="text-indigo-500 font-medium">돌아가기</Text>
        </Pressable>
      </View>
    );
  }

  const correctCount = session.correct_count ?? 0;

  return (
    <View className="flex-1 bg-[#FAF9F7]" style={{ paddingTop: insets.top }}>
      {/* 헤더 */}
      <View className="bg-white px-4 py-2 flex-row items-center border-b border-gray-100">
        <Pressable
          onPress={() => router.back()}
          className="w-9 h-9 items-center justify-center active:opacity-60"
        >
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </Pressable>
        <Text className="text-base font-semibold text-gray-900 ml-1">퀴즈 결과</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        {/* 점수 요약 카드 */}
        <View className="bg-white rounded-2xl px-6 py-6 mb-4 items-center border border-gray-100">
          {session.correct_count !== null ? (
            <>
              <Text className="text-5xl font-black text-indigo-600">{correctCount}</Text>
              <Text className="text-xl text-gray-400 font-medium">/ {session.total_count}</Text>
            </>
          ) : (
            <Text className="text-gray-400 font-medium">미완료 퀴즈</Text>
          )}
        </View>

        {/* 문제 목록 */}
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          문제 목록
        </Text>
        {questions.map((q, i) => (
          <View
            key={q.id}
            className="bg-white rounded-2xl px-4 py-4 mb-2 border border-gray-100 flex-row items-start"
          >
            {/* 채점 아이콘 */}
            <View className="w-7 h-7 rounded-full items-center justify-center mr-3 mt-0.5"
              style={{
                backgroundColor:
                  q.is_correct === true ? '#D1FAE5' :
                  q.is_correct === false ? '#FEE2E2' : '#F3F4F6',
              }}
            >
              {q.is_correct === true && (
                <Ionicons name="checkmark" size={16} color="#059669" />
              )}
              {q.is_correct === false && (
                <Ionicons name="close" size={16} color="#DC2626" />
              )}
              {q.is_correct === null && (
                <Text className="text-gray-400 text-xs">{i + 1}</Text>
              )}
            </View>

            {/* 표현 + 예문 */}
            <View className="flex-1">
              <Text className="text-sm font-bold text-indigo-600 mb-1">
                {q.expression_text}
              </Text>
              <Text className="text-xs text-gray-500 leading-5">
                {q.example_sentence_ko}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
