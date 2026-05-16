import { useState, useEffect, useRef } from "react";
const SUPA_URL = "https://nemmhucubeozvlhncivu.supabase.co";
const SUPA_KEY = "sb_publishable_z1BlRpR03jJTUNRKiaB1ZQ_avox17xS";

async function supa(path, method = "GET", body = null) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    method,
    headers: {
      "apikey": SUPA_KEY,
      "Authorization": `Bearer ${SUPA_KEY}`,
      "Content-Type": "application/json",
      "Prefer": method === "POST" ? "resolution=merge-duplicates" : "",
    },
    body: body ? JSON.stringify(body) : null,
  });
  if (method === "DELETE" || res.status === 204) return null;
  return res.json();
}

// ─── COLORS ───────────────────────────────────────────────────────────────────
const C = {
  bg: "#0a0a12", surface: "#0f0f1a", card: "#14141f", card2: "#1a1a28",
  border: "#1e1e32", accent: "#6c63ff", accentGlow: "#6c63ff40",
  green: "#00c896", red: "#e84393", yellow: "#c8a830", blue: "#5b6bff",
    orange: "#FF9500",
  text: "#eeeeff", sub: "#8888aa", muted: "#44445a", purple: "#a07cff",
  teal: "#00e5c8",
};

function pColor(p) {
    if (p === 100) return C.green;
    if (p >= 70) return C.blue;
    if (p >= 40) return C.yellow;
  if (p >= 1 && p <= 5) return C.orange;
  return C.red;
}

// Cell background colors based on progress
function cellBg(p) {
    if (p >= 1 && p <= 5) return { bg: C.card, border: C.orange };
    if (p >= 40) return { bg: C.card, border: C.yellow };
    return { bg: C.card, border: C.red };
}

// gradient bar colors matching screenshot
function barGrad(p) {
  if (p >= 70) return `linear-gradient(90deg, #5b6bff, #a07cff)`;
  if (p >= 40) return `linear-gradient(90deg, #6c63ff, #c8a830)`;
    if (p >= 1 && p <= 5) return `linear-gradient(90deg, #FF9500, #FFA500)`;
  return `linear-gradient(90deg, #6c63ff, #e84393)`;
}

const ROW_LABELS = ["独占", "互角", "通常"];
const COL_LABELS = ["販売", "本社", "生産"];
const TYPES = ["人", "物", "金"];
const STATUS_LIST = ["未着手", "準備", "実行", "改善", "完了"];
const PRIORITY_LIST = ["低", "中", "高"];
const MEMBER_COLORS = ["#6c63ff","#00c896","#c8a830","#5b6bff","#e84393","#ff9f7c","#a07cff"];
const PHASE_COLORS = ["#6c63ff","#00c896","#c8a830","#5b6bff","#e84393","#00e5c8","#a07cff","#ff9f7c"];

// ─── PROJECT HELPERS ────────────────────────────────────────────────────────
const PROJ_LIST_KEY='trizos_projects_v1';
const ACTIVE_PROJ_KEY='trizos_active_proj';
function getProjectsList(){try{const s=localStorage.getItem(PROJ_LIST_KEY);return s?JSON.parse(s):[{id:'default',name:'プロジェクト1'}];}catch{return[{id:'default',name:'プロジェクト1'}];}}
function saveProjectsList(list){localStorage.setItem(PROJ_LIST_KEY,JSON.stringify(list));saveProjectsToSB(list);}
function getActiveProjId(){return localStorage.getItem(ACTIVE_PROJ_KEY)||'default';}
window._activeProjId=localStorage.getItem('trizos_active_proj')||'default';
async function saveProjectsToSB(list){try{await supa('trizos_cells','POST',{key:'__proj_list__',data:JSON.stringify(list)});}catch(e){}}
async function loadProjectsFromSB(){try{const r=await supa('trizos_cells?select=data&key=eq.__proj_list__');if(r&&r.length)return JSON.parse(r[0].data);}catch(e){}return null;}
async function loadProjectCells(pid){return await loadCells(pid);}

function buildInitialCells() {
  const cells = {};
  ROW_LABELS.forEach(row => COL_LABELS.forEach(col => TYPES.forEach(t1 => TYPES.forEach(t2 => {
    const key = `${row}__${col}__${t1}__${t2}`;
    cells[key] = {
      key, row, col, type1: t1, type2: t2,
      name: `${row}化の${col} ${t1}×${t2}戦略`,
      progress: 0, status: "未着手", priority: "中",
      assignee: "", startDate: "", deadline: "",
      kpi: "", kgi: "", ksf: "", risk: "", next: "",
      description: `${row}領域における「${col}」の${t1}×${t2}の打ち手。`,
      income: 0, expense: 0, tasks: [],
    };
  }))));
  return cells;
}

async function loadCells(pid='default') {
  try {
    const filter = pid === 'default'
      ? 'key=not.like.*:*&key=neq.__proj_list__'
      : 'key=like.' + pid + ':*';
    const base = buildInitialCells();
    const rows = await supa('trizos_cells?select=key,data&' + filter);
    const pfxLen = pid === 'default' ? 0 : pid.length + 1;
    rows.forEach(r => {
      const k = pfxLen ? r.key.substring(pfxLen) : r.key;
      if (base[k]) base[k] = { ...base[k], ...r.data, tasks: r.data.tasks || [] };
    });
    return base;
  } catch { return buildInitialCells(); }
}
async function saveCell(cell) {
  const _sbKey=(window._activeProjId&&window._activeProjId!=="default")?window._activeProjId+":"+cell.key:cell.key;
  try {
    const res = await fetch(`${SUPA_URL}/rest/v1/trizos_cells`, {
      method: "POST",
      headers: {
        "apikey": SUPA_KEY,
        "Authorization": `Bearer ${SUPA_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify({ key: _sbKey, data: cell }),
    });
    const txt = await res.text();
    if (!res.ok) {
      console.error("saveCell error", res.status, txt);
      alert(`保存エラー (${res.status}): ${txt}`);
    }
  } catch(e) {
    console.error("saveCell exception", e);
    alert(`保存例外: ${e.message}`);
  }
}
async function loadMembers() {
  try {
    const rows = await supa("trizos_members?select=*");
    if (rows?.length) return rows;
    return [{ id:"m1",name:"代表",color:"#6c63ff"},{id:"m2",name:"COO",color:"#00c896"},{id:"m3",name:"CFO",color:"#c8a830"}];
  } catch { return []; }
}
async function saveMember(m) { try { await supa("trizos_members","POST",m); } catch {} }
async function deleteMember(id) { try { await supa(`trizos_members?id=eq.${id}`,"DELETE"); } catch {} }

async function loadGlobalPlan() {
  try {
    const rows = await supa("trizos_plan?id=eq.main&select=data");
    if (rows?.length) return rows[0].data;
  } catch {}
  return { projectName: "", startDate: "", endDate: "", phases: [], payments: [] };
}
async function saveGlobalPlan(plan) {
  try { await supa("trizos_plan","POST",{ id:"main", data:plan }); } catch {}
}

function cellToId(key) {
  return "c_" + btoa(encodeURIComponent(key)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
}
function idToKey(id) {
  const b = id.slice(2).replace(/-/g,"+").replace(/_/g,"/");
  const p = b.length%4===0?"":"=".repeat(4-b.length%4);
  try { return decodeURIComponent(atob(b+p)); } catch { return ""; }
}
function lsKey(key) { return `trizos_plan_${key}`; }
async function loadCellPlansIndex() {
  const result = new Set();
  // localStorage（メイン）：キー形式 trizos_plan_<cellKey>
  for (let i=0; i<localStorage.length; i++) {
    const k=localStorage.key(i);
    if (k?.startsWith("trizos_plan_") && k.slice(12).includes("__")) { result.add(k.slice(12)); }
  }
  // Supabase（サブ・失敗しても無視）
  try { const rows=await supa("trizos_plan?select=id"); rows?.filter(r=>r.id.startsWith("c_")).forEach(r=>{const ck=idToKey(r.id);if(ck)result.add(ck);}); } catch {}
  return result;
}
async function loadCellPlan(key) {
  try { const ls=localStorage.getItem(lsKey(key)); if(ls) return JSON.parse(ls); } catch {}
  try { const rows=await supa(`trizos_plan?id=eq.${cellToId(key)}&select=data`); if(rows?.length)return rows[0].data; } catch {}
  return { projectName:"", startDate:"", endDate:"", phases:[], payments:[] };
}
async function saveCellPlan(key, plan) {
  try { localStorage.setItem(lsKey(key), JSON.stringify(plan)); } catch {} // 必ず保存
  try { await supa("trizos_plan","POST",{id:cellToId(key),data:plan}); } catch {} // サブ
}
function savePlan(cellKey, data) {
  try { localStorage.setItem(lsKey(cellKey), JSON.stringify(data)); } catch {}
}
function loadPlan(cellKey) {
  try { const s = localStorage.getItem(lsKey(cellKey)); return s ? JSON.parse(s) : null; } catch { return null; }
}
function hasPlan(cellKey) {
  try { return !!localStorage.getItem(lsKey(cellKey)); } catch { return false; }
}

// ─── CIRCLE SVG ───────────────────────────────────────────────────────────────
function Ring({ pct, size=72, stroke=6 }) {
  const r=(size-stroke*2)/2, circ=2*Math.PI*r, dash=(pct/100)*circ, col=pColor(pct);
  return (
    <svg width={size} height={size} style={{transform:"rotate(-90deg)",flexShrink:0}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col}
        strokeWidth={stroke} strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{transition:"stroke-dasharray 0.5s",filter:`drop-shadow(0 0 4px ${col}88)`}}/>
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
        fill={col} fontSize={size*0.19} fontWeight="900"
        style={{transform:"rotate(90deg)",transformOrigin:"center",fontFamily:"monospace"}}>
        {pct}%
      </text>
    </svg>
  );
}

// ─── BIG RING for DASH ────────────────────────────────────────────────────────
function BigRing({ pct, size=120 }) {
  const stroke=10, r=(size-stroke*2)/2, circ=2*Math.PI*r, dash=(pct/100)*circ;
  const col = pct>=70?C.yellow:pct>=40?"#c8a830":C.red;
  return (
    <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1e1e32" strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col}
        strokeWidth={stroke} strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{filter:`drop-shadow(0 0 8px ${col}88)`}}/>
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
        fill={col} fontSize={size*0.18} fontWeight="900"
        style={{transform:"rotate(90deg)",transformOrigin:"center",fontFamily:"monospace"}}>
        {pct}%
      </text>
    </svg>
  );
}

// ─── TASK SECTION ─────────────────────────────────────────────────────────────
function TaskSection({ tasks, onChange }) {
  const [input, setInput] = useState("");
  function addTask() { const t=input.trim(); if(!t)return; onChange([...tasks,{id:Date.now()+"",text:t,done:false}]); setInput(""); }
  function toggle(id) { onChange(tasks.map(t=>t.id===id?{...t,done:!t.done}:t)); }
  function remove(id) { onChange(tasks.filter(t=>t.id!==id)); }
  function editText(id,val) { onChange(tasks.map(t=>t.id===id?{...t,text:val}:t)); }
  const done=tasks.filter(t=>t.done).length;
  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:14,marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <span style={{fontSize:11,fontWeight:700,color:C.sub,letterSpacing:"0.08em",textTransform:"uppercase"}}>タスク</span>
        {tasks.length>0&&<span style={{fontSize:11,color:done===tasks.length?C.green:C.sub}}>{done}/{tasks.length} 完了</span>}
      </div>
      {tasks.map(t=>(
        <div key={t.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:`1px solid ${C.border}`}}>
          <button onClick={()=>toggle(t.id)} style={{width:20,height:20,borderRadius:5,border:`2px solid ${t.done?C.green:C.border}`,background:t.done?C.green+"33":"transparent",cursor:"pointer",flexShrink:0,color:C.green,fontSize:11}}>
            {t.done?"✓":""}
          </button>
          <input value={t.text} onChange={e=>editText(t.id,e.target.value)}
            style={{flex:1,background:"none",border:"none",color:t.done?C.muted:C.text,fontSize:13,outline:"none",textDecoration:t.done?"line-through":"none",fontFamily:"inherit"}}/>
          <button onClick={()=>remove(t.id)} style={{background:"none",border:"none",color:C.muted,fontSize:16,cursor:"pointer"}}>×</button>
        </div>
      ))}
      <div style={{display:"flex",gap:8,marginTop:tasks.length?10:0}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTask()}
          placeholder="タスクを追加..." style={{...inp,flex:1,padding:"8px 10px"}}/>
        <button onClick={addTask} style={{padding:"8px 16px",borderRadius:9,border:"none",background:C.accentGlow,color:C.accent,fontWeight:800,fontSize:15,cursor:"pointer"}}>+</button>
      </div>
    </div>
  );
}

// ─── CELL MODAL ───────────────────────────────────────────────────────────────
function CellModal({ cell, onClose, onSave, matrix, onOpenPlan, onProgressChange, onAutoSave, cellPlansIndex }) {
  const [d, setD] = useState({...cell, tasks: cell.tasks||[]});
  const [editingName, setEditingName] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const profit = (d.income||0)-(d.expense||0);
  const nameRef = useRef();

  async function runAI() {
    setAiLoading(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,
          messages:[{role:"user",content:`経営戦略の専門家として以下を日本語で分析。200文字以内、箇条書き。\nセル:${d.name}\nステータス:${d.status} 進捗:${d.progress}%\nKPI:${d.kpi||"未設定"} KSF:${d.ksf||"未設定"}\nリスク:${d.risk||"未設定"}\n売上:¥${(d.income||0).toLocaleString()} コスト:¥${(d.expense||0).toLocaleString()}\n次:${d.next||"未設定"}`}]})
      });
      const j=await res.json();
      setAiText(j.content?.[0]?.text||"分析できませんでした。");
    } catch { setAiText("APIエラーが発生しました。"); }
    setAiLoading(false);
  }

  return (
    <div style={{position:"fixed",inset:0,background:"#000b",zIndex:300,overflow:"hidden"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:480,margin:"0 auto",background:C.surface,minHeight:"100vh",height:"100%",overflowY:"auto",WebkitOverflowScrolling:"touch"}}>

        {/* HEADER */}
        <div style={{padding:"20px 18px 16px",borderBottom:`1px solid ${C.border}`}}>
          <div style={{display:"flex",alignItems:"flex-start",gap:14,marginBottom:14}}>
            <Ring pct={d.progress} size={72}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:11,color:C.sub,marginBottom:4}}>{d.row} / {d.col} / {d.type1}×{d.type2}</div>
              {editingName
                ? <input ref={nameRef} autoFocus value={d.name} onChange={e=>setD(p=>({...p,name:e.target.value}))}
                    onBlur={()=>setEditingName(false)} onKeyDown={e=>e.key==="Enter"&&setEditingName(false)}
                    style={{...inp,fontSize:17,fontWeight:800,padding:"5px 8px",width:"100%"}}/>
                : <div onClick={()=>{setEditingName(true);setTimeout(()=>nameRef.current?.focus(),50)}}
                    style={{fontSize:17,fontWeight:800,color:C.text,lineHeight:1.3,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
                    {d.name}<span style={{fontSize:12,color:C.muted}}>✎</span>
                  </div>
              }
              <div style={{display:"flex",gap:7,marginTop:8,flexWrap:"wrap"}}>
                <span style={{padding:"4px 12px",borderRadius:20,background:C.accentGlow,color:C.accent,fontSize:11,fontWeight:700}}>{d.status}</span>
                <span style={{padding:"4px 12px",borderRadius:20,background:d.priority==="高"?"#e8439322":d.priority==="中"?"#c8a83022":"#2a2a44",color:d.priority==="高"?C.red:d.priority==="中"?C.yellow:C.muted,fontSize:11,fontWeight:700}}>優先度: {d.priority}</span>
              </div>
            </div>
            <button onClick={onClose} style={{width:36,height:36,borderRadius:"50%",background:C.card,border:`1px solid ${C.border}`,color:C.sub,fontSize:16,cursor:"pointer",flexShrink:0}}>✕</button>
          </div>

          {/* PROGRESS */}
          <div style={{marginBottom:12}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <input type="range" min={0} max={100} value={d.progress}
                onChange={e=>setD(p=>({...p,progress:parseInt(e.target.value)}))}
                style={{flex:1,accentColor:pColor(d.progress),height:6}}/>
              <span style={{fontSize:15,fontWeight:900,color:pColor(d.progress),minWidth:44}}>{d.progress}%</span>
            </div>
          </div>

          {/* STATUS BUTTONS */}
          <div style={{display:"flex",gap:3}}>
            {STATUS_LIST.map(s=>(
              <button key={s} onClick={()=>setD(p=>({...p,status:s}))}
                style={{flex:1,padding:"8px 0",borderRadius:9,border:`1px solid ${d.status===s?C.accent:C.border}`,fontSize:10,fontWeight:700,cursor:"pointer",background:d.status===s?C.accentGlow:C.card2,color:d.status===s?C.accent:C.muted}}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* BODY */}
        <div style={{padding:18}}>
          {/* BASIC */}
          <Sec label="基本情報">
            <FRow label="担当者"><input value={d.assignee} onChange={e=>setD(p=>({...p,assignee:e.target.value}))} placeholder="担当者名を入力..." style={inp}/></FRow>
            <FRow label="開始日"><input type="date" value={d.startDate?.replace(/\//g,"-")} onChange={e=>setD(p=>({...p,startDate:e.target.value}))} style={inp}/></FRow>
            <FRow label="期限"><input type="date" value={d.deadline?.replace(/\//g,"-")} onChange={e=>setD(p=>({...p,deadline:e.target.value}))} style={inp}/></FRow>
            <FRow label="優先度">
              <div style={{display:"flex",gap:6}}>
                {PRIORITY_LIST.map(p=>(
                  <button key={p} onClick={()=>setD(prev=>({...prev,priority:p}))}
                    style={{flex:1,padding:"9px 0",borderRadius:9,border:`1px solid ${d.priority===p?(p==="高"?C.red:p==="中"?C.yellow:C.blue):C.border}`,fontSize:12,fontWeight:700,cursor:"pointer",background:d.priority===p?(p==="高"?C.red+"22":p==="中"?C.yellow+"22":C.blue+"22"):C.card2,color:d.priority===p?(p==="高"?C.red:p==="中"?C.yellow:C.blue):C.muted}}>
                    {p}
                  </button>
                ))}
              </div>
            </FRow>
          </Sec>

          {/* TASKS */}
          <TaskSection tasks={d.tasks} onChange={tasks=>{
            const done = tasks.filter(t=>t.done).length;
            const progress = tasks.length ? Math.round(done/tasks.length*100) : d.progress;
            const updated = {...d, tasks, progress};
            setD(updated);
            onSave(updated);
          }}/>

          {/* 4K */}
          <Sec label="4K 戦略項目">
            {[{k:"kpi",label:"KPI",tag:"数値目標",color:C.blue},{k:"kgi",label:"KGI",tag:"重要目標指標",color:C.orange},{k:"ksf",label:"KSF",tag:"サクセスファクター",color:C.green},{k:"risk",label:"RISK",tag:"リスクファクター",color:C.red},{k:"next",label:"NEXT",tag:"次にやる事",color:C.purple}].map(({k,label,tag,color})=>{
              const filled = d[k]?.trim().length > 0;
              return (
              <div key={k} style={{background:filled ? C.card : "#ffffff",border:`1px solid ${filled ? color+"66" : "#e0e0e0"}`,borderLeft:`3px solid ${filled ? color : "#d0d0d0"}`,borderRadius:12,padding:14,marginBottom:10}}>
                <div style={{display:"flex",gap:8,marginBottom:8,alignItems:"center"}}>
                  <span style={{fontSize:11,fontWeight:800,color:filled ? color : C.muted,letterSpacing:"0.06em"}}>{label}</span>
                  <span style={{fontSize:10,color:C.muted}}>{tag}</span>
                </div>
                <textarea value={d[k]} onChange={e=>setD(p=>({...p,[k]:e.target.value}))}
                  rows={2} placeholder={`${label}を入力...`} style={{...inp,resize:"none",fontFamily:"inherit"}}/>
              </div>
            );
            })}
          </Sec>

          {/* RIVAL (販売 only) */}
          {d.col === "販売" && (
          <Sec label="ライバル会社データ">
            {(d.rivals||[]).map((r,i)=>(
              <div key={i} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:12,marginBottom:10,position:"relative"}}>
                <button onClick={()=>setD(p=>({...p,rivals:(p.rivals||[]).filter((_,j)=>j!==i)}))}
                  style={{position:"absolute",top:8,right:8,background:"none",border:"none",color:C.muted,fontSize:18,cursor:"pointer"}}>×</button>
                {[
                  {k:"name",label:"会社名",rows:1},
                  {k:"business",label:"業務内容",rows:2},
                  {k:"unique",label:"独自の特化したサービス",rows:2},
                  {k:"weakness",label:"弱点",rows:2},
                  {k:"strength",label:"向こうの強み",rows:2},
                  {k:"memo",label:"メモ",rows:2},
                ].map(({k,label,rows})=>(
                  <div key={k} style={{marginBottom:8}}>
                    <div style={{fontSize:11,color:C.sub,marginBottom:4}}>{label}</div>
                    {rows===1
                      ? <input value={r[k]||""} onChange={e=>{const v=e.target.value;setD(p=>({...p,rivals:(p.rivals||[]).map((x,j)=>j===i?{...x,[k]:v}:x)}))}} placeholder={`${label}を入力...`} style={inp}/>
                      : <textarea value={r[k]||""} onChange={e=>{const v=e.target.value;setD(p=>({...p,rivals:(p.rivals||[]).map((x,j)=>j===i?{...x,[k]:v}:x)}))}} rows={rows} placeholder={`${label}を入力...`} style={{...inp,resize:"none",fontFamily:"inherit"}}/>
                    }
                  </div>
                ))}
              </div>
            ))}
            <button onClick={()=>setD(p=>({...p,rivals:[...(p.rivals||[]),{name:"",business:"",unique:"",weakness:"",strength:"",memo:""}]}))}
              style={{width:"100%",padding:"10px 0",borderRadius:10,border:`1px dashed ${C.accent}`,background:"transparent",color:C.accent,fontWeight:700,fontSize:13,cursor:"pointer"}}>
              + ライバル会社を追加
            </button>
          </Sec>
          )}

          {/* DESC */}
          <Sec label="説明">
            <textarea value={d.description} onChange={e=>setD(p=>({...p,description:e.target.value}))} rows={3} style={{...inp,resize:"none",fontFamily:"inherit"}}/>
          </Sec>

          {/* FINANCE */}
          <Sec label="財務">
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
              <div>
                <div style={{fontSize:11,color:C.sub,marginBottom:5}}>売上（円）</div>
                <input type="number" value={d.income||""} onChange={e=>setD(p=>({...p,income:parseInt(e.target.value)||0}))} placeholder="0" style={inp}/>
              </div>
              <div>
                <div style={{fontSize:11,color:C.sub,marginBottom:5}}>コスト（円）</div>
                <input type="number" value={d.expense||""} onChange={e=>setD(p=>({...p,expense:parseInt(e.target.value)||0}))} placeholder="0" style={inp}/>
              </div>
            </div>
            <div style={{fontSize:14,fontWeight:800,color:profit>=0?C.green:C.red}}>
              粗利: {profit>=0?"+":""}{profit.toLocaleString()} 円
            </div>
          </Sec>

          {/* AI */}
          <Sec label="AI 戦略分析">
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:16,marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                <div style={{width:32,height:32,borderRadius:9,background:C.accentGlow,border:`1px solid ${C.accent}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>✦</div>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:C.text}}>AI 戦略分析</div>
                  <div style={{fontSize:10,color:C.muted}}>経営の脳によるレビュー</div>
                </div>
                <div style={{flex:1,height:60,borderRadius:8,background:`radial-gradient(ellipse at 100% 50%, ${C.accentGlow} 0%, transparent 70%)`}}/>
              </div>
              {aiText
                ? <div style={{fontSize:12,color:C.sub,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{aiText}</div>
                : <div style={{fontSize:12,color:C.muted,fontStyle:"italic"}}>ボタンを押してAI分析を実行...</div>
              }
            </div>
            <button onClick={runAI} disabled={aiLoading}
              style={{width:"100%",padding:"12px 0",borderRadius:11,border:`1px solid ${C.accent}`,background:aiLoading?C.card:C.accentGlow,color:C.accent,fontWeight:700,fontSize:13,cursor:aiLoading?"not-allowed":"pointer"}}>
              {aiLoading?"分析中...":"✦ AI分析を実行"}
            </button>
          </Sec>

          <button onClick={()=>onOpenPlan(d)}
            style={{width:"100%",padding:"13px 0",borderRadius:13,border:`1px solid ${hasPlan(d.key)?C.teal:C.accent}`,
              background:hasPlan(d.key)?C.teal+"22":C.accentGlow,
              color:hasPlan(d.key)?C.teal:C.accent,fontWeight:800,fontSize:14,cursor:"pointer",marginTop:6,marginBottom:8}}>
            📋 4K計画書を{hasPlan(d.key)?"確認・編集":"作成"}
          </button>

          <button onClick={()=>{onSave(d);onClose();}}
            style={{width:"100%",padding:"15px 0",borderRadius:13,border:"none",background:`linear-gradient(135deg,${C.accent},${C.purple})`,color:"#fff",fontWeight:800,fontSize:15,cursor:"pointer",marginTop:6}}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

function Sec({label,children}) {
  return <div style={{marginBottom:22}}>
    <div style={{fontSize:11,color:C.sub,letterSpacing:"0.08em",marginBottom:12,textTransform:"uppercase",fontWeight:700}}>{label}</div>
    {children}
  </div>;
}
function FRow({label,children}) {
  return <div style={{display:"flex",alignItems:"center",marginBottom:12,gap:14}}>
    <div style={{fontSize:13,color:C.sub,minWidth:58,flexShrink:0}}>{label}</div>
    <div style={{flex:1}}>{children}</div>
  </div>;
}
const inp = {width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 13px",color:C.text,fontSize:13,boxSizing:"border-box",outline:"none"};

// ─── HOME TAB ─────────────────────────────────────────────────────────────────
function HomeTab({ matrix, onCellClick, cellPlansIndex, selectedBiz, bizNames }) {
  // cell color based on progress
  function cellBg(p) {
    if(p===0) return {bg:"#ffffff",border:"#e0e0e0"};
    if(p>=70) return {bg:"#1a1f3a",border:"#3a4070"};
    if(p>=40) return {bg:"#1f1a0a",border:"#504010"};
    return {bg:"#1f0f18",border:"#50203a"};
  }

  return (
    <div>
      {/* Column headers — 大枠グリッドと完全同期 */}
      <div style={{display:"flex",gap:6,marginBottom:6,paddingLeft:34}}>
        {COL_LABELS.map(c=>(
          <div key={c} style={{flex:1,textAlign:"center",fontSize:13,fontWeight:700,color:C.sub,padding:"4px 0"}}>
            {c}
          </div>
        ))}
      </div>

      {(selectedBiz ? [selectedBiz] : ROW_LABELS).map(row=>(
        <div key={row} style={{display:"grid",gridTemplateColumns:"28px 1fr 1fr 1fr",gap:6,marginBottom:6}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{fontSize:10,color:C.sub,writingMode:"vertical-rl",letterSpacing:"0.1em"}}>{(bizNames&&bizNames[row])||row}</span>
          </div>
          {COL_LABELS.map(col=>{
            const cells=Object.values(matrix).filter(c=>c.row===row&&c.col===col);
            const avg=Math.round(cells.reduce((a,c)=>a+c.progress,0)/cells.length);
            const alerts=cells.filter(c=>c.priority==="高"&&c.progress<50).length;
            return (
              <div key={col} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:13,padding:8}}>
                {/* group header */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <span style={{fontSize:9,color:C.muted,fontWeight:600}}>{row}-{col}</span>
                  <div style={{display:"flex",gap:5,alignItems:"center"}}>
                    {alerts>0&&<span style={{fontSize:9,color:C.red,fontWeight:800,display:"flex",alignItems:"center",gap:2}}>
                      <span style={{width:6,height:6,borderRadius:"50%",background:C.red,display:"inline-block"}}/>
                      {alerts}
                    </span>}
                    <span style={{fontSize:10,fontWeight:800,color:pColor(avg)}}>{avg}%</span>
                  </div>
                </div>
                {/* 3x3 grid */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:3}}>
                  {TYPES.flatMap(t1=>TYPES.map(t2=>{
                    const key=`${row}__${col}__${t1}__${t2}`;
                    const cell=matrix[key]; if(!cell)return null;
                    const {bg,border}=cellBg(cell.progress);
                    const isAlert=cell.priority==="高"&&cell.progress<50;
                    return (
                      <button key={key} onClick={()=>onCellClick(cell)}
                        style={{padding:"5px 3px",borderRadius:7,border:`1px solid ${border}`,background:bg,cursor:"pointer",textAlign:"center",position:"relative"}}>
                        {isAlert&&<span style={{position:"absolute",top:2,right:2,width:5,height:5,borderRadius:"50%",background:C.red,display:"block"}}/>}
                        {cellPlansIndex?.has(key)&&<span style={{position:"absolute",bottom:2,left:2,width:5,height:5,borderRadius:"50%",background:C.teal,display:"block",boxShadow:`0 0 4px ${C.teal}`}}/>}
                        <div style={{fontSize:10,fontWeight:800,color:cell.progress===0?"#cccccc":pColor(cell.progress)}}>{cell.progress}%</div>
                        <div style={{fontSize:7,color:cell.progress===0?"#cccccc":pColor(cell.progress),marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:36,opacity:0.85}}>{cell.name.slice(0,4)}</div>
                      </button>
                    );
                  }))}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* Legend */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:13,padding:14,marginTop:10}}>
        <div style={{fontSize:10,color:C.muted,marginBottom:10,letterSpacing:"0.08em",fontWeight:700}}>LEGEND</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
          {[{l:"完了 (100%)",c:C.green},{l:"順調 (70-99%)",c:C.blue},{l:"注意 (40-69%)",c:C.yellow},{l:"危険 (1-39%)",c:C.red}].map(x=>(
            <div key={x.l} style={{display:"flex",alignItems:"center",gap:7}}>
              <span style={{width:10,height:10,borderRadius:3,background:x.c,display:"inline-block",flexShrink:0,boxShadow:`0 0 6px ${x.c}88`}}/>
              <span style={{fontSize:10,color:C.sub}}>{x.l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── DASH TAB ─────────────────────────────────────────────────────────────────
function DashTab({ matrix, members }) {
  const cells=Object.values(matrix);
  const avgP=Math.round(cells.reduce((a,c)=>a+c.progress,0)/cells.length);
  const completed=cells.filter(c=>c.progress===100).length;
  const danger=cells.filter(c=>c.progress<40).length;
  const kpiCells=cells.filter(c=>c.kpi&&c.kpi.trim());
  const kpiDone=kpiCells.filter(c=>c.progress>=70).length;
  const kpiPct=kpiCells.length?Math.round((kpiDone/kpiCells.length)*100):0;
  const totalIn=cells.reduce((a,c)=>a+(c.income||0),0);
  const totalEx=cells.reduce((a,c)=>a+(c.expense||0),0);
  const profit=totalIn-totalEx;

  // by owner
  const ownerStats=members.map(m=>{
    const oc=cells.filter(c=>c.assignee===m.name);
    const avg=oc.length?Math.round(oc.reduce((a,c)=>a+c.progress,0)/oc.length):0;
    const prf=oc.reduce((a,c)=>a+(c.income||0)-(c.expense||0),0);
    return {...m,count:oc.length,avg,profit:prf};
  }).filter(m=>m.count>0).sort((a,b)=>b.count-a.count);

  // by section
  const secStats=ROW_LABELS.flatMap(row=>COL_LABELS.map(col=>{
    const sc=cells.filter(c=>c.row===row&&c.col===col);
    const avg=Math.round(sc.reduce((a,c)=>a+c.progress,0)/sc.length);
    return {label:`${row}-${col}`,avg};
  }));

  return (
    <div>
      {/* OVERALL card */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:20,marginBottom:12,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,right:0,width:120,height:120,background:`radial-gradient(circle at 80% 20%, ${C.accentGlow} 0%, transparent 70%)`}}/>
        <div style={{display:"flex",alignItems:"center",gap:20}}>
          <BigRing pct={avgP}/>
          <div>
            <div style={{fontSize:10,color:C.muted,letterSpacing:"0.1em",marginBottom:4}}>OVERALL</div>
            <div style={{fontSize:36,fontWeight:900,color:C.yellow,lineHeight:1}}>{avgP}%</div>
            <div style={{fontSize:11,color:C.sub,marginTop:4}}>81 戦略マスの平均進捗</div>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:16}}>
          {[{l:"完了",v:`${completed}/81`,c:C.green,bg:"#00c89620"},{l:"危険案件",v:danger,c:C.red,bg:"#e8439320"},{l:"KPI達成",v:`${kpiPct}%`,c:C.yellow,bg:"#c8a83020"}].map(k=>(
            <div key={k.l} style={{background:k.bg,borderRadius:10,padding:"10px 8px",border:`1px solid ${k.c}44`}}>
              <div style={{fontSize:10,color:k.c,fontWeight:700,marginBottom:3}}>{k.l}</div>
              <div style={{fontSize:18,fontWeight:900,color:k.c}}>{k.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* PROFIT */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:16,marginBottom:12}}>
        <div style={{fontSize:10,color:C.muted,letterSpacing:"0.1em",marginBottom:12,fontWeight:700}}>PROFIT</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          {[{l:"売上",v:Math.round(totalIn/10000),c:C.purple},{l:"コスト",v:Math.round(totalEx/10000),c:C.sub},{l:"粗利",v:Math.round(profit/10000),c:profit>=0?C.teal:C.red}].map(k=>(
            <div key={k.l}>
              <div style={{fontSize:10,color:C.sub,marginBottom:3}}>{k.l}</div>
              <div style={{fontSize:18,fontWeight:900,color:k.c}}>{k.v}<span style={{fontSize:11,fontWeight:600}}>万円</span></div>
            </div>
          ))}
        </div>
      </div>

      {/* BY OWNER */}
      {ownerStats.length>0&&(
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:16,marginBottom:12}}>
          <div style={{fontSize:10,color:C.muted,letterSpacing:"0.1em",marginBottom:14,fontWeight:700}}>BY OWNER</div>
          {ownerStats.map(m=>(
            <div key={m.id} style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                <span style={{fontSize:13,color:C.text,fontWeight:600}}>{m.name.length>5?m.name.slice(0,5)+"...":m.name}</span>
                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  <span style={{fontSize:13,fontWeight:700,color:pColor(m.avg)}}>{m.avg}%</span>
                  <span style={{fontSize:11,color:m.profit>=0?C.teal:C.red,fontWeight:600}}>{m.profit>=0?"+":""}{Math.round(m.profit/10000)}万</span>
                </div>
              </div>
              <div style={{background:C.border,borderRadius:6,height:7,overflow:"hidden"}}>
                <div style={{width:`${m.avg}%`,height:"100%",background:barGrad(m.avg),borderRadius:6,transition:"width 0.5s"}}/>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* BY SECTION */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:16}}>
        <div style={{fontSize:10,color:C.muted,letterSpacing:"0.1em",marginBottom:14,fontWeight:700}}>BY SECTION</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          {secStats.map(s=>(
            <div key={s.label} style={{background:C.card2,borderRadius:11,padding:"10px 8px",border:`1px solid ${C.border}`,textAlign:"center"}}>
              <div style={{fontSize:9,color:C.muted,marginBottom:5}}>{s.label}</div>
              <div style={{fontSize:19,fontWeight:900,color:pColor(s.avg)}}>{s.avg}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── ROAD TAB ─────────────────────────────────────────────────────────────────
function RoadTab({ matrix, onOpenPlan }) {
  const [filter, setFilter]=useState("すべて");
  const FILTERS=["すべて","計画あり","計画なし"];

  const allCells=Object.values(matrix);
  let cells=allCells;
  if(filter==="計画あり") cells=allCells.filter(c=>hasPlan(c.key));
  else if(filter==="計画なし") cells=allCells.filter(c=>!hasPlan(c.key));

  return (
    <div>
      {/* Filter pills */}
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {FILTERS.map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            style={{padding:"7px 16px",borderRadius:50,border:`1px solid ${f===filter?C.accent:C.border}`,background:f===filter?C.accentGlow:"transparent",color:f===filter?C.accent:C.sub,fontSize:12,fontWeight:f===filter?700:400,cursor:"pointer"}}>
            {f}
          </button>
        ))}
      </div>

      {cells.length===0&&(
        <div style={{textAlign:"center",color:C.muted,fontSize:13,marginTop:40}}>該当なし</div>
      )}

      {cells.map(cell=>{
        const plan=loadPlan(cell.key);
        const has=!!plan;
        const col=pColor(cell.progress);
        return (
          <div key={cell.key} style={{background:C.card,border:`1px solid ${has?C.accent+"55":C.border}`,borderRadius:12,padding:"12px 14px",marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                  <span style={{fontSize:10,padding:"2px 7px",borderRadius:20,background:has?C.accentGlow:"transparent",border:`1px solid ${has?C.accent:C.border}`,color:has?C.accent:C.muted,fontWeight:700}}>
                    {has?"計画あり":"計画なし"}
                  </span>
                  <span style={{fontSize:10,color:C.muted}}>{cell.row}</span>
                </div>
                <div style={{fontSize:13,fontWeight:700,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cell.name||"（未設定）"}</div>
                {has&&plan.projectName&&<div style={{fontSize:11,color:C.sub,marginTop:2}}>📋 {plan.projectName}</div>}
                {has&&(plan.startDate||plan.endDate)&&(
                  <div style={{fontSize:10,color:C.muted,marginTop:2}}>{plan.startDate||"?"} → {plan.endDate||"?"}</div>
                )}
                <div style={{display:"flex",alignItems:"center",gap:6,marginTop:6}}>
                  <div style={{flex:1,height:4,borderRadius:2,background:C.border}}>
                    <div style={{width:`${cell.progress}%`,height:"100%",borderRadius:2,background:col}}/>
                  </div>
                  <span style={{fontSize:10,color:col,fontWeight:700}}>{cell.progress}%</span>
                </div>
              </div>
              <button onClick={()=>onOpenPlan&&onOpenPlan(cell)}
                style={{marginLeft:10,padding:"6px 12px",borderRadius:8,border:`1px solid ${C.accent}`,background:C.accentGlow,color:C.accent,fontSize:11,fontWeight:700,cursor:"pointer",flexShrink:0}}>
                {has?"編集":"作成"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── TEAM TAB ─────────────────────────────────────────────────────────────────
function TeamTab({ members, setMembers, matrix }) {
  const [name, setName]=useState("");
  const [colorIdx, setColorIdx]=useState(0);

  async function add() {
    if(!name.trim())return;
    const m={id:Date.now()+"",name:name.trim(),color:MEMBER_COLORS[colorIdx]};
    await saveMember(m); setMembers(prev=>[...prev,m]); setName("");
  }
  async function remove(id) { await deleteMember(id); setMembers(prev=>prev.filter(m=>m.id!==id)); }

  const cells=Object.values(matrix);

  return (
    <div>
      {/* Add member */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:16,marginBottom:16}}>
        <div style={{fontSize:10,color:C.muted,letterSpacing:"0.1em",marginBottom:12,fontWeight:700}}>ADD MEMBER</div>
        <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:8}}>
          <div style={{width:38,height:38,borderRadius:10,background:MEMBER_COLORS[colorIdx],flexShrink:0,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}
            onClick={()=>setColorIdx((colorIdx+1)%MEMBER_COLORS.length)}>
            {name?name[0]:""}
          </div>
          <input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()}
            placeholder="代表" style={{...inp,flex:1}}/>
          <button onClick={add} style={{padding:"10px 16px",borderRadius:10,border:"none",background:C.accent,color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>追加</button>
        </div>
        <div style={{fontSize:10,color:C.muted}}>名前は MatrixCell の owner と一致するよう登録</div>
      </div>

      {members.map(m=>{
        const assigned=cells.filter(c=>c.assignee===m.name);
        const avgP=assigned.length?Math.round(assigned.reduce((a,c)=>a+c.progress,0)/assigned.length):0;
        return (
          <div key={m.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:16,marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",gap:14}}>
              <div style={{width:44,height:44,borderRadius:12,background:m.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:800,color:"#000",flexShrink:0}}>
                {m.name[0]}
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:2}}>{m.name}</div>
                <div style={{fontSize:11,color:C.muted}}>担当 · 担当 {assigned.length} 件</div>
                {assigned.length>0&&(
                  <div style={{marginTop:8}}>
                    <div style={{background:C.border,borderRadius:6,height:6,overflow:"hidden"}}>
                      <div style={{width:`${avgP}%`,height:"100%",background:barGrad(avgP),borderRadius:6,transition:"width 0.5s"}}/>
                    </div>
                  </div>
                )}
              </div>
              <div style={{textAlign:"right"}}>
                {assigned.length>0&&<div style={{fontSize:16,fontWeight:900,color:pColor(avgP),marginBottom:4}}>{avgP}%</div>}
                <button onClick={()=>remove(m.id)} style={{background:"none",border:"none",color:C.muted,fontSize:18,cursor:"pointer",padding:0}}>×</button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── PLAN TAB ─────────────────────────────────────────────────────────────────
function PlanTab({ plan, setPlan }) {
  const [saving, setSaving] = useState(false);

  function upProj(field, val) { setPlan(p => ({ ...p, [field]: val })); }

  function addPhase() {
    const idx = (plan.phases||[]).length;
    setPlan(p => ({ ...p, phases: [...(p.phases||[]), {
      id: Date.now()+"", name: "新フェーズ",
      start: p.startDate||"", end: p.endDate||"",
      color: PHASE_COLORS[idx % PHASE_COLORS.length]
    }]}));
  }
  function upPhase(id, field, val) {
    setPlan(p => ({ ...p, phases: p.phases.map(ph => ph.id===id ? {...ph,[field]:val} : ph) }));
  }
  function rmPhase(id) { setPlan(p => ({ ...p, phases: p.phases.filter(ph => ph.id!==id) })); }

  function addPayment() {
    setPlan(p => ({ ...p, payments: [...(p.payments||[]), { id:Date.now()+"", date:"", amount:0, item:"", memo:"" }]}));
  }
  function upPayment(id, field, val) {
    setPlan(p => ({ ...p, payments: p.payments.map(py => py.id===id ? {...py,[field]:val} : py) }));
  }
  function rmPayment(id) { setPlan(p => ({ ...p, payments: p.payments.filter(py => py.id!==id) })); }

  async function handleSave() {
    setSaving(true);
    await saveGlobalPlan(plan);
    setSaving(false);
  }

  const phases   = plan.phases   || [];
  const payments = plan.payments || [];
  const totalPay = payments.reduce((a,p) => a + (parseInt(p.amount)||0), 0);

  const projStart = plan.startDate ? new Date(plan.startDate) : null;
  const projEnd   = plan.endDate   ? new Date(plan.endDate)   : null;
  const projDays  = projStart && projEnd ? (projEnd - projStart) / 86400000 : 0;

  function phaseBar(ph) {
    if (!projStart || !projDays || !ph.start || !ph.end) return null;
    const s = new Date(ph.start), e = new Date(ph.end);
    const left  = Math.max(0, Math.min(100, (s - projStart) / 86400000 / projDays * 100));
    const width = Math.max(2, Math.min(100 - left, (e - s) / 86400000 / projDays * 100));
    return { left, width };
  }

  const cellInput = { ...inp, padding:"6px 8px", fontSize:12 };

  return (
    <div>
      {/* PROJECT INFO */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:16,marginBottom:12}}>
        <div style={{fontSize:10,color:C.muted,letterSpacing:"0.1em",marginBottom:12,fontWeight:700}}>PROJECT INFO</div>
        <div style={{marginBottom:10}}>
          <div style={{fontSize:11,color:C.sub,marginBottom:5}}>プロジェクト名</div>
          <input value={plan.projectName||""} onChange={e=>upProj("projectName",e.target.value)}
            placeholder="プロジェクト名を入力..." style={inp}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div>
            <div style={{fontSize:11,color:C.sub,marginBottom:5}}>開始日</div>
            <input type="date" value={plan.startDate||""} onChange={e=>upProj("startDate",e.target.value)} style={inp}/>
          </div>
          <div>
            <div style={{fontSize:11,color:C.sub,marginBottom:5}}>終了日</div>
            <input type="date" value={plan.endDate||""} onChange={e=>upProj("endDate",e.target.value)} style={inp}/>
          </div>
        </div>
      </div>

      {/* TIMELINE */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:16,marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontSize:10,color:C.muted,letterSpacing:"0.1em",fontWeight:700}}>TIMELINE</div>
          <button onClick={addPhase} style={{padding:"6px 14px",borderRadius:20,border:`1px solid ${C.accent}`,background:C.accentGlow,color:C.accent,fontSize:11,fontWeight:700,cursor:"pointer"}}>+ フェーズ追加</button>
        </div>

        {/* Scale bar */}
        {projStart && projEnd && projDays > 0 && (
          <div style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:7,height:20,position:"relative",overflow:"hidden",marginBottom:10,display:"flex",alignItems:"center",padding:"0 8px"}}>
            <span style={{fontSize:9,color:C.muted}}>{plan.startDate}</span>
            <span style={{fontSize:9,color:C.muted,marginLeft:"auto"}}>{plan.endDate}</span>
          </div>
        )}

        {phases.length===0 && (
          <div style={{textAlign:"center",color:C.muted,fontSize:12,padding:"18px 0"}}>フェーズを追加してください</div>
        )}

        {phases.map(ph => {
          const bar = phaseBar(ph);
          return (
            <div key={ph.id} style={{marginBottom:14}}>
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:5}}>
                <div style={{width:12,height:12,borderRadius:3,background:ph.color,flexShrink:0,cursor:"pointer"}}
                  onClick={()=>upPhase(ph.id,"color",PHASE_COLORS[(PHASE_COLORS.indexOf(ph.color)+1)%PHASE_COLORS.length])}/>
                <input value={ph.name} onChange={e=>upPhase(ph.id,"name",e.target.value)}
                  style={{...cellInput,flex:1,fontWeight:700}}/>
                <button onClick={()=>rmPhase(ph.id)} style={{background:"none",border:"none",color:C.muted,fontSize:16,cursor:"pointer",padding:0}}>×</button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:5}}>
                <input type="date" value={ph.start||""} onChange={e=>upPhase(ph.id,"start",e.target.value)} style={cellInput}/>
                <input type="date" value={ph.end||""}   onChange={e=>upPhase(ph.id,"end",  e.target.value)} style={cellInput}/>
              </div>
              <div style={{background:C.card2,borderRadius:6,height:18,position:"relative",overflow:"hidden"}}>
                {bar && <div style={{position:"absolute",top:2,bottom:2,left:`${bar.left}%`,width:`${bar.width}%`,background:ph.color,borderRadius:4,opacity:0.85,display:"flex",alignItems:"center",paddingLeft:4,overflow:"hidden"}}>
                  <span style={{fontSize:9,color:"#fff",fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{ph.name}</span>
                </div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* PAYMENT SCHEDULE */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:16,marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontSize:10,color:C.muted,letterSpacing:"0.1em",fontWeight:700}}>支払いスケジュール</div>
          <button onClick={addPayment} style={{padding:"6px 14px",borderRadius:20,border:`1px solid ${C.green}`,background:C.green+"22",color:C.green,fontSize:11,fontWeight:700,cursor:"pointer"}}>+ 追加</button>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"88px 76px 1fr 1fr 20px",gap:4,marginBottom:6}}>
          {["日付","金額","項目","メモ",""].map(h=>(
            <div key={h} style={{fontSize:9,color:C.muted,fontWeight:700,paddingLeft:2}}>{h}</div>
          ))}
        </div>

        {payments.length===0 && (
          <div style={{textAlign:"center",color:C.muted,fontSize:12,padding:"12px 0"}}>支払いを追加してください</div>
        )}

        {payments.map(py=>(
          <div key={py.id} style={{display:"grid",gridTemplateColumns:"88px 76px 1fr 1fr 20px",gap:4,marginBottom:6,alignItems:"center"}}>
            <input type="date" value={py.date||""} onChange={e=>upPayment(py.id,"date",e.target.value)} style={{...cellInput,padding:"5px 5px",fontSize:11}}/>
            <input type="number" value={py.amount||""} onChange={e=>upPayment(py.id,"amount",parseInt(e.target.value)||0)} placeholder="0" style={{...cellInput,padding:"5px 5px",fontSize:11}}/>
            <input value={py.item||""} onChange={e=>upPayment(py.id,"item",e.target.value)} placeholder="項目" style={{...cellInput,padding:"5px 5px",fontSize:11}}/>
            <input value={py.memo||""} onChange={e=>upPayment(py.id,"memo",e.target.value)} placeholder="メモ" style={{...cellInput,padding:"5px 5px",fontSize:11}}/>
            <button onClick={()=>rmPayment(py.id)} style={{background:"none",border:"none",color:C.muted,fontSize:16,cursor:"pointer",padding:0,lineHeight:1}}>×</button>
          </div>
        ))}

        {payments.length>0&&(
          <div style={{borderTop:`1px solid ${C.border}`,paddingTop:10,marginTop:4,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:12,color:C.sub,fontWeight:700}}>合計</span>
            <span style={{fontSize:18,fontWeight:900,color:C.teal}}>¥{totalPay.toLocaleString()}</span>
          </div>
        )}
      </div>

      <button onClick={handleSave} disabled={saving}
        style={{width:"100%",padding:"14px 0",borderRadius:13,border:"none",background:`linear-gradient(135deg,${C.accent},${C.purple})`,color:"#fff",fontWeight:800,fontSize:15,cursor:saving?"not-allowed":"pointer",opacity:saving?0.7:1}}>
        {saving ? "保存中..." : "計画書を保存"}
      </button>
    </div>
  );
}

// ─── CELL PLAN MODAL ──────────────────────────────────────────────────────────
function CellPlanModal({ cell, matrix, onClose, onProgressUpdate }) {
  const allCellNames = Object.values(matrix)
    .map(c => c.name)
    .filter(n => n && n.trim() && n !== cell.name);
  const uniqueNames = [...new Set(allCellNames)];

  const existing = (() => { try { const s = localStorage.getItem(`trizos_plan_${cell.key}`); return s ? JSON.parse(s) : null; } catch { return null; } })();
  const [projName, setProjName] = useState(existing?.projName || cell.name || "");
  const [useCustom, setUseCustom] = useState(false);
  const [customName, setCustomName] = useState(existing?.projName || "");
  const [startDate, setStartDate] = useState(existing?.startDate || "");
  const [endDate, setEndDate] = useState(existing?.endDate || "");
  const [phases, setPhases] = useState(existing?.phases || []);
  const [payments, setPayments] = useState(existing?.payments || []);
  const [tasks, setTasks] = useState(existing?.tasks || []);
  const [newTask, setNewTask] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (tasks.length > 0 && onProgressUpdate) {
      const done = tasks.filter(t => t.done).length;
      onProgressUpdate(cell.key, Math.round((done / tasks.length) * 100));
    }
  }, []);

  const totalPayment = payments.reduce((a, p) => a + (parseInt(p.amount) || 0), 0);
  function addPhase() { setPhases(p => [...p, { id: Date.now()+"", name: "", start: "", end: "", color: "#6c63ff" }]); }
  function removePhase(id) { setPhases(p => p.filter(x => x.id !== id)); }
  function updatePhase(id, key, val) { setPhases(p => p.map(x => x.id === id ? {...x,[key]:val} : x)); }
  function addPayment() { setPayments(p => [...p, { id: Date.now()+"", date: "", amount: "", item: "", memo: "" }]); }
  function removePayment(id) { setPayments(p => p.filter(x => x.id !== id)); }
  function updatePayment(id, key, val) { setPayments(p => p.map(x => x.id === id ? {...x,[key]:val} : x)); }
  function addTask() {
    if (!newTask.trim()) return;
    const updated = [...tasks, { id: Date.now()+"", text: newTask.trim(), done: false }];
    setTasks(updated);
    setNewTask("");
    calcProgress(updated);
  }
  function toggleTask(id) {
    const updated = tasks.map(x => x.id === id ? {...x, done: !x.done} : x);
    setTasks(updated);
    calcProgress(updated);
  }
  function removeTask(id) {
    const updated = tasks.filter(x => x.id !== id);
    setTasks(updated);
    calcProgress(updated);
  }
  function moveTaskUp(id) {
    const idx = tasks.findIndex(x => x.id === id);
    if (idx <= 0) return;
    const updated = [...tasks];
    [updated[idx-1], updated[idx]] = [updated[idx], updated[idx-1]];
    setTasks(updated);
  }
  function moveTaskDown(id) {
    const idx = tasks.findIndex(x => x.id === id);
    if (idx < 0 || idx >= tasks.length - 1) return;
    const updated = [...tasks];
    [updated[idx], updated[idx+1]] = [updated[idx+1], updated[idx]];
    setTasks(updated);
  }
  function calcProgress(list) {
    if (!list.length || !onProgressUpdate) return;
    const done = list.filter(t => t.done).length;
    const pct = Math.round((done / list.length) * 100);
    onProgressUpdate(cell.key, pct);
  }

  function handleSave() {
    const name = useCustom ? customName : projName;
    try { localStorage.setItem(`trizos_plan_${cell.key}`, JSON.stringify({ projName: name, startDate, endDate, phases, payments, tasks })); } catch {}
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 1200);
  }

  const ganttStart = startDate ? new Date(startDate) : null;
  const ganttEnd = endDate ? new Date(endDate) : null;
  const totalDays = ganttStart && ganttEnd ? (ganttEnd - ganttStart) / 86400000 : 0;
  const inp2 = {width:"100%",background:"#1a1a28",border:"1px solid #1e1e32",borderRadius:10,padding:"10px 13px",color:"#eeeeff",fontSize:13,boxSizing:"border-box",outline:"none"};

  return (
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.75)",zIndex:600,overflowY:"auto"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:480,margin:"0 auto",background:"#0f0f1a",minHeight:"100%",paddingBottom:40}}>
        <div style={{padding:"18px 16px 14px",borderBottom:"1px solid #1e1e32",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:15,fontWeight:900,color:"#6c63ff"}}>📋 4K計画書</div>
            <div style={{fontSize:11,color:"#44445a",marginTop:2}}>{cell.name}</div>
          </div>
          <button onClick={onClose} style={{width:34,height:34,borderRadius:"50%",background:"#14141f",border:"1px solid #1e1e32",color:"#8888aa",fontSize:16,cursor:"pointer"}}>✕</button>
        </div>
        <div style={{padding:"16px 14px"}}>
          <div style={{marginBottom:18}}>
            <div style={{fontSize:11,color:"#8888aa",marginBottom:6,fontWeight:700}}>プロジェクト名</div>
            <select value={useCustom ? "__custom__" : projName} onChange={e => {
              if (e.target.value === "__custom__") { setUseCustom(true); }
              else { setUseCustom(false); setProjName(e.target.value); }
            }} style={{...inp2,marginBottom:useCustom?8:0}}>
              <option value={cell.name||"現在のマス"}>現在のマス: {cell.name}</option>
              {uniqueNames.map(n => <option key={n} value={n}>{n}</option>)}
              <option value="__custom__">✏️ カスタム入力</option>
            </select>
            {useCustom && <input value={customName} onChange={e=>setCustomName(e.target.value)} placeholder="プロジェクト名を入力..." style={inp2}/>}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:18}}>
            <div><div style={{fontSize:11,color:"#8888aa",marginBottom:5,fontWeight:700}}>開始日</div><input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} style={inp2}/></div>
            <div><div style={{fontSize:11,color:"#8888aa",marginBottom:5,fontWeight:700}}>終了日</div><input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} style={inp2}/></div>
          </div>
          <div style={{marginBottom:18}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontSize:11,color:"#8888aa",fontWeight:700}}>タイムライン</div>
              <button onClick={addPhase} style={{padding:"5px 12px",borderRadius:20,border:"1px solid #6c63ff",background:"#6c63ff40",color:"#6c63ff",fontSize:11,fontWeight:700,cursor:"pointer"}}>+ フェーズ追加</button>
            </div>
            {phases.length===0&&<div style={{fontSize:12,color:"#44445a",textAlign:"center",padding:"14px 0"}}>フェーズを追加してください</div>}
            {phases.map(ph=>(
              <div key={ph.id} style={{background:"#14141f",border:"1px solid #1e1e32",borderLeft:`3px solid ${ph.color||"#6c63ff"}`,borderRadius:10,padding:12,marginBottom:8}}>
                <div style={{display:"flex",gap:8,marginBottom:8,alignItems:"center"}}>
                  <input value={ph.name} onChange={e=>updatePhase(ph.id,"name",e.target.value)} placeholder="フェーズ名..." style={{...inp2,flex:1,padding:"7px 10px"}}/>
                  <input type="color" value={ph.color||"#6c63ff"} onChange={e=>updatePhase(ph.id,"color",e.target.value)} style={{width:28,height:28,border:"none",background:"none",cursor:"pointer",padding:0}}/>
                  <button onClick={()=>removePhase(ph.id)} style={{background:"none",border:"none",color:"#44445a",fontSize:18,cursor:"pointer",padding:0}}>×</button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <input type="date" value={ph.start} onChange={e=>updatePhase(ph.id,"start",e.target.value)} style={{...inp2,padding:"6px 8px",fontSize:12}}/>
                  <input type="date" value={ph.end} onChange={e=>updatePhase(ph.id,"end",e.target.value)} style={{...inp2,padding:"6px 8px",fontSize:12}}/>
                </div>
                {totalDays>0&&ph.start&&ph.end&&(()=>{
                  const ps=new Date(ph.start),pe=new Date(ph.end);
                  const left=Math.max(0,((ps-ganttStart)/86400000/totalDays)*100);
                  const width=Math.min(100-left,((pe-ps)/86400000/totalDays)*100);
                  return(<div style={{marginTop:8,background:"#1e1e32",borderRadius:6,height:8,overflow:"hidden"}}><div style={{marginLeft:`${left}%`,width:`${width}%`,height:"100%",background:ph.color||"#6c63ff",borderRadius:6,minWidth:4}}/></div>);
                })()}
              </div>
            ))}
          </div>
          {/* TASKS */}
          <div style={{marginBottom:18}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontSize:11,color:"#8888aa",fontWeight:700,letterSpacing:"0.06em"}}>
                タスク {tasks.length>0&&<span style={{color:"#6c63ff",marginLeft:6}}>{tasks.filter(t=>t.done).length}/{tasks.length}</span>}
              </div>
            </div>
            {tasks.length>0&&(
              <div style={{background:"#1e1e32",borderRadius:6,height:6,marginBottom:10,overflow:"hidden"}}>
                <div style={{width:`${Math.round(tasks.filter(t=>t.done).length/tasks.length*100)}%`,height:"100%",background:"linear-gradient(90deg,#6c63ff,#a07cff)",borderRadius:6,transition:"width 0.3s"}}/>
              </div>
            )}
            {tasks.map(task=>(
              <div key={task.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",background:"#14141f",border:"1px solid #1e1e32",borderRadius:8,marginBottom:6}}>
                <button onClick={()=>toggleTask(task.id)}
                  style={{width:20,height:20,borderRadius:5,border:`2px solid ${task.done?"#6c63ff":"#44445a"}`,background:task.done?"#6c63ff":"transparent",flexShrink:0,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:"#fff",padding:0,WebkitAppearance:"none"}}>
                  {task.done?"✓":""}
                </button>
                <span style={{flex:1,fontSize:13,color:task.done?"#44445a":"#eeeeff",textDecoration:task.done?"line-through":"none"}}>{task.text}</span>
                <button onClick={()=>moveTaskUp(task.id)} style={{background:"none",border:"none",color:"#8888aa",fontSize:11,cursor:"pointer",padding:"0 2px",lineHeight:1}} title="上へ">▲</button><button onClick={()=>moveTaskDown(task.id)} style={{background:"none",border:"none",color:"#8888aa",fontSize:11,cursor:"pointer",padding:"0 2px",lineHeight:1}} title="下へ">▼</button><button onClick={()=>removeTask(task.id)} style={{background:"none",border:"none",color:"#44445a",fontSize:16,cursor:"pointer",padding:0}}>×</button>
              </div>
            ))}
            <div style={{display:"flex",gap:8,marginTop:4}}>
              <input value={newTask} onChange={e=>setNewTask(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&addTask()}
                placeholder="タスクを追加..."
                style={{flex:1,background:"#1a1a28",border:"1px solid #1e1e32",borderRadius:8,padding:"8px 12px",color:"#eeeeff",fontSize:13,outline:"none"}}/>
              <button onClick={addTask}
                style={{padding:"8px 14px",borderRadius:8,border:"none",background:"#6c63ff",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>追加</button>
            </div>
          </div>
          <div style={{marginBottom:18}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontSize:11,color:"#8888aa",fontWeight:700}}>支払いスケジュール</div>
              <button onClick={addPayment} style={{padding:"5px 12px",borderRadius:20,border:"1px solid #00c896",background:"#00c89622",color:"#00c896",fontSize:11,fontWeight:700,cursor:"pointer"}}>+ 追加</button>
            </div>
            {payments.length===0&&<div style={{fontSize:12,color:"#44445a",textAlign:"center",padding:"14px 0"}}>支払いを追加してください</div>}
            {payments.map(py=>(
              <div key={py.id} style={{background:"#14141f",border:"1px solid #1e1e32",borderRadius:10,padding:12,marginBottom:8}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                  <input type="date" value={py.date} onChange={e=>updatePayment(py.id,"date",e.target.value)} style={{...inp2,padding:"7px 8px",fontSize:12}}/>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <input type="number" value={py.amount} onChange={e=>updatePayment(py.id,"amount",e.target.value)} placeholder="金額" style={{...inp2,flex:1,padding:"7px 8px",fontSize:12}}/>
                    <button onClick={()=>removePayment(py.id)} style={{background:"none",border:"none",color:"#44445a",fontSize:18,cursor:"pointer",padding:0,flexShrink:0}}>×</button>
                  </div>
                </div>
                <input value={py.item} onChange={e=>updatePayment(py.id,"item",e.target.value)} placeholder="項目（例：サーバー代）" style={{...inp2,marginBottom:6,padding:"7px 10px"}}/>
                <input value={py.memo} onChange={e=>updatePayment(py.id,"memo",e.target.value)} placeholder="メモ" style={{...inp2,padding:"7px 10px"}}/>
              </div>
            ))}
            {payments.length>0&&(
              <div style={{display:"flex",justifyContent:"space-between",padding:"10px 14px",background:"#1a1a28",border:"1px solid #1e1e32",borderRadius:10}}>
                <span style={{fontSize:13,color:"#8888aa"}}>合計</span>
                <span style={{fontSize:15,fontWeight:800,color:"#00c896"}}>¥{totalPayment.toLocaleString()}</span>
              </div>
            )}
          </div>
          <button onClick={handleSave} style={{width:"100%",padding:"14px 0",borderRadius:13,border:"none",background:saved?"linear-gradient(135deg,#00c896,#00e5c8)":"linear-gradient(135deg,#6c63ff,#a07cff)",color:"#fff",fontWeight:800,fontSize:15,cursor:"pointer"}}>
            {saved?"✓ 保存しました":"計画書を保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── BIZ ITEM ────────────────────────────────────────────────────────────────
function BizItem({ row, bizNames, selectedBiz, setSelectedBiz, setDrawerOpen, updateBizName }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(bizNames[row]||row);
  const name = bizNames[row]||row;
  useEffect(()=>{ setVal(bizNames[row]||row); },[bizNames,row]);
  if (editing) return (
    <div style={{display:"flex",gap:6}}>
      <input value={val} onChange={e=>setVal(e.target.value)} autoFocus
        onKeyDown={e=>{if(e.key==="Enter"){updateBizName(row,val);setEditing(false);}}}
        style={{flex:1,background:C.card2,border:`1px solid ${C.accent}`,borderRadius:8,padding:"8px 12px",color:C.text,fontSize:13,outline:"none"}}/>
      <button onClick={()=>{updateBizName(row,val);setEditing(false);}}
        style={{background:C.accent,border:"none",borderRadius:8,color:"#fff",padding:"0 14px",cursor:"pointer",fontSize:14,fontWeight:700}}>✓</button>
    </div>
  );
  return (
    <div style={{display:"flex",alignItems:"center",gap:6}}>
      <button onClick={()=>{setSelectedBiz(row);setDrawerOpen(false);}}
        style={{flex:1,padding:"12px 16px",borderRadius:10,border:`1px solid ${selectedBiz===row?C.accent:C.border}`,background:selectedBiz===row?C.accentGlow:"transparent",color:selectedBiz===row?C.accent:C.text,fontSize:13,fontWeight:700,cursor:"pointer",textAlign:"left"}}>
        {name}
      </button>
      <button onClick={()=>{setVal(name);setEditing(true);}}
        style={{background:"none",border:"none",color:C.muted,fontSize:16,cursor:"pointer",padding:"4px 6px",lineHeight:1}}>✏</button>
    </div>
  );
}

// ─── PROJECT MODAL ───────────────────────────────────────────────────────────
function ProjectModal({projects,activeProjectId,onSwitch,onCreate,onRename,onDelete,onClose}){
  const [newName,setNewName]=useState('');
  const [editId,setEditId]=useState(null);
  const [editVal,setEditVal]=useState('');
  return(
    <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:400,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'flex-end'}}>
      <div onClick={e=>e.stopPropagation()} style={{width:'100%',maxWidth:430,margin:'0 auto',background:C.surface,borderRadius:'16px 16px 0 0',padding:20,maxHeight:'70vh',overflowY:'auto'}}>
        <div style={{fontSize:15,fontWeight:900,color:C.accent,marginBottom:16}}>プロジェクト切替</div>
        {projects.map(p=>(
          <div key={p.id} style={{marginBottom:8}}>
            {editId===p.id?(
              <div style={{display:'flex',gap:6}}>
                <input value={editVal} onChange={e=>setEditVal(e.target.value)} autoFocus
                  onKeyDown={e=>{if(e.key==='Enter'){onRename(p.id,editVal);setEditId(null);}}}
                  style={{flex:1,background:C.card2,border:`1px solid ${C.accent}`,borderRadius:8,padding:'8px 12px',color:C.text,fontSize:13,outline:'none'}}/>
                <button onClick={()=>{onRename(p.id,editVal);setEditId(null);}} style={{background:C.accent,border:'none',borderRadius:8,color:'#fff',padding:'0 14px',cursor:'pointer',fontSize:14,fontWeight:700}}>✓</button>
                <button onClick={()=>setEditId(null)} style={{background:'none',border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,padding:'0 10px',cursor:'pointer'}}>✕</button>
              </div>
            ):(
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <button onClick={()=>onSwitch(p.id)} style={{flex:1,padding:'12px 16px',borderRadius:10,border:`1px solid ${activeProjectId===p.id?C.accent:C.border}`,background:activeProjectId===p.id?C.accentGlow:'transparent',color:activeProjectId===p.id?C.accent:C.text,fontSize:14,fontWeight:700,cursor:'pointer',textAlign:'left'}}>
                  {activeProjectId===p.id?'▶ ':''}{p.name}
                </button>
                <button onClick={()=>{setEditId(p.id);setEditVal(p.name);}} style={{background:'none',border:`1px solid ${C.border}`,color:C.muted,fontSize:11,cursor:'pointer',padding:'4px 8px',borderRadius:6,whiteSpace:'nowrap'}}>名前変更</button>
                {p.id!==activeProjectId&&onDelete&&<button onClick={()=>{if(window.confirm(p.name+'を削除しますか？'))onDelete(p.id);}} style={{background:'none',border:'1px solid #e84393',color:'#e84393',fontSize:11,cursor:'pointer',padding:'4px 8px',borderRadius:6,whiteSpace:'nowrap'}}>削除</button>}
              </div>
            )}
          </div>
        ))}
        <div style={{display:'flex',gap:8,marginTop:16,borderTop:`1px solid ${C.border}`,paddingTop:16}}>
          <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder='新規PJ名...'
            onKeyDown={e=>{if(e.key==='Enter'&&newName.trim()){onCreate(newName.trim());setNewName('');}}}
            style={{flex:1,background:C.card2,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 12px',color:C.text,fontSize:13,outline:'none'}}/>
          <button onClick={()=>{if(newName.trim()){onCreate(newName.trim());setNewName('');}}} style={{background:C.accent,border:'none',borderRadius:8,color:'#fff',padding:'0 16px',cursor:'pointer',fontSize:13,fontWeight:700}}>＋追加</button>
        </div>
      </div>
    </div>
  );
}

// ─── TAB BAR ──────────────────────────────────────────────────────────────────
const TAB_ICONS = {
  home: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>),
  dash: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>),
  road: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="22" height="22"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>),
  team: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22"><circle cx="9" cy="7" r="3"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.85"/></svg>),
};
const TAB_LABELS = { home:"HOME", dash:"DASH", road:"ROAD", team:"TEAM" };
const TAB_PAGE_TITLES = { home:"TRIZ OS", dash:"Dashboard", road:"Roadmap", team:"Team" };
const TAB_PAGE_SUBS = { home:"81 戦略マトリクス", dash:"経営の脳 — 全体分析", road:"実行ロードマップ", team:"担当者と権限" };

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab]=useState("home");
  const [matrix, setMatrix]=useState(null);
  const [members, setMembers]=useState([]);
  const [selected, setSelected]=useState(null);
  const [loading, setLoading]=useState(true);
  const [saving, setSaving]=useState(false);
  const [plan, setPlan]=useState({ projectName:"", startDate:"", endDate:"", phases:[], payments:[] });
  const [cellPlansIndex, setCellPlansIndex]=useState(new Set());
  const [cellPlanModal, setCellPlanModal]=useState(null); // { cell, plan }
  const [openPlanCell, setOpenPlanCell]=useState(null);
  const [projects, setProjects]=useState(getProjectsList);
  const [activeProjId, setActiveProjId]=useState(getActiveProjId);
  const [projModalOpen, setProjModalOpen]=useState(false);
  const [selectedBiz, setSelectedBiz]=useState(null);
  const [drawerOpen, setDrawerOpen]=useState(false);
  const [bizNames, setBizNames]=useState(()=>{ try{return JSON.parse(localStorage.getItem('trizos_biz_names')||'{}');}catch{return {};} });
  function updateBizName(row,name){ const n={...bizNames,[row]:name}; setBizNames(n); localStorage.setItem('trizos_biz_names',JSON.stringify(n)); }

  useEffect(()=>{
    loadProjectsFromSB().then(sbList=>{if(sbList&&sbList.length){setProjects(sbList);localStorage.setItem(PROJ_LIST_KEY,JSON.stringify(sbList));}});
    Promise.all([loadProjectCells(getActiveProjId()),loadMembers(),loadGlobalPlan(),loadCellPlansIndex()]).then(([m,mb,pl,cpi])=>{setMatrix(m);setMembers(mb);setPlan(pl);setCellPlansIndex(cpi);setLoading(false);});
  },[]);

  async function handleOpenCellPlan(cell) {
    const p = await loadCellPlan(cell.key);
    setCellPlanModal({ cell, plan: p });
  }
  function handleCellPlanSaved(cellKey) {
    setCellPlansIndex(prev => new Set([...prev, cellKey]));
  }

  function handleProgressUpdate(cellKey, progress) {
    setMatrix(prev => {
      if (!prev[cellKey]) return prev;
      const updatedCell = {...prev[cellKey], progress};
      saveCell(updatedCell);
      return {...prev, [cellKey]: updatedCell};
    });
  }

  function exportCSV() {
    if(!matrix) return;
    const rows = Object.values(matrix);
    const header = ["key","row","col","type1","type2","name","progress","status","priority","assignee","startDate","deadline","kpi","ksf","risk","next","income","expense","description"];
    const csv = [header.join(","), ...rows.map(r => header.map(h => `"${String(r[h]??'').replace(/"/g,'""')}"`).join(","))].join("\n");
    const blob = new Blob(["\uFEFF"+csv], {type:"text/csv;charset=utf-8;"});
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `trizos_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  }

  function handleAutoSave(cell) {
    setMatrix(prev=>{const nm={...prev,[cell.key]:cell};saveProjMatrix(activeProjId,nm);return nm;});
    if(activeProjId==='default')saveCell(cell);
  }

  function switchToProject(id){
    if(matrix)window._activeProjId=id;
    localStorage.setItem(ACTIVE_PROJ_KEY,id);
    setActiveProjId(id);
    setProjModalOpen(false);
    setLoading(true);
    loadProjectCells(id).then(m=>{setMatrix(m);setLoading(false);});
  }
  function createProject(name){
    const id='p_'+Date.now();
    const list=[...projects,{id,name}];
    setProjects(list);saveProjectsList(list);
    switchToProject(id);
  }
  function renameProject(id,name){
    const list=projects.map(p=>p.id===id?{...p,name}:p);
    setProjects(list);saveProjectsList(list);
  }
  function deleteProject(id){
    if(id===activeProjId)return;
    const list=projects.filter(p=>p.id!==id);
    setProjects(list);saveProjectsList(list);
    try{supa('trizos_cells?key=like.'+id+'%3A*','DELETE');}catch{}
  }
  function handleSave(updated) {
    setMatrix(prev => ({ ...prev, [updated.key]: updated }));
    setSaving(true);
    saveCell(updated).finally(() => setSaving(false));
  }

  if(loading) return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14}}>
      <div style={{width:48,height:48,borderRadius:12,background:C.accentGlow,border:`1px solid ${C.accent}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>⊞</div>
      <div style={{color:C.accent,fontSize:15,fontWeight:700}}>TRIZ OS</div>
      <div style={{color:C.muted,fontSize:12}}>Supabaseに接続しています...</div>
    </div>
  );

  return (
    <div style={{maxWidth:430,margin:"0 auto",minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'Noto Sans JP','Hiragino Sans',sans-serif",display:"flex",flexDirection:"column"}}>

      {/* TOP HEADER */}
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          
          <div style={{width:32,height:32,borderRadius:8,background:C.accentGlow,border:`1px solid ${C.accent}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>⊞</div>
          <div onClick={()=>setProjModalOpen(true)} style={{cursor:'pointer'}}>
            <div style={{fontSize:15,fontWeight:900,color:C.accent,lineHeight:1.1}}>
              {(projects.find(p=>p.id===activeProjId)||{name:'TRIZ OS'}).name} <span style={{fontSize:12,opacity:0.7}}>▾</span>
            </div>
            <div style={{fontSize:10,color:C.muted}}>{TAB_PAGE_SUBS[tab]}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button style={{padding:"6px 12px",borderRadius:20,border:`1px solid ${C.border}`,background:"transparent",color:C.sub,fontSize:11,cursor:"pointer"}}>ローカル</button>
          <button onClick={exportCSV} style={{padding:"6px 14px",borderRadius:20,border:"none",background:C.card2,color:C.text,fontSize:11,fontWeight:600,cursor:"pointer"}}>CSV{saving?" ●":""}</button>
        </div>
      </div>

      {/* PROJECT MODAL */}
      {projModalOpen&&<ProjectModal projects={projects} activeProjectId={activeProjId} onSwitch={switchToProject} onCreate={createProject} onRename={renameProject} onDelete={deleteProject} onClose={()=>setProjModalOpen(false)}/>}

      {/* SIDE DRAWER */}
      {drawerOpen&&<div onClick={()=>setDrawerOpen(false)} style={{position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,0.55)"}}>
        <div onClick={e=>e.stopPropagation()} style={{position:"absolute",top:0,left:0,bottom:0,width:250,background:C.surface,borderRight:`1px solid ${C.border}`,padding:20,display:"flex",flexDirection:"column",gap:10,overflowY:"auto"}}>
          <div style={{fontSize:15,fontWeight:900,color:C.accent,marginBottom:4}}>事業を切替</div>
          <button onClick={()=>{setSelectedBiz(null);setDrawerOpen(false);}}
            style={{padding:"12px 16px",borderRadius:10,border:`1px solid ${selectedBiz===null?C.accent:C.border}`,background:selectedBiz===null?C.accentGlow:"transparent",color:selectedBiz===null?C.accent:C.text,fontSize:13,fontWeight:700,cursor:"pointer",textAlign:"left",marginBottom:4}}>
            ✦ 全事業を表示
          </button>
          {ROW_LABELS.map(row=>(<BizItem key={row} row={row} bizNames={bizNames} selectedBiz={selectedBiz} setSelectedBiz={setSelectedBiz} setDrawerOpen={setDrawerOpen} updateBizName={updateBizName}/>))}
        </div>
      </div>}

      {/* SIDE DRAWER */}
      {drawerOpen&&<div onClick={()=>setDrawerOpen(false)} style={{position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,0.55)"}}>
        <div onClick={e=>e.stopPropagation()} style={{position:"absolute",top:0,left:0,bottom:0,width:250,background:C.surface,borderRight:`1px solid ${C.border}`,padding:20,display:"flex",flexDirection:"column",gap:10,overflowY:"auto"}}>
          <div style={{fontSize:15,fontWeight:900,color:C.accent,marginBottom:4}}>事業を切替</div>
          <button onClick={()=>{setSelectedBiz(null);setDrawerOpen(false);}}
            style={{padding:"12px 16px",borderRadius:10,border:`1px solid ${selectedBiz===null?C.accent:C.border}`,background:selectedBiz===null?C.accentGlow:"transparent",color:selectedBiz===null?C.accent:C.text,fontSize:13,fontWeight:700,cursor:"pointer",textAlign:"left",marginBottom:4}}>
            ✦ 全事業を表示
          </button>
          {ROW_LABELS.map(row=>(<BizItem key={row} row={row} bizNames={bizNames} selectedBiz={selectedBiz} setSelectedBiz={setSelectedBiz} setDrawerOpen={setDrawerOpen} updateBizName={updateBizName}/>))}
        </div>
      </div>}

      {/* CONTENT */}
      <div style={{flex:1,overflowY:"auto",padding:"14px 12px 90px"}}>
        {tab==="home"&&<HomeTab matrix={matrix} onCellClick={setSelected} cellPlansIndex={cellPlansIndex} selectedBiz={selectedBiz} bizNames={bizNames}/>}
        {tab==="dash"&&<DashTab matrix={matrix} members={members}/>}
        {tab==="road"&&<RoadTab matrix={matrix} onOpenPlan={setOpenPlanCell}/>}
        {tab==="team"&&<TeamTab members={members} setMembers={setMembers} matrix={matrix}/>}
      </div>

      {/* BOTTOM TAB BAR */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,background:C.surface,borderTop:`1px solid ${C.border}`,display:"flex",zIndex:100}}>
        {Object.keys(TAB_ICONS).map(t=>{
          const active=tab===t;
          return (
            <button key={t} onClick={()=>setTab(t)}
              style={{flex:1,padding:"12px 0 14px",background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4,color:active?C.accent:C.muted,position:"relative"}}>
              {active&&<div style={{position:"absolute",top:0,left:"25%",right:"25%",height:2,background:`linear-gradient(90deg,${C.accent},${C.purple})`,borderRadius:"0 0 2px 2px"}}/>}
              {TAB_ICONS[t]}
              <span style={{fontSize:9,fontWeight:active?700:400,letterSpacing:"0.06em"}}>{TAB_LABELS[t]}</span>
            </button>
          );
        })}
      </div>

      {selected&&<CellModal cell={matrix[selected.key]} matrix={matrix}
        onClose={()=>setSelected(null)} onSave={handleSave}
        onOpenPlan={setOpenPlanCell} onProgressChange={handleProgressUpdate}
        onAutoSave={handleAutoSave}/>}
      {cellPlanModal&&<CellPlanModal cell={cellPlanModal.cell} initialPlan={cellPlanModal.plan}
        onClose={()=>setCellPlanModal(null)}
        onSaved={handleCellPlanSaved}
        onSavedAndClose={()=>{setCellPlanModal(null);setSelected(null);}}
        matrix={matrix}/>}
      {openPlanCell&&<CellPlanModal cell={openPlanCell} matrix={matrix} onClose={()=>setOpenPlanCell(null)} onProgressUpdate={handleProgressUpdate}/>}
    </div>
  );
}
