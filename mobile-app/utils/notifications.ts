let Notifications: typeof import('expo-notifications') | null = null;
try {
  Notifications = require('expo-notifications');
} catch {
  // Native module not available in this build
}

export const NOTIFICATION_IDS = {
  STREAK: 'streak-daily-reminder',
  REVIEW: 'review-daily-reminder',
} as const;

export async function requestPermission(): Promise<boolean> {
  if (!Notifications) return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleStreakReminder(): Promise<void> {
  if (!Notifications) return;
  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_IDS.STREAK,
    content: {
      title: '오늘 영어 대화 하셨나요? 🐻',
      body: '곰돌이가 기다리고 있어요! 5분만 대화해볼까요?',
    },
    trigger: { hour: 20, minute: 0, repeats: true, type: Notifications.SchedulableTriggerInputTypes.DAILY },
  });
}

export async function scheduleReviewReminder(): Promise<void> {
  if (!Notifications) return;
  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_IDS.REVIEW,
    content: {
      title: '오늘 복습할 표현이 있어요 📚',
      body: '퀴즈 탭에서 확인해보세요!',
    },
    trigger: { hour: 10, minute: 0, repeats: true, type: Notifications.SchedulableTriggerInputTypes.DAILY },
  });
}

export async function cancelTodayStreakReminder(): Promise<void> {
  if (!Notifications) return;
  await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_IDS.STREAK);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(20, 0, 0, 0);

  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_IDS.STREAK,
    content: {
      title: '오늘 영어 대화 하셨나요? 🐻',
      body: '곰돌이가 기다리고 있어요!',
    },
    trigger: { date: tomorrow, type: Notifications.SchedulableTriggerInputTypes.DATE },
  });
}

export async function disableAllNotifications(): Promise<void> {
  if (!Notifications) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}
