/** Local synthetic development store. Never expose directly to the browser or use for real data.
 * Actor objects must originate from a verified server-side session; caller-supplied roles are unsafe.
 * Partner access is denied by default until explicit sharing and database policies exist.
 */
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { upgradeOperationalSchema } from './operational-schema.mjs';
import { outcomeReasons, requirementTransitions, terminalActionStates, validateActionTransition, workflowDate } from './workflow.mjs';

const permitted={executive:new Set(['read','operate','finance']),talent_ops:new Set(['read','operate']),finance:new Set(['read','finance'])};
function requireCapability(actor,cap){if(!actor?.id || !permitted[actor.role]?.has(cap)) throw new Error('FORBIDDEN');}
function validText(v,field){if(typeof v!=='string'||!v.trim())throw new Error(`${field} is required`);return v.trim()}
function integer(v){if(!Number.isSafeInteger(v)||v<=0)throw new Error('Amount must be positive integer minor units');return v}
function currency(v){if(!/^[A-Z]{3}$/.test(v||''))throw new Error('Currency must be an ISO code');return v}
const outcomeTables = {
 application: 'consideration', introduction: 'introduction', requirement: 'requirement',
 interview: 'interview', placement: 'placement', action: 'action',
 commercial: 'invoice', collection: 'invoice',
};
const financialOutcome = type => type === 'commercial' || type === 'collection';
const requireOutcomeAccess = (actor, type) => requireCapability(actor, financialOutcome(type) ? 'finance' : 'operate');
const checkVersion = (record, expected) => {
 if (!record) throw new Error('NOT_FOUND');
 if (expected !== record.version) throw new Error('STALE_RECORD');
};
const requiredDate = (value, field) => {
 if (!workflowDate(value)) throw new Error(`Valid ${field} is required`);
 return value;
};
const certainty=new Set(['confirmed','reported','disputed','unknown']);
const stamp=()=>new Date().toISOString();
export class OperationalStore {
 #db;
 constructor(path=':memory:'){
  this.#db=new DatabaseSync(path); this.#db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  this.#db.exec(`
   CREATE TABLE IF NOT EXISTS partner(id TEXT PRIMARY KEY,name TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS legal_entity(id TEXT PRIMARY KEY,name TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS partner_entity(partner_id TEXT NOT NULL REFERENCES partner(id),entity_id TEXT NOT NULL REFERENCES legal_entity(id),PRIMARY KEY(partner_id,entity_id));
   CREATE TABLE IF NOT EXISTS agreement(id TEXT PRIMARY KEY,partner_id TEXT NOT NULL REFERENCES partner(id),entity_id TEXT NOT NULL REFERENCES legal_entity(id), FOREIGN KEY(partner_id,entity_id) REFERENCES partner_entity(partner_id,entity_id));
   CREATE TABLE IF NOT EXISTS agreement_version(id TEXT PRIMARY KEY,agreement_id TEXT NOT NULL REFERENCES agreement(id),label TEXT NOT NULL,UNIQUE(id,agreement_id));
   CREATE TABLE IF NOT EXISTS requirement(id TEXT PRIMARY KEY,partner_id TEXT NOT NULL REFERENCES partner(id),agreement_id TEXT NOT NULL REFERENCES agreement(id),agreement_version_id TEXT NOT NULL,title TEXT NOT NULL,owner TEXT NOT NULL,FOREIGN KEY(agreement_version_id,agreement_id) REFERENCES agreement_version(id,agreement_id));
   CREATE TABLE IF NOT EXISTS candidate(id TEXT PRIMARY KEY,display_name TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS consideration(id TEXT PRIMARY KEY,candidate_id TEXT NOT NULL REFERENCES candidate(id),requirement_id TEXT NOT NULL REFERENCES requirement(id),stage TEXT NOT NULL,UNIQUE(candidate_id,requirement_id));
   CREATE TABLE IF NOT EXISTS introduction(id TEXT PRIMARY KEY,consideration_id TEXT NOT NULL REFERENCES consideration(id),evidence TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS interview(id TEXT PRIMARY KEY,introduction_id TEXT NOT NULL REFERENCES introduction(id),scheduled_at TEXT, status TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS placement(id TEXT PRIMARY KEY,consideration_id TEXT NOT NULL REFERENCES consideration(id),agreement_id TEXT NOT NULL,agreement_version_id TEXT NOT NULL,actual_date TEXT NOT NULL,evidence TEXT NOT NULL,FOREIGN KEY(agreement_version_id,agreement_id) REFERENCES agreement_version(id,agreement_id));
   CREATE TABLE IF NOT EXISTS outcome(id TEXT PRIMARY KEY,record_type TEXT NOT NULL,record_id TEXT NOT NULL,outcome TEXT NOT NULL,reason TEXT NOT NULL,context TEXT NOT NULL,evidence TEXT NOT NULL,reported_by TEXT NOT NULL,recorded_by TEXT NOT NULL,certainty TEXT NOT NULL,next_action TEXT NOT NULL,end_date TEXT, replacement_review TEXT,created_at TEXT NOT NULL,supersedes TEXT REFERENCES outcome(id));
   CREATE TABLE IF NOT EXISTS action(id TEXT PRIMARY KEY,subject TEXT NOT NULL,action_type TEXT NOT NULL,owner TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('open','completed')),due TEXT NOT NULL,next_action TEXT NOT NULL,evidence TEXT NOT NULL,updated_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS action_event(id TEXT PRIMARY KEY,action_id TEXT NOT NULL REFERENCES action(id),kind TEXT NOT NULL,actor TEXT NOT NULL,recorded_at TEXT NOT NULL,detail TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS entitlement(id TEXT PRIMARY KEY,placement_id TEXT NOT NULL REFERENCES placement(id),agreement_version_id TEXT NOT NULL REFERENCES agreement_version(id),estimated INTEGER NOT NULL CHECK(estimated>=0),earned INTEGER NOT NULL CHECK(earned>=0),currency TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS invoice(id TEXT PRIMARY KEY,partner_id TEXT NOT NULL REFERENCES partner(id),agreement_version_id TEXT NOT NULL REFERENCES agreement_version(id),number TEXT NOT NULL UNIQUE,gross INTEGER NOT NULL CHECK(gross>0),currency TEXT NOT NULL,due TEXT,issued_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS invoice_line(id TEXT PRIMARY KEY,invoice_id TEXT NOT NULL REFERENCES invoice(id),entitlement_id TEXT NOT NULL REFERENCES entitlement(id),amount INTEGER NOT NULL CHECK(amount>0));
   CREATE TABLE IF NOT EXISTS receipt(id TEXT PRIMARY KEY,reference TEXT NOT NULL,received_at TEXT NOT NULL,amount INTEGER NOT NULL CHECK(amount>0),currency TEXT NOT NULL,UNIQUE(reference,received_at,amount,currency));
   CREATE TABLE IF NOT EXISTS allocation(id TEXT PRIMARY KEY,receipt_id TEXT NOT NULL REFERENCES receipt(id),invoice_id TEXT NOT NULL REFERENCES invoice(id),amount INTEGER NOT NULL CHECK(amount>0),created_at TEXT NOT NULL,actor TEXT NOT NULL,idempotency_key TEXT NOT NULL UNIQUE);
   CREATE TABLE IF NOT EXISTS allocation_reversal(id TEXT PRIMARY KEY,allocation_id TEXT NOT NULL UNIQUE REFERENCES allocation(id),reason TEXT NOT NULL,actor TEXT NOT NULL,created_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,record_id TEXT NOT NULL,at TEXT NOT NULL);
  `);
  try { upgradeOperationalSchema(this.#db); } catch (error) { this.#db.close(); throw error; }
 }
 close(){this.#db.close()}
 #run(q,...params){return this.#db.prepare(q).run(...params)}
 #one(q,...params){return this.#db.prepare(q).get(...params)}
 #all(q,...params){return this.#db.prepare(q).all(...params)}
 #transaction(f){this.#db.exec('BEGIN IMMEDIATE');try{const x=f();this.#db.exec('COMMIT');return x}catch(e){this.#db.exec('ROLLBACK');throw e}}
 #event(actor,kind,id){this.#run('INSERT INTO audit VALUES(?,?,?,?,?)',randomUUID(),actor.id,kind,id,stamp())}
 createAccount(actor,{partnerName,entityName,agreementLabel}){requireCapability(actor,'operate');return this.#transaction(()=>{let p=randomUUID(),e=randomUUID(),a=randomUUID(),v=randomUUID();this.#run('INSERT INTO partner(id,name,owner) VALUES(?,?,?)',p,validText(partnerName,'partnerName'),actor.id);this.#run('INSERT INTO legal_entity VALUES(?,?)',e,validText(entityName,'entityName'));this.#run('INSERT INTO partner_entity VALUES(?,?)',p,e);this.#run('INSERT INTO agreement VALUES(?,?,?)',a,p,e);this.#run('INSERT INTO agreement_version(id,agreement_id,label) VALUES(?,?,?)',v,a,validText(agreementLabel,'agreementLabel'));this.#event(actor,'create_account',p);return {partnerId:p,entityId:e,agreementId:a,versionId:v}})}
 createRequirement(actor,{partnerId,agreementId,versionId,title,owner}){requireCapability(actor,'operate');const a=this.#one('SELECT partner_id FROM agreement WHERE id=?',agreementId);if(!a||a.partner_id!==partnerId)throw new Error('PARTNER_AGREEMENT_MISMATCH');return this.#transaction(()=>{const id=randomUUID();this.#run('INSERT INTO requirement(id,partner_id,agreement_id,agreement_version_id,title,owner) VALUES(?,?,?,?,?,?)',id,partnerId,agreementId,versionId,validText(title,'title'),validText(owner,'owner'));this.#event(actor,'create_requirement',id);return id})}
 addCandidate(actor,name){requireCapability(actor,'operate');return this.#transaction(()=>{const id=randomUUID();this.#run('INSERT INTO candidate VALUES(?,?)',id,validText(name,'name'));this.#event(actor,'create_candidate',id);return id})}
 consider(actor,candidateId,requirementId){requireCapability(actor,'operate');return this.#transaction(()=>{const id=randomUUID();this.#run('INSERT INTO consideration VALUES(?,?,?,?)',id,candidateId,requirementId,'new');this.#event(actor,'create_consideration',id);return id})}
 setStage(actor,id,stage){requireCapability(actor,'operate');if(!['new','assessing','introduced','interviewing','offer','closed'].includes(stage))throw new Error('INVALID_STAGE');return this.#transaction(()=>{const current=this.#one('SELECT stage FROM consideration WHERE id=?',id);if(!current)throw new Error('NOT_FOUND');if(current.stage==='closed'&&stage!=='closed')throw new Error('REOPEN_REQUIRES_REVIEW');this.#run('UPDATE consideration SET stage=? WHERE id=?',stage,id);this.#event(actor,`transition:${current.stage}:${stage}`,id)})}
 introduce(actor, considerationId, input) {
  requireCapability(actor, 'operate');
  const details = typeof input === 'string' ? { evidence: input } : input;
  return this.#transaction(() => {
   const consideration = this.#one('SELECT stage FROM consideration WHERE id=?', considerationId);
   if (!consideration) throw new Error('NOT_FOUND');
   if (consideration.stage === 'closed') throw new Error('REOPEN_REQUIRES_REVIEW');
   const id = randomUUID();
   this.#run('INSERT INTO introduction(id,consideration_id,evidence,introduced_on,method,follow_up_owner) VALUES(?,?,?,?,?,?)',
    id, considerationId, validText(details.evidence, 'evidence'),
    details.introducedOn ? requiredDate(details.introducedOn, 'introduction date') : null,
    details.method || null, details.followUpOwner || null);
   this.#event(actor, 'introduce', id);
   return id;
  });
 }
 introductionHistory(actor, considerationId) {
  requireCapability(actor, 'operate');
  return this.#all(`SELECT i.*, r.id AS requirement_id, r.partner_id FROM introduction i
   JOIN consideration c ON c.id=i.consideration_id JOIN requirement r ON r.id=c.requirement_id
   WHERE i.consideration_id=? ORDER BY i.rowid`, considerationId);
 }
 interview(actor,introductionId,scheduledAt){requireCapability(actor,'operate');return this.#transaction(()=>{const id=randomUUID();this.#run('INSERT INTO interview VALUES(?,?,?,?)',id,introductionId,scheduledAt||null,'scheduled');this.#event(actor,'interview',id);return id})}
 place(actor,{considerationId,actualDate,evidence}){requireCapability(actor,'operate');const r=this.#one('SELECT r.agreement_id,r.agreement_version_id FROM consideration c JOIN requirement r ON r.id=c.requirement_id WHERE c.id=?',considerationId);if(!r)throw new Error('NOT_FOUND');return this.#transaction(()=>{const id=randomUUID();this.#run('INSERT INTO placement VALUES(?,?,?,?,?,?)',id,considerationId,r.agreement_id,r.agreement_version_id,validText(actualDate,'actualDate'),validText(evidence,'evidence'));this.#event(actor,'place',id);return id})}
 #recordOutcome(actor, x) {
  const reason = x.reason || 'unknown';
  const verification = x.certainty || 'unknown';
  const type = x.recordType;
  if (!outcomeReasons[type]?.includes(reason) || !certainty.has(verification)) throw new Error('INVALID_OUTCOME');
  if (!this.#one(`SELECT id FROM ${outcomeTables[type]} WHERE id=?`, x.recordId)) throw new Error('NOT_FOUND');
  if (x.supersedes) {
   const prior = this.#one('SELECT record_type,record_id FROM outcome WHERE id=?', x.supersedes);
   if (!prior || prior.record_type !== type || prior.record_id !== x.recordId) throw new Error('INVALID_CORRECTION');
   if (this.#one('SELECT id FROM outcome WHERE supersedes=?', x.supersedes)) throw new Error('STALE_CORRECTION');
  }
  if (reason === 'other') validText(x.context, 'explanation');
  if (verification === 'confirmed') {
   validText(x.reportedBy, 'source');
   validText(x.evidence, 'confirmation evidence');
  }
  if (type === 'placement' && x.outcome === 'ended' && (!x.endDate || !x.reportedBy)) {
   throw new Error('END_DATE_AND_SOURCE_REQUIRED');
  }
  if (x.endDate) requiredDate(x.endDate, 'end date');
  const occurredOn = x.occurredOn ? requiredDate(x.occurredOn, 'outcome date') : null;
  if (x.followUpId) {
   const followUp = this.#one('SELECT subject,subject_type FROM action WHERE id=?', x.followUpId);
   if (!followUp || followUp.subject !== x.recordId || followUp.subject_type !== type) throw new Error('INVALID_FOLLOW_UP');
  }
  const id = randomUUID();
  this.#run(`INSERT INTO outcome(id,record_type,record_id,outcome,reason,context,evidence,reported_by,recorded_by,
   certainty,next_action,end_date,replacement_review,created_at,supersedes,stage,occurred_on,follow_up_id)
   VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, id, type, x.recordId, validText(x.outcome, 'outcome'), reason,
   x.context || '', x.evidence || '', x.reportedBy || '', actor.id, verification, x.nextAction || '',
   x.endDate || null, x.replacementReview || null, stamp(), x.supersedes || null, x.stage || null, occurredOn, x.followUpId || null);
  this.#event(actor, x.supersedes ? 'correct_outcome' : 'record_outcome', id);
  return id;
 }
 recordOutcome(actor, input) {
  requireOutcomeAccess(actor, input.recordType);
  return this.#transaction(() => {
   if (input.recordType === 'action') {
    const related = this.#one('SELECT subject_type FROM action WHERE id=?', input.recordId);
    if (related?.subject_type) requireOutcomeAccess(actor, related.subject_type);
   }
   return this.#recordOutcome(actor, input);
  });
 }
 addAction(actor, x) {
  requireCapability(actor, 'operate');
  const subject = validText(x.subject, 'subject');
  if (x.subjectType) {
   const table = outcomeTables[x.subjectType];
   if (!table || x.subjectType === 'action') throw new Error('INVALID_SUBJECT');
   requireOutcomeAccess(actor, x.subjectType);
   if (!this.#one(`SELECT id FROM ${table} WHERE id=?`, subject)) throw new Error('INVALID_SUBJECT');
  }
  return this.#transaction(() => {
   const id = randomUUID(), at = stamp();
   this.#run(`INSERT INTO action(id,subject,action_type,owner,status,due,next_action,evidence,updated_at,reason,source,priority,subject_type)
    VALUES(?,?,?,?,'open',?,?,?,?,?,?,?,?)`, id, subject, validText(x.actionType, 'actionType'),
    validText(x.owner, 'owner'), requiredDate(x.due, 'due date'), validText(x.nextAction, 'nextAction'),
    x.evidence || '', at, x.reason || '', x.source || '', x.priority || 'normal', x.subjectType || null);
   this.#actionEvent(actor, id, 'created', at, '');
   return id;
  });
 }
 #actionEvent(actor, id, kind, at, detail) {
  this.#run('INSERT INTO action_event VALUES(?,?,?,?,?,?)', randomUUID(), id, kind, actor.id, at, detail);
  this.#event(actor, kind === 'created' ? 'create_action' : kind, id);
 }
 transitionAction(actor, id, input) {
  requireCapability(actor, 'operate');
  return this.#transaction(() => {
   const previous = this.#one('SELECT * FROM action WHERE id=?', id);
   checkVersion(previous, input.expectedVersion);
   if (previous.subject_type) requireOutcomeAccess(actor, previous.subject_type);
   const error = validateActionTransition(previous.status, input.status, input);
   if (error) throw new Error(`INVALID_TRANSITION: ${error}`);
   const at = stamp(), blocked = input.status === 'blocked';
   this.#run(`UPDATE action SET status=?,next_action=?,blocker=?,blocker_owner=?,review_date=?,version=version+1,updated_at=? WHERE id=?`,
    input.status, input.nextAction?.trim() || previous.next_action, blocked ? input.blocker.trim() : null,
    blocked ? input.blockerOwner.trim() : null, blocked ? input.reviewDate : null, at, id);
   this.#actionEvent(actor, id, 'status_changed', at, JSON.stringify({
    from: previous.status, to: input.status, blocker: blocked ? input.blocker.trim() : null,
    blockerOwner: blocked ? input.blockerOwner.trim() : null, reviewDate: blocked ? input.reviewDate : null,
    context: input.context || '', nextAction: input.nextAction || previous.next_action,
   }));
   if (terminalActionStates.includes(input.status)) {
    this.#recordOutcome(actor, { ...input, recordType: 'action', recordId: id, stage: previous.status,
     occurredOn: input.occurredOn || at.slice(0,10) });
   }
   return this.#one('SELECT * FROM action WHERE id=?', id);
  });
 }
 // Compatibility for existing local demo callers. New callers use transitionAction with a version and outcome.
 changeAction(actor, id, kind, value = '') {
  requireCapability(actor, 'operate');
  if (!['complete','reopen','assign'].includes(kind)) throw new Error('INVALID_ACTION');
  return this.#transaction(() => {
   const prior = this.#one('SELECT * FROM action WHERE id=?', id);
   if (!prior) throw new Error('NOT_FOUND');
   if (prior.subject_type) requireOutcomeAccess(actor, prior.subject_type);
   if (kind === 'complete' && prior.status !== 'open' || kind === 'reopen' && prior.status !== 'completed') throw new Error('INVALID_TRANSITION');
   const at = stamp(), status = kind === 'complete' ? 'completed' : kind === 'reopen' ? 'open' : prior.status;
   const owner = kind === 'assign' ? validText(value,'owner') : prior.owner;
   this.#run('UPDATE action SET status=?,owner=?,updated_at=?,version=version+1 WHERE id=?',status,owner,at,id);
   this.#actionEvent(actor, id, kind, at, value);
   if (kind === 'complete') this.#recordOutcome(actor, {
    recordType:'action', recordId:id, outcome:'Completed via the original action workflow',
    reason:'unknown', occurredOn:at.slice(0,10),
   });
  });
 }
 followUpQueue(actor, asOf) {
  requireCapability(actor, 'operate');
  requiredDate(asOf, 'queue date');
  return this.listActions(actor).filter(action =>
   action.status === 'blocked' || (['open', 'in_progress'].includes(action.status) && action.due <= asOf)
  ).sort((a, b) => {
   const rank = { urgent:0, high:1, normal:2, low:3 };
   return rank[a.priority] - rank[b.priority] || (a.review_date || a.due).localeCompare(b.review_date || b.due);
  });
 }
 transitionRequirement(actor, id, input) {
  requireCapability(actor, 'operate');
  return this.#transaction(() => {
   const prior = this.#one('SELECT * FROM requirement WHERE id=?', id);
   checkVersion(prior, input.expectedVersion);
   if (!requirementTransitions[prior.status]?.includes(input.status)) throw new Error('INVALID_TRANSITION');
   this.#run('UPDATE requirement SET status=?, version=version+1 WHERE id=?', input.status, id);
   this.#event(actor, `requirement:${prior.status}:${input.status}`, id);
   if (['filled', 'paused', 'cancelled', 'unsuccessful'].includes(input.status)) {
    this.#recordOutcome(actor, { ...input, recordType:'requirement', recordId:id, stage:prior.status, outcome:input.status });
   }
   return this.#one('SELECT * FROM requirement WHERE id=?', id);
  });
 }
 addCriterion(actor, { requirementId, label, relevance }) {
  requireCapability(actor, 'operate');
  return this.#transaction(() => {
   const id = randomUUID();
   this.#run('INSERT INTO assessment_criterion VALUES(?,?,?,?)', id, requirementId,
    validText(label,'criterion'), validText(relevance,'role relevance'));
   this.#event(actor, 'assessment_criterion', id);
   return id;
  });
 }
 recordAssessment(actor, x) {
  requireCapability(actor, 'operate');
  return this.#transaction(() => {
   if (!this.#one(`SELECT c.id FROM consideration c JOIN assessment_criterion a
    ON a.requirement_id=c.requirement_id WHERE c.id=? AND a.id=?`, x.considerationId, x.criterionId)) {
    throw new Error('CRITERION_REQUIREMENT_MISMATCH');
   }
   const id = randomUUID();
   this.#run('INSERT INTO assessment_review VALUES(?,?,?,?,?,?,?,?,?,?)', id, x.considerationId, x.criterionId,
    validText(x.observation,'observation'), validText(x.evidence,'evidence'), x.limitation || null,
    actor.id, requiredDate(x.reviewedOn,'review date'), x.recommendation || null,
    x.recommendation ? validText(x.recommendationReason, 'recommendation reason') : null);
   this.#event(actor, 'assessment_review', id);
   return id;
  });
 }
 listAssessments(actor, considerationId) {
  requireCapability(actor, 'operate');
  return this.#all(`SELECT review.*, criterion.label, criterion.relevance FROM assessment_review review
   JOIN assessment_criterion criterion ON criterion.id=review.criterion_id
   WHERE review.consideration_id=? ORDER BY review.rowid`, considerationId);
 }
 addLegalEntity(actor, partnerId, { name, existingEntityId }) {
  requireCapability(actor, 'operate');
  return this.#transaction(() => {
   const id = existingEntityId || randomUUID();
   if (!existingEntityId) this.#run('INSERT INTO legal_entity VALUES(?,?)', id, validText(name,'entity name'));
   this.#run('INSERT INTO partner_entity VALUES(?,?)', partnerId, id);
   this.#event(actor, 'link_legal_entity', id);
   return id;
  });
 }
 addAgreement(actor, { partnerId, entityId }) {
  requireCapability(actor, 'operate');
  return this.#transaction(() => {
   const id = randomUUID();
   this.#run('INSERT INTO agreement VALUES(?,?,?)', id, partnerId, entityId);
   this.#event(actor, 'create_agreement', id);
   return id;
  });
 }
 addAgreementVersion(actor, { agreementId, label, executionState = 'unverified', termsReference }) {
  requireCapability(actor, 'operate');
  if (!['unverified', 'draft', 'executed', 'expired'].includes(executionState)) throw new Error('INVALID_AGREEMENT_STATE');
  if (executionState === 'executed') validText(termsReference, 'executed terms reference');
  return this.#transaction(() => {
   const id = randomUUID();
   this.#run('INSERT INTO agreement_version(id,agreement_id,label,execution_state,terms_reference) VALUES(?,?,?,?,?)',
    id, agreementId, validText(label,'version label'), executionState, termsReference || null);
   this.#event(actor, 'agreement_version', id);
   return id;
  });
 }
 partnerRelationships(actor, partnerId) {
  requireCapability(actor, 'operate');
  return this.#all(`SELECT e.id AS entity_id, e.name AS entity_name, a.id AS agreement_id,
   v.id AS version_id, v.label, v.execution_state, v.terms_reference
   FROM partner_entity pe JOIN legal_entity e ON e.id=pe.entity_id
   LEFT JOIN agreement a ON a.partner_id=pe.partner_id AND a.entity_id=e.id
   LEFT JOIN agreement_version v ON v.agreement_id=a.id WHERE pe.partner_id=?
   ORDER BY e.name, v.rowid`, partnerId);
 }
 getConsideration(actor,id){requireCapability(actor,'operate');return this.#one('SELECT * FROM consideration WHERE id=?',id)}
 invoiceBalance(actor,id){requireCapability(actor,'finance');return this.#balance(id)}
 listActions(actor,filter={}){requireCapability(actor,'operate');let list=this.#all('SELECT * FROM action ORDER BY due,id');return list.filter(a=>(!financialOutcome(a.subject_type)||permitted[actor.role].has('finance'))&&(!filter.owner||a.owner===filter.owner)&&(!filter.status||a.status===filter.status)&&(!filter.due||a.due===filter.due))}
 actionHistory(actor,id){requireCapability(actor,'operate');const action=this.#one('SELECT subject_type FROM action WHERE id=?',id);if(action?.subject_type)requireOutcomeAccess(actor,action.subject_type);return this.#all('SELECT * FROM action_event WHERE action_id=? ORDER BY rowid',id)}
 listOutcomes(actor,recordType,recordId){requireOutcomeAccess(actor,recordType);if(recordType==='action'){const action=this.#one('SELECT subject_type FROM action WHERE id=?',recordId);if(action?.subject_type)requireOutcomeAccess(actor,action.subject_type)}return this.#all('SELECT * FROM outcome WHERE record_type=? AND record_id=? ORDER BY rowid',recordType,recordId)}
 outcomeReport(actor, recordType) {
  requireOutcomeAccess(actor, recordType);
  if (!outcomeReasons[recordType]) throw new Error('INVALID_OUTCOME');
  return this.#all(`SELECT o.reason,o.certainty,COUNT(*) AS reports FROM outcome o
   WHERE o.record_type=? AND NOT EXISTS (SELECT 1 FROM outcome correction WHERE correction.supersedes=o.id)
   AND (? OR o.record_type<>'action' OR NOT EXISTS (SELECT 1 FROM action a WHERE a.id=o.record_id AND a.subject_type IN ('commercial','collection')))
   GROUP BY o.reason,o.certainty ORDER BY o.reason,o.certainty`, recordType, Number(permitted[actor.role].has('finance')));
 }
 createEntitlement(actor,{placementId,estimated,earned,currency:cur,basis}){requireCapability(actor,'finance');if(!Number.isSafeInteger(estimated)||estimated<0||!Number.isSafeInteger(earned)||earned<0)throw new Error('INVALID_AMOUNT');let p=this.#one('SELECT agreement_version_id FROM placement WHERE id=?',placementId);if(!p)throw new Error('NOT_FOUND');return this.#transaction(()=>{const id=randomUUID();this.#run('INSERT INTO entitlement(id,placement_id,agreement_version_id,estimated,earned,currency,basis) VALUES(?,?,?,?,?,?,?)',id,placementId,p.agreement_version_id,estimated,earned,currency(cur),basis||null);this.#event(actor,'entitlement',id);return id})}
 createInvoice(actor,{entitlementId,number,gross,currency:cur,due}){requireCapability(actor,'finance');integer(gross);currency(cur);const e=this.#one('SELECT e.*,r.partner_id FROM entitlement e JOIN placement p ON p.id=e.placement_id JOIN consideration c ON c.id=p.consideration_id JOIN requirement r ON r.id=c.requirement_id WHERE e.id=?',entitlementId);if(!e||e.currency!==cur)throw new Error('INVALID_ENTITLEMENT');return this.#transaction(()=>{const id=randomUUID();this.#run('INSERT INTO invoice VALUES(?,?,?,?,?,?,?,?)',id,e.partner_id,e.agreement_version_id,validText(number,'number'),gross,cur,due||null,stamp());this.#run('INSERT INTO invoice_line VALUES(?,?,?,?)',randomUUID(),id,entitlementId,gross);this.#event(actor,'invoice',id);return id})}
 recordReceipt(actor,{reference,receivedAt,amount,currency:cur}){requireCapability(actor,'finance');return this.#transaction(()=>{const id=randomUUID();this.#run('INSERT INTO receipt VALUES(?,?,?,?,?)',id,validText(reference,'reference'),validText(receivedAt,'receivedAt'),integer(amount),currency(cur));this.#event(actor,'receipt',id);return id})}
 #balance(invoiceId){return this.#one('SELECT i.*,i.gross+COALESCE((SELECT SUM(amount) FROM invoice_adjustment WHERE invoice_id=i.id),0)-COALESCE((SELECT SUM(a.amount) FROM allocation a LEFT JOIN allocation_reversal r ON r.allocation_id=a.id WHERE a.invoice_id=i.id AND r.id IS NULL),0) AS open FROM invoice i WHERE i.id=?',invoiceId)}
 allocate(actor,{receiptId,invoiceId,amount,key}){requireCapability(actor,'finance');integer(amount);validText(key,'key');return this.#transaction(()=>{const existing=this.#one('SELECT * FROM allocation WHERE idempotency_key=?',key);if(existing){if(existing.receipt_id!==receiptId||existing.invoice_id!==invoiceId||existing.amount!==amount)throw new Error('IDEMPOTENCY_CONFLICT');return existing.id}const receipt=this.#one('SELECT * FROM receipt WHERE id=?',receiptId),invoice=this.#balance(invoiceId);if(!receipt||!invoice||receipt.currency!==invoice.currency)throw new Error('INVALID_ALLOCATION');const used=this.#one('SELECT COALESCE(SUM(a.amount),0) AS n FROM allocation a LEFT JOIN allocation_reversal r ON r.allocation_id=a.id WHERE a.receipt_id=? AND r.id IS NULL',receiptId).n;if(amount>receipt.amount-used||amount>invoice.open)throw new Error('OVER_ALLOCATION');const id=randomUUID();this.#run('INSERT INTO allocation VALUES(?,?,?,?,?,?,?)',id,receiptId,invoiceId,amount,stamp(),actor.id,key);this.#event(actor,'allocate',id);return id})}
 reverseAllocation(actor,id,reason){requireCapability(actor,'finance');return this.#transaction(()=>{const a=this.#one('SELECT id FROM allocation WHERE id=?',id);if(!a)throw new Error('NOT_FOUND');const reversal=randomUUID();this.#run('INSERT INTO allocation_reversal VALUES(?,?,?,?,?)',reversal,id,validText(reason,'reason'),actor.id,stamp());this.#event(actor,'reverse_allocation',reversal);return reversal})}
 invoiceTrace(actor, id) {
  requireCapability(actor, 'finance');
  const invoice = this.#balance(id);
  if (!invoice) throw new Error('NOT_FOUND');
  const agreement = this.#one(`SELECT v.*, a.id AS agreement_id, e.id AS legal_entity_id, e.name AS legal_entity
   FROM agreement_version v JOIN agreement a ON a.id=v.agreement_id JOIN legal_entity e ON e.id=a.entity_id
   WHERE v.id=?`, invoice.agreement_version_id);
  const lines = this.#all(`SELECT l.*, e.basis, e.estimated, e.earned, e.placement_id, p.actual_date, p.evidence
   FROM invoice_line l JOIN entitlement e ON e.id=l.entitlement_id JOIN placement p ON p.id=e.placement_id
   WHERE l.invoice_id=? ORDER BY l.rowid`, id);
  const receipts = this.#all(`SELECT a.*, r.reference, r.received_at, r.amount AS receipt_amount,
    rev.id AS reversal_id, rev.reason AS reversal_reason, rev.created_at AS reversed_at
   FROM allocation a JOIN receipt r ON r.id=a.receipt_id LEFT JOIN allocation_reversal rev ON rev.allocation_id=a.id
   WHERE a.invoice_id=? ORDER BY a.rowid`, id);
  const adjustments = this.#all('SELECT * FROM invoice_adjustment WHERE invoice_id=? ORDER BY rowid', id);
  return { invoice, agreement, lines, receipts, adjustments };
 }
 adjustInvoice(actor, id, input) {
  requireCapability(actor, 'finance');
  return this.#transaction(() => {
   const invoice = this.#balance(id);
   if (!invoice) throw new Error('NOT_FOUND');
   let amount = input.amount;
   if (input.reverses) {
    const prior = this.#one('SELECT * FROM invoice_adjustment WHERE id=? AND invoice_id=?', input.reverses, id);
    if (!prior || prior.reversal_of) throw new Error('INVALID_REVERSAL');
    amount = -prior.amount;
   }
   if (!Number.isSafeInteger(amount) || amount === 0 || !Number.isSafeInteger(invoice.open + amount) || invoice.open + amount < 0) {
    throw new Error('INVALID_ADJUSTMENT');
   }
   const alreadyAdjusted = this.#one('SELECT COALESCE(SUM(amount),0) AS amount FROM invoice_adjustment WHERE invoice_id=?', id).amount;
   if (!Number.isSafeInteger(invoice.gross + alreadyAdjusted + amount)) throw new Error('AMOUNT_OUT_OF_RANGE');
   const adjustmentId = randomUUID();
   this.#run('INSERT INTO invoice_adjustment VALUES(?,?,?,?,?,?,?,?)', adjustmentId, id, amount,
    validText(input.reason,'reason'), validText(input.evidence,'evidence'), actor.id, stamp(), input.reverses || null);
   this.#event(actor, input.reverses ? 'reverse_adjustment' : 'adjust_invoice', adjustmentId);
   return adjustmentId;
  });
 }
 financials(actor,cur){requireCapability(actor,'finance');currency(cur);const invoices=this.#all('SELECT id FROM invoice WHERE currency=?',cur).map(i=>this.#balance(i.id));return {currency:cur,invoices,estimated:this.#one('SELECT COALESCE(SUM(estimated),0) AS n FROM entitlement WHERE currency=?',cur).n,earned:this.#one('SELECT COALESCE(SUM(earned),0) AS n FROM entitlement WHERE currency=?',cur).n,cashReceived:this.#one('SELECT COALESCE(SUM(amount),0) AS n FROM receipt WHERE currency=?',cur).n,open:invoices.reduce((s,i)=>{const total=s+i.open;if(!Number.isSafeInteger(total))throw new Error('AMOUNT_OUT_OF_RANGE');return total},0)}}
}
