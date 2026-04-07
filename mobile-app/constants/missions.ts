export type Mission = {
  id: string;
  situationId: string;
  label: string;
  desc: string;
  missionBar: string;
  successPrompt: string;
  /** 미션 브리핑 카드용 미션 목표 텍스트 */
  mission: string;
  /** 미션 성공 조건 체크리스트 */
  successConditions: string[];
};

export const MISSIONS: Mission[] = [
  {
    id: 'cafe_return',
    situationId: 'cafe_order',
    label: '☕ 차가운 커피 환불받기',
    desc: '주문한 뜨거운 커피가 차갑게 나왔어요. 예의 바르게 환불을 받아내세요!',
    missionBar: '미션: 차가운 커피 환불받기 ☕',
    mission: '잘못 나온 음료를 정중하게 항의하고 환불 또는 교환을 받아내세요.',
    successConditions: [
      '문제를 명확하게 설명한다',
      '환불 또는 교환을 직접 요청한다',
      '끝까지 예의 바른 태도를 유지한다',
    ],
    successPrompt:
      `Always include "goal_achieved": false in every response by default. ` +
      `Set "goal_achieved": true ONLY IF the customer explicitly requested a refund ` +
      `OR replacement AND provided a valid reason (wrong temperature, wrong order, etc.). ` +
      `If the customer only complained without a clear request, keep false. ` +
      `Initially resist citing store policy, but yield if the argument is logical and polite.`,
  },
  {
    id: 'hotel_upgrade',
    situationId: 'hotel_checkin',
    label: '🏨 룸 업그레이드 요청하기',
    desc: '체크인할 때 정중하게 더 좋은 룸으로 업그레이드를 요청해보세요!',
    missionBar: '미션: 룸 업그레이드 성공하기 🏨',
    mission: '체크인 과정에서 더 좋은 룸으로 업그레이드를 설득력 있게 요청하세요.',
    successConditions: [
      '업그레이드를 명시적으로 요청한다',
      '설득력 있는 이유를 제시한다',
      '직원의 거절에 재요청하거나 대안을 제안한다',
    ],
    successPrompt:
      `Always include "goal_achieved": false by default. ` +
      `Set "goal_achieved": true ONLY IF the guest explicitly asked for an upgrade ` +
      `AND gave a persuasive reason (special occasion, loyalty status, etc.). ` +
      `Keep false for vague requests without justification.`,
  },
  {
    id: 'airport_explain',
    situationId: 'airport_immigration',
    label: '✈️ 입국 심사 통과하기',
    desc: '입국 심사관의 까다로운 질문을 모두 통과해 도장을 받으세요!',
    missionBar: '미션: 입국 심사 통과하기 ✈️',
    mission: '까다로운 심사관의 모든 질문에 명확하고 일관되게 답변하여 입국 허가를 받으세요.',
    successConditions: [
      '방문 목적을 명확히 설명한다',
      '체류 기간과 숙소를 구체적으로 답변한다',
      '모든 질문에 일관되게 대답한다',
    ],
    successPrompt:
      `Always include "goal_achieved": false by default. ` +
      `Act as a strict immigration officer. Ask at least 3 questions (purpose, duration, accommodation). ` +
      `Set "goal_achieved": true ONLY IF the traveler answered all questions clearly and consistently. ` +
      `If any answer is vague or contradictory, keep false and ask follow-up questions.`,
  },
];
