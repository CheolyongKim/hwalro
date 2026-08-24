import { Check, ChevronRight, X } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { LayoutSearch } from '../api/layoutSearchApi';
import { layoutSearchReplies, type SearchReply } from '../utils/searchFeed';
import { SEARCH_STATUS_LABELS } from '../utils/searchLabels';

interface Props {
  search: LayoutSearch;
}

const REPLY_TONE_CLASSES: Record<SearchReply['tone'], string> = {
  queued: 'text-text-muted',
  running: 'text-text-strong',
  done: 'font-bold text-text-strong',
  failed: 'font-bold text-danger-strong',
};

function ReplyIcon({ tone }: { tone: SearchReply['tone'] }) {
  if (tone === 'running') {
    return (
      <span
        aria-hidden="true"
        className="mt-0.5 block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-primary/25 border-t-primary"
      />
    );
  }
  if (tone === 'queued') {
    return (
      <span
        aria-hidden="true"
        className="mt-0.5 block h-3.5 w-3.5 shrink-0 rounded-full border-2 border-line"
      />
    );
  }
  if (tone === 'failed') {
    return (
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger-strong"
      >
        <X className="h-2.5 w-2.5" strokeWidth={3} />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"
    >
      <Check className="h-2.5 w-2.5" strokeWidth={3} />
    </span>
  );
}

function ReplyRow({ reply }: { reply: SearchReply }) {
  const className =
    'flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left transition hover:bg-background group';
  const content = (
    <>
      <ReplyIcon tone={reply.tone} />
      <span className={`text-xs leading-5 ${REPLY_TONE_CLASSES[reply.tone]}`}>{reply.text}</span>
      {reply.simulationId !== null && (
        <ChevronRight
          aria-hidden="true"
          className="ml-auto h-3.5 w-3.5 shrink-0 text-text-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
        />
      )}
    </>
  );

  if (reply.simulationId === null) {
    return <div className={className}>{content}</div>;
  }
  return (
    <Link
      to={`/simulations/${reply.simulationId}/results`}
      className={`${className} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring`}
    >
      {content}
      <span className="sr-only">결과 화면으로 이동</span>
    </Link>
  );
}

export function LayoutSearchReplyThread({ search }: Props) {
  const replies = layoutSearchReplies(search);
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3" aria-live="polite">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold tracking-wide text-text-strong">배치 개선안 찾기</span>
        <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-bold text-text-muted">
          {SEARCH_STATUS_LABELS[search.status]}
        </span>
      </div>
      <ul role="list" className="mt-2 space-y-1 border-l border-line pl-3">
        {replies.map((reply) => (
          <li key={reply.key}>
            <ReplyRow reply={reply} />
          </li>
        ))}
      </ul>
    </div>
  );
}
