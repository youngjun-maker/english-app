import { View, Text, Pressable } from 'react-native';
import type { ShadowingMode } from '@/types/shadowing';

type Props = {
  mode: ShadowingMode;
  onModeChange: (mode: ShadowingMode) => void;
};

const TABS: { key: ShadowingMode; label: string }[] = [
  { key: '1', label: '1문장' },
  { key: '3', label: '3문장' },
  { key: 'full', label: '전체' },
];

export default function ModeTab({ mode, onModeChange }: Props) {
  return (
    <View className="items-center py-4">
      <View className="flex-row bg-gray-100 rounded-full p-1">
        {TABS.map((tab) => {
          const isActive = mode === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => onModeChange(tab.key)}
              className={`px-5 py-1.5 rounded-full active:opacity-70 ${isActive ? 'bg-blue-500' : ''}`}
            >
              <Text
                className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-gray-400'}`}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
