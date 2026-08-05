import { useEffect, useRef, useState } from 'react';
import type { Vec2 } from '../types';
import { textFontPx } from '../utils/hitTest';

interface InlineTextInputProps {
  point: Vec2;
  zoom: number;
  panX: number;
  panY: number;
  onCommit: (text: string) => void;
  onCancel: () => void;
}

export function InlineTextInput({
  point,
  zoom,
  panX,
  panY,
  onCommit,
  onCancel,
}: InlineTextInputProps) {
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      const input = inputRef.current;
      if (input) {
        input.focus();
        input.select();
      }
    }
  }, [mounted]);

  if (!mounted) {
    return null;
  }

  return (
    <input
      ref={inputRef}
      className="absolute z-10 min-w-20 rounded-sm border-2 border-primary bg-white px-0.5 font-sans text-ink shadow-[0_2px_8px_rgba(0,0,0,0.15)] outline-none"
      style={{
        left: (point.x - panX) * zoom,
        top: (point.y - panY) * zoom,
        fontSize: textFontPx(zoom),
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          onCommit(event.currentTarget.value);
        } else if (event.key === 'Escape') {
          onCancel();
        }
      }}
      onBlur={(event) => onCommit(event.target.value)}
    />
  );
}
