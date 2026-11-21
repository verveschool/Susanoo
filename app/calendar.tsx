import Link from "next/link";
import {request} from "../lib/workspace";
import type {View} from "./workspace-shell";

type Interview={id:string;scheduled_at:string|null;scheduled_on:string|null;round_label:string|null;submissions:{candidates:{name:string};requirements:{title:string;partners:{name:string}}}};
function monthName(year:number,month:number){return new Intl.DateTimeFormat("en-IN",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(Date.UTC(year,month-1,1)));}
function monthKey(year:number,month:number){const date=new Date(Date.UTC(year,month-1,1));return date.toISOString().slice(0,7);}
export async function Calendar({token,view,month}:{token:string;view:View;month?:string}){
 const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 const selected=month&&/^\d{4}-(0[1-9]|1[0-2])$/.test(month)?month:today.slice(0,7);
 const [year,num]=selected.split("-").map(Number),next=monthKey(year,num+1),previous=monthKey(year,num-1);
 const start=selected+"-01",end=next+"-01";
 const filter="or="+encodeURIComponent("(and(scheduled_at.gte."+start+"T00:00:00+05:30,scheduled_at.lt."+end+"T00:00:00+05:30),and(scheduled_on.gte."+start+",scheduled_on.lt."+end+"))");
 const res=await request("/rest/v1/interviews?select=id,scheduled_at,scheduled_on,round_label,submissions(candidates(name),requirements(title,partners(name)))&"+filter+"&order=scheduled_at.asc.nullslast,scheduled_on.asc,id.asc&limit=1000",token);
 if(!res.ok)throw new Error("Calendar unavailable");
 const rows:Interview[]=await res.json();
 const dayFor=(r:Interview)=>r.scheduled_at?new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(r.scheduled_at)):r.scheduled_on!;
 const timeFor=(r:Interview)=>r.scheduled_at?new Intl.DateTimeFormat("en-IN",{timeZone:"Asia/Kolkata",hour:"numeric",minute:"2-digit"}).format(new Date(r.scheduled_at)):"Time not recorded";
 const days=new Date(Date.UTC(year,num,0)).getUTCDate(),offset=(new Date(Date.UTC(year,num-1,1)).getUTCDay()+6)%7;
 const dayRows=new Map<string,Interview[]>();for(const row of rows){const d=dayFor(row);dayRows.set(d,[...(dayRows.get(d)??[]),row]);}
 return <><div className="page-title"><div><h1>Calendar</h1><p>Interviews in India time</p></div><Link className="primary verve-primary" href={"/?view="+view+"&section=interviews&add=1"}>Schedule interview</Link></div>
 <div className="calendar-controls"><Link className="outline" aria-label="Previous month" href={"/?view="+view+"&section=calendar&month="+previous}>←</Link><h2>{monthName(year,num)}</h2><Link className="outline" aria-label="Next month" href={"/?view="+view+"&section=calendar&month="+next}>→</Link><Link href={"/?view="+view+"&section=calendar"}>Today</Link></div>
 <div className="calendar-grid" aria-label="Calendar">{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=><strong key={d}>{d}</strong>)}{Array.from({length:offset},(_,i)=><div key={"empty"+i}/>)}{Array.from({length:days},(_,i)=>{const date=selected+"-"+String(i+1).padStart(2,"0"),events=dayRows.get(date)??[];return <a key={date} className={"calendar-day"+(date===today?" today":"")} href={"#day-"+date} aria-label={date+", "+events.length+" interviews"}><span>{i+1}</span>{events.length>0&&<small>{events.length} {events.length===1?"interview":"interviews"}</small>}</a>})}</div>
 <section className="section"><h2>Interviews this month</h2>{!rows.length&&<p>No interviews recorded for this month.</p>}{[...dayRows.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([day,events])=><div key={day} id={"day-"+day} className="calendar-group"><h3>{new Intl.DateTimeFormat("en-IN",{dateStyle:"full",timeZone:"UTC"}).format(new Date(day+"T00:00:00Z"))}</h3>{events.map(r=><div className="card calendar-event" key={r.id}><strong>{timeFor(r)}</strong><div><strong>{r.submissions?.candidates?.name??"Candidate"}</strong><p>{[r.submissions?.requirements?.title,r.submissions?.requirements?.partners?.name,r.round_label].filter(Boolean).join(" · ")}</p></div></div>)}</div>)}{rows.length===1000&&<p>Showing the first 1,000 interviews for this month.</p>}</section></>;
}
