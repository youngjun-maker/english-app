import { View, Text, Pressable, useWindowDimensions, Platform } from 'react-native';
import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';

// expo-video는 웹 미지원 — 웹에서는 placeholder 렌더링
let useVideoPlayer: (url: string, cb: (p: any) => void) => any = () => ({
  pause: () => {}, play: () => {}, playing: false,
  get playbackRate() { return 1.0; },
  set playbackRate(_v: number) {},
  get currentTime() { return 0; },
  set currentTime(_v: number) {},
  addListener: () => ({ remove: () => {} }),
  release: () => {},
});
let VideoView: React.ComponentType<any> = () => null;

if (Platform.OS !== 'web') {
  const expoVideo = require('expo-video');
  useVideoPlayer = expoVideo.useVideoPlayer;
  VideoView = expoVideo.VideoView;
}

export type VideoPlayerHandle = {
  pause: () => void;
  play: () => void;
  seek: (seconds: number) => void;
};

type Props = {
  videoUrl: string;
  duration: number;
  playbackRate: 0.75 | 1.0;
  onTimeUpdate?: (currentTime: number) => void;
  onPlayingChange?: (isPlaying: boolean) => void;
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

const VideoPlayer = forwardRef<VideoPlayerHandle, Props>(
  ({ videoUrl, duration, playbackRate, onTimeUpdate, onPlayingChange }, ref) => {
    const { width: windowWidth } = useWindowDimensions();
    // 웹에서는 브라우저 전체 너비를 반환하므로 최대 393px로 제한
    const width = Platform.OS === 'web' ? Math.min(windowWidth, 393) : windowWidth;
    const videoHeight = width * (9 / 16);
    const [progress, setProgress] = useState(0);
    const [currentTimeSec, setCurrentTimeSec] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const onTimeUpdateRef = useRef(onTimeUpdate);
    const onPlayingChangeRef = useRef(onPlayingChange);
    onTimeUpdateRef.current = onTimeUpdate;
    onPlayingChangeRef.current = onPlayingChange;

    const player = useVideoPlayer(videoUrl, (p) => {
      p.loop = false;
      p.playbackRate = playbackRate;
    });

    // 외부에서 player 제어
    useImperativeHandle(ref, () => ({
      pause: () => player.pause(),
      play: () => player.play(),
      seek: (seconds: number) => {
        player.currentTime = seconds;
      },
    }));

    // playbackRate 동기화
    useEffect(() => {
      player.playbackRate = playbackRate;
    }, [playbackRate, player]);

    // playingChange 이벤트 구독 + 250ms interval로 currentTime 폴링
    useEffect(() => {
      const playingSub = player.addListener('playingChange', (e: { isPlaying: boolean }) => {
        setIsPlaying(e.isPlaying);
        onPlayingChangeRef.current?.(e.isPlaying);
      });

      const interval = setInterval(() => {
        const current = player.currentTime ?? 0;
        onTimeUpdateRef.current?.(current);
        setCurrentTimeSec(current);
        setProgress(duration > 0 ? current / duration : 0);
      }, 250);

      return () => {
        playingSub.remove();
        clearInterval(interval);
      };
    }, [player, duration]);

    // 언마운트 시 리소스 해제
    useEffect(() => {
      return () => {
        player.release();
      };
    }, [player]);

    function togglePlayPause() {
      if (player.playing) {
        player.pause();
      } else {
        player.play();
      }
    }

    return (
      <View style={{ width, height: videoHeight }} className="bg-black">
        {Platform.OS === 'web' ? (
          /* 웹 미리보기용 placeholder */
          <View className="flex-1 items-center justify-center bg-gray-900">
            <Ionicons name="play-circle-outline" size={56} color="white" />
          </View>
        ) : (
          <VideoView
            player={player}
            style={{ width, height: videoHeight }}
            nativeControls={false}
            contentFit="contain"
          />
        )}

        {/* 재생/일시정지 오버레이 */}
        <Pressable
          onPress={togglePlayPause}
          className="absolute inset-0 items-center justify-center"
          style={{ backgroundColor: 'transparent' }}
        >
          {Platform.OS !== 'web' && (
            <View
              className="w-14 h-14 rounded-full items-center justify-center"
              style={{ backgroundColor: isPlaying ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.40)' }}
            >
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={28}
                color="white"
                style={{ opacity: isPlaying ? 0.6 : 1 }}
              />
            </View>
          )}
        </Pressable>

        {/* 프로그레스 바 + 시간 표시 */}
        <View className="absolute bottom-0 left-0 right-0">
          {/* 시간 텍스트 — 좌: 현재, 우: 총 시간 */}
          <View className="flex-row justify-between px-2 pb-1">
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>
              {formatTime(currentTimeSec)}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>
              {formatTime(duration)}
            </Text>
          </View>
          {/* 4px 높이 프로그레스 바 */}
          <View className="h-1 bg-white/20">
            <View
              className="h-full bg-blue-500"
              style={{ width: `${Math.min(progress * 100, 100)}%` }}
            />
          </View>
        </View>
      </View>
    );
  },
);

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;
