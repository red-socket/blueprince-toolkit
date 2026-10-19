import type { ComponentChildren } from 'preact';
import { pathFor } from '../lib/route';
import { TIER_LABEL, useReveal, type Tier } from '../spoilers';

interface Props {
  id: string;
  tier: Tier;
  /** What the hidden content is about, without giving it away. */
  label: string;
  children: ComponentChildren;
}

/** Hides `children` behind a reveal button until the visitor asks to see them. */
export function Spoiler({ id, tier, label, children }: Props) {
  const [shown, setShown] = useReveal(id);
  if (shown) {
    return (
      <div class="spoiler spoiler--open">
        <button type="button" class="spoiler__hide" onClick={() => setShown(false)}>
          Hide again
        </button>
        {children}
      </div>
    );
  }
  return (
    <div class="spoiler">
      <span class={`tier tier--${tier}`}>{TIER_LABEL[tier]}</span>
      <p>{label}</p>
      <button type="button" class="btn" onClick={() => setShown(true)}>
        Show
      </button>
    </div>
  );
}

interface GateProps {
  id: string;
  tier: Tier;
  title: string;
  warning: string;
  children: ComponentChildren;
}

/** Full-page gate for a tool whose subject is itself a spoiler. */
export function ToolGate({ id, tier, title, warning, children }: GateProps) {
  const [shown, setShown] = useReveal(id);
  if (shown) return <>{children}</>;
  return (
    <section class="gate panel">
      <span class={`tier tier--${tier}`}>{TIER_LABEL[tier]}</span>
      <h1>{title}</h1>
      <p>{warning}</p>
      <div class="gate__actions">
        <button type="button" class="btn btn--primary" onClick={() => setShown(true)}>
          Open the tool
        </button>
        <a class="btn" href={pathFor('')}>
          Back to the toolkit
        </a>
      </div>
    </section>
  );
}
