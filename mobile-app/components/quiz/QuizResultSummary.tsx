import { View, Text, Pressable, ScrollView } from 'react-native';

type Props = {
  correctCount: number;
  totalCount: number;
  onReturn: () => void;
};

function getResultContent(correct: number, total: number) {
  const ratio = correct / total;
  if (ratio >= 0.9) return { emoji: '🏆', message: '완벽해요!', bg: 'bg-emerald-50', text: 'text-emerald-700' };
  if (ratio >= 0.7) return { emoji: '🎉', message: '잘했어요!', bg: 'bg-blue-50', text: 'text-blue-700' };
  if (ratio >= 0.5) return { emoji: '💪', message: '조금만 더!', bg: 'bg-amber-50', text: 'text-amber-700' };
  return { emoji: '📚', message: '더 연습해요', bg: 'bg-red-50', text: 'text-red-600' };
}

export default function QuizResultSummary({ correctCount, totalCount, onReturn }: Props) {
  const result = getResultContent(correctCount, totalCount);

  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* 결과 카드 */}
      <View className={`${result.bg} rounded-3xl py-10 px-8 items-center mb-8`}>
        <Text className="text-6xl mb-4">{result.emoji}</Text>
        <Text className={`text-2xl font-bold ${result.text} mb-6`}>{result.message}</Text>

        {/* 점수 */}
        <View className="flex-row items-end">
          <Text className={`text-7xl font-black ${result.text}`}>{correctCount}</Text>
          <Text className="text-3xl font-bold text-gray-400 mb-2"> / {totalCount}</Text>
        </View>
      </View>

      {/* 돌아가기 버튼 */}
      <Pressable
        onPress={onReturn}
        className="bg-indigo-500 rounded-2xl py-4 items-center active:opacity-80"
      >
        <Text className="text-white font-bold text-base">퀴즈 탭으로 돌아가기</Text>
      </Pressable>
    </ScrollView>
  );
}
