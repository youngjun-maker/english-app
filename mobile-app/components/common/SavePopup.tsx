import { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

type SavePopupProps = {
  visible: boolean;
  initialText: string;
  sourceLabel?: string;  // e.g. "💬 Free Talking", "✈️ 카페 주문"
  sourceBlock?: string;  // e.g. "내 발화", "AI 응답", "교정 표현"
  onSave: (text: string, memo: string) => void;
  onClose: () => void;
};

export default function SavePopup({
  visible,
  initialText,
  sourceLabel,
  sourceBlock,
  onSave,
  onClose,
}: SavePopupProps) {
  const [text, setText] = useState(initialText);
  const [memo, setMemo] = useState('');
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setText(initialText);
    setMemo('');
    setEditing(false);
    setSaved(false);
  }, [initialText, visible]);

  function handleSave() {
    if (saved) return;
    setSaved(true);
    onSave(text, memo);
    setTimeout(() => {
      onClose();
    }, 600);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable
          className="flex-1 bg-black/50 justify-end"
          onPress={onClose}
        >
          {/* 바텀시트 */}
          <Pressable onPress={() => {}} className="w-full">
            <View className="bg-white rounded-t-3xl px-5 pt-4 pb-8">

              {/* 드래그 핸들 */}
              <View className="w-10 h-1 bg-gray-200 rounded-full self-center mb-5" />

              {/* 헤더 */}
              <View className="flex-row items-center mb-4">
                <View className="w-8 h-8 bg-amber-100 rounded-full items-center justify-center mr-2.5">
                  <Ionicons name="bookmark" size={16} color="#D97706" />
                </View>
                <Text className="text-base font-bold text-gray-900">단어장에 추가</Text>
              </View>

              {/* 출처 태그 */}
              {(sourceLabel || sourceBlock) && (
                <View className="flex-row gap-2 mb-3 flex-wrap">
                  {sourceLabel && (
                    <View className="bg-amber-50 border border-amber-200 rounded-full px-3 py-0.5 self-start">
                      <Text className="text-xs text-amber-700 font-medium">{sourceLabel}</Text>
                    </View>
                  )}
                  {sourceBlock && (
                    <View className="bg-gray-100 rounded-full px-3 py-0.5 self-start">
                      <Text className="text-xs text-gray-500 font-medium">{sourceBlock}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* 표현 카드 */}
              <Pressable
                onPress={() => !editing && setEditing(true)}
                className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-4 mb-3"
              >
                {editing ? (
                  <TextInput
                    className="text-gray-900 font-semibold text-base leading-6"
                    value={text}
                    onChangeText={setText}
                    multiline
                    autoFocus
                    onBlur={() => setEditing(false)}
                    placeholder="저장할 표현을 입력하세요"
                    placeholderTextColor="#d1d5db"
                  />
                ) : (
                  <View className="flex-row items-start">
                    <Text className="flex-1 text-gray-900 font-semibold text-base leading-6">
                      {text}
                    </Text>
                    <Ionicons
                      name="pencil-outline"
                      size={14}
                      color="#D97706"
                      style={{ marginTop: 4, marginLeft: 10 }}
                    />
                  </View>
                )}
              </Pressable>

              {/* 메모 한 줄 입력 */}
              <View className="flex-row items-center bg-gray-50 rounded-xl px-3 py-3 mb-5">
                <Ionicons
                  name="create-outline"
                  size={16}
                  color="#9CA3AF"
                  style={{ marginRight: 8 }}
                />
                <TextInput
                  className="flex-1 text-sm text-gray-700"
                  value={memo}
                  onChangeText={setMemo}
                  placeholder="메모 추가..."
                  placeholderTextColor="#d1d5db"
                  returnKeyType="done"
                />
              </View>

              {/* 저장 버튼 */}
              <Pressable
                onPress={handleSave}
                className={`w-full rounded-2xl py-4 items-center mb-3 active:opacity-80 ${
                  saved ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              >
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  <Ionicons
                    name={saved ? 'checkmark-circle' : 'bookmark-outline'}
                    size={18}
                    color="white"
                  />
                  <Text className="text-white font-bold text-base">
                    {saved ? '저장됐어요!' : '단어장에 저장하기'}
                  </Text>
                </View>
              </Pressable>

              {/* 취소 텍스트 링크 */}
              <Pressable onPress={onClose} className="items-center py-1 active:opacity-60">
                <Text className="text-sm text-gray-400">취소</Text>
              </Pressable>

            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
