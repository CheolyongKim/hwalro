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
  backLabel,
  action,
}: SafetyCheckHeaderProps) {
  return (
    <header className="flex flex-col gap-5 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {backTo && (
          <Link
            to={backTo}
            className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-text-muted hover:text-primary"
          >
            <span aria-hidden="true">←</span>
            {backLabel}
          </Link>
        )}
        <p className="text-sm font-bold text-primary">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-ink sm:text-4xl">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-text-muted">{description}</p>
      </div>
      {action}
    </header>
  );
}
