'use client';

import * as React from 'react';

const SOUND_PREF_KEY = 'sales_copilot_sound_enabled';
const NOTIFICATION_PREF_KEY = 'sales_copilot_notifications_enabled';

export interface NotifyOptions {
  title: string;
  body: string;
  icon?: string;
  onClick?: () => void;
}

/**
 * Synthesizes a pleasant, gentle 2-tone chime using the Web Audio API.
 * Guarantees zero latency and avoids network/file loading issues.
 */
export function playSyntheticChime(): void {
  if (typeof window === 'undefined') return;

  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Tone 1: 587.33 Hz (D5) - soft bell
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.18, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.12);

    // Tone 2: 880.00 Hz (A5) - clear chime
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.0, now + 0.08);
    gain2.gain.setValueAtTime(0.22, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.45);
  } catch {
    // Autoplay policy or unsupported audio context
  }
}

/**
 * Plays audio notification using HTML5 Audio with fallback to Web Audio synthetic chime.
 */
export function playNotificationSound(soundUrl = '/sounds/ding.mp3'): void {
  if (typeof window === 'undefined') return;

  try {
    const audio = new Audio(soundUrl);
    audio.volume = 0.5;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Fallback to synthetic chime if audio file is blocked or unavailable
        playSyntheticChime();
      });
    }
  } catch {
    playSyntheticChime();
  }
}

/**
 * Hook for managing desktop browser notifications and incoming message audio chimes.
 */
export function useBrowserNotifications() {
  const [permission, setPermission] = React.useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });

  const [soundEnabled, setSoundEnabledState] = React.useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(SOUND_PREF_KEY);
      return stored !== null ? stored === 'true' : true;
    }
    return true;
  });

  const [notificationsEnabled, setNotificationsEnabledState] = React.useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(NOTIFICATION_PREF_KEY);
      return stored !== null ? stored === 'true' : true;
    }
    return true;
  });

  const setSoundEnabled = React.useCallback((enabled: boolean) => {
    setSoundEnabledState(enabled);
    if (typeof window !== 'undefined') {
      localStorage.setItem(SOUND_PREF_KEY, String(enabled));
    }
  }, []);

  const setNotificationsEnabled = React.useCallback((enabled: boolean) => {
    setNotificationsEnabledState(enabled);
    if (typeof window !== 'undefined') {
      localStorage.setItem(NOTIFICATION_PREF_KEY, String(enabled));
    }
  }, []);

  const requestPermission = React.useCallback(async (): Promise<NotificationPermission> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }

    try {
      const res = await Notification.requestPermission();
      setPermission(res);
      return res;
    } catch {
      return 'denied';
    }
  }, []);

  const notify = React.useCallback(
    (options: NotifyOptions) => {
      // 1. Play audio chime if enabled
      if (soundEnabled) {
        playNotificationSound();
      }

      // 2. Trigger browser notification if supported, permitted, and tab is inactive
      if (
        typeof window === 'undefined' ||
        !('Notification' in window) ||
        permission !== 'granted' ||
        !notificationsEnabled
      ) {
        return;
      }

      // Only show system notification when tab is blurred or hidden
      const isTabActive =
        typeof document !== 'undefined' && !document.hidden && document.hasFocus();
      if (isTabActive) {
        return;
      }

      try {
        const notification = new Notification(options.title, {
          body: options.body,
          icon: options.icon || '/icon.png',
        });

        if (options.onClick) {
          notification.onclick = () => {
            window.focus();
            notification.close();
            options.onClick?.();
          };
        }
      } catch {
        // Notification construction error fallback
      }
    },
    [permission, soundEnabled, notificationsEnabled],
  );

  return {
    permission,
    soundEnabled,
    notificationsEnabled,
    setSoundEnabled,
    setNotificationsEnabled,
    requestPermission,
    playNotificationSound,
    notify,
  };
}
