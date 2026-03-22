import { View, Text, FlatList, ListRenderItem } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import type { Expression } from '@/types';
import ExpressionCard from '@/components/study/ExpressionCard';
import DeleteConfirmModal from '@/components/study/DeleteConfirmModal';
import { fetchExpressions, deleteExpression } from '@/api/chat';
import { useAppStore } from '@/store/useAppStore';

function EmptyState() {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <Text className="text-5xl mb-4">📚</Text>
      <Text className="text-xl font-bold text-gray-800 mb-2 text-center">
        저장된 표현이 없어요
      </Text>
      <Text className="text-sm text-gray-400 text-center leading-5">
        {'대화 중 표현을 길게 눌러\n학습장에 저장해 보세요'}
      </Text>
    </View>
  );
}

export default function StudyScreen() {
  const router = useRouter();
  const showToast = useAppStore((s) => s.showToast);
  const [expressions, setExpressions] = useState<Expression[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Expression | null>(null);

  useEffect(() => {
    fetchExpressions()
      .then(setExpressions)
      .catch(() => showToast('표현 목록을 불러오지 못했어요.'));
  }, []);

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
    <View className="flex-1 bg-gray-50">
      {/* 헤더 */}
      <View className="bg-white px-5 pt-14 pb-4 border-b border-gray-100">
        <Text className="text-2xl font-bold text-gray-900">학습장</Text>
        <Text className="text-sm text-gray-400 mt-1">{expressions.length}개의 표현</Text>
      </View>

      {/* 목록 */}
      <FlatList
        data={expressions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        className="flex-1 px-4 pt-4"
        ListEmptyComponent={<EmptyState />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={expressions.length === 0 ? { flex: 1 } : undefined}
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
