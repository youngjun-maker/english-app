export type ShadowingMode = '1' | '3' | 'full';
export type BlindMode = 0 | 1 | 2;

export type ShadowingContent = {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  duration: number;
  level: 'easy' | 'medium' | 'hard';
  category: 'movie' | 'speech' | 'ted';
};

export type ShadowingScript = {
  index: number;
  start: number;
  end: number;
  text: string;
  translation: string | null;
};
