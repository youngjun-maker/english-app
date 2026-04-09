import { View, Text, Pressable, ActivityIndicator, Animated, BackHandler, Alert } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { fetchQuizSessionDetail, submitQuizResult } from '@/api/quiz';
import QuizQuestion from '@/components/quiz/QuizQuestion';
import QuizResultSummary from '@/components/quiz/QuizResultSummary';
import { useAppStore } from '@/store/useAppStore';
import type { QuizQuestion as QuizQuestionType } from '@/types/quiz';

export default function QuizPlayerScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showToast = useAppStore((s) => s.showToast);

  const [questions, setQuestions] = useState<QuizQuestionType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [answers, setAnswers] = useState<Array<{ expression_id: string; is_correct: boolean }>>([]);
  const [phase, setPhase] = useState<'playing' | 'result'>('playing');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [finalScore, setFinalScore] = useState(0);

  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!sessionId) return;
    fetchQuizSessionDetail(sessionId)
      .then(({ questions: q }) => setQuestions(q))
      .catch(() => showToast('퀴즈를 불러오지 못했어요.', 'error'))
      .finally(() => setIsLoading(false));
  }, [sessionId]);

  useEffect(() => {
    if (questions.length === 0) return;
    Animated.timing(progressAnim, {
      toValue: (currentIndex + 1) / questions.length,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [currentIndex, questions.length]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (phase === 'result') return false;
      handleBack();
      return true;
    });
    return () => subscription.remove();
  }, [phase]);

  function handleBack() {
    if (phase === 'result') {
      router.back();
      return;
    }
    Alert.alert(
      '퀴즈 종료',
      '종료하면 이번 퀴즈 진행 상황이 저장되지 않아요.',
      [
        { text: '계속 풀기', style: 'cancel' },
        { text: '그래도 나가기', style: 'destructive', onPress: () => router.back() },
      ]
    );
  }

  async function handleAnswer(isCorrect: boolean) {
    Haptics.impactAsync(
      isCorrect ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Heavy
    );
    const currentQ = questions[currentIndex];
    const newAnswers = [
      ...answers,
      ...(currentQ.expression_id
        ? [{ expression_id: currentQ.expression_id, is_correct: isCorrect }]
        : []),
    ];
    setAnswers(newAnswers);

    const isLast = currentIndex === questions.length - 1;

    if (isLast) {
      const correctCount = newAnswers.filter((a) => a.is_correct).length;
      setFinalScore(correctCount);
      setIsSubmitting(true);
      try {
        await submitQuizResult(sessionId!, correctCount, newAnswers);
      } catch {
        // 제출 실패해도 결과 화면은 보여줌
        showToast('결과 저장에 실패했어요.', 'error');
      } finally {
        setIsSubmitting(false);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPhase('result');
    } else {
      setCurrentIndex((i) => i + 1);
      setIsAnswerRevealed(false);
    }
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#6366F1" />
        <Text className="text-gray-400 text-sm mt-3">퀴즈 준비 중...</Text>
      </View>
    );
  }

  if (questions.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-8">
        <Text className="text-gray-400 text-center">퀴즈를 불러올 수 없어요.</Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="text-indigo-500 font-medium">돌아가기</Text>
        </Pressable>
      </View>
    );
  }

  // 결과 화면
  if (phase === 'result') {
    return (
      <View className="flex-1 bg-white" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
        {isSubmitting ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#6366F1" />
            <Text className="text-gray-400 text-sm mt-3">결과 저장 중...</Text>
          </View>
        ) : (
          <QuizResultSummary
            correctCount={finalScore}
            totalCount={questions.length}
            onReturn={() => router.replace('/(tabs)/quiz')}
          />
        )}
      </View>
    );
  }

  const currentQuestion = questions[currentIndex];
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      {/* 헤더 */}
      <View className="px-4 py-2 flex-row items-center">
        <Pressable
          onPress={handleBack}
          className="w-9 h-9 items-center justify-center active:opacity-60"
        >
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </Pressable>
        <Text className="text-base font-semibold text-gray-900 flex-1 ml-1">퀴즈</Text>
        <Text className="text-sm font-medium text-gray-400">
          {currentIndex + 1} / {questions.length}
        </Text>
      </View>

      {/* 진행률 바 */}
      <View className="mx-4 bg-gray-100 rounded-full h-1.5 mb-2">
        <Animated.View
          className="bg-indigo-500 rounded-full h-1.5"
          style={{ width: progressWidth }}
        />
      </View>

      {/* 문제 영역 */}
      <QuizQuestion question={currentQuestion} isAnswerRevealed={isAnswerRevealed} />

      {/* 하단 버튼 */}
      <View className="px-4 pb-8" style={{ paddingBottom: Math.max(insets.bottom, 24) }}>
        {!isAnswerRevealed ? (
          <Pressable
            onPress={() => setIsAnswerRevealed(true)}
            className="bg-indigo-500 rounded-2xl py-4 items-center active:opacity-80"
          >
            <Text className="text-white font-bold text-base">답 확인</Text>
          </Pressable>
        ) : (
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => handleAnswer(false)}
              className="flex-1 bg-red-50 border border-red-100 rounded-2xl py-4 items-center active:opacity-70"
            >
              <Text className="text-2xl mb-1">👎</Text>
              <Text className="text-red-500 font-semibold text-sm">몰랐어</Text>
            </Pressable>
            <Pressable
              onPress={() => handleAnswer(true)}
              className="flex-1 bg-emerald-50 border border-emerald-100 rounded-2xl py-4 items-center active:opacity-70"
            >
              <Text className="text-2xl mb-1">👍</Text>
              <Text className="text-emerald-600 font-semibold text-sm">알았어</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}
