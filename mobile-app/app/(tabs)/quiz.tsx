import { View, Text, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAppStore } from '@/store/useAppStore';
import { generateQuiz, fetchQuizSessions } from '@/api/quiz';
import QuizSessionCard from '@/components/quiz/QuizSessionCard';
import type { QuizSession } from '@/types/quiz';

type APIError = { error: { code: string; message: string } };

export default function QuizScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const showToast = useAppStore((s) => s.showToast);

  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [notEnough, setNotEnough] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      fetchQuizSessions()
        .then(setSessions)
        .catch(() => showToast('퀴즈 내역을 불러오지 못했어요.'))
        .finally(() => setIsLoading(false));
    }, [])
  );

  async function handleGenerate() {
    setIsGenerating(true);
    setNotEnough(false);
    try {
      const data = await generateQuiz();
      router.push({ pathname: '/quiz/[sessionId]', params: { sessionId: data.session.id } });
    } catch (err) {
      const apiErr = err as APIError;
      if (apiErr?.error?.code === 'NOT_ENOUGH_EXPRESSIONS') {
        setNotEnough(true);
      } else {
        showToast('퀴즈 생성에 실패했어요. 다시 시도해주세요.');
      }
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <View className="flex-1 bg-[#FAF9F7]">
      {/* 헤더 */}
      <View style={{ paddingTop: insets.top + 8 }} className="bg-white px-5 pb-4 border-b border-gray-100">
        <Text className="text-2xl font-bold text-gray-900">퀴즈</Text>
        <Text className="text-sm text-gray-400 mt-1">저장한 표현으로 실력을 확인하세요</Text>
      </View>

      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <QuizSessionCard
            session={item}
            onPress={() =>
              router.push({
                pathname: '/quiz/result/[sessionId]',
                params: { sessionId: item.id },
              })
            }
          />
        )}
        ListHeaderComponent={
          <View className="pt-5 pb-2">
            {/* 퀴즈 생성 버튼 */}
            <Pressable
              onPress={handleGenerate}
              disabled={isGenerating}
              className="bg-indigo-500 rounded-2xl py-4 items-center mb-4 active:opacity-80"
              style={{ opacity: isGenerating ? 0.7 : 1 }}
            >
              {isGenerating ? (
                <View className="flex-row items-center gap-2">
                  <ActivityIndicator size="small" color="white" />
                  <Text className="text-white font-bold text-base ml-2">생성 중...</Text>
                </View>
              ) : (
                <Text className="text-white font-bold text-base">🎯 퀴즈 생성!</Text>
              )}
            </Pressable>

            {/* 표현 부족 안내 */}
            {notEnough && (
              <View className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 flex-row items-start">
                <Text className="flex-1 text-amber-700 text-sm font-medium leading-5">
                  퀴즈를 시작하려면 표현이 10개 이상 필요해요.{'\n'}
                  대화하면서 표현을 더 저장해보세요! 📚
                </Text>
                <Pressable onPress={() => setNotEnough(false)} className="ml-2 p-1 active:opacity-60">
                  <Ionicons name="close" size={16} color="#92400e" />
                </Pressable>
              </View>
            )}

            {/* 내역 섹션 타이틀 */}
            {sessions.length > 0 && (
              <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                이전 퀴즈 기록
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View className="items-center justify-center py-20">
              <ActivityIndicator size="large" color="#6366F1" />
            </View>
          ) : (
            <View className="items-center justify-center py-20 px-8">
              <Text className="text-4xl mb-4">🏆</Text>
              <Text className="text-base font-semibold text-gray-700 text-center mb-1">
                아직 퀴즈 기록이 없어요
              </Text>
              <Text className="text-sm text-gray-400 text-center">
                퀴즈 생성 버튼을 눌러 시작해보세요!
              </Text>
            </View>
          )
        }
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
