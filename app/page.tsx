'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import { Home as HomeIcon, ListChecks, Users, CalendarDays, Wallet, Menu, X, UserRound, Plus, ChevronDown } from 'lucide-react';
import {demo,money,summary,partnerDemo} from '../lib/demo.mjs';
import { product } from '../lib/product';
import { actionStates, requirementTransitions, terminalActionStates } from '../lib/workflow.mjs';
import { ActionEditor, reasonLabel, type ActionEntry } from './action-editor';
import { OutcomeEditor, type DemoOutcome, type OutcomeTarget } from './outcome-editor';

type Workspace='Executive'|'Team'|'Partner';
type RequirementStatus = keyof typeof requirementTransitions;
const initialActions: ActionEntry[] = demo.tasks.map((task, index) => ({
 ...task, status:'open', due: ['2026-11-16', '2026-11-16', '2026-11-17'][index],
 reason: ['Continuity evidence is pending for a placement.', 'A receipt needs supporting bank evidence.', 'Access must be reviewed before the handover.'][index],
 priority: index === 1 ? 'high' : 'normal', source:'Synthetic fixture', evidence:'', history:[],
}));
const menus:Record<Workspace,string[]>={Executive:['Overview','Actions','Partners','Requirements','Placements','Finance','Collections','Rules & readiness'],Team:['My work','Actions','Requirements','Submissions','Interviews','Placements','My earnings'],Partner:['Overview','Requirements','Submissions','Interviews','Shared documents']};
const titles:Record<Workspace,string>={Executive:'Company overview',Team:'My work',Partner:'Demo Partner A'};
function Badge({children}:{children:React.ReactNode}){return <span className="badge">{children}</span>}
function Panel({title,sub,children,action}:{title:string;sub?:string;children:React.ReactNode;action?:React.ReactNode}){return <section className="section"><div className="section-head"><div><h2>{title}</h2>{sub&&<p>{sub}</p>}</div>{action}</div>{children}</section>}
function GridTable({ heads, rows, onSelect, numeric = [], empty = 'No synthetic records in this view.' }: {
 heads: string[];
 rows: string[][];
 onSelect?: (index: number) => void;
 numeric?: number[];
 empty?: string;
}) {
 return (
  <div className="table-wrap">
   <table role="table">
    <thead role="rowgroup">
     <tr role="row">{heads.map((head, column) => <th key={head} role="columnheader" scope="col" className={numeric.includes(column) ? 'number' : undefined}>{head}</th>)}</tr>
    </thead>
    <tbody role="rowgroup">
     {rows.length ? rows.map((row, index) => (
      <tr key={index} role="row" onClick={onSelect ? () => onSelect(index) : undefined} className={onSelect ? 'click-row' : undefined}>
       {row.map((cell, column) => (
        <td key={column} role="cell" data-label={heads[column]} className={numeric.includes(column) ? 'number' : undefined}>
         {column === 0 && onSelect ? (
          <button className="row-link" onClick={event => { event.stopPropagation(); onSelect(index); }}>{cell}</button>
         ) : cell}
        </td>
       ))}
      </tr>
     )) : <tr role="row"><td role="cell" colSpan={heads.length} className="empty">{empty}</td></tr>}
    </tbody>
   </table>
  </div>
 );
}
function Stat({label,value,note,onClick}:{label:string;value:string|number;note:string;onClick?:()=>void}){return <button className="stat" onClick={onClick}><span>{label}</span><strong>{value}</strong><small>{note}</small></button>}
export default function Home(){
 const [space,setSpace]=useState<Workspace>('Executive'); const [page,setPage]=useState('Overview'); const [query,setQuery]=useState(''); const [tasks,setTasks]=useState<ActionEntry[]>(initialActions); const [detail,setDetail]=useState<{title:string;lines:string[];actionId?:string;createAction?:boolean;outcome?:OutcomeTarget;destination?:string}|null>(null); const [slot,setSlot]=useState(false); const [menuOpen,setMenuOpen]=useState(false); const [accountOpen,setAccountOpen]=useState(false); const [addOpen,setAddOpen]=useState(false); const [draftName,setDraftName]=useState(''); const [draftRole,setDraftRole]=useState('Sales specialist'); const [added,setAdded]=useState<{candidate:string;role:string}[]>([]);
 const [requirementStates, setRequirementStates] = useState<Record<string, RequirementStatus>>({});
 const [outcomes, setOutcomes] = useState<DemoOutcome[]>([]);
 const [feedback, setFeedback] = useState('');
 const [draftError, setDraftError] = useState('');
 const headingRef = useRef<HTMLHeadingElement>(null);
 const detailOpen = Boolean(detail);
 const detailRef=useRef<HTMLElement>(null),accountRef=useRef<HTMLElement>(null),addRef=useRef<HTMLFormElement>(null),menuRef=useRef<HTMLElement>(null);
 useEffect(()=>{
  const element=detailOpen?detailRef.current:addOpen?addRef.current:accountOpen?accountRef.current:menuOpen?menuRef.current:null;
  if(!element)return;
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const focusable=()=>Array.from(element.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]'));
  const first=focusable()[0];first?.focus();
  const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();if(detailOpen)setDetail(null);else if(addOpen)setAddOpen(false);else if(accountOpen)setAccountOpen(false);else setMenuOpen(false);return}if(event.key==='Tab'){const items=focusable();if(!items.length){event.preventDefault();return}const firstItem=items[0],lastItem=items[items.length-1];if(event.shiftKey&&document.activeElement===firstItem){event.preventDefault();lastItem.focus()}else if(!event.shiftKey&&document.activeElement===lastItem){event.preventDefault();firstItem.focus()}}};
  const scroll = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', onKey);
  return () => {
   document.removeEventListener('keydown', onKey);
   document.body.style.overflow = scroll;
   queueMicrotask(() => {
    if (previous?.isConnected && previous.getClientRects().length) previous.focus();
    else headingRef.current?.focus();
   });
  };
 },[detailOpen,addOpen,accountOpen,menuOpen]);
 useEffect(() => {
  if (!feedback) return;
  const timer = window.setTimeout(() => setFeedback(''), 5000);
  return () => window.clearTimeout(timer);
 }, [feedback]);

 const overlayOpen = Boolean(detail || addOpen || accountOpen || menuOpen);
 const filterAvailable = !['Rules & readiness', 'My earnings', 'Interviews', 'Shared documents'].includes(page);
 const empty = query.trim() ? 'No matching synthetic records. Try another term or clear the filter.' : undefined;
 const calc=summary(demo); const partner: {requirements:{id:string;title:string;status:string}[]; submissions:{id:string;candidate:string;role:string;stage:string;action:string}[]} = partnerDemo(demo,'p-a');
 const search=(x:string[])=>x.join(' ').toLowerCase().includes(query.trim().toLowerCase());
 const visibleTasks = useMemo(() => tasks.filter(task =>
  (space !== 'Team' || task.owner === 'Demo operator') &&
  [task.title, task.owner, task.due, task.next, actionStates[task.status]].join(' ').toLowerCase().includes(query.trim().toLowerCase())
 ), [tasks, query, space]);
 const openTasks = visibleTasks.filter(task => !terminalActionStates.includes(task.status)).sort((a, b) => {
  const rank: Record<string, number> = { urgent:0, high:1, normal:2, low:3 };
  return rank[a.priority] - rank[b.priority] || (a.reviewDate || a.due).localeCompare(b.reviewDate || b.due);
 });
 const taskTable = (items: ActionEntry[]) => <GridTable empty={empty} heads={['Obligation','Owner','Status','Due / review','Next action']}
  rows={items.map(t=>[t.title,t.owner,actionStates[t.status],t.reviewDate || t.due,t.next])}
  onSelect={index=>setDetail({title:items[index].title,lines:[],actionId:items[index].id})}/>;
 const actionTable = taskTable(openTasks);
 const metric=(title:string,lines:string[],destination?:string)=>setDetail({title,lines,destination});
 const openRecord=(title:string,lines:string[],target:OutcomeTarget)=>setDetail({title,lines,outcome:space==='Partner'?undefined:target});
 const invoices = demo.invoices.filter(invoice=>search([invoice.number,invoice.due,invoice.status,invoice.currency]));
 const invoiceDetail = (invoice: typeof demo.invoices[number], type: string) => {
  const partner = demo.partners.find(entry=>entry.id===invoice.partnerId);
  const entitlement = demo.entitlements.find(entry=>entry.id===invoice.entitlementId);
  openRecord(invoice.number, [
   `Brand: ${partner?.name ?? 'Unknown'}`, `Legal entity on partner record: ${partner?.legalEntity ?? 'Unknown'}`,
   'Contracting entity and applicable agreement version require verification in these fixtures.',
   `Currency: ${invoice.currency} · Due: ${invoice.due}`,
   `Net: ${money(invoice.net)} · Tax: ${money(invoice.tax)} · Gross: ${money(invoice.gross)}`,
   `Cash allocated: ${money(invoice.cash)} · Open gross: ${money(invoice.gross-invoice.cash)}`,
   entitlement ? `Synthetic entitlement ${entitlement.id} · Placement ${entitlement.placement} · Earned ${money(entitlement.earned)}` : 'Entitlement link unavailable.',
   'Source: demo fixture, as of 16 November 2026. Supporting receipt and agreement documents are unavailable.',
  ], {type,id:invoice.id,stage:invoice.status});
 };
 const selectedAction = tasks.find(task=>task.id===detail?.actionId);
 const actor = space === 'Team' ? 'Demo operator' : 'Demo executive';
 const saveAction = (next: ActionEntry) => {
  setTasks(actions => actions.some(action => action.id === next.id) ?
   actions.map(action => action.id === next.id ? next : action) : [...actions, next]);
  setDetail(null);
  setFeedback('Action saved for this demo session.');
 };
 const changeSpace=(next: Workspace)=>{setMenuOpen(false);setSpace(next);setPage(menus[next][0]);setQuery('');setDetail(null)};
 const requirements = demo.requirements.filter(requirement=>space!=='Team'||requirement.owner==='Demo operator')
  .map(requirement=>({...requirement, workflow: requirementStates[requirement.id] ??
   (requirement.status === 'Paused' ? 'paused' : 'sourcing') as RequirementStatus}))
  .filter(requirement=>search([requirement.title, requirement.owner, reasonLabel(requirement.workflow)]));
 const selectedRequirement = detail?.outcome?.type==='requirement' ?
  demo.requirements.find(requirement=>requirement.id===detail.outcome?.id) : undefined;
 const selectedRequirementState = selectedRequirement ? requirementStates[selectedRequirement.id] ??
  (selectedRequirement.status==='Paused' ? 'paused' : 'sourcing') : undefined;
 const heading=page===menus[space][0]?titles[space]:page;
 const nav=(p:string)=>{setMenuOpen(false);setPage(p);setQuery('');setDetail(null)};
 const sources=(process.env.NEXT_PUBLIC_PIPELINE_SOURCE_NAMES||'').split('|').filter(Boolean);
 const mobileLinks = space==='Team' ? [{label:'Home',page:'My work',Icon:HomeIcon},{label:'Work',page:'Submissions',Icon:Users},{label:'Interviews',page:'Interviews',Icon:CalendarDays},{label:'Earnings',page:'My earnings',Icon:Wallet}] : space==='Executive' ? [{label:'Home',page:'Overview',Icon:HomeIcon},{label:'Actions',page:'Actions',Icon:ListChecks},{label:'Partners',page:'Partners',Icon:Users},{label:'Finance',page:'Finance',Icon:Wallet}] : [{label:'Home',page:'Overview',Icon:HomeIcon},{label:'Roles',page:'Requirements',Icon:ListChecks},{label:'Profiles',page:'Submissions',Icon:Users},{label:'Interviews',page:'Interviews',Icon:CalendarDays}];
 const filterNote=query?` · filtered by “${query}”`:'';
 return <><a className="skip-link" href="#workspace-content" inert={overlayOpen}>Skip to content</a><div className="shell" inert={overlayOpen}><aside className="sidebar"><div className="brand">{product.brand}</div><nav aria-label={`${space} navigation`}>{menus[space].map(p=><button key={p} onClick={()=>nav(p)} aria-current={p===page?'page':undefined}>{p}</button>)}</nav></aside><div className="body"><header className="topbar"><div className="mobile-brand"><div className="brand">{product.brand}</div><div className="mobile-header-actions"><button className="mobile-account" onClick={()=>setAccountOpen(true)} aria-label="Open demo account"><UserRound size={20}/></button><button className="mobile-account" onClick={()=>setMenuOpen(true)} aria-label="Open navigation"><Menu size={21}/></button></div></div><div className="workspace-switch" role="group" aria-label="Demo view">{(['Executive','Team','Partner'] as Workspace[]).map(s=><button key={s} className={s===space?'verve-primary':undefined} aria-pressed={s===space} onClick={()=>changeSpace(s)}>{s==='Team'?'Talent Ops':s}</button>)}</div>{filterAvailable && <label className="search"><span className="sr-only">Filter current records</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Filter current records" /></label>}<Badge>Synthetic data</Badge><button className="persona" onClick={()=>setAccountOpen(true)}><UserRound size={16}/> Demo account <ChevronDown size={15}/></button></header><main id="workspace-content" tabIndex={-1}><div className="notice"><strong>Design demo · synthetic operational records</strong><span>View switching simulates access. Changes reset on refresh.</span></div><div className="page-title"><div><h1 tabIndex={-1} ref={headingRef}>{heading}</h1><p>{space==='Executive'?'16 November 2026 / month to date / INR / all figures are synthetic fixtures':space==='Team'?'Your candidates, interviews and earnings in one place · demo' :'Hiring workspace / explicitly released records / synthetic organisation'}</p></div><button className="outline" onClick={()=>{setTasks(initialActions);setOutcomes([]);setRequirementStates({});setQuery('');setSlot(false);setAdded([]);setDetail(null);setDraftName('');setDraftError('');setDraftRole('Sales specialist');setFeedback('Demo reset. Temporary changes cleared.')}}>Reset demo</button></div>
 {space==='Executive' && page==='Overview' && <><div className="stats four"><Stat label="Net fee cash collected" value={money(calc.cashNet)} note="Verified line allocation · demo" onClick={()=>metric('Net fee cash collected',[`Net fee cash: ${money(calc.cashNet)}`,'One synthetic invoice allocation. Tax is excluded.','Source: issued invoice allocations · 1–16 November 2026 · INR · fixture coverage only.'],'Finance')}/><Stat label="Gross receivables open" value={money(calc.open)} note="Includes tax / one demo invoice" onClick={()=>metric('Gross receivables open',[`Invoice DEMO-001 gross: ${money(calc.invoiced)}`,`Cash allocated: ${money(calc.cash)}`,`Open: ${money(calc.open)}`,'1–16 November 2026 · INR · one synthetic invoice.'],'Collections')}/><Stat label="Gross receivables overdue" value={money(calc.overdue)} note="Contractual due date retained" onClick={()=>metric('Gross receivables overdue',['DEMO-001 · due 10 Nov 2026',`Open gross: ${money(calc.overdue)}`,'As of 16 Nov 2026 · INR. Overdue uses the known due date and positive open gross.'],'Collections')}/><Stat label="Eligible unbilled fee" value={money(calc.unbilled)} note="One invoiced eligible entitlement" onClick={()=>metric('Eligible unbilled fee',['The earned example is fully invoiced.','The other estimate is contingent and excluded.'],'Finance')}/></div><Panel title="Needs a decision" sub={'Exceptions have an owner, evidence and a next step'+filterNote} action={<button className="text-button" onClick={()=>nav('Actions')}>View all actions →</button>}>{actionTable}</Panel><div className="split"><Panel title="Money has separate stages" sub="Month to date · synthetic INR amounts"><GridTable empty={empty} numeric={[0, 1, 2, 3]} heads={['Net fee estimate','Earned net fee','Invoiced gross','Bank cash']} rows={[[money(calc.estimate),money(calc.earned),money(calc.invoiced),money(calc.cash)]]}/><button className="text-button" onClick={()=>metric('Money stages',['Estimates include contingent fees. Earned fees require evidence and rule review.','Issued gross includes tax. Cash reflects only the synthetic receipt.','These stages are not interchangeable or live balances.'])}>Explain money stages →</button></Panel><div className="card coverage"><h2>Coverage and source completeness</h2><p>One earned fee is fully invoiced. One other estimate remains contingent. No current company totals are represented.</p><button className="text-button" onClick={()=>nav('Rules & readiness')}>Review open decisions →</button></div></div></>}
 {space==='Team' && page==='My work' && <><div className="scout-welcome"><div><h2>Ready when you are.</h2><p>Keep your candidates moving, one good conversation at a time.</p></div><button className="verve-primary primary add-button" onClick={()=>{setDraftError('');setAddOpen(true)}}><Plus size={18}/> Add candidate</button></div><div className="stats three"><Stat label="Upcoming interviews" value="2" note="One confirmation required" onClick={()=>nav('Interviews')}/><Stat label="Joining checks" value="1" note="Actual date requires evidence" onClick={()=>nav('Placements')}/><Stat label="Blocked actions" value={openTasks.filter(t=>t.status==='blocked').length} note="Dependency owner visible" onClick={()=>nav('Actions')}/></div><Panel title="Your next actions" sub="Prioritised by deadline and external commitment">{actionTable}</Panel><Panel title="My earnings" sub="Illustrative fixture · 20% policy / 60% contribution / one synthetic fee"><div className="stats three"><Stat label="Commission accrued" value="₹12,000" note="From earned attributable fee" onClick={()=>nav('My earnings')}/><Stat label="Eligible unpaid" value="₹6,000" note="After corresponding partial cash" onClick={()=>nav('My earnings')}/><Stat label="Paid" value="₹0" note="Payout execution separate" onClick={()=>nav('My earnings')}/></div></Panel></>}
 {space==='Partner' && page==='Overview' && <><div className="stats three"><Stat label="Active requirements" value={partner.requirements.filter(r=>r.status==='Active').length} note="Sales and customer support" onClick={()=>nav('Requirements')}/><Stat label="Released profiles" value={partner.submissions.length} note="Approved profile versions only" onClick={()=>nav('Submissions')}/><Stat label="Interviews this week" value="2" note="Confirm or propose a slot" onClick={()=>nav('Interviews')}/></div><Panel title="Your hiring actions" sub="Operational collaboration within the demo organisation"><GridTable empty={empty} heads={['Submission','Requirement','Current stage','Your action']} rows={partner.submissions.filter(s=>search([s.candidate,s.role,s.stage,s.action])).map(s=>[s.candidate,s.role,s.stage,s.action])} onSelect={i=>{const s=partner.submissions.filter(s=>search([s.candidate,s.role,s.stage,s.action]))[i];metric(s.candidate,[s.role,`Stage: ${s.stage}`,`Next: ${s.action}`,'This is a released synthetic profile.'])}}/></Panel><div className="equal"><div className="card"><h2>Upcoming interview</h2><p>Demo candidate 01 / 17 Nov / 11:00 IST</p><button className="verve-primary primary" onClick={()=>setSlot(!slot)}>{slot?'Close proposal':'Propose another slot'}</button>{slot&&<div className="inline-note">Demo only: scheduling and sending are not connected.</div>}</div><div className="card"><h2>Shared documents</h2><p>Approved role brief / current version</p><p>Released candidate profile / version 2</p><button className="text-button" onClick={()=>nav('Shared documents')}>View document list →</button></div></div></>}
 {page==='Actions' && <>
  <Panel title="Active and blocked actions" sub={'Blocked work remains visible until its next review'+filterNote}
   action={<button className="verve-primary primary" onClick={()=>setDetail({title:'New demo action',lines:[],createAction:true})}>New action</button>}>{actionTable}</Panel>
  <Panel title="Closed actions" sub="Completed, failed and cancelled outcomes">{taskTable(visibleTasks.filter(task=>terminalActionStates.includes(task.status)))}</Panel>
 </>}
 {(page==='Partners') && <><Panel title="Partner accounts" sub="Brands and legal entities are distinct; execution state is not assumed"><GridTable empty={empty} heads={['Partner','Legal entity','Owner','Agreement state']} rows={demo.partners.filter(p=>search([p.name,p.legalEntity,p.owner,p.agreement])).map(p=>[p.name,p.legalEntity,p.owner,p.agreement])} onSelect={i=>{const p=demo.partners.filter(p=>search([p.name,p.legalEntity,p.owner,p.agreement]))[i];metric(p.name,[`Legal entity: ${p.legalEntity}`,`Account owner: ${p.owner}`,`Agreement: ${p.agreement}`,'No terms are automatically activated.'])}}/></Panel>{sources.length>0&&<Panel title="Pipeline source names" sub="Names from file titles, shown locally. Relationship, current activity and legal entities have not been verified."><div className="source-list">{sources.filter(x=>search([x])).map(x=><span key={x}>{x}</span>)}</div></Panel>}</>}
 {page==='Requirements' && <Panel title="Requirements" sub="Synthetic hiring mandates">
  {space==='Partner' ? <GridTable empty={empty} heads={['Requirement','Partner','Status']}
   rows={partner.requirements.map(r=>[r.title,'Demo Partner A',r.status]).filter(search)}/> :
   <GridTable empty={empty} heads={['Requirement','Partner','Status','Owner']}
    rows={requirements.map(r=>[r.title,demo.partners.find(p=>p.id===r.partnerId)?.name??'Unknown',reasonLabel(r.workflow),r.owner])}
    onSelect={index=>{const r=requirements[index];openRecord(r.title,[`Owner: ${r.owner}`,`Partner: ${demo.partners.find(p=>p.id===r.partnerId)?.name??'Unknown'}`],
      {type:'requirement',id:r.id,stage:reasonLabel(r.workflow)})}}/>}
 </Panel>}
 {page==='Placements' && <Panel title="Placements and retention" sub="Planned dates do not confirm joining; missing evidence stays visible"><GridTable empty={empty} heads={['Candidate','Status','Actual joining','Owner','Next action']} rows={demo.placements.filter(p=>(space!=='Team'||p.owner==='Demo operator')&&search([p.candidate,p.status,p.owner,p.next])).map(p=>[p.candidate,p.status,p.actualDate||'Unknown · evidence required',p.owner,p.next])} onSelect={i=>{const p=demo.placements.filter(p=>(space!=='Team'||p.owner==='Demo operator')&&search([p.candidate,p.status,p.owner,p.next]))[i];openRecord(p.candidate,[`Status: ${p.status}`,`Actual joining: ${p.actualDate||'Unknown'}`,`Owner: ${p.owner}`,`Next: ${p.next}`],{type:'placement',id:p.id,stage:p.status})}}/></Panel>}
 {(page==='Finance'||page==='Collections') && <>
  <Panel title="Invoices and collections" sub="Synthetic gross includes tax · reporting period 1–16 November 2026">
   <GridTable empty={empty} numeric={[2,3,4]} heads={['Invoice','Partner','Gross','Cash allocated','Open gross','Due']}
    rows={invoices.map(i=>[i.number,demo.partners.find(p=>p.id===i.partnerId)?.name||'',money(i.gross),money(i.cash),money(i.gross-i.cash),i.due])}
    onSelect={index=>invoiceDetail(invoices[index],page==='Collections'?'collection':'commercial')}/>
  </Panel>
  <Panel title="Entitlement review" sub="Estimated and earned amounts reflect different stages">
   <GridTable empty={empty} numeric={[3,4]} heads={['ID','Placement','State','Estimate','Earned']}
    rows={demo.entitlements.map(e=>[e.id,e.placement,e.status,money(e.estimate),money(e.earned)]).filter(search)}/>
  </Panel>
 </>}
 {page==='Rules & readiness' && <Panel title="Decisions before live operations" sub="Open business rules stay in review; these are not defaults"><div className="card"><ul className="rules"><li>Executed agreements, precedence and fee terms require commercial review.</li><li>Commission basis, attribution, tax and reversals require approved policy.</li><li>Joining and retention need evidence; unknown is not passed.</li><li>Authentication, backend authorisation, audit, private storage and restore tests are required before live data.</li><li>Partner isolation, release and revocation tests are required before external access.</li></ul></div></Panel>}
 {page==='Submissions' && <><Panel title={space==='Team'?'My candidate pipeline':'Released submissions'} sub={space==='Team'?'Your synthetic candidate work. Additions last only for this session.':'Synthetic, explicitly released profile snapshots'} action={space==='Team'?<button className="verve-primary primary add-button" onClick={()=>{setDraftError('');setAddOpen(true)}}><Plus size={17}/> Add candidate</button>:null}><GridTable empty={empty} heads={['Candidate','Requirement','Stage','Next action']} rows={partner.submissions.filter(s=>search([s.candidate,s.role,s.stage,s.action])).map(s=>[s.candidate,s.role,s.stage,s.action])} onSelect={i=>{const s=partner.submissions.filter(s=>search([s.candidate,s.role,s.stage,s.action]))[i];openRecord(s.candidate,[`Requirement: ${s.role}`,`Stage: ${s.stage}`,`Next action: ${s.action}`],{type:'introduction',id:s.id,stage:s.stage})}}/></Panel>{space==='Team'&&added.length>0&&<Panel title="Added in this session" sub="Synthetic drafts · not submitted or saved"><GridTable empty={empty} heads={['Candidate','Requirement','Stage']} rows={added.map(a=>[a.candidate,a.role,'Draft']).filter(search)}/></Panel>}</>}
 {page==='My earnings' && <Panel title="Illustrative commission statement" sub="A synthetic example, not an approved policy or payable balance"><div className="card"><p>Earned net fee ₹1,00,000 × 20% illustrative policy × 60% contribution = ₹12,000 accrued. Half of the synthetic net fee has been collected, so ₹6,000 is shown as eligible; ₹0 is shown paid.</p><p>Policy, attribution and reversal treatment require approval before live use.</p></div></Panel>}
 {page==='Interviews' && <Panel title="Upcoming interviews" sub="Synthetic schedule"><GridTable empty={empty} heads={['Submission','When','State','Action']} rows={[["Demo candidate 01","17 Nov / 11:00 IST","Confirmation required","Confirm round 2"],["Demo candidate 03","18 Nov / 15:30 IST","Proposed","Review time"]]}/></Panel>}
 {page==='Shared documents' && <Panel title="Shared documents" sub="Reference list only · no file storage or downloads connected"><GridTable empty={empty} heads={['Document','Version','State']} rows={[["Approved role brief","Current","Released demo"],["Candidate profile","Version 2","Released demo"]]}/></Panel>}
 <footer><div>{product.demoName}</div>{space!=='Partner'&&<strong>The world moves for those who do.</strong>}</footer></main></div><nav className="mobile-bottom" aria-label="Quick navigation">{mobileLinks.map(({label,page:target,Icon})=><button key={label} aria-current={page===target?'page':undefined} onClick={()=>nav(target)}><Icon size={20}/><span>{label}</span></button>)}<button onClick={()=>setMenuOpen(true)} aria-expanded={menuOpen}><Menu size={20}/><span>More</span></button></nav></div><div className="feedback" role="status">{feedback}</div>{menuOpen&&<div className="mobile-menu-overlay" onClick={()=>setMenuOpen(false)}><section ref={menuRef} role="dialog" aria-modal="true" aria-labelledby="mobile-menu-title" className="mobile-menu" onClick={e=>e.stopPropagation()}><div className="menu-heading"><div><h2 id="mobile-menu-title">Demo navigation</h2></div><button className="icon-button" aria-label="Close navigation" onClick={()=>setMenuOpen(false)}><X/></button></div>{menus[space].map(p=><button aria-current={p===page?'page':undefined} key={p} onClick={()=>nav(p)}>{p}<span>›</span></button>)}</section></div>}
 {accountOpen&&<div className="modal-backdrop" onClick={()=>setAccountOpen(false)}><section ref={accountRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="account-title" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setAccountOpen(false)} aria-label="Close account">×</button><h2 id="account-title">Explore {product.demoName}</h2><p>You’re exploring as a demo user. Choose a demo view to see its workflows.</p><div className="account-choices">{(['Executive','Team','Partner'] as Workspace[]).map(s=><button key={s} onClick={()=>{changeSpace(s);setAccountOpen(false)}}>{s==='Team'?'Talent Ops':s}<span>Explore demo →</span></button>)}</div><p className="hint">This is a preview, not a sign-in. No account has been created and access is not protected.</p></section></div>}
 {addOpen&&<div className="modal-backdrop" onClick={()=>setAddOpen(false)}><form ref={addRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="add-title" onClick={e=>e.stopPropagation()} onSubmit={e=>{e.preventDefault();const name = draftName.trim(); if (!name) { setDraftError('Enter a fictional candidate name.'); addRef.current?.querySelector('input')?.focus(); return; } setAdded(a=>[...a,{candidate:name,role:draftRole}]);setDraftName('');setAddOpen(false);nav('Submissions');setFeedback('Candidate draft added for this session.');}}><button type="button" className="close" onClick={()=>setAddOpen(false)} aria-label="Close add candidate">×</button><h2 id="add-title">Add a candidate</h2><p>Try the flow with a fictional name. This draft only lasts for this session.</p><label className="field">Fictional candidate name<input required maxLength={60} value={draftName} aria-invalid={draftError ? true : undefined} aria-describedby={draftError ? "draft-error" : undefined} onChange={e=>{setDraftName(e.target.value);setDraftError("")}} placeholder="e.g. Demo candidate 07"/></label>{draftError && <p id="draft-error" role="alert">{draftError}</p>}<label className="field">Requirement<select value={draftRole} onChange={e=>setDraftRole(e.target.value)}><option>Sales specialist</option><option>Support associate</option></select></label><button className="verve-primary primary" type="submit">Add demo draft</button><p className="hint">No profile is released or saved. Please do not enter real personal data.</p></form></div>}
 {detail && <div className="modal-backdrop" onClick={()=>setDetail(null)}>
  <section ref={detailRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onClick={event=>event.stopPropagation()}>
   <button className="close" onClick={()=>setDetail(null)} aria-label="Close detail">×</button>
   <h2 id="dialog-title">{detail.title}</h2>
   <div className="detail-lines">{detail.lines.map((line,index)=><p key={index}>{line}</p>)}</div>
   {selectedAction && <>
    <p>Current status · {actionStates[selectedAction.status]}</p>
    {selectedAction.related && <p>Related record · {selectedAction.related}</p>}
    {selectedAction.blocker && <p>Blocked by {selectedAction.blocker} · {selectedAction.blockerOwner} · Review {selectedAction.reviewDate}</p>}
   </>}
   {(selectedAction || detail.createAction) && <ActionEditor key={selectedAction?.id ?? 'new'} action={selectedAction} actor={actor} onSave={saveAction}/>}
   {selectedAction && selectedAction.history.length > 0 && <section className="section"><h2>Action history</h2>
    {selectedAction.history.map((entry,index)=><div className="history-entry" key={index}>
     <strong>{actionStates[entry.status]} · {entry.actor} · {entry.at.slice(0,10)}</strong>
     <p>{[entry.reason && reasonLabel(entry.reason),entry.certainty !== 'unknown' && reasonLabel(entry.certainty),entry.note,entry.source,entry.evidence].filter(Boolean).join(' · ')}</p>
    </div>)}</section>}
   {detail.destination && <button type="button" className="text-button" onClick={()=>nav(detail.destination!)}>Open {detail.destination} →</button>}
   {selectedRequirement && selectedRequirementState && <form onSubmit={event=>{
    event.preventDefault();
    const status = new FormData(event.currentTarget).get('requirementStatus') as RequirementStatus;
    if (!requirementTransitions[selectedRequirementState].some(available=>available===status)) return;
    const note = String(new FormData(event.currentTarget).get('requirementChange') ?? '').trim();
    setRequirementStates(previous=>({...previous,[selectedRequirement.id]:status}));
    setOutcomes(previous=>[...previous,{ type:'requirement', id:selectedRequirement.id,
     stage:reasonLabel(selectedRequirementState), outcomeId:crypto.randomUUID(), outcome:`Status changed to ${reasonLabel(status)}`,
     reason:'unknown', certainty:'reported', context:note, source:'Demo workflow', evidence:'', actor,
     occurredOn:new Date().toISOString().slice(0,10),nextAction:'' }]);
    setDetail(previous=>previous?.outcome ? {...previous,outcome:{...previous.outcome,stage:reasonLabel(status)}} : previous);
    setFeedback('Requirement status updated for this demo session.');
   }}>
    <p>Current status · {reasonLabel(selectedRequirementState)}</p>
    {requirementTransitions[selectedRequirementState].length > 0 && <>
     <label className="field">Move requirement to<select name="requirementStatus" defaultValue="" required key={selectedRequirementState}>
      <option value="" disabled>Choose a status</option>
      {requirementTransitions[selectedRequirementState].map(value=><option key={value} value={value}>{reasonLabel(value)}</option>)}
     </select></label>
     <label className="field">Why the status changed<textarea name="requirementChange" maxLength={600}/></label>
     <button className="verve-primary primary" type="submit">Save requirement status</button>
    </>}
   </form>}
   {detail.outcome && <OutcomeEditor key={detail.outcome.id + detail.outcome.type} actor={actor} target={detail.outcome}
    history={outcomes.filter(entry=>entry.id===detail.outcome?.id && entry.type===detail.outcome?.type)}
    onSave={entry=>{setOutcomes(previous=>[...previous,entry]);setFeedback('Outcome saved for this demo session.')}}/>}
   <p className="hint">Use fictional information only. Changes reset on refresh.</p>
  </section>
 </div>}</>
}
