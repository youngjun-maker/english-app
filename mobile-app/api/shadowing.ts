import { apiFetch } from '@/utils/apiFetch';
import type { ShadowingContent, ShadowingScript } from '@/types/shadowing';

type APIError = { error: { code: string; message: string } };

async function handleError(res: Response): Promise<never> {
  const data = (await res.json()) as APIError;
  throw data;
}

// ─── 웹 미리보기용 더미 데이터 (PREVIEW_MODE=true 시 API 호출 대신 사용) ───
const PREVIEW_MODE = false;

const DUMMY_CONTENTS: ShadowingContent[] = [
  {
    id: 'preview-1',
    title: "Steve Jobs — Stay Hungry, Stay Foolish",
    description: "스탠퍼드 대학교 졸업 연설 (2005). 원어민 발음과 리듬을 따라 말해보세요.",
    video_url: '',
    thumbnail_url: 'https://i.ytimg.com/vi/UF8uR6Z6KLc/hqdefault.jpg',
    duration: 87,
    level: 'medium',
    category: 'speech',
  },
  {
    id: 'preview-2',
    title: "Friends — Central Perk Scene",
    description: "미국 일상 영어의 교과서. 자연스러운 축약어와 슬랭을 익혀보세요.",
    video_url: '',
    thumbnail_url: null,
    duration: 62,
    level: 'easy',
    category: 'movie',
  },
  {
    id: 'preview-3',
    title: "TED — Brené Brown: The Power of Vulnerability",
    description: "전 세계 5천만 뷰 명강연. 학술적 표현과 스토리텔링 구조를 학습하세요.",
    video_url: '',
    thumbnail_url: 'https://pi.tedcdn.com/r/pe.tedcdn.com/images/ted/3bbf1d26a8f68a9015d71818ce77e05f26b6a03c_2880x1620.jpg',
    duration: 105,
    level: 'hard',
    category: 'ted',
  },
];

const DUMMY_SCRIPTS: ShadowingScript[] = [
  { index: 0, start: 0.0,  end: 4.2,  text: "Here's to the crazy ones.", translation: "미친 사람들을 위하여." },
  { index: 1, start: 4.2,  end: 8.5,  text: "The misfits. The rebels. The troublemakers.", translation: "부적응자들. 반항아들. 말썽꾼들." },
  { index: 2, start: 8.5,  end: 13.0, text: "The round pegs in the square holes.", translation: "네모난 구멍에 박힌 둥근 못들." },
  { index: 3, start: 13.0, end: 18.2, text: "The ones who see things differently.", translation: "세상을 다르게 바라보는 사람들." },
  { index: 4, start: 18.2, end: 23.5, text: "They're not fond of rules.", translation: "그들은 규칙을 좋아하지 않습니다." },
  { index: 5, start: 23.5, end: 29.0, text: "And they have no respect for the status quo.", translation: "그리고 현 상태를 전혀 존중하지 않습니다." },
  { index: 6, start: 29.0, end: 35.0, text: "You can quote them, disagree with them, glorify or vilify them.", translation: "당신은 그들을 인용하고, 반대하고, 찬양하거나 비난할 수 있습니다." },
  { index: 7, start: 35.0, end: 41.0, text: "About the only thing you can't do is ignore them.", translation: "당신이 할 수 없는 단 한 가지는 그들을 무시하는 것입니다." },
  { index: 8, start: 41.0, end: 47.0, text: "Because they change things.", translation: "왜냐하면 그들이 세상을 바꾸기 때문입니다." },
  { index: 9, start: 47.0, end: 54.0, text: "They push the human race forward.", translation: "그들은 인류를 앞으로 나아가게 합니다." },
  { index: 10, start: 54.0, end: 62.0, text: "And while some may see them as the crazy ones, we see genius.", translation: "일부는 그들을 미친 사람으로 볼지 모르지만, 우리는 천재를 봅니다." },
  { index: 11, start: 62.0, end: 70.0, text: "Because the people who are crazy enough to think they can change the world,", translation: "세상을 바꿀 수 있다고 생각할 만큼 미친 사람들이야말로," },
  { index: 12, start: 70.0, end: 87.0, text: "are the ones who do.", translation: "실제로 세상을 바꾸는 사람들이기 때문입니다." },
];
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchContents(): Promise<ShadowingContent[]> {
  if (PREVIEW_MODE) return Promise.resolve(DUMMY_CONTENTS);
  const res = await apiFetch('/api/shadowing/contents');
  if (!res.ok) return handleError(res);
  return res.json();
}

export async function fetchContentDetail(id: string): Promise<{
  content: ShadowingContent;
  scripts: ShadowingScript[];
}> {
  if (PREVIEW_MODE) {
    const content = DUMMY_CONTENTS.find((c) => c.id === id) ?? DUMMY_CONTENTS[0];
    return Promise.resolve({ content, scripts: DUMMY_SCRIPTS });
  }
  const res = await apiFetch(`/api/shadowing/contents/${id}`);
  if (!res.ok) return handleError(res);
  return res.json();
}

export async function saveSession(payload: {
  content_id: string;
  completed: boolean;
}): Promise<void> {
  const res = await apiFetch('/api/shadowing/sessions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) return handleError(res);
}
