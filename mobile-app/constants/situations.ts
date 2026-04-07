export type SituationCategory = 'Travel' | 'Daily' | 'Business';

export type Situation = {
  id: string;
  label: string;
  emoji: string;
  desc: string;
  category: SituationCategory;
  /** AI가 먼저 말하는 상황 (입국심사, 바리스타 등) */
  aiFirst?: boolean;
  /** aiFirst=true 일 때 채팅창 상단에 표시할 AI 첫 마디 */
  aiOpeningLine?: string;
  /** aiFirst=false 일 때 유저에게 보여줄 영어 추천 프롬프트 */
  starterPrompts?: string[];
  /** 상황별 타이핑 인디케이터 텍스트 */
  typingText?: string;
};

// id는 ai-server/prompts/ 파일명(확장자 제외)과 일치해야 함
export const SITUATIONS: Situation[] = [
  {
    id: 'cafe_order',
    emoji: '☕',
    label: '카페 주문',
    desc: '음료 주문, 커스텀 요청, 픽업 안내',
    category: 'Daily',
    aiFirst: true,
    aiOpeningLine: "Hi there! Welcome. What can I get started for you today?",
    typingText: '바리스타가 음료 만들고 있어요... ☕',
  },
  {
    id: 'airport_immigration',
    emoji: '✈️',
    label: '공항 입국심사',
    desc: '비자, 방문 목적, 체류 기간 설명',
    category: 'Travel',
    aiFirst: true,
    aiOpeningLine: "Next, please. Passport? What's the purpose of your visit?",
    typingText: '심사관이 서류 확인 중이에요... ✈️',
  },
  {
    id: 'hotel_checkin',
    emoji: '🏨',
    label: '호텔 체크인',
    desc: '예약 확인, 룸 요청, 어메니티 문의',
    category: 'Travel',
    starterPrompts: [
      "Hi, I have a reservation. The name is on Park.",
      "Could I get a room with a nice view?",
      "Does the room include breakfast?",
    ],
    typingText: '프런트 직원이 확인 중이에요... 🏨',
  },
  {
    id: 'small_talk',
    emoji: '💬',
    label: '스몰토크',
    desc: '날씨, 주말 이야기, 가벼운 일상',
    category: 'Daily',
    starterPrompts: [
      "Beautiful weather today, isn't it?",
      "How have you been lately?",
      "What did you get up to this weekend?",
    ],
    typingText: '상대방이 생각 중이에요... 💬',
  },
  {
    id: 'opinion',
    emoji: '💭',
    label: '의견 말하기',
    desc: '찬반 토론, 논리적 설득, 제안',
    category: 'Daily',
    starterPrompts: [
      "I think that's actually a great point.",
      "I'm not sure I agree with that.",
      "Here's my take on the matter.",
    ],
    typingText: '상대방이 생각 중이에요... 💭',
  },
  {
    id: 'taxi_negotiation',
    emoji: '🚕',
    label: '택시 목적지 협상',
    desc: '목적지 안내, 요금 협상, 경로 변경 요청',
    category: 'Travel',
    aiFirst: true,
    aiOpeningLine: "Hey, where to?",
    typingText: '기사님이 경로 찾는 중이에요... 🚕',
  },
  {
    id: 'job_interview',
    emoji: '💼',
    label: '취업 면접',
    desc: '자기소개, 강점/약점 설명, 커리어 목표 어필',
    category: 'Business',
    aiFirst: true,
    aiOpeningLine: "Good morning! Please take a seat. Let's start with — can you tell me a little about yourself?",
    typingText: '면접관이 메모 중이에요... 💼',
  },
  {
    id: 'neighbor_complaint',
    emoji: '🏠',
    label: '이웃 소음 항의',
    desc: '소음 문제 정중하게 항의, 해결책 제안',
    category: 'Daily',
    starterPrompts: [
      "Hi, sorry to bother you. I'm your neighbor from downstairs.",
      "I wanted to talk to you about some noise.",
      "Could we figure something out together?",
    ],
    typingText: '이웃이 생각 중이에요... 🏠',
  },
  {
    id: 'pharmacy',
    emoji: '💊',
    label: '약국 증상 설명',
    desc: '아픈 증상 설명, 약 처방 요청, 복용법 확인',
    category: 'Daily',
    aiFirst: true,
    aiOpeningLine: "Hi there, how can I help you today?",
    typingText: '약사가 확인 중이에요... 💊',
  },
  {
    id: 'restaurant_complaint',
    emoji: '🍽️',
    label: '레스토랑 주문 실수 정정',
    desc: '잘못 나온 음식, 알레르기 대응, 정중한 요청',
    category: 'Daily',
    aiFirst: true,
    aiOpeningLine: "Hi, is everything alright with your meal?",
    typingText: '웨이터가 메모 중이에요... 🍽️',
  },
  {
    id: 'bank_account',
    emoji: '🏦',
    label: '은행 계좌 개설',
    desc: '계좌 종류 선택, 서류 제출, 카드 발급 요청',
    category: 'Business',
    aiFirst: true,
    aiOpeningLine: "Good afternoon! Welcome to City Bank. How may I assist you today?",
    typingText: '은행 직원이 서류 확인 중이에요... 🏦',
  },
  {
    id: 'business_meeting',
    emoji: '📊',
    label: '비즈니스 미팅',
    desc: '프로젝트 제안, 일정 조율, 협업 제안',
    category: 'Business',
    starterPrompts: [
      "Thank you for meeting with me today.",
      "I'd like to discuss a potential collaboration.",
      "Here's a brief overview of what I have in mind.",
    ],
    typingText: '파트너가 검토 중이에요... 📊',
  },
];
