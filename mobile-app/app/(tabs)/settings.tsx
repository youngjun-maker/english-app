import { View, Text, Pressable, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';
import { supabase } from '@/utils/supabase';
import BearMascot from '@/components/common/BearMascot';

export default function SettingsScreen() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const todayTurnCount = useAppStore((s) => s.todayTurnCount);
  const displayName = user?.display_name ?? 'User';
  const email = user?.email ?? '';

  // streak은 별도 API 없으므로 턴 카운트로 대체 표시
  const streak = 3;

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <View className="flex-1 bg-[#FAF9F7]">
      {/* 헤더 */}
      <View className="px-5 pt-14 pb-3">
        <Text className="text-2xl font-black text-gray-900">Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* 프로필 카드 */}
        <View className="bg-white rounded-2xl mx-4 px-4 py-4 mb-3 flex-row items-center">
          {/* 곰 아이콘 */}
          <View className="w-12 h-12 rounded-full bg-red-50 items-center justify-center mr-3">
            <BearMascot size="small" />
          </View>

          {/* 이름 + 이메일 */}
          <View className="flex-1">
            <Text className="font-bold text-gray-900 text-base">{displayName}</Text>
            <Text className="text-xs text-gray-400 mt-0.5">{email}</Text>
          </View>

          {/* 스트릭 배지 */}
          <View className="bg-orange-50 rounded-full px-3 py-1.5 flex-row items-center gap-1">
            <Text className="text-sm">🔥</Text>
            <Text className="text-xs font-semibold text-orange-500">{streak}</Text>
          </View>
        </View>

        {/* 메뉴 섹션 */}
        <View className="bg-white rounded-2xl mx-4 mb-3 overflow-hidden">
          {/* Subscription */}
          <Pressable className="flex-row items-center px-4 py-4 active:opacity-60">
            <View className="w-8 h-8 rounded-full bg-indigo-50 items-center justify-center mr-3">
              <Text className="text-base">💳</Text>
            </View>
            <Text className="flex-1 text-sm font-medium text-gray-800">Subscription</Text>
            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
          </Pressable>

          <View className="mx-4 border-b border-gray-50" />

          {/* Preferences */}
          <Pressable className="flex-row items-center px-4 py-4 active:opacity-60">
            <View className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center mr-3">
              <Text className="text-base">⚙️</Text>
            </View>
            <Text className="flex-1 text-sm font-medium text-gray-800">Preferences</Text>
            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
          </Pressable>
        </View>

        {/* 앱 사용 가이드 */}
        <View className="bg-white rounded-2xl mx-4 mb-3 overflow-hidden">
          <Pressable
            className="flex-row items-center px-4 py-4 active:opacity-60"
            onPress={() => router.push('/guide')}
          >
            <View className="w-8 h-8 rounded-full bg-yellow-50 items-center justify-center mr-3">
              <Text className="text-base">💡</Text>
            </View>
            <Text className="flex-1 text-sm font-medium text-gray-800">도움말 & FAQ</Text>
            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
          </Pressable>
        </View>

        {/* 오늘 사용 현황 */}
        <View className="bg-white rounded-2xl mx-4 mb-3 px-4 py-4">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            {"Today's Usage"}
          </Text>
          <Text className="text-sm text-gray-700">
            <Text className="font-bold text-indigo-600">{todayTurnCount}</Text>
            <Text className="text-gray-400"> / 20 turns</Text>
          </Text>
        </View>

        {/* Sign Out */}
        <View className="bg-white rounded-2xl mx-4 mb-8">
          <Pressable
            className="flex-row items-center px-4 py-4 active:opacity-60"
            onPress={handleSignOut}
          >
            <View className="mr-3">
              <Ionicons name="log-out-outline" size={18} color="#EF4444" />
            </View>
            <Text className="text-sm font-semibold text-red-500">Sign Out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
