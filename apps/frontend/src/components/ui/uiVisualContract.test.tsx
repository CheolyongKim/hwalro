import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Button, { buttonClassName } from './Button';
import Card from './Card';
import PageHeader from './PageHeader';

describe('shared UI visual contract', () => {
  it('uses the shared primary and focus tokens for primary actions', () => {
    const classes = buttonClassName({ variant: 'primary', size: 'md' });
    expect(classes).toContain('bg-primary');
    expect(classes).toContain('focus-visible:ring-focus-ring');
    expect(classes).toContain('rounded-lg');
    expect(classes).not.toContain('scale-');
  });

  it('keeps cards flat by default', () => {
    const html = renderToStaticMarkup(<Card>내용</Card>);
    expect(html).toContain('border-line');
    expect(html).not.toContain('shadow-card');
  });

  it('renders page hierarchy without uppercase eyebrow styling', () => {
    const html = renderToStaticMarkup(
      <PageHeader eyebrow="안전 검토" title="도면 목록" description="등록된 도면" />,
    );
    expect(html).not.toContain('uppercase');
    expect(html).not.toContain('font-black');
  });

  it('disables a loading button', () => {
    const html = renderToStaticMarkup(<Button isLoading>저장</Button>);
    expect(html).toContain('disabled');
  });

  it('keeps projector workspace surfaces light and visibly separated', () => {
    const globalStyles = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');

    expect(globalStyles).toContain('--color-workspace: #eef2f0;');
    expect(globalStyles).toContain('--color-canvas-surround: #dfe6e3;');
    expect(globalStyles).toContain('--color-workspace-panel: #ffffff;');
    expect(globalStyles).toContain('--color-workspace-line: #879690;');
    expect(globalStyles).toContain('--color-workspace-text: #17201e;');
    expect(globalStyles).toContain('--color-workspace-muted: #4f5f5a;');
  });
});
