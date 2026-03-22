import { View, Text, ScrollView, Pressable } from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import UserBubble from '@/components/chat/UserBubble';
import AIBubble from '@/components/chat/AIBubble';
import TTSButton from '@/components/common/TTSButton';
import {
  DUMMY_EXPRESSIONS,
  DUMMY_CONTEXT_MAP,
  DUMMY_EXAMPLES_MAP,
  SOURCE_BLOCK_LABEL,
} from '@/constants/dummyExpressions';

export default function ExpressionDetailScreen() {
  const { expressionId } = useLocalSearchParams<{ expressionId: string }>();
  const router = useRouter();

  const expression = DUMMY_EXPRESSIONS.find((e) => e.id === expressionId);
  const contextData = expressionId ? DUMMY_CONTEXT_MAP[expressionId] : undefined;
  const examples = expressionId ? (DUMMY_EXAMPLES_MAP[expressionId] ?? []) : [];

  const [isPlaying, setIsPlaying] = useState(false);
  const [showExamples, setShowExamples] = useState(false);

  if (!expression) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-gray-400">표현을 찾을 수 없습니다.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      {/* 헤더 */}
      <View className="bg-white px-5 pt-14 pb-4 border-b border-gray-100 flex-row items-center gap-3">
        <Pressable
          onPress={() => router.back()}
          className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center active:opacity-60"
        >
          <Ionicons name="chevron-back" size={20} color="#111827" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-900" numberOfLines={1}>
            {expression.topic_label}
          </Text>
          <Text className="text-xs text-gray-400">
            {SOURCE_BLOCK_LABEL[expression.source_block]}에서 저장
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Section 1: 저장한 표현 강조 */}
        <View className="mx-4 mt-4 mb-6 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-4">
          <Text className="text-xs text-blue-500 font-medium mb-2">저장한 표현</Text>
          <Text className="text-xl font-bold text-blue-700 mb-2">
            {expression.expression_text}
          </Text>
          <TTSButton
            text={expression.expression_text}
            isPlaying={isPlaying}
            onPress={() => setIsPlaying((p) => !p)}
          />
          {expression.user_memo && (
            <Text className="text-sm text-gray-500 mt-2">{expression.user_memo}</Text>
          )}
        </View>

        {/* Section 2: 원본 대화 문맥 */}
        {contextData && (
          <View className="mb-6">
            <Text className="text-base font-bold text-gray-900 px-4 mb-3">원본 대화</Text>
            <View className="px-4">
              {contextData.turns.map((turn) => {
                const isHighlighted = turn.id === contextData.highlightedTurnId;
                return (
                  <View
                    key={turn.id}
                    className={
                      isHighlighted
                        ? 'bg-blue-50 border border-blue-200 rounded-2xl px-2 py-2 mb-4'
                        : 'mb-4'
                    }
                  >
                    {isHighlighted && (
                      <Text className="text-blue-500 text-xs font-medium mb-1 px-2">
                        📌 저장된 표현이 포함된 대화
                      </Text>
                    )}
                    <UserBubble
                      text={turn.userText}
                      onLongPress={() => {}}
                    />
                    <AIBubble
                      feedback={turn.ai.feedback}
                      nextResponse={turn.ai.next_response}
                      messageId={turn.id}
                      readonly
                    />
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Section 3: 예문 더 보기 */}
        {examples.length > 0 && (
          <View className="mb-8">
            <Pressable
              onPress={() => setShowExamples((v) => !v)}
              className="flex-row items-center justify-between px-4 py-3 border-t border-gray-100 active:opacity-60"
            >
              <Text className="text-base font-bold text-gray-900">예문 더 보기</Text>
              <Ionicons
                name={showExamples ? 'chevron-up' : 'chevron-down'}
                size={18}
                color="#6B7280"
              />
            </Pressable>
            {showExamples && (
              <View className="px-4 pt-2">
                {examples.map((ex) => (
                  <View key={ex.id} className="bg-gray-50 rounded-xl px-4 py-3 mb-2">
                    <Text className="text-gray-800 font-medium text-sm mb-1">{ex.sentence}</Text>
                    <Text className="text-gray-400 text-xs">{ex.translation}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
