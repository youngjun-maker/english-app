'use strict';

const MISSIONS = [
  {
    id: 'cafe_return',
    successPrompt:
      `Always include "goal_achieved": false in every response by default. ` +
      `Set "goal_achieved": true ONLY IF the customer explicitly requested a refund ` +
      `OR replacement AND provided a valid reason (wrong temperature, wrong order, etc.). ` +
      `If the customer only complained without a clear request, keep false. ` +
      `Initially resist citing store policy, but yield if the argument is logical and polite.`,
  },
  {
    id: 'hotel_upgrade',
    successPrompt:
      `Always include "goal_achieved": false by default. ` +
      `Set "goal_achieved": true ONLY IF the guest explicitly asked for an upgrade ` +
      `AND gave a persuasive reason (special occasion, loyalty status, etc.). ` +
      `Keep false for vague requests without justification.`,
  },
  {
    id: 'airport_explain',
    successPrompt:
      `Always include "goal_achieved": false by default. ` +
      `Act as a strict immigration officer. Ask at least 3 questions (purpose, duration, accommodation). ` +
      `Set "goal_achieved": true ONLY IF the traveler answered all questions clearly and consistently. ` +
      `If any answer is vague or contradictory, keep false and ask follow-up questions.`,
  },
];

module.exports = { MISSIONS };
