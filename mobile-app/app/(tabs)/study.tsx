import { View, Text, FlatList, ListRenderItem, Pressable, ScrollView } from 'react-native';
import { useCallback, useState } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Expression } from '@/types';
import ExpressionCard from '@/components/study/ExpressionCard';
import DeleteConfirmModal from '@/components/study/DeleteConfirmModal';
import { fetchExpressions, deleteExpression } from '@/api/chat';
import { useAppStore } from '@/store/useAppStore';

type FilterType = 'all' | 'user_speech' | 'feedback' | 'response';

const FILTER_CHIPS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'user_speech', label: 'My Speech' },
  { key: 'feedback', label: 'Corrections' },
  { key: 'response', label: 'AI Response' },
];

function EmptyState() {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <Text className="text-5xl mb-4">📚</Text>
      <Text className="text-xl font-bold text-gray-800 mb-2 text-center">
        No saved expressions yet
      </Text>
      <Text className="text-sm text-gray-400 text-center leading-5">
  {"Tap on a message during a conversation\nto save expressions here."}
      </Text>
    </View>
  );
}

export default function StudyScreen() {
  const router = useRouter();
  const showToast = useAppStore((s) => s.showToast);
  const [expressions, setExpressions] = useState<Expression[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Expression | null>(null);
  const [filterType, setFilterType] = useState<FilterType>('all');

  useFocusEffect(
    useCallback(() => {
      fetchExpressions()
        .then(setExpressions)
        .catch(() => showToast('표현 목록을 불러오지 못했어요.'));
    }, [])
  );

  const filteredExpressions =
    filterType === 'all'
      ? expressions
      : expressions.filter((e) => e.source_block === filterType);

  function handleCardPress(item: Expression) {
    router.push({
      pathname: '/study/[expressionId]',
      params: {
        expressionId: item.id,
        conversationId: item.conversation_id,
        messageId: item.message_id,
        expressionText: item.expression_text,
        topicLabel: item.topic_label,
        sourceBlock: item.source_block,
      },
    });
  }

  function handleLongPress(expression: Expression) {
    setDeleteTarget(expression);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    try {
      await deleteExpression(deleteTarget.id);
      setExpressions((prev) => prev.filter((e) => e.id !== deleteTarget.id));
      showToast('표현이 삭제되었습니다.');
    } catch {
      showToast('표현 삭제에 실패했어요.');
    } finally {
      setDeleteTarget(null);
    }
  }

  function handleDeleteCancel() {
    setDeleteTarget(null);
  }

  const renderItem: ListRenderItem<Expression> = ({ item }) => (
    <ExpressionCard
      expression={item}
      onPress={() => handleCardPress(item)}
      onLongPress={() => handleLongPress(item)}
    />
  );

  return (
    <View className="flex-1 bg-[#FAF9F7]">
      {/* 헤더 */}
      <View className="px-5 pt-14 pb-3 flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-black text-gray-900">Learn</Text>
          <Text className="text-xs text-gray-400 mt-0.5">{expressions.length} expressions saved</Text>
        </View>
        <Pressable className="w-9 h-9 rounded-full bg-white border border-gray-100 items-center justify-center active:opacity-60">
          <Ionicons name="search-outline" size={18} color="#6B7280" />
        </Pressable>
      </View>

      {/* 필터 칩 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="flex-grow-0 mb-3"
        contentContainerClassName="px-5 gap-2"
      >
        {FILTER_CHIPS.map((chip) => {
          const isSelected = filterType === chip.key;
          return (
            <Pressable
              key={chip.key}
              onPress={() => setFilterType(chip.key)}
              className={`px-4 py-1.5 rounded-full border active:opacity-70 ${
                isSelected
                  ? 'bg-gray-900 border-gray-900'
                  : 'bg-white border-gray-200'
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  isSelected ? 'text-white' : 'text-gray-500'
                }`}
              >
                {chip.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* 목록 */}
      <FlatList
        data={filteredExpressions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        className="flex-1 px-4"
        ListEmptyComponent={<EmptyState />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={filteredExpressions.length === 0 ? { flex: 1 } : { paddingBottom: 24 }}
      />

      <DeleteConfirmModal
        visible={deleteTarget !== null}
        expressionText={deleteTarget?.expression_text ?? ''}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </View>
  );
}
