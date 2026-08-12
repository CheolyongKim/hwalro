import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader, buttonClassName } from '../../components/ui';

interface SafetyCheckHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  backTo?: string;
  backLabel?: string;
  action?: ReactNode;
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
    <div className="flex flex-col gap-4">
      {backTo && (
        <Link to={backTo} className={buttonClassName({ variant: 'secondary', size: 'sm' })}>
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          {backLabel}
        </Link>
      )}
      <PageHeader eyebrow={eyebrow} title={title} description={description} actions={action} />
    </div>
  );
}
