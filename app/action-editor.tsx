'use client';

import { useState, type FormEvent } from 'react';
import { actionStates, actionTransitions, outcomeReasons, terminalActionStates, validateActionTransition } from '../lib/workflow.mjs';

type Status = keyof typeof actionStates;

export type ActionEntry = {
  id: string;
  title: string;
  owner: string;
  due: string;
  next: string;
  related: string;
  status: Status;
  reason: string;
  priority: string;
  source: string;
  evidence: string;
  blocker?: string;
  blockerOwner?: string;
  reviewDate?: string;
  history: { status: Status; actor: string; at: string; reason: string; note: string; certainty: string; source: string; evidence: string }[];
};

export function reasonLabel(value: string) {
  const label = value.replaceAll('_', ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function ActionEditor({ action, actor, onSave }: {
  action?: ActionEntry;
  actor: string;
  onSave: (next: ActionEntry) => void;
}) {
  const [status, setStatus] = useState<Status>(action?.status ?? 'open');
  const [error, setError] = useState('');
  const closing = action && status !== action.status && terminalActionStates.includes(status);
  const blocking = Boolean(action && status !== action.status && status === 'blocked');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const field = (key: string) => String(form.get(key) ?? '').trim();
    const owner = field('owner');
    const next = field('next');
    const due = field('due');
    const title = action?.title ?? field('title');
    if (!owner || !title || !next || !due) {
      setError('Enter a title, owner, due date and next step.');
      return;
    }
    const input = { blocker: field('blocker'), blockerOwner: field('blockerOwner'), reviewDate: field('reviewDate'),
      reason: field('reason'), outcome: field('outcome') };
    const evidence = field('evidence');
    const source = field('source');
    const confirmationEvidence = field('confirmationEvidence');
    const confirmationSource = field('confirmationSource');
    const certainty = field('certainty') || 'unknown';
    if (action && status !== action.status) {
      const invalid = validateActionTransition(action.status, status, input);
      if (invalid) { setError(invalid); return; }
    }
    if (closing && input.reason === 'other' && !field('context')) {
      setError('Explain the reason when you choose Other.'); return;
    }
    if (closing && certainty === 'confirmed' && (!confirmationSource || !confirmationEvidence)) {
      setError('Enter the confirmation source and evidence, or choose a different verification state.'); return;
    }
    const note = [input.outcome, blocking && `${input.blocker} · ${input.blockerOwner} · Review ${input.reviewDate}`,
      field('context'), action && action.owner !== owner && `Assigned to ${owner}`, `Next: ${next}`].filter(Boolean).join(' · ');
    onSave({
      id: action?.id ?? crypto.randomUUID(), title, owner, due, next, related: action?.related ?? field('related'), status,
      reason: field('actionReason'), priority: field('priority'), source, evidence,
      blocker: blocking ? input.blocker : (status === 'blocked' ? action?.blocker : undefined),
      blockerOwner: blocking ? input.blockerOwner : (status === 'blocked' ? action?.blockerOwner : undefined),
      reviewDate: blocking ? input.reviewDate : (status === 'blocked' ? action?.reviewDate : undefined),
      history: [...(action?.history ?? []), { status, actor, at: new Date().toISOString(),
        reason: input.reason, note, certainty, source: confirmationSource, evidence: confirmationEvidence }],
    });
  }

  return (
    <form onSubmit={submit}>
      {!action && <label className="field">Title<input name="title" required maxLength={120} /></label>}
      {!action && <label className="field">Related demo record reference<input name="related" maxLength={80} /></label>}
      <div className="field-pair">
        <label className="field">Owner<input name="owner" required maxLength={100} defaultValue={action?.owner ?? actor} /></label>
        <label className="field">Due date<input type="date" name="due" required defaultValue={action?.due} /></label>
      </div>
      <label className="field">Why this action exists<input name="actionReason" maxLength={240} defaultValue={action?.reason} /></label>
      <label className="field">Next step<input name="next" required maxLength={240} defaultValue={action?.next} /></label>
      <div className="field-pair">
        <label className="field">Priority<select name="priority" defaultValue={action?.priority ?? 'normal'}>
          <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
        </select></label>
        {action && <label className="field">Status<select name="status" value={status} onChange={event => { setStatus(event.target.value as Status); setError(''); }}>
          {[action.status, ...actionTransitions[action.status]].map(value => <option key={value} value={value}>{actionStates[value as Status]}</option>)}
        </select></label>}
      </div>
      <label className="field">Action source<input name="source" maxLength={120} defaultValue={action?.source} /></label>
      <label className="field">Action evidence or reference<input name="evidence" maxLength={240} defaultValue={action?.evidence} /></label>
      {blocking && <>
        <label className="field">Blocker<input name="blocker" required maxLength={240} /></label>
        <label className="field">Responsible party<input name="blockerOwner" required maxLength={120} /></label>
        <label className="field">Review date<input name="reviewDate" type="date" required /></label>
      </>}
      {closing && <>
        <label className="field">Outcome reason<select name="reason" defaultValue="unknown">{outcomeReasons.action.map(reason => (
          <option key={reason} value={reason}>{reasonLabel(reason)}</option>
        ))}</select></label>
        <label className="field">What happened<textarea name="outcome" required maxLength={600} /></label>
        <label className="field">Verification<select name="certainty" defaultValue="unknown">
          <option value="unknown">Unknown</option><option value="reported">Reported</option><option value="confirmed">Confirmed</option>
        </select></label>
        <label className="field">Outcome source<input name="confirmationSource" maxLength={120} /></label>
        <label className="field">Outcome evidence<input name="confirmationEvidence" maxLength={240} /></label>
      </>}
      {Boolean(blocking || closing) && <label className="field">Context<textarea name="context" maxLength={600} /></label>}
      {error && <p role="alert">{error}</p>}
      <button type="submit" className="verve-primary primary">{action ? 'Save action' : 'Create action'}</button>
    </form>
  );
}
