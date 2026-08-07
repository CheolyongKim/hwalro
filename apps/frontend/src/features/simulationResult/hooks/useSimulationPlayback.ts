import { useCallback, useEffect, useRef, useState } from 'react';

export function useSimulationPlayback(durationSeconds: number) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeSeconds, setCurrentTimeSeconds] = useState(0);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [hasCompletedPlayback, setHasCompletedPlayback] = useState(false);
  const timeRef = useRef(0);
  const previousTimestampRef = useRef<number | null>(null);

  useEffect(() => {
    timeRef.current = currentTimeSeconds;
  }, [currentTimeSeconds]);

  useEffect(() => {
    if (!isPlaying) {
      previousTimestampRef.current = null;
      return;
    }
    let animationFrame = 0;
    let lastUiUpdate = 0;
    const tick = (timestamp: number) => {
      const previous = previousTimestampRef.current ?? timestamp;
      previousTimestampRef.current = timestamp;
      timeRef.current = Math.min(
        durationSeconds,
        timeRef.current + ((timestamp - previous) / 1000) * playbackRate,
      );
      if (timestamp - lastUiUpdate > 33 || timeRef.current >= durationSeconds) {
        setCurrentTimeSeconds(timeRef.current);
        lastUiUpdate = timestamp;
      }
      if (timeRef.current >= durationSeconds) {
        setHasCompletedPlayback(true);
        setIsPlaying(false);
        return;
      }
      animationFrame = window.requestAnimationFrame(tick);
    };
    animationFrame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [durationSeconds, isPlaying, playbackRate]);

  const seek = useCallback(
    (value: number) => {
      const next = Math.min(durationSeconds, Math.max(0, value));
      timeRef.current = next;
      setCurrentTimeSeconds(next);
      previousTimestampRef.current = null;
    },
    [durationSeconds],
  );

  const play = useCallback(() => {
    if (timeRef.current >= durationSeconds) seek(0);
    setIsPlaying(true);
  }, [durationSeconds, seek]);

  return {
    isPlaying,
    currentTimeSeconds,
    playbackRate,
    hasCompletedPlayback,
    play,
    pause: () => setIsPlaying(false),
    toggle: () => (isPlaying ? setIsPlaying(false) : play()),
    seek,
    setPlaybackRate: (rate: number) => setPlaybackRateState(rate),
  };
}
