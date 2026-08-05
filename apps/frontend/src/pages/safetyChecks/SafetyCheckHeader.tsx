import { Link } from 'react-router-dom';

interface SafetyCheckHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  backTo?: string;
  backLabel?: string;
  action?: React.ReactNode;
}

export default function SafetyCheckHeader({
  eyebrow,
  title,
  description,
  backTo,
  backLabel = '이전 화면으로 돌아가기',
  action,
}: SafetyCheckHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {backTo && (
          <Link
            to={backTo}
            className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:text-primary/80"
          >
            <span aria-hidden="true">←</span>
            {backLabel}
          </Link>
        )}
        {!backTo && <p className="text-sm font-bold text-primary">{eyebrow}</p>}
        <h1 className="mt-2 text-3xl font-black tracking-tight text-ink sm:text-4xl">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-text-muted">{description}</p>
      </div>
      {action}
    </header>
  );
}
