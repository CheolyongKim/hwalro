import { formatDuration } from '../utils/playback';

interface Props {
  currentTimeSeconds: number;
  durationSeconds: number;
  isPlaying: boolean;
  playbackRate: number;
  resultsVisible: boolean;
  onToggle: () => void;
  onSeek: (timeSeconds: number) => void;
  onPlaybackRateChange: (rate: number) => void;
  onRevealResults: () => void;
}

export function PlaybackControls({
  currentTimeSeconds,
  durationSeconds,
  isPlaying,
  playbackRate,
  resultsVisible,
  onToggle,
  onSeek,
  onPlaybackRateChange,
  onRevealResults,
}: Props) {
  const nextPlaybackRate = playbackRate === 1 ? 2 : playbackRate === 2 ? 4 : 1;

  return (
    <div className="playback-controls">
      <button
        type="button"
        className="playback-toggle"
        aria-label={isPlaying ? '일시정지' : '재생'}
        title={isPlaying ? '일시정지' : '재생'}
        onClick={onToggle}
      >
        <span aria-hidden="true">{isPlaying ? 'Ⅱ' : '▶'}</span>
      </button>
      <strong>{formatDuration(currentTimeSeconds)}</strong>
      <input
        aria-label="재생 위치"
        type="range"
        min="0"
        max={durationSeconds}
        step="0.1"
        value={currentTimeSeconds}
        onChange={(event) => onSeek(Number(event.target.value))}
      />
      <span>{formatDuration(durationSeconds)}</span>
      <button
        type="button"
        className="playback-rate"
        aria-label={`현재 ${playbackRate}배속, 다음 재생 속도로 변경`}
        onClick={() => onPlaybackRateChange(nextPlaybackRate)}
      >
        {playbackRate}×
      </button>
      <button
        type="button"
        className={`playback-result ${resultsVisible ? 'is-visible' : ''}`}
        aria-pressed={resultsVisible}
        disabled={resultsVisible}
        onClick={onRevealResults}
      >
        {resultsVisible ? '결과 표시됨' : '결과 보기'}
      </button>
    </div>
  );
}
