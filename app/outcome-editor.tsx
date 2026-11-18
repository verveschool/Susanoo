'use client';

import { useState, type FormEvent } from 'react';
import { outcomeReasons } from '../lib/workflow.mjs';
import { reasonLabel } from './action-editor';

export type OutcomeTarget = { type: string; id: string; stage: string };
export type DemoOutcome = OutcomeTarget & {
  outcomeId: string;
  supersedes?: string;
  outcome: string;
  reason: string;
  certainty: string;
  context: string;
  source: string;
  evidence: string;
  occurredOn: string;
  nextAction: string;
  actor: string;
};

export function OutcomeEditor({ target, actor, history, onSave }: {
  target: OutcomeTarget;
  actor: string;
  history: DemoOutcome[];
  onSave: (entry: DemoOutcome) => void;
}) {
  const [correction, setCorrection] = useState<DemoOutcome>();
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const corrected = new Set(history.map(entry=>entry.supersedes).filter(Boolean));
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const get = (key: string) => String(data.get(key) ?? '').trim();
    const outcome = get('outcome'), reason = get('reason'), certainty = get('certainty');
    const source = get('source'), evidence = get('evidence'), context = get('context');
    if (!outcome || (reason === 'other' && !context)) {
      setError('Enter the outcome and explain any reason marked Other.'); return;
    }
    if (certainty === 'confirmed' && (!source || !evidence)) {
      setError('Confirmed outcomes require a source and evidence.'); return;
    }
    onSave({ ...target, outcomeId:crypto.randomUUID(), supersedes:correction?.outcomeId, outcome,
      reason, certainty, source, context, evidence, actor, occurredOn:get('occurredOn'), nextAction:get('nextAction') });
    setEditing(false);
    setCorrection(undefined);
    setError('');
  }

  return <section className="section" aria-label="Outcome history">
    <h2>Outcomes and corrections</h2>
    {history.map(entry=><div className="history-entry" key={entry.outcomeId}>
      <strong>{entry.outcome} · {reasonLabel(entry.certainty)}{corrected.has(entry.outcomeId) && ' · Superseded'}</strong>
      <p>{[reasonLabel(entry.reason), entry.occurredOn, entry.stage, entry.actor, entry.context,
        entry.source && `Source: ${entry.source}`, entry.evidence && `Evidence: ${entry.evidence}`,
        entry.nextAction && `Follow-up: ${entry.nextAction}`].filter(Boolean).join(' · ')}</p>
      {!corrected.has(entry.outcomeId) && <button type="button" className="text-button" onClick={()=>{
        setError(''); setCorrection(entry); setEditing(true);
      }}>Correct this outcome</button>}
    </div>)}
    {!editing && <button type="button" className="text-button" onClick={()=>setEditing(true)}>Record an outcome</button>}
    {editing && <form key={correction?.outcomeId ?? 'new'} onSubmit={submit}>
      <label className="field">Outcome<input name="outcome" maxLength={160} required defaultValue={correction?.outcome}/></label>
      <div className="field-pair">
        <label className="field">Reason<select name="reason" defaultValue={correction?.reason ?? 'unknown'}>
          {outcomeReasons[target.type].map(reason=><option key={reason} value={reason}>{reasonLabel(reason)}</option>)}
        </select></label>
        <label className="field">Verification<select name="certainty" defaultValue={correction?.certainty ?? 'unknown'}>
          <option value="unknown">Unknown</option><option value="reported">Reported</option><option value="confirmed">Confirmed</option>
        </select></label>
      </div>
      <label className="field">Date of outcome<input name="occurredOn" type="date" defaultValue={correction?.occurredOn}/></label>
      <label className="field">Source<input name="source" maxLength={120} defaultValue={correction?.source}/></label>
      <label className="field">Evidence<input name="evidence" maxLength={240} defaultValue={correction?.evidence}/></label>
      <label className="field">Factual context<textarea name="context" maxLength={600} defaultValue={correction?.context}/></label>
      <label className="field">Follow-up needed<input name="nextAction" maxLength={240} defaultValue={correction?.nextAction}/></label>
      {error && <p role="alert">{error}</p>}
      <div className="outcome-actions"><button className="verve-primary primary" type="submit">{correction ? 'Save correction' : 'Save outcome'}</button>
      <button type="button" className="outline" onClick={()=>{setEditing(false);setCorrection(undefined);setError('')}}>Discard draft</button></div>
    </form>}
  </section>;
}
