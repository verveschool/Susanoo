// Synthetic fixtures only. Amounts are integer paise; no production records or rules.
export const demo = {
  partners: [{ id:'p-a', name:'Demo Partner A', legalEntity:'Demo A Services Pvt Ltd', owner:'Demo operator', agreement:'Under review' },{ id:'p-b', name:'Demo Partner B', legalEntity:'Demo B Learning Pvt Ltd', owner:'Demo lead', agreement:'Evidence pending' }],
  requirements: [{id:'r-1',partnerId:'p-a',title:'Sales specialist',status:'Active',owner:'Demo operator'}, {id:'r-2',partnerId:'p-a',title:'Support associate',status:'Active',owner:'Demo operator'}, {id:'r-3',partnerId:'p-b',title:'Account manager',status:'Paused',owner:'Demo lead'}],
  submissions: [{id:'s-1',partnerId:'p-a',candidate:'Demo candidate 01',role:'Sales specialist',stage:'Interviewing',action:'Confirm round 2',released:true},{id:'s-2',partnerId:'p-a',candidate:'Demo candidate 03',role:'Support associate',stage:'Submitted',action:'Review approved profile',released:true},{id:'s-3',partnerId:'p-a',candidate:'Demo candidate 04',role:'Sales specialist',stage:'Offer accepted',action:'Confirm actual joining',released:true},{id:'s-4',partnerId:'p-b',candidate:'Demo candidate 05',role:'Account manager',stage:'Submitted',action:'Review profile',released:false}],
  placements: [{id:'pl-1',partnerId:'p-a',candidate:'Demo candidate 04',status:'Joining evidence pending',actualDate:null,owner:'Demo operator',next:'Verify actual joining with employer'}, {id:'pl-2',partnerId:'p-b',candidate:'Demo candidate 06',status:'Retention evidence pending',actualDate:'2026-10-01',owner:'Demo lead',next:'Request continuity evidence'}],
  entitlements: [{id:'e-1',placement:'pl-2',status:'Earned and invoiced',estimate:10000000,earned:10000000,invoiced:10000000},{id:'e-2',placement:'pl-1',status:'Contingent · rule review',estimate:10000000,earned:0,invoiced:0}],
  invoices: [{id:'inv-1',number:'DEMO-001',partnerId:'p-b',entitlementId:'e-1',net:10000000,tax:1800000,gross:11800000,due:'2026-11-10',cash:5900000,cashNet:5000000,status:'Issued',currency:'INR'}],
  tasks: [{id:'t-1',title:'Confirm continuity evidence',owner:'Demo operator',due:'Today',next:'Request employer confirmation',status:'Open',related:'pl-2'}, {id:'t-2',title:'Review receipt evidence',owner:'Demo finance',due:'Evidence pending',next:'Inspect bank reference',status:'Open',related:'inv-1'}, {id:'t-3',title:'Approve handover bundle',owner:'Demo lead',due:'17 Nov',next:'Review successor access',status:'Open',related:'handover'}],
};
export function money(paise) {
  const amount = BigInt(paise);
  const absolute = amount < 0n ? -amount : amount;
  const units = new Intl.NumberFormat('en-IN').format(absolute / 100n);
  const remainder = absolute % 100n;
  return `${amount < 0n ? '−' : ''}₹${units}${remainder ? '.' + String(remainder).padStart(2, '0') : ''}`;
}
export function summary(data){const issued=data.invoices.filter(i=>i.status==='Issued'); return {cashNet:issued.reduce((s,i)=>s+i.cashNet,0),open:issued.reduce((s,i)=>s+i.gross-i.cash,0),overdue:issued.filter(i=>i.due && i.due<'2026-11-16').reduce((s,i)=>s+i.gross-i.cash,0),unbilled:data.entitlements.reduce((s,e)=>s+Math.max(0,e.earned-e.invoiced),0),estimate:data.entitlements.reduce((s,e)=>s+e.estimate,0),earned:data.entitlements.reduce((s,e)=>s+e.earned,0),invoiced:issued.reduce((s,i)=>s+i.gross,0),cash:issued.reduce((s,i)=>s+i.cash,0)}}
// This is an allowlisted synthetic projection, not an authorization boundary.
export function partnerDemo(data,partnerId){ return {partner:data.partners.filter(p=>p.id===partnerId).map(({id,name})=>({id,name}))[0], requirements:data.requirements.filter(r=>r.partnerId===partnerId).map(({id,title,status})=>({id,title,status})),submissions:data.submissions.filter(s=>s.partnerId===partnerId&&s.released).map(({id,candidate,role,stage,action})=>({id,candidate,role,stage,action}))} }
