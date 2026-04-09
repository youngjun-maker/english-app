import { Modal, View, Text, Pressable, ScrollView, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ShadowingScript } from '@/types/shadowing';

type Props = {
  visible: boolean;
  scripts: ShadowingScript[];
  currentIndex: number;
  onSeek: (index: number) => void;
  onClose: () => void;
};

export default function ScriptBottomSheet({
  visible,
  scripts,
  currentIndex,
  onSeek,
  onClose,
}: Props) {
  function formatTime(sec: number) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 justify-end"
        style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
        onPress={onClose}
      >
        {/* 바텀시트 */}
        <Pressable onPress={() => {}} className="w-full">
          <View
            className="bg-white rounded-t-3xl"
            style={{ maxHeight: '75%' }}
          >
            {/* 드래그 핸들 */}
            <View className="items-center pt-3 pb-1">
              <View className="w-9 h-1 rounded-full bg-gray-200" />
            </View>

            {/* 헤더 */}
            <View className="flex-row items-center justify-between px-5 py-3 border-b border-gray-100">
              <Text className="text-base font-bold text-gray-900">전체 스크립트</Text>
              <Pressable
                onPress={onClose}
                className="w-8 h-8 items-center justify-center rounded-full active:bg-gray-100"
              >
                <Ionicons name="close" size={20} color="#9CA3AF" />
              </Pressable>
            </View>

            {/* 스크립트 목록 */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 12, paddingBottom: Platform.OS === 'ios' ? 40 : 24 }}
            >
              {scripts.map((script) => {
                const isCurrent = script.index === currentIndex;
                return (
                  <Pressable
                    key={script.index}
                    onPress={() => {
                      onSeek(script.index);
                      onClose();
                    }}
                    className="py-3 active:opacity-60"
                    style={
                      isCurrent
                        ? {
                            backgroundColor: '#EFF6FF',
                            borderLeftWidth: 3,
                            borderLeftColor: '#3B82F6',
                            borderRadius: 8,
                            paddingLeft: 12,
                            paddingRight: 8,
                            marginBottom: 4,
                          }
                        : {
                            borderBottomWidth: 1,
                            borderBottomColor: '#F3F4F6',
                            marginBottom: 2,
                          }
                    }
                  >
                    {/* 시간 + 영어 */}
                    <View className="flex-row items-start gap-2">
                      <Text
                        className="text-xs font-mono mt-0.5"
                        style={{ color: isCurrent ? '#3B82F6' : '#9CA3AF', minWidth: 36 }}
                      >
                        {formatTime(script.start)}
                      </Text>
                      <Text
                        className="flex-1 leading-5"
                        style={{
                          fontSize: 14,
                          fontWeight: isCurrent ? '700' : '400',
                          color: isCurrent ? '#111827' : '#374151',
                        }}
                      >
                        {script.text}
                      </Text>
                    </View>
                    {/* 한국어 번역 */}
                    {script.translation && (
                      <Text
                        className="text-xs leading-4 mt-1"
                        style={{
                          marginLeft: 44,
                          color: isCurrent ? '#6B7280' : '#9CA3AF',
                        }}
                      >
                        {script.translation}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
