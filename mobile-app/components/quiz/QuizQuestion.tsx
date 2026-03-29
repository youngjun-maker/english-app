import { View, Text } from 'react-native';
import type { QuizQuestion } from '@/types/quiz';

type Props = {
  question: QuizQuestion;
  isAnswerRevealed: boolean;
};

function HighlightedText({
  sentence,
  highlight,
}: {
  sentence: string;
  highlight: string;
}) {
  const idx = sentence.indexOf(highlight);
  if (idx === -1) {
    return (
      <Text className="text-gray-800 text-lg leading-8 text-center">{sentence}</Text>
    );
  }
  const before = sentence.slice(0, idx);
  const after = sentence.slice(idx + highlight.length);
  return (
    <Text className="text-gray-800 text-lg leading-8 text-center">
      {before}
      <Text className="font-bold text-gray-900">{highlight}</Text>
      {after}
    </Text>
  );
}

export default function QuizQuestion({ question, isAnswerRevealed }: Props) {
  return (
    <View className="flex-1 px-6 justify-center">
      {/* 힌트 레이블 */}
      <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-center mb-4">
        이 표현은 무엇일까요?
      </Text>

      {/* 한글 예문 (highlight 볼드) */}
      <View className="bg-gray-50 rounded-2xl px-5 py-6 mb-6">
        <HighlightedText
          sentence={question.example_sentence_ko}
          highlight={question.highlight_text}
        />
      </View>

      {/* 정답 공개 영역 */}
      {isAnswerRevealed && (
        <View className="border-t border-gray-100 pt-6">
          {/* 영어 표현 */}
          <Text className="text-2xl font-bold text-indigo-600 text-center mb-3">
            {question.expression_text}
          </Text>
          {/* 영어 예문 */}
          <Text className="text-base text-gray-500 text-center leading-7">
            {question.example_sentence_en}
          </Text>
        </View>
      )}
    </View>
  );
}
