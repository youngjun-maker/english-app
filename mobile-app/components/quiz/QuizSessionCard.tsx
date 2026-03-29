import { View, Text, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { QuizSession } from '@/types/quiz';

type Props = {
  session: QuizSession;
  onPress: () => void;
};

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd}`;
}

function getScoreColor(correct: number, total: number): string {
  const ratio = correct / total;
  if (ratio >= 0.8) return 'text-emerald-600';
  if (ratio >= 0.5) return 'text-amber-500';
  return 'text-red-500';
}

export default function QuizSessionCard({ session, onPress }: Props) {
  const isComplete = session.correct_count !== null;

  return (
    <Pressable
      onPress={onPress}
      className="bg-white rounded-2xl px-4 py-4 mb-3 border border-gray-100 flex-row items-center active:opacity-70"
      style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 }}
    >
      {/* 날짜 */}
      <View className="flex-1">
        <Text className="text-sm font-semibold text-gray-800">
          {formatDate(session.created_at)}
        </Text>
        <Text className="text-xs text-gray-400 mt-0.5">
          {session.total_count}문제
        </Text>
      </View>

      {/* 점수 */}
      {isComplete ? (
        <Text
          className={`text-lg font-bold mr-3 ${getScoreColor(session.correct_count!, session.total_count)}`}
        >
          {session.correct_count} / {session.total_count}
        </Text>
      ) : (
        <View className="bg-gray-100 rounded-full px-3 py-1 mr-3">
          <Text className="text-xs font-medium text-gray-400">진행 중</Text>
        </View>
      )}

      <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
    </Pressable>
  );
}
