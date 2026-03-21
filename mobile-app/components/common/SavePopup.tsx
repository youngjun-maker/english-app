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
      <Pressable
        className="flex-1 bg-black/50 justify-end"
        onPress={onClose}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable onPress={() => {}}>
            <View className="bg-white rounded-t-2xl p-6">
              <Text className="text-base font-semibold text-gray-800 mb-3">표현 저장</Text>

              <Text className="text-xs text-gray-500 mb-1">표현</Text>
              <TextInput
                className="border border-gray-200 rounded-lg px-3 py-2 text-gray-800 mb-3"
                value={text}
                onChangeText={setText}
                multiline
                placeholder="저장할 표현을 입력하세요"
              />

              <Text className="text-xs text-gray-500 mb-1">메모 (선택)</Text>
              <TextInput
                className="border border-gray-200 rounded-lg px-3 py-2 text-gray-800 mb-5"
                value={memo}
                onChangeText={setMemo}
                placeholder="메모를 입력하세요"
              />

              <View className="flex-row gap-3">
                <Pressable
                  className="flex-1 py-3 rounded-xl border border-gray-200 items-center"
                  onPress={onClose}
                >
                  <Text className="text-gray-600 font-medium">취소</Text>
                </Pressable>
                <Pressable
                  className="flex-1 py-3 rounded-xl bg-blue-500 items-center"
                  onPress={() => { onSave(text, memo); onClose(); }}
                >
                  <Text className="text-white font-semibold">저장</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}
