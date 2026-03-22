import { Modal, View, Text, Pressable } from 'react-native';

type DeleteConfirmModalProps = {
  visible: boolean;
  expressionText: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function DeleteConfirmModal({
  visible,
  expressionText,
  onConfirm,
  onCancel,
}: DeleteConfirmModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View className="flex-1 bg-black/50 justify-center items-center px-6">
        <View className="bg-white rounded-2xl p-6 w-full">
          {/* 제목 */}
          <Text className="text-lg font-bold text-gray-900 mb-4">표현 삭제</Text>

          {/* 표현 미리보기 */}
          <View className="bg-blue-50 rounded-xl px-3 py-2 mb-3">
            <Text className="text-blue-600 font-semibold text-sm" numberOfLines={2}>
              {expressionText}
            </Text>
          </View>

          {/* 경고 문구 */}
          <Text className="text-sm text-gray-500 mb-6">
            삭제된 표현은 복구할 수 없습니다.
          </Text>

          {/* 버튼 행 */}
          <View className="flex-row gap-3">
            <Pressable
              onPress={onCancel}
              className="flex-1 bg-gray-100 rounded-xl py-3 items-center active:opacity-70"
            >
              <Text className="text-gray-700 font-semibold text-sm">취소</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              className="flex-1 bg-red-500 rounded-xl py-3 items-center active:opacity-70"
            >
              <Text className="text-white font-semibold text-sm">삭제</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
