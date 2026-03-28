import { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';

type SavePopupProps = {
  visible: boolean;
  initialText: string;
  onSave: (text: string, memo: string) => void;
  onClose: () => void;
};

export default function SavePopup({ visible, initialText, onSave, onClose }: SavePopupProps) {
  const [text, setText] = useState(initialText);
  const [memo, setMemo] = useState('');

  useEffect(() => {
    setText(initialText);
    setMemo('');
  }, [initialText, visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable
          className="flex-1 bg-black/50 justify-center items-center px-6"
          onPress={onClose}
        >
          <Pressable onPress={() => {}} className="w-full">
            <View className="bg-white rounded-2xl p-6 w-full">
              {/* 제목 */}
              <Text className="text-lg font-bold text-gray-900 mb-4">표현 저장</Text>

              {/* 표현 미리보기 */}
              <Text className="text-xs font-medium text-gray-500 mb-1">표현</Text>
              <View className="bg-blue-50 rounded-xl px-3 py-2 mb-4">
                <TextInput
                  className="text-blue-600 font-semibold text-sm"
                  value={text}
                  onChangeText={setText}
                  multiline
                  placeholder="저장할 표현을 입력하세요"
                  placeholderTextColor="#93c5fd"
                />
              </View>

              {/* 메모 */}
              <Text className="text-xs font-medium text-gray-500 mb-1">메모 (선택)</Text>
              <View className="bg-gray-50 rounded-xl px-3 py-2 mb-6">
                <TextInput
                  className="text-gray-700 text-sm"
                  value={memo}
                  onChangeText={setMemo}
                  placeholder="메모를 입력하세요"
                  placeholderTextColor="#d1d5db"
                />
              </View>

              {/* 버튼 행 */}
              <View className="flex-row gap-3">
                <Pressable
                  onPress={onClose}
                  className="flex-1 bg-gray-100 rounded-xl py-3 items-center active:opacity-70"
                >
                  <Text className="text-gray-700 font-semibold text-sm">취소</Text>
                </Pressable>
                <Pressable
                  onPress={() => { onSave(text, memo); onClose(); }}
                  className="flex-1 bg-blue-500 rounded-xl py-3 items-center active:opacity-70"
                >
                  <Text className="text-white font-semibold text-sm">저장</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
