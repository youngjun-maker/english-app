import { ScrollView, Text, View, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type FAQItem = {
  q: string;
  a: string;
};

type FAQSection = {
  title: string;
  items: FAQItem[];
};

const FAQ_DATA: FAQSection[] = [
  {
    title: '🐻 대화 & 홈 화면 (Home)',
    items: [
      {
        q: '하루에 몇 번 대화할 수 있나요?',
        a: '하루에 딱 20번(턴) 대화할 수 있어요.\n\n제가 한 번 듣고 한 번 답하는 게 1턴이에요. 홈 화면의 진행 바로 남은 횟수를 확인할 수 있고, 횟수는 매일 자정(KST)에 다시 채워져요.',
      },
      {
        q: '어떤 주제로 대화할 수 있나요?',
        a: '크게 두 가지 방법이 있어요.\n\n💬 Free Talking: 아무 주제나 던져주세요. 일상 이야기, 고민 상담 모두 괜찮아요.\n\n🎭 Situation (상황극): 여행 ✈️ / 일상 💬 / 비즈니스 💼 세 카테고리에서 총 12개 상황을 고를 수 있어요. 상황을 고른 뒤 난이도(Lv.1~3)를 선택하거나, 미션에 도전하거나, 그냥 자유롭게 대화할 수 있어요.\n\n✏️ 나만의 상황: 상황 선택 화면 아래 [내 상황 직접 입력하기]를 눌러 원하는 상황을 직접 만들 수도 있어요. (예: "내일 구글 면접 있어, 면접관 해줘")',
      },
      {
        q: '매주 리포트를 준다던데, 뭔가요?',
        a: '📊 이번 주 리포트 기능이에요.\n\n일주일 동안 틀렸던 표현들을 분석해서 \'가장 많이 틀린 약점 TOP 3\', \'잘한 점\', \'다음 주 목표\'를 정리해 드려요.\n\n홈 화면의 [📊 이번 주 리포트 보기] 버튼을 눌러보세요.',
      },
      {
        q: '예전에 했던 대화를 다시 볼 수 있나요?',
        a: '홈 화면 아래 [Recent History]에서 최근 대화 목록을 볼 수 있어요.\n\n카드를 누르면 예전 대화방으로 들어가서 이어나갈 수 있어요.',
      },
    ],
  },
  {
    title: '🎭 상황극 & 미션 (Situation)',
    items: [
      {
        q: '상황은 어떻게 고르나요?',
        a: '상황 선택 화면 상단의 카테고리 탭으로 필터링할 수 있어요.\n\n✈️ 여행: 공항 입국심사, 호텔 체크인, 택시 협상 등\n💬 일상: 카페 주문, 스몰토크, 이웃 소음 항의, 약국, 레스토랑 등\n💼 비즈니스: 취업 면접, 은행 계좌 개설, 비즈니스 미팅\n\n총 12개 상황이 있어요.',
      },
      {
        q: '난이도(Lv.1 / Lv.2 / Lv.3)는 뭐가 다른가요?',
        a: '속도 차이가 아니라 AI의 교정 방식이 달라져요.\n\nLv.1 초급 — 모든 문법·어휘 실수를 꼼꼼히 교정해 드려요. 막히면 힌트도 드려요.\nLv.2 중급 — 주요 실수만 짚어드려요. 사소한 어색함은 넘어가요.\nLv.3 고급 — 정말 어색하거나 심각한 것만 교정해요. 관용어와 구동사를 자유롭게 써드려요.\n\n처음엔 Lv.2로 시작해서 편해지면 Lv.3에 도전해 보세요!',
      },
      {
        q: '미션 도전은 어떻게 하나요?',
        a: '상황을 선택하면 바텀시트가 열려요. 거기서 [🎯 미션 도전] 카드를 탭하면 미션 브리핑이 나와요.\n\n미션 목표와 성공 조건 체크리스트를 확인한 뒤 [🎯 미션 시작하기] 버튼을 누르면 바로 시작됩니다.\n\n미션을 성공하면 폭죽 🎉이 터지고, 그 상황에서 원어민이 자주 쓰는 표현 2~3개도 알려드려요. 바로 단어장에 저장도 할 수 있어요!',
      },
      {
        q: '대화 중에 갑자기 화면이 빨개지는데 뭔가요?',
        a: '⚡ 돌발 상황이에요!\n\n3턴 이상 대화하면 AI가 예상치 못한 반박이나 돌발 질문을 한 번 끼워 넣어요. 화면 테두리가 빨갛게 번쩍이고 진동이 울려요.\n\n예를 들어 카페에서는 "손님, 처음에 분명 핫으로 안 하셨는데요?", 입국심사에서는 "비자는 14일인데 한 달 있겠다고요?" 같은 상황이에요.\n\n당황하지 말고 영어로 대응해 보세요. 이게 실전 긴장감 연습의 핵심이에요!',
      },
      {
        q: '나만의 상황을 만들 수 있나요?',
        a: '상황 선택 화면 맨 아래 [✏️ 내 상황 직접 입력하기] 버튼을 눌러보세요.\n\n원하는 상황을 최대 150자로 입력하면 AI가 그 역할을 맡아 대화를 시작해요.\n예: "나 다음 주에 미국 파트너사 미팅 있어, 협상 연습 해줘"\n예: "영국 친구한테 여행 계획 소개하는 연습 하고 싶어"',
      },
    ],
  },
  {
    title: '💬 실전 대화 꿀팁 (Chat)',
    items: [
      {
        q: '영어로 어떻게 말하나요? 타자도 되나요?',
        a: '하단 마이크 버튼(🎤)을 한 번 탭하면 녹음이 시작되고, 다시 탭하면 멈추고 자동으로 전송돼요. 최대 30초가 지나면 자동으로 멈춰요.\n\n조용한 곳이라면 텍스트 입력창을 눌러 타자로 보낼 수도 있어요.',
      },
      {
        q: '내 영어가 틀리면 어떡하죠?',
        a: '틀려도 괜찮아요, 제가 다 고쳐드릴게요!\n\n어색하거나 틀린 표현이 있으면 채팅창에 피드백 블록이 나타나요. 원래 문장과 교정된 문장을 나란히 보여드려요.\n\n완벽한 문장이면 ✅ Perfect! 칭찬이 나와요.',
      },
      {
        q: '처음 대화방에 들어갔는데 뭐라고 해야 할지 모르겠어요.',
        a: '상황에 따라 두 가지예요.\n\nAI가 먼저 말하는 상황(카페 주문, 입국심사 등)은 AI가 먼저 말을 걸어요. 그냥 답하면 돼요.\n\n유저가 먼저 시작하는 상황(호텔, 스몰토크 등)은 마이크 버튼 위에 추천 말풍선 3개가 뜨는데, 탭하면 그 문장으로 바로 시작할 수 있어요.',
      },
      {
        q: '원어민 발음으로 다시 듣고 싶어요.',
        a: 'AI 응답이나 교정된 문장 옆 스피커(🔊) 버튼을 눌러보세요.\n\n자연스러운 원어민 억양으로 읽어드려요. 한 번 더 누르면 멈춰요.',
      },
      {
        q: '대화하다가 마음에 드는 표현을 발견했어요!',
        a: '말풍선을 탭해 보세요!\n\n내 발화, AI 응답, 피드백 블록 모두 탭하면 단어장 저장 팝업이 열려요. 텍스트를 수정하거나 메모를 남기고 저장할 수 있어요.',
      },
    ],
  },
  {
    title: '📚 복습과 퀴즈 (Learn & Quiz)',
    items: [
      {
        q: '저장한 표현들은 어디서 보나요?',
        a: '하단 [📚 Learn] 탭에 모여있어요.\n\n카드를 누르면 이 표현을 어떤 대화 상황에서 썼는지 원본 대화가 함께 나와서 기억에 더 오래 남아요.',
      },
      {
        q: '퀴즈는 언제 풀 수 있나요?',
        a: 'Learn 탭에 표현이 쌓이면 퀴즈를 시작할 수 있어요.\n\n[🎯 퀴즈 생성!] 버튼을 누르면 저장한 표현들로 퀴즈가 만들어져요.',
      },
      {
        q: '퀴즈에서 \'알았어👍 / 몰랐어👎\'는 왜 누르나요?',
        a: '망각 곡선 시스템이에요.\n\n👎 몰랐어 → 다음 날 다시 출제\n👍 알았어 → 2일 뒤 → 4일 뒤 → 8일 뒤 순으로 간격이 늘어요.\n\n양심껏 채점하면 오래 기억할 수 있어요.',
      },
    ],
  },
  {
    title: '🎧 섀도잉 (Shadowing)',
    items: [
      {
        q: '섀도잉은 어떻게 훈련하는 게 좋나요?',
        a: '화면 상단 3가지 모드를 활용해 보세요.\n\n[1문장] 모드: 한 문장씩 자동으로 멈춰요. 따라 말하고 재생 버튼을 누르세요.\n[3문장] 모드: 연음과 호흡 타이밍 연습에 좋아요.\n[전체] 모드: 멈춤 없이 끝까지 따라가는 실전 모드예요.\n\n전체 모드로 완주하면 완료 뱃지가 붙어요. 🏅',
      },
      {
        q: '영상이 너무 빨라요! 보조 기능이 있나요?',
        a: '하단 컨트롤 바를 활용해 보세요.\n\n🐢 0.75배속 버튼: 천천히 들어요.\n👁 블라인드 버튼: 한국어 숨기기 → 영어 숨기기 → 모두 보기로 전환돼요.\n🔁 루프 버튼: 특정 문장만 무한 반복해요.\n🎤 마이크 버튼: 녹음하면 원어민 발음 → 내 발음 순으로 바로 비교해서 들을 수 있어요.',
      },
    ],
  },
  {
    title: '⚙️ 프로필 및 설정 (Settings)',
    items: [
      {
        q: '내 정보와 앱 설정은 어디서 하나요?',
        a: '하단 [⚙️ Settings] 탭에서 이름, 오늘 대화 횟수, 로그아웃을 할 수 있어요.',
      },
    ],
  },
];

function AccordionItem({ q, a }: FAQItem) {
  const [open, setOpen] = useState(false);

  function handlePress() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((prev) => !prev);
  }

  return (
    <View className="border-b border-gray-100">
      <Pressable
        className="flex-row items-center px-4 py-4 active:opacity-60"
        onPress={handlePress}
      >
        <Text className="flex-1 text-sm font-semibold text-gray-800 leading-5 pr-2">{q}</Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color="#9CA3AF"
        />
      </Pressable>
      {open && (
        <View className="px-4 pb-4">
          <Text className="text-sm text-gray-600 leading-6">{a}</Text>
        </View>
      )}
    </View>
  );
}

export default function GuideScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-[#FAF9F7]">
      {/* 헤더 */}
      <View className="flex-row items-center px-4 pt-14 pb-3 bg-[#FAF9F7]">
        <Pressable
          className="w-9 h-9 items-center justify-center rounded-full active:opacity-60 mr-2"
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={22} color="#111827" />
        </Pressable>
        <View>
          <Text className="text-xl font-black text-gray-900">도움말 & FAQ</Text>
          <Text className="text-xs text-gray-400 mt-0.5">자주 묻는 질문</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <View className="px-4 pb-10">
          {FAQ_DATA.map((section, si) => (
            <View key={si} className="mb-4">
              {/* 섹션 타이틀 */}
              <Text className="text-base font-bold text-gray-800 mb-2 px-1">
                {section.title}
              </Text>
              {/* 아코디언 카드 */}
              <View className="bg-white rounded-2xl overflow-hidden">
                {section.items.map((item, ii) => (
                  <AccordionItem key={ii} q={item.q} a={item.a} />
                ))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
