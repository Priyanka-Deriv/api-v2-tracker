import { useState, useEffect, useMemo } from "react";

const STATUSES = ["Backlog","In Progress","Blocked","In Review","Done"];
const TYPES = ["Action Item","Product Decision","Review","Bug / Fix","Documentation","External Request"];
const PRIORITIES = ["High","Medium","Low"];
const MEMBERS = ["Priyanka","Ashkan","Muhammad","Manros","Prince","Matin","Kirill","Ahmed","Lepika","Abheeshta","Rakshit","Azita"];
const TEAMS = [
  {id:"core",label:"Core API Team",dot:"bg-indigo-500",poc:"Ashkan/Priyanka"},
  {id:"hubspot",label:"HubSpot/Marketing",dot:"bg-pink-500",poc:"Abheeshta"},
  {id:"bi",label:"BI / Data",dot:"bg-cyan-500",poc:"Prakash, Guru"},
  {id:"compliance",label:"Compliance",dot:"bg-rose-500",poc:"Azita"},
  {id:"partners",label:"Partners",dot:"bg-amber-500",poc:"Ying Shan, Rakshit"},
  {id:"design",label:"Design",dot:"bg-violet-500",poc:"Manros"},
  {id:"auth",label:"Auth / Backend",dot:"bg-blue-600",poc:"Kirill, Lepika"},
  {id:"seo",label:"SEO",dot:"bg-emerald-500",poc:"TBD"},
  {id:"translations",label:"Translations",dot:"bg-fuchsia-500",poc:"TBD"},
  {id:"content",label:"Content / Docs",dot:"bg-teal-500",poc:"TBD"},
  {id:"finance",label:"Finance",dot:"bg-orange-500",poc:"TBD"},
  {id:"marketing",label:"Marketing",dot:"bg-purple-500",poc:"TBD"},
  {id:"support",label:"Support",dot:"bg-sky-500",poc:"Dmitry"},
  {id:"country",label:"Country Managers",dot:"bg-lime-600",poc:"Regional"},
  {id:"devops",label:"DevOps",dot:"bg-slate-500",poc:"Shriv"},
];
const SLACK_CHS = [
  {id:"C08H3AYCDM3",name:"#project_deriv_api_v2",on:true},
  {id:"C09QFK3SA5V",name:"#task_api_v2_website",on:true},
  {id:"C0AE4RPLLCA",name:"#project-br-api-migration",on:false},
  {id:"CK42VMYTF",name:"#need_help_api",on:false},
  {id:"C09948U0SQP",name:"#task_connect_api_v1_v2",on:false},
];

// ── SLACK SYNC ENGINE ─────────────────────────────────────────────────────────
// Reads messages from both channels, uses Claude to extract action items,
// matches @mentions to real owners, deduplicates against existing tracker items.
async function syncFromSlack(existingItems, onNewItems, onDuplicates, onDone) {
  const allMessages = [];
  for (const ch of SYNC_CHANNELS) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514", max_tokens:300,
          messages:[{role:"user", content:`Read the last 30 messages from Slack channel ${ch.id} and return them as JSON array: [{"user":"userId","text":"message text","ts":"timestamp"}]. Return ONLY valid JSON, no markdown.`}],
          mcp_servers:[{type:"url",url:"https://mcp.slack.com/mcp",name:"slack"}]
        })
      });
      const d = await res.json();
      const raw = (d.content||[]).find(b=>b.type==="text");
      if (raw) {
        const msgs = JSON.parse(raw.text.replace(/```json|```/g,"").trim());
        msgs.forEach(m => allMessages.push({...m, channel:ch.name, channelId:ch.id}));
      }
    } catch(e) { console.log("Slack read error for "+ch.name, e); }
  }

  if (!allMessages.length) { onDone(); return; }

  // Resolve @mentions to names using our user map
  const resolveText = (text) => {
    if (!text) return text;
    return text.replace(/<@([A-Z0-9]+)(?:\|[^>]*)?>/, (match, uid) => {
      const name = SLACK_USER_MAP[uid];
      return name ? `@${name}` : match;
    });
  };

  const resolved = allMessages.map(m => ({
    ...m,
    text: resolveText(m.text),
    ownerName: SLACK_USER_MAP[m.user] || null,
  }));

  // Ask Claude to extract action items from these messages
  const existing = existingItems.map(i=>`ID:${i.id}|"${i.title}"`).join("\n");
  const msgText = resolved.map(m=>`[${m.channel}] ${m.ownerName||m.user}: ${m.text}`).join("\n");

  try {
    const res2 = await fetch("https://api.anthropic.com/v1/messages", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        model:"claude-sonnet-4-20250514", max_tokens:2000,
        system:`You extract action items from Slack messages for the Deriv API V2 team.
Only extract messages that: (1) mention a team member by @name, OR (2) clearly describe a task/to-do/action.
Ignore general discussion, links, or status updates with no clear action.
Known team members: ${Object.values(SLACK_USER_MAP).join(", ")}.
Types: ${TYPES.join(", ")}. Priorities: High/Medium/Low. Statuses: ${STATUSES.join(", ")}.
Existing tracker items (for duplicate detection):\n${existing}
Return ONLY valid JSON no markdown:
{"newItems":[{"title":"","owner":"","type":"Action Item","status":"Backlog","priority":"Medium","notes":"","team":"core","sourceChannel":"","possibleDuplicateOfId":null}]}
Set possibleDuplicateOfId to the ID number of an existing item if this looks like the same task, else null.`,
        messages:[{role:"user", content:"Extract action items from these Slack messages:\n\n"+msgText}]
      })
    });
    const d2 = await res2.json();
    const raw2 = (d2.content||[]).find(b=>b.type==="text");
    if (!raw2) { onDone(); return; }
    const parsed = JSON.parse(raw2.text.replace(/```json|```/g,"").trim());
    const all = (parsed.newItems||[]);
    const dupes = all.filter(i=>i.possibleDuplicateOfId);
    const fresh = all.filter(i=>!i.possibleDuplicateOfId);
    if (fresh.length) onNewItems(fresh);
    if (dupes.length) onDuplicates(dupes);
  } catch(e) { console.log("Claude extract error", e); }
  onDone();
}
const HANDLES = {Priyanka:"@priyanka",Ashkan:"@ashkan",Muhammad:"@muhammad",Manros:"@manros",Prince:"@prince",Matin:"@matin",Kirill:"@kirill",Ahmed:"@ahmed"};
// Real Slack user IDs from workspace — used to match @mentions in messages
const SLACK_USER_MAP = {
  "U070LCMQX19":"Priyanka",
  "U0D22JSDA":  "Ashkan",
  "U6Y448143":  "Kirill",
  "U01A0GPH49Z":"Matin",
  "U071Q4DHS58":"Ahmed",
  "U75BVGLCE":  "Muhammad",
  "U0D640XCJ":  "Manros",
  "U02UCMS0YKH":"Prince",
};
const SYNC_CHANNELS = [
  {id:"C08H3AYCDM3", name:"#project_deriv_api_v2"},
  {id:"C09QFK3SA5V", name:"#task_api_v2_website"},
];

const S_COL = {
  "Backlog":    {col:"bg-gray-50",  hdr:"bg-gray-200 text-gray-700",    dot:"bg-gray-400" },
  "In Progress":{col:"bg-blue-50",  hdr:"bg-blue-200 text-blue-800",    dot:"bg-blue-500" },
  "Blocked":    {col:"bg-red-50",   hdr:"bg-red-200 text-red-800",      dot:"bg-red-500"  },
  "In Review":  {col:"bg-yellow-50",hdr:"bg-yellow-200 text-yellow-800",dot:"bg-yellow-500"},
  "Done":       {col:"bg-green-50", hdr:"bg-green-200 text-green-800",  dot:"bg-green-500"},
};
const T_COLOR = {
  "Action Item":"bg-blue-100 text-blue-700","Product Decision":"bg-purple-100 text-purple-700",
  "Review":"bg-yellow-100 text-yellow-700","Bug / Fix":"bg-red-100 text-red-700",
  "Documentation":"bg-green-100 text-green-700","External Request":"bg-teal-100 text-teal-700",
};
const P_COLOR = {High:"bg-red-100 text-red-700",Medium:"bg-yellow-100 text-yellow-700",Low:"bg-green-100 text-green-700"};
const S_COLOR = {
  "Backlog":"bg-gray-100 text-gray-600","In Progress":"bg-blue-100 text-blue-700",
  "Blocked":"bg-red-100 text-red-700","In Review":"bg-yellow-100 text-yellow-700","Done":"bg-green-100 text-green-700",
};

const SEED = [
  {id:1,title:"Add T&C to dashboard before markup push",owner:"Manros",type:"Action Item",status:"In Progress",priority:"High",notes:"Must ship before markup update.",team:"core",ft:false},
  {id:2,title:"Email trigger on new app registration",owner:"Kirill",type:"Action Item",status:"Backlog",priority:"High",notes:"Backend sends T&C email on app_created.",team:"auth",ft:false},
  {id:3,title:"Remove AI disclaimer from V2",owner:"Priyanka",type:"Product Decision",status:"In Review",priority:"Medium",notes:"Align with Azita first.",team:"compliance",ft:false},
  {id:4,title:"Update OAuth consent page design",owner:"Manros",type:"Action Item",status:"Backlog",priority:"Medium",notes:"Assign design resource in Malaysia.",team:"design",ft:false},
  {id:5,title:"White-label configurations PR",owner:"Muhammad",type:"Action Item",status:"In Review",priority:"High",notes:"Review with Ashkan and Priyanka.",team:"core",ft:false},
  {id:6,title:"Dashboard UI updates",owner:"Manros",type:"Review",status:"Blocked",priority:"High",notes:"Awaiting Ashkan/Priyanka review slot.",team:"design",ft:false},
  {id:7,title:"PAT with 2FA/OTP on developer dashboard",owner:"Ahmed",type:"Action Item",status:"In Progress",priority:"High",notes:"V2 dashboard work.",team:"core",ft:false},
  {id:8,title:"Dual App ID logic V1 to V2 edge cases",owner:"Ashkan",type:"Product Decision",status:"In Progress",priority:"High",notes:"Define failure scenarios.",team:"core",ft:false},
  {id:9,title:"Developer incentive plan rollout",owner:"Priyanka",type:"Action Item",status:"In Progress",priority:"Medium",notes:"Finalise tiers and markup bands.",team:"partners",ft:false},
  {id:10,title:"V1 sunset communications plan",owner:"Priyanka",type:"Documentation",status:"Backlog",priority:"High",notes:"Expand beyond S-30 to S+15.",team:"core",ft:false},
  {id:11,title:"HubSpot tracking on API website",owner:"Priyanka",type:"Action Item",status:"In Progress",priority:"High",notes:"Abheeshta to provide tracker.",team:"hubspot",ft:false},
  {id:12,title:"BI data feed for analytics dashboard",owner:"Priyanka",type:"External Request",status:"Backlog",priority:"High",notes:"Reach out to Prakash, Guru, Harley.",team:"bi",ft:false},
  {id:13,title:"SEO setup for developers.deriv.com",owner:"Priyanka",type:"External Request",status:"Backlog",priority:"Medium",notes:"Domain indexing and sitemap.",team:"seo",ft:false},
  {id:14,title:"Portuguese translations for migration docs",owner:"Priyanka",type:"External Request",status:"Backlog",priority:"High",notes:"Brazil devs need PT docs.",team:"translations",ft:false},
  {id:15,title:"Amy chatbot training content",owner:"Ashkan",type:"Documentation",status:"In Progress",priority:"Medium",notes:"Update whenever docs change.",team:"content",ft:false},
];

const INIT_PAD = () => Object.fromEntries(TEAMS.map(t=>[t.id,{q:[],d:[],df:[],dt:[],n:""}]));

async function sLoad(key,fb){try{const r=await window.storage.get(key,true);if(r&&r.value)return JSON.parse(r.value);}catch(e){}return fb;}
async function sSave(key,val){try{await window.storage.set(key,JSON.stringify(val),true);}catch(e){}}

const Pill=({cls,children})=><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{children}</span>;
const Modal=({children})=><div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4 overflow-y-auto"><div className="my-4 w-full max-w-lg">{children}</div></div>;

function Card({item,onChange,onDelete,onMove,mergeMode,selected,onSelect}){
  const [open,setOpen]=useState(false);
  return(
    <div className={`bg-white rounded-xl border shadow-sm p-3 mb-2 ${selected?"ring-2 ring-indigo-500":""} ${item.ft?"ring-2 ring-orange-400":""}`}>
      {mergeMode&&<label className="flex items-center gap-2 mb-2 cursor-pointer"><input type="checkbox" checked={selected} onChange={()=>onSelect(item.id)} className="accent-indigo-600 w-4 h-4"/><span className="text-xs text-indigo-600">Select to merge</span></label>}
      {item.ft&&<div className="text-[10px] font-bold text-orange-500 mb-1 uppercase">⚡ From transcript — review</div>}
      <div className="flex items-start gap-1 mb-2">
        <p className="text-sm font-semibold text-gray-800 flex-1 leading-snug" contentEditable suppressContentEditableWarning
          onBlur={e=>onChange(item.id,{title:e.target.innerText.trim()})}>{item.title}</p>
        <button onClick={()=>onDelete(item.id)} className="text-gray-300 hover:text-red-400 text-xs shrink-0">✕</button>
      </div>
      {item.notes&&<p className="text-xs text-gray-500 italic mb-2">{item.notes}</p>}
      <div className="flex flex-wrap gap-1 mb-2">
        <Pill cls={T_COLOR[item.type]||"bg-gray-100 text-gray-600"}>{item.type}</Pill>
        <Pill cls={P_COLOR[item.priority]}>{item.priority}</Pill>
        <Pill cls="bg-gray-100 text-gray-600">{item.owner}</Pill>
        <Pill cls={S_COLOR[item.status]}>{item.status}</Pill>
      </div>
      <button onClick={()=>setOpen(o=>!o)} className="text-xs text-gray-400">{open?"▲ less":"▼ actions"}</button>
      {open&&(
        <div className="mt-2 space-y-1">
          <div className="flex flex-wrap gap-1">
            {STATUSES.filter(s=>s!==item.status).map(s=><button key={s} onClick={()=>onMove(item.id,s)} className="text-xs border border-gray-300 rounded px-2 py-0.5 hover:bg-gray-50 text-gray-600">→ {s}</button>)}
          </div>
          {item.ft&&<button onClick={()=>onChange(item.id,{ft:false})} className="text-xs bg-orange-100 text-orange-600 rounded px-2 py-0.5">Mark reviewed</button>}
        </div>
      )}
    </div>
  );
}

function AddModal({onAdd,onClose}){
  const [f,setF]=useState({title:"",notes:"",owner:"Priyanka",type:"Action Item",status:"Backlog",priority:"High",team:"core"});
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  return(
    <Modal><div className="bg-white rounded-2xl shadow-xl p-5">
      <h2 className="text-lg font-bold mb-4">Add Item</h2>
      <div className="space-y-3">
        <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Title *" value={f.title} onChange={e=>s("title",e.target.value)}/>
        <textarea className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} placeholder="Notes" value={f.notes} onChange={e=>s("notes",e.target.value)}/>
        <div className="grid grid-cols-2 gap-2">
          {[["Owner","owner",MEMBERS],["Type","type",TYPES],["Status","status",STATUSES],["Priority","priority",PRIORITIES]].map(([lb,ky,op])=>(
            <div key={ky}><label className="text-xs text-gray-500 mb-1 block">{lb}</label>
              <select className="w-full border rounded-lg px-2 py-1.5 text-sm" value={f[ky]} onChange={e=>s(ky,e.target.value)}>{op.map(o=><option key={o}>{o}</option>)}</select>
            </div>
          ))}
        </div>
        <div><label className="text-xs text-gray-500 mb-1 block">Team</label>
          <select className="w-full border rounded-lg px-2 py-1.5 text-sm" value={f.team} onChange={e=>s("team",e.target.value)}>{TEAMS.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border">Cancel</button>
        <button onClick={()=>{if(f.title.trim()){onAdd(f);onClose();}}} className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white">Add</button>
      </div>
    </div></Modal>
  );
}

function TranscriptModal({items,onAdd,onClose}){
  const [txt,setTxt]=useState(""); const [busy,setBusy]=useState(false); const [err,setErr]=useState("");
  const go=async()=>{
    if(!txt.trim())return; setBusy(true); setErr("");
    try{
      const ex=items.map(i=>`ID:${i.id}|"${i.title}"|${i.owner}|${i.status}`).join("\n");
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:2000,system:`Extract action items from Deriv API transcript. Team: ${MEMBERS.join(",")}. Types: ${TYPES.join(",")}. Priorities: High/Medium/Low. Statuses: ${STATUSES.join(",")}. Existing:\n${ex}\nReturn ONLY valid JSON: {"items":[{"title":"","owner":"","type":"","status":"","priority":"","notes":"","team":"core"}]}`,messages:[{role:"user",content:"Parse:\n"+txt}]})});
      const d=await res.json();
      const raw=(d.content||[]).find(b=>b.type==="text");
      if(!raw)throw new Error("No response");
      const p=JSON.parse(raw.text.replace(/```json|```/g,"").trim());
      onAdd(p.items||[]); onClose();
    }catch(e){setErr("Error: "+e.message);}
    setBusy(false);
  };
  return(
    <Modal><div className="bg-white rounded-2xl shadow-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div><h2 className="text-lg font-bold">Paste Transcript</h2><p className="text-sm text-gray-500">Claude extracts action items automatically.</p></div>
        <button onClick={onClose} className="text-gray-400 text-xl">✕</button>
      </div>
      <textarea className="w-full border rounded-xl px-3 py-2 text-sm h-48 resize-none font-mono outline-none" placeholder="Paste meeting transcript here..." value={txt} onChange={e=>setTxt(e.target.value)}/>
      {err&&<p className="text-xs text-red-500 mt-1">{err}</p>}
      <div className="flex justify-end gap-2 mt-3">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border">Cancel</button>
        <button onClick={go} disabled={!txt.trim()||busy} className="px-4 py-2 text-sm rounded-lg bg-orange-500 text-white disabled:opacity-40">{busy?"Parsing...":"Parse Transcript"}</button>
      </div>
    </div></Modal>
  );
}

function SlackModal({items,onClose}){
  const ai=items.filter(i=>i.type==="Action Item"&&i.status!=="Done");
  const [si,setSi]=useState(ai.map(i=>i.id));
  const [sc,setSc]=useState(SLACK_CHS.filter(c=>c.on).map(c=>c.id));
  const [busy,setBusy]=useState(false); const [res,setRes]=useState([]);
  const send=async()=>{
    if(!sc.length||!si.length)return; setBusy(true);
    const ts=ai.filter(i=>si.includes(i.id));
    const out=[];
    for(const cid of sc){
      const ch=SLACK_CHS.find(c=>c.id===cid);
      const msg=`*API V2 Tracker — Action Items*\n_${new Date().toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"})} · ${ts.length} items_\n\n`+ts.map(i=>`*${i.priority==="High"?"🔴":i.priority==="Medium"?"🟡":"🟢"} ${i.title}*\nOwner: ${HANDLES[i.owner]||i.owner} · ${i.status}${i.notes?"\n"+i.notes:""}`).join("\n\n---\n\n");
      try{await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:200,messages:[{role:"user",content:`Send to Slack channel ${cid}:\n${msg}`}],mcp_servers:[{type:"url",url:"https://mcp.slack.com/mcp",name:"slack"}]})});out.push({n:ch?ch.name:cid,ok:true});}
      catch(e){out.push({n:ch?ch.name:cid,ok:false});}
    }
    setRes(out); setBusy(false);
  };
  return(
    <Modal><div className="bg-white rounded-2xl shadow-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div><h2 className="text-lg font-bold">Post to Slack</h2><p className="text-sm text-gray-500">Tag owners and share action items.</p></div>
        <button onClick={onClose} className="text-gray-400 text-xl">✕</button>
      </div>
      {res.length>0?(
        <div className="space-y-2">{res.map((r,i)=><div key={i} className={`p-3 rounded-lg text-sm ${r.ok?"bg-green-50 text-green-700":"bg-red-50 text-red-700"}`}>{r.ok?"✓ Posted to "+r.n:"✕ Failed: "+r.n}</div>)}<div className="flex justify-end mt-2"><button onClick={onClose} className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white">Done</button></div></div>
      ):(
        <>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Channels</p>
          {SLACK_CHS.map(ch=><label key={ch.id} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"><input type="checkbox" checked={sc.includes(ch.id)} onChange={()=>setSc(s=>s.includes(ch.id)?s.filter(x=>x!==ch.id):[...s,ch.id])} className="accent-indigo-600"/><span className="text-sm">{ch.name}</span></label>)}
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2 mt-4">Items ({si.length})</p>
          <div className="max-h-36 overflow-y-auto border rounded-lg p-2 space-y-1">
            {ai.map(i=><label key={i.id} className="flex items-start gap-2 p-1.5 rounded hover:bg-gray-50 cursor-pointer"><input type="checkbox" checked={si.includes(i.id)} onChange={()=>setSi(s=>s.includes(i.id)?s.filter(x=>x!==i.id):[...s,i.id])} className="mt-0.5 accent-indigo-600"/><div><p className="text-sm">{i.title}</p><p className="text-xs text-gray-400">{i.owner} · {i.status}</p></div></label>)}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border">Cancel</button>
            <button onClick={send} disabled={busy||!sc.length||!si.length} className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white disabled:opacity-40">{busy?"Posting...":"Post to Slack"}</button>
          </div>
        </>
      )}
    </div></Modal>
  );
}

function MergeModal({items,ids,onMerge,onClose}){
  const sel=items.filter(i=>ids.includes(i.id));
  const [pid,setPid]=useState(ids[0]);
  const prim=sel.find(i=>i.id===pid)||sel[0];
  if(!prim)return null;
  const others=sel.filter(i=>i.id!==pid);
  const mn=[...new Set(sel.map(i=>i.notes).filter(Boolean))].join("\n---\n");
  const hp=["High","Medium","Low"].find(p=>sel.some(i=>i.priority===p));
  return(
    <Modal><div className="bg-white rounded-2xl shadow-xl p-5">
      <h2 className="text-lg font-bold mb-2">Merge {sel.length} Items</h2>
      <p className="text-sm text-gray-500 mb-4">Pick the primary title to keep.</p>
      <div className="space-y-2 mb-4">{sel.map(i=><label key={i.id} className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer ${pid===i.id?"border-indigo-500 bg-indigo-50":"border-gray-200"}`}><input type="radio" name="p" checked={pid===i.id} onChange={()=>setPid(i.id)} className="mt-0.5 accent-indigo-600"/><div><p className="text-sm font-medium">{i.title}</p><p className="text-xs text-gray-400">{i.owner} · {i.status}</p></div></label>)}</div>
      <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 mb-4"><p><strong>Priority:</strong> {hp}</p><p><strong>Notes:</strong> {mn?"combined":"none"}</p></div>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border">Cancel</button>
        <button onClick={()=>onMerge(prim,others,mn,hp)} className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white">Merge</button>
      </div>
    </div></Modal>
  );
}

function Scratchpad({pad,save}){
  const [at,setAt]=useState(TEAMS[0].id);
  const [tab,setTab]=useState("q");
  const [inp,setInp]=useState({q:"",d:"",df:"",dt:""});
  const p=pad[at]||{q:[],d:[],df:[],dt:[],n:""};
  const sp=fn=>save(s=>({...s,[at]:fn(s[at]||{q:[],d:[],df:[],dt:[],n:""})}));
  const si=(k,v)=>setInp(i=>({...i,[k]:v}));
  const add=(lk,ik)=>{const v=inp[ik].trim();if(!v)return;sp(x=>({...x,[lk]:[...(x[lk]||[]),{id:Date.now(),text:v,done:false}]}));si(ik,"");};
  const tog=(lk,id)=>sp(x=>({...x,[lk]:x[lk].map(i=>i.id===id?{...i,done:!i.done}:i)}));
  const rm=(lk,id)=>sp(x=>({...x,[lk]:x[lk].filter(i=>i.id!==id)}));
  const team=TEAMS.find(t=>t.id===at)||TEAMS[0];
  const cnt=tid=>{const x=pad[tid];if(!x)return 0;return (x.q||[]).length+(x.d||[]).length+(x.df||[]).length+(x.dt||[]).length;};
  const List=({lk,ik,ph,bc})=>(
    <div className="space-y-2">
      <div className="flex gap-2"><input className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none" placeholder={ph} value={inp[ik]} onChange={e=>si(ik,e.target.value)} onKeyDown={e=>e.key==="Enter"&&add(lk,ik)}/><button onClick={()=>add(lk,ik)} className={`px-3 py-2 rounded-lg text-sm text-white ${bc}`}>Add</button></div>
      {(p[lk]||[]).length===0&&<p className="text-sm text-gray-300 italic text-center py-3">Nothing yet.</p>}
      {(p[lk]||[]).map(x=><div key={x.id} className={`flex items-start gap-3 p-3 rounded-lg border bg-white ${x.done?"opacity-50":""}`}><input type="checkbox" checked={!!x.done} onChange={()=>tog(lk,x.id)} className="mt-0.5 w-4 h-4 accent-indigo-600"/><span className={`flex-1 text-sm ${x.done?"line-through text-gray-400":"text-gray-700"}`}>{x.text}</span><button onClick={()=>rm(lk,x.id)} className="text-gray-300 hover:text-red-400 text-xs">✕</button></div>)}
    </div>
  );
  return(
    <div className="flex" style={{height:"calc(100vh - 130px)"}}>
      <div className="w-36 shrink-0 border-r border-gray-200 bg-white overflow-y-auto">
        {TEAMS.map(t=>{const c=cnt(t.id);return(<button key={t.id} onClick={()=>setAt(t.id)} className={`w-full text-left px-2 py-2 flex items-center gap-1.5 hover:bg-gray-50 border-b border-gray-50 ${at===t.id?"bg-indigo-50 border-r-2 border-indigo-500":""}`}><span className={`w-2 h-2 rounded-full ${t.dot} shrink-0`}></span><span className={`text-xs flex-1 leading-tight ${at===t.id?"font-semibold text-indigo-700":"text-gray-700"}`}>{t.label}</span>{c>0&&<span className="text-[9px] bg-indigo-100 text-indigo-700 rounded-full px-1">{c}</span>}</button>);})}
      </div>
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="bg-white border-b px-4 py-3 sticky top-0 z-10">
          <div className="flex items-center gap-2 mb-2"><span className={`w-2.5 h-2.5 rounded-full ${team.dot}`}></span><div><p className="font-bold text-gray-800 text-sm">{team.label}</p><p className="text-xs text-gray-400">POC: {team.poc}</p></div></div>
          <div className="flex gap-1 flex-wrap">
            {[{id:"q",lb:"Questions"},{id:"d",lb:"Decisions"},{id:"deps",lb:"Dependencies"},{id:"n",lb:"Notes"}].map(tb=><button key={tb.id} onClick={()=>setTab(tb.id)} className={`px-2 py-1 text-xs rounded-lg font-medium ${tab===tb.id?"bg-indigo-600 text-white":"bg-gray-100 text-gray-600"}`}>{tb.lb}</button>)}
          </div>
        </div>
        <div className="p-4">
          {tab==="q"&&<List lk="q" ik="q" ph="Add open question..." bc="bg-indigo-600"/>}
          {tab==="d"&&<List lk="d" ik="d" ph="Record a decision..." bc="bg-green-600"/>}
          {tab==="deps"&&(
            <div className="space-y-5">
              <div><p className="text-xs font-semibold text-gray-600 uppercase mb-2">We need from {team.label}</p><div className="flex gap-2 mb-2"><input className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none" placeholder="What do we need?" value={inp.df} onChange={e=>si("df",e.target.value)} onKeyDown={e=>e.key==="Enter"&&add("df","df")}/><button onClick={()=>add("df","df")} className="px-3 py-2 rounded-lg text-sm text-white bg-orange-500">Add</button></div>{(p.df||[]).map(x=><div key={x.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-orange-200 bg-orange-50 mb-2"><span className="text-orange-500 text-sm">←</span><span className="flex-1 text-sm">{x.text}</span><button onClick={()=>rm("df",x.id)} className="text-gray-300 text-xs">✕</button></div>)}</div>
              <div><p className="text-xs font-semibold text-gray-600 uppercase mb-2">They need from us</p><div className="flex gap-2 mb-2"><input className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none" placeholder="What they need?" value={inp.dt} onChange={e=>si("dt",e.target.value)} onKeyDown={e=>e.key==="Enter"&&add("dt","dt")}/><button onClick={()=>add("dt","dt")} className="px-3 py-2 rounded-lg text-sm text-white bg-blue-500">Add</button></div>{(p.dt||[]).map(x=><div key={x.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-blue-200 bg-blue-50 mb-2"><span className="text-blue-500 text-sm">→</span><span className="flex-1 text-sm">{x.text}</span><button onClick={()=>rm("dt",x.id)} className="text-gray-300 text-xs">✕</button></div>)}</div>
            </div>
          )}
          {tab==="n"&&<textarea className="w-full border rounded-xl px-4 py-3 text-sm outline-none resize-none bg-white" rows={12} placeholder={"Live notes for "+team.label+"..."} value={p.n||""} onChange={e=>sp(x=>({...x,n:e.target.value}))}/>}
        </div>
      </div>
    </div>
  );
}

export default function App(){
  const [items,setItems]=useState(null);
  const [pad,setPad]=useState(null);
  const [nid,setNid]=useState(20);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [syncing,setSyncing]=useState(false);
  const [lastSync,setLastSync]=useState(null);
  const [pendingDupes,setPendingDupes]=useState([]);
  const [view,setView]=useState("kanban");
  const [modal,setModal]=useState(null);
  const [mergeMode,setMergeMode]=useState(false);
  const [selIds,setSelIds]=useState([]);
  const [fOwner,setFOwner]=useState("All");
  const [fStatus,setFStatus]=useState("All");
  const [q,setQ]=useState("");

  const runSync = (currentItems, currentNid) => {
    if (syncing) return;
    setSyncing(true);
    let id = currentNid;
    syncFromSlack(
      currentItems,
      (fresh) => {
        const toAdd = fresh.map(f=>({title:"",notes:"",owner:"Priyanka",type:"Action Item",status:"Backlog",priority:"Medium",team:"core",...f,id:id++,ft:true,fromSlack:true}));
        setItems(its => { const n=[...(its||[]),...toAdd]; persist(n,id); return n; });
        setNid(id);
      },
      (dupes) => { setPendingDupes(d=>[...d,...dupes]); },
      () => { setSyncing(false); setLastSync(new Date()); }
    );
  };

  useEffect(()=>{
    (async()=>{
      const [it,pd,id]=await Promise.all([sLoad("dv2-v5-items",SEED),sLoad("dv2-v5-pad",INIT_PAD()),sLoad("dv2-v5-nid",20)]);
      setItems(it); setPad(pd); setNid(id); setLoading(false);
      // Auto-sync from Slack on open
      runSync(it, id);
    })();
  },[]);

  const persist=async(it,id)=>{setSaving(true);await Promise.all([sSave("dv2-v5-items",it),sSave("dv2-v5-nid",id)]);setSaving(false);};
  const persistPad=async(p)=>{setSaving(true);await sSave("dv2-v5-pad",p);setSaving(false);};

  const onChange=(id,fields)=>setItems(its=>{const n=its.map(i=>i.id===id?{...i,...fields}:i);persist(n,nid);return n;});
  const onDelete=(id)=>setItems(its=>{const n=its.filter(i=>i.id!==id);persist(n,nid);return n;});
  const onMove=(id,s)=>setItems(its=>{const n=its.map(i=>i.id===id?{...i,status:s}:i);persist(n,nid);return n;});

  const addItem=f=>{const n=[...items,{...f,id:nid,ft:false}];setItems(n);persist(n,nid+1);setNid(nid+1);};
  const addFromTranscript=newItems=>{let id=nid;const add=newItems.map(f=>({title:"",notes:"",owner:"Priyanka",type:"Action Item",status:"Backlog",priority:"High",team:"core",...f,id:id++,ft:true}));const n=[...items,...add];setItems(n);persist(n,id);setNid(id);};

  const doMerge=(prim,others,mn,hp)=>{
    const merged={...prim,notes:mn,priority:hp,ft:false};
    const n=items.filter(i=>!others.map(o=>o.id).includes(i.id)).map(i=>i.id===prim.id?merged:i);
    setItems(n);persist(n,nid);setSelIds([]);setMergeMode(false);setModal(null);
  };

  const savePad=fn=>setPad(prev=>{const next=typeof fn==="function"?fn(prev):fn;persistPad(next);return next;});
  const selTog=id=>setSelIds(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);

  const filtered=useMemo(()=>{
    if(!items)return[];
    return items.filter(i=>{
      const om=fOwner==="All"||i.owner===fOwner;
      const sm=fStatus==="All"||i.status===fStatus;
      const qm=!q||i.title.toLowerCase().includes(q.toLowerCase());
      return om&&sm&&qm;
    });
  },[items,fOwner,fStatus,q]);

  const transcripts=(items||[]).filter(i=>i.ft&&!i.fromSlack).length;
  const fromSlack=(items||[]).filter(i=>i.fromSlack&&i.ft).length;
  const blocked=filtered.filter(i=>i.status==="Blocked").length;
  const cardProps={onChange,onDelete,onMove,mergeMode,selIds,onSelect:selTog};

  // Duplicate review modal
  const DupeModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 max-h-screen overflow-y-auto">
        <h2 className="text-lg font-bold mb-1">Possible Duplicates from Slack</h2>
        <p className="text-sm text-gray-500 mb-4">These Slack items may already exist in the tracker. Review each one.</p>
        <div className="space-y-3">
          {pendingDupes.map((d,i)=>{
            const existing = (items||[]).find(it=>it.id===parseInt(d.possibleDuplicateOfId));
            return(
              <div key={i} className="border border-gray-200 rounded-xl p-3">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">From Slack ({d.sourceChannel||"channel"})</p>
                <p className="text-sm font-semibold text-gray-800 mb-1">{d.title}</p>
                {d.notes&&<p className="text-xs text-gray-500 italic mb-2">{d.notes}</p>}
                {existing&&<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 mb-2"><p className="text-xs text-yellow-700 font-semibold mb-0.5">Possible duplicate of:</p><p className="text-xs text-gray-700">{existing.title}</p><p className="text-xs text-gray-400">{existing.owner} · {existing.status}</p></div>}
                <div className="flex gap-2">
                  <button onClick={()=>{
                    const toAdd={...d,id:nid,ft:true,fromSlack:true};
                    setItems(its=>{const n=[...(its||[]),toAdd];persist(n,nid+1);return n;});
                    setNid(n=>n+1);
                    setPendingDupes(p=>p.filter((_,x)=>x!==i));
                  }} className="text-xs bg-indigo-100 text-indigo-700 border border-indigo-300 rounded px-3 py-1">Add anyway</button>
                  <button onClick={()=>setPendingDupes(p=>p.filter((_,x)=>x!==i))} className="text-xs bg-gray-100 text-gray-600 border rounded px-3 py-1">Skip</button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-end mt-4">
          <button onClick={()=>setPendingDupes([])} className="px-4 py-2 text-sm rounded-lg border">Done</button>
        </div>
      </div>
    </div>
  );

  if(loading)return(
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center"><div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div><p className="text-sm text-gray-500">Loading shared tracker...</p></div>
    </div>
  );

  return(
    <div className="min-h-screen bg-slate-50 font-sans pb-12">
      {/* HEADER */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-30 shadow-sm">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-gray-900">Deriv API V2 Tracker</h1>
            <span className="flex items-center gap-1 text-[10px] bg-green-100 text-green-700 rounded-full px-2 py-0.5 font-semibold border border-green-200"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block"></span>LIVE</span>
            {saving&&<span className="text-xs text-indigo-500">Saving…</span>}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {fromSlack>0&&<span className="text-xs bg-blue-100 text-blue-600 border border-blue-200 rounded-full px-2 py-0.5 cursor-pointer" onClick={()=>{}}>💬 {fromSlack} from Slack</span>}
            {transcripts>0&&<span className="text-xs bg-orange-100 text-orange-600 border border-orange-200 rounded-full px-2 py-0.5">⚡ {transcripts} to review</span>}
            {pendingDupes.length>0&&<button onClick={()=>setModal("dupes")} className="text-xs bg-yellow-100 text-yellow-700 border border-yellow-300 rounded-full px-2 py-0.5 font-medium">⚠️ {pendingDupes.length} dupes</button>}
            <button onClick={()=>runSync(items||[], nid)} disabled={syncing} className={`text-xs rounded-lg px-2.5 py-1.5 font-medium border ${syncing?"bg-gray-100 text-gray-400":"bg-white text-gray-700 hover:bg-gray-50"}`}>
              {syncing?"Syncing…":"↻ Sync Slack"}
            </button>
            <button onClick={()=>{setMergeMode(m=>!m);setSelIds([]);}} className={`text-xs rounded-lg px-2.5 py-1.5 font-medium border ${mergeMode?"bg-indigo-600 text-white":"bg-white text-gray-700"}`}>{mergeMode?`Merging (${selIds.length})`:"Merge"}</button>
            {mergeMode&&selIds.length>=2&&<button onClick={()=>setModal("merge")} className="text-xs bg-indigo-600 text-white rounded-lg px-2.5 py-1.5 font-medium">Merge {selIds.length}</button>}
            <button onClick={()=>setModal("transcript")} className="text-xs bg-orange-500 text-white rounded-lg px-2.5 py-1.5 font-medium">Transcript</button>
            <button onClick={()=>setModal("add")} className="text-xs bg-indigo-600 text-white rounded-lg px-2.5 py-1.5 font-medium">+ Add</button>
          </div>
        </div>
        {lastSync&&<p className="text-[10px] text-gray-400 mb-1">Last synced from Slack: {lastSync.toLocaleTimeString()}</p>}
        <div className="flex gap-2 mb-2 flex-wrap">
          <input className="border rounded-lg px-2 py-1 text-xs w-28" placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)}/>
          <select className="border rounded-lg px-2 py-1 text-xs" value={fOwner} onChange={e=>setFOwner(e.target.value)}><option value="All">All owners</option>{MEMBERS.map(m=><option key={m}>{m}</option>)}</select>
          <select className="border rounded-lg px-2 py-1 text-xs" value={fStatus} onChange={e=>setFStatus(e.target.value)}><option value="All">All statuses</option>{STATUSES.map(s=><option key={s}>{s}</option>)}</select>
        </div>
        <div className="flex gap-1">
          {[["kanban","Kanban"],["person","By Person"],["type","By Type"],["scratchpad","Scratchpad"]].map(([v,lb])=>(
            <button key={v} onClick={()=>setView(v)} className={`text-xs px-2.5 py-1 rounded-lg font-medium ${view===v?"bg-indigo-600 text-white":"bg-gray-100 text-gray-600"}`}>{lb}</button>
          ))}
        </div>
      </div>

      {/* KANBAN */}
      {view==="kanban"&&(
        <div className="flex gap-3 p-4 overflow-x-auto" style={{minHeight:"70vh"}}>
          {STATUSES.map(st=>{
            const m=S_COL[st]; const col=filtered.filter(i=>i.status===st);
            return(
              <div key={st} className={`rounded-xl ${m.col} flex-shrink-0`} style={{width:260}}>
                <div className={`flex items-center justify-between px-3 py-2 rounded-t-xl ${m.hdr}`}>
                  <div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${m.dot}`}></span><span className="font-bold text-sm">{st}</span></div>
                  <span className="text-xs bg-white bg-opacity-60 px-1.5 rounded-full font-semibold">{col.length}</span>
                </div>
                <div className="p-2">
                  {col.map(i=><Card key={i.id} item={i} {...cardProps} selected={selIds.includes(i.id)}/>)}
                  <button onClick={()=>setModal("add")} className="w-full text-xs text-gray-400 border-2 border-dashed border-gray-200 rounded-lg py-2 mt-1">+ Add</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* BY PERSON */}
      {view==="person"&&(
        <div className="p-4 space-y-4">
          {MEMBERS.map(person=>{
            const pi=filtered.filter(i=>i.owner===person);
            if(!pi.length)return null;
            return(
              <div key={person} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">{person[0]}</div>
                  <span className="font-semibold text-gray-800">{person}</span>
                  <span className="text-xs text-gray-400">{pi.length} items</span>
                  {pi.filter(i=>i.status==="Blocked").length>0&&<span className="text-xs text-red-500 font-medium">{pi.filter(i=>i.status==="Blocked").length} blocked</span>}
                </div>
                <div className="p-3 grid gap-2" style={{gridTemplateColumns:"repeat(auto-fill,minmax(250px,1fr))"}}>
                  {pi.map(i=><Card key={i.id} item={i} {...cardProps} selected={selIds.includes(i.id)}/>)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* BY TYPE */}
      {view==="type"&&(
        <div className="p-4 space-y-4">
          {TYPES.map(type=>{
            const ti=filtered.filter(i=>i.type===type);
            if(!ti.length)return null;
            return(
              <div key={type} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 border-b bg-gray-50 flex items-center justify-between">
                  <Pill cls={T_COLOR[type]||"bg-gray-100 text-gray-600"}>{type}</Pill>
                  <span className="text-xs text-gray-400">{ti.length} items</span>
                </div>
                <div className="p-3 grid gap-2" style={{gridTemplateColumns:"repeat(auto-fill,minmax(250px,1fr))"}}>
                  {ti.map(i=><Card key={i.id} item={i} {...cardProps} selected={selIds.includes(i.id)}/>)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SCRATCHPAD */}
      {view==="scratchpad"&&pad&&<Scratchpad pad={pad} save={savePad}/>}

      {/* STATUS BAR */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-4 py-2 flex gap-3 text-xs text-gray-500 z-20 flex-wrap">
        {STATUSES.map(s=><span key={s} className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${S_COL[s].dot}`}></span>{s.split(" ")[0]}: <strong>{filtered.filter(i=>i.status===s).length}</strong></span>)}
        {blocked>0&&<span className="text-red-500 font-semibold">{blocked} blocked</span>}
        <span className="ml-auto"><strong>{filtered.length}</strong> items</span>
      </div>

      {modal==="add"        &&<AddModal onAdd={addItem} onClose={()=>setModal(null)}/>}
      {modal==="transcript" &&<TranscriptModal items={items||[]} onAdd={addFromTranscript} onClose={()=>setModal(null)}/>}
      {modal==="slack"      &&<SlackModal items={items||[]} onClose={()=>setModal(null)}/>}
      {modal==="merge"      &&<MergeModal items={items||[]} ids={selIds} onMerge={doMerge} onClose={()=>setModal(null)}/>}
      {modal==="dupes"      &&<DupeModal/>}
    </div>
  );
}
