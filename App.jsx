import { useState, useEffect, useRef } from "react";

const SUPA_URL = "https://nemmhucubeozvlhncivu.supabase.co";
const SUPA_KEY = "sb_publishable_z1BlRpR03jJTUNRKiaB1ZQ_avox17xS";
const AI_KEY_STORAGE  = "triz_ai_key";
const COMP_STORAGE    = "triz_competitors";
const BUILT_IN_AI_KEY = import.meta.env.VITE_ANTHROPIC_KEY ?? "";

function getAiKey() {
  return localStorage.getItem(AI_KEY_STORAGE) || BUILT_IN_AI_KEY;
}

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
  text: "#eeeeff", sub: "#8888aa", muted: "#44445a", purple: "#a07cff",
  teal: "#00e5c8",
};

function pColor(p) {
  if (p === 100) return C.green;
  if (p >= 70) return C.blue;
  if (p >= 40) return C.yellow;
  return C.red;
}
function barGrad(p) {
  if (p >= 70) return `linear-gradient(90deg, #5b6bff, #a07cff)`;
  if (p >= 40) return `linear-gradient(90deg, #6c63ff, #c8a830)`;
  return `linear-gradient(90deg, #6c63ff, #e84393)`;
}

const ROW_LABELS   = ["独占", "互角", "通常"];
const COL_LABELS   = ["販売", "本社", "生産"];
const TYPES        = ["人", "物", "金"];
const STATUS_LIST  = ["未着手", "準備", "実行", "改善", "完了"];
const PRIORITY_LIST= ["低", "中", "高"];
const MEMBER_COLORS= ["#6c63ff","#00c896","#c8a830","#5b6bff","#e84393","#ff9f7c","#a07cff"];
const COMP_COLORS  = ["#e84393","#c8a830","#00c896","#5b6bff","#a07cff","#ff9f7c","#00e5c8"];

// ─── COMPETITOR STORAGE ───────────────────────────────────────────────────────
function loadCompetitors() {
  try { return JSON.parse(localStorage.getItem(COMP_STORAGE) || "[]"); } catch { return []; }
}
function saveCompetitors(list) {
  localStorage.setItem(COMP_STORAGE, JSON.stringify(list));
}

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

async function loadCells() {
  try {
    const rows = await supa("trizos_cells?select=key,data");
    const base = buildInitialCells();
    if (rows?.length) rows.forEach(r => { if (base[r.key]) base[r.key] = { ...base[r.key], ...r.data, tasks: r.data.tasks || [] }; });
    return base;
  } catch { return buildInitialCells(); }
}
async function saveCell(cell) {
  try {
    const res = await fetch(`${SUPA_URL}/rest/v1/trizos_cells`, {
      method: "POST",
      headers: {
        "apikey": SUPA_KEY,
        "Authorization": `Bearer ${SUPA_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify({ key: cell.key, data: cell }),
    });
    const txt = await res.text();
    if (!res.ok) console.error("saveCell error", res.status, txt);
  } catch(e) { console.error("saveCell exception", e); }
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

// ─── TASK SECTION (改善版) ────────────────────────────────────────────────────
function TaskSection({ tasks, onChange }) {
  const [input, setInput] = useState("");
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);

  function addTask() {
    const t = input.trim();
    if (!t) return;
    onChange([...tasks, { id: Date.now()+"", text: t, done: false }]);
    setInput("");
  }
  function toggle(id) { onChange(tasks.map(t => t.id===id ? {...t, done: !t.done} : t)); }
  function remove(id) { onChange(tasks.filter(t => t.id!==id)); }
  function editText(id, val) { onChange(tasks.map(t => t.id===id ? {...t, text:val} : t)); }
  function moveUp(idx) {
    if (idx===0) return;
    const a=[...tasks]; [a[idx-1],a[idx]]=[a[idx],a[idx-1]]; onChange(a);
  }
  function moveDown(idx) {
    if (idx===tasks.length-1) return;
    const a=[...tasks]; [a[idx],a[idx+1]]=[a[idx+1],a[idx]]; onChange(a);
  }

  // drag & drop
  function onDragStart(idx) { setDragIdx(idx); }
  function onDragOver(e, idx) { e.preventDefault(); setOverIdx(idx); }
  function onDrop(idx) {
    if (dragIdx===null||dragIdx===idx) { setDragIdx(null); setOverIdx(null); return; }
    const a=[...tasks];
    const [moved]=a.splice(dragIdx,1);
    a.splice(idx,0,moved);
    onChange(a);
    setDragIdx(null); setOverIdx(null);
  }

  const done = tasks.filter(t => t.done).length;

  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:14,marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <span style={{fontSize:11,fontWeight:700,color:C.sub,letterSpacing:"0.08em",textTransform:"uppercase"}}>タスク</span>
        {tasks.length>0 && (
          <span style={{fontSize:11,color:done===tasks.length?C.green:C.sub,fontWeight:700}}>
            {done}/{tasks.length} 完了
          </span>
        )}
      </div>

      {tasks.map((t, idx) => (
        <div key={t.id}
          draggable
          onDragStart={()=>onDragStart(idx)}
          onDragOver={e=>onDragOver(e,idx)}
          onDrop={()=>onDrop(idx)}
          onDragEnd={()=>{setDragIdx(null);setOverIdx(null);}}
          style={{
            display:"flex", alignItems:"center", gap:8,
            padding:"8px 6px", borderRadius:9, marginBottom:4,
            background: overIdx===idx ? C.accentGlow : dragIdx===idx ? C.card2 : "transparent",
            border: `1px solid ${overIdx===idx ? C.accent : "transparent"}`,
            transition:"background 0.15s",
          }}>
          {/* ドラッグハンドル */}
          <div style={{display:"flex",flexDirection:"column",gap:2,cursor:"grab",flexShrink:0,padding:"0 2px"}}>
            {[0,1,2].map(i=>(
              <div key={i} style={{display:"flex",gap:2}}>
                <div style={{width:3,height:3,borderRadius:"50%",background:C.muted}}/>
                <div style={{width:3,height:3,borderRadius:"50%",background:C.muted}}/>
              </div>
            ))}
          </div>

          {/* 番号 */}
          <span style={{fontSize:10,color:C.muted,fontWeight:700,minWidth:16,textAlign:"center",flexShrink:0}}>{idx+1}</span>

          {/* チェック */}
          <button onClick={()=>toggle(t.id)}
            style={{width:22,height:22,borderRadius:6,border:`2px solid ${t.done?C.green:C.border}`,background:t.done?C.green+"33":"transparent",cursor:"pointer",flexShrink:0,color:C.green,fontSize:12,display:"flex",alignItems:"center",justifyContent:"center"}}>
            {t.done ? "✓" : ""}
          </button>

          {/* テキスト */}
          <input value={t.text} onChange={e=>editText(t.id,e.target.value)}
            style={{flex:1,background:"none",border:"none",color:t.done?C.muted:C.text,fontSize:13,outline:"none",textDecoration:t.done?"line-through":"none",fontFamily:"inherit"}}/>

          {/* 上下ボタン */}
          <div style={{display:"flex",flexDirection:"column",gap:1,flexShrink:0}}>
            <button onClick={()=>moveUp(idx)} disabled={idx===0}
              style={{background:idx===0?"transparent":C.card2,border:`1px solid ${idx===0?C.border:C.sub}`,color:idx===0?C.muted:C.sub,fontSize:9,cursor:idx===0?"default":"pointer",padding:"2px 5px",borderRadius:4,lineHeight:1,fontWeight:700}}>
              ▲
            </button>
            <button onClick={()=>moveDown(idx)} disabled={idx===tasks.length-1}
              style={{background:idx===tasks.length-1?"transparent":C.card2,border:`1px solid ${idx===tasks.length-1?C.border:C.sub}`,color:idx===tasks.length-1?C.muted:C.sub,fontSize:9,cursor:idx===tasks.length-1?"default":"pointer",padding:"2px 5px",borderRadius:4,lineHeight:1,fontWeight:700}}>
              ▼
            </button>
          </div>

          <button onClick={()=>remove(t.id)}
            style={{background:"none",border:"none",color:C.muted,fontSize:16,cursor:"pointer",flexShrink:0,padding:"0 2px"}}>
            ×
          </button>
        </div>
      ))}

      <div style={{display:"flex",gap:8,marginTop:tasks.length?10:0}}>
        <input value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&addTask()}
          placeholder="タスクを追加... (Enterで追加)"
          style={{...inp,flex:1,padding:"8px 10px"}}/>
        <button onClick={addTask}
          style={{padding:"8px 16px",borderRadius:9,border:"none",background:C.accentGlow,color:C.accent,fontWeight:800,fontSize:15,cursor:"pointer"}}>
          +
        </button>
      </div>
      {tasks.length > 1 && (
        <div style={{fontSize:10,color:C.muted,marginTop:6,textAlign:"center"}}>
          ⋮⋮ ドラッグで並び替え可能
        </div>
      )}
    </div>
  );
}

// ─── CELL MODAL ───────────────────────────────────────────────────────────────
function CellModal({ cell, onClose, onSave }) {
  const [d, setD] = useState({...cell, tasks: cell.tasks||[]});
  const [editingName, setEditingName] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiKeyInput, setAiKeyInput] = useState(localStorage.getItem(AI_KEY_STORAGE)||"");
  const [showKeyInput, setShowKeyInput] = useState(false);
  const profit = (d.income||0)-(d.expense||0);
  const nameRef = useRef();

  function saveAiKey() {
    const k = aiKeyInput.trim();
    if (k) { localStorage.setItem(AI_KEY_STORAGE, k); setShowKeyInput(false); }
  }

  async function runAI() {
    const key = getAiKey();
    if (!key) { setShowKeyInput(true); setAiText("APIキーを設定してください。"); return; }
    setAiLoading(true); setAiText("");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "x-api-key": key,
          "anthropic-version":"2023-06-01",
          "anthropic-dangerous-direct-browser-access":"true"
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 800,
          messages:[{role:"user", content:
            `経営戦略の専門家として以下のセルを日本語で分析してください。200文字以内、箇条書き3点で。\n` +
            `セル名:${d.name}\nステータス:${d.status} / 進捗:${d.progress}%\n` +
            `KPI:${d.kpi||"未設定"} / KGI:${d.kgi||"未設定"} / KSF:${d.ksf||"未設定"}\n` +
            `リスク:${d.risk||"未設定"}\n` +
            `売上:¥${(d.income||0).toLocaleString()} / コスト:¥${(d.expense||0).toLocaleString()}\n` +
            `次のアクション:${d.next||"未設定"}`
          }]
        })
      });
      const j = await res.json();
      if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
      setAiText(j.content?.[0]?.text || "分析できませんでした。");
    } catch(e) {
      setAiText(`❌ エラー: ${e.message}`);
    }
    setAiLoading(false);
  }

  // 5K items definition
  const K5 = [
    {k:"kpi",  label:"KPI",  tag:"数値目標",      color:C.blue,   icon:"📊"},
    {k:"kgi",  label:"KGI",  tag:"最終目標指標",  color:C.teal,   icon:"🎯"},
    {k:"ksf",  label:"KSF",  tag:"サクセスファクター", color:C.green, icon:"⭐"},
    {k:"risk", label:"RISK", tag:"リスクファクター",color:C.red,    icon:"⚠️"},
    {k:"next", label:"NEXT", tag:"次にやる事",     color:C.purple, icon:"▶️"},
  ];

  return (
    <div style={{position:"fixed",inset:0,background:"#000b",zIndex:300,overflowY:"auto"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:480,margin:"0 auto",background:C.surface,minHeight:"100vh"}}>

        {/* HEADER */}
        <div style={{padding:"20px 18px 16px",borderBottom:`1px solid ${C.border}`}}>
          <div style={{display:"flex",alignItems:"flex-start",gap:14,marginBottom:14}}>
            <Ring pct={d.progress} size={72}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:11,color:C.sub,marginBottom:4}}>{d.row} / {d.col} / {d.type1}×{d.type2}</div>
              {editingName
                ? <input ref={nameRef} autoFocus value={d.name}
                    onChange={e=>setD(p=>({...p,name:e.target.value}))}
                    onBlur={()=>setEditingName(false)}
                    onKeyDown={e=>e.key==="Enter"&&setEditingName(false)}
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
            <FRow label="担当者">
              <input value={d.assignee} onChange={e=>setD(p=>({...p,assignee:e.target.value}))} placeholder="担当者名を入力..." style={inp}/>
            </FRow>
            <FRow label="開始日">
              <input type="date" value={d.startDate?.replace(/\//g,"-")} onChange={e=>setD(p=>({...p,startDate:e.target.value}))} style={inp}/>
            </FRow>
            <FRow label="期限">
              <input type="date" value={d.deadline?.replace(/\//g,"-")} onChange={e=>setD(p=>({...p,deadline:e.target.value}))} style={inp}/>
            </FRow>
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
          <TaskSection tasks={d.tasks} onChange={tasks=>setD(p=>({...p,tasks}))}/>

          {/* 5K 戦略項目 (ブラッシュアップ版) */}
          <Sec label="5K 戦略項目">
            {K5.map(({k, label, tag, color, icon})=>{
              const val = d[k]||"";
              const filled = val.trim().length > 0;
              return (
                <div key={k} style={{
                  background: filled ? C.card : "#ffffff",
                  border:`1px solid ${filled ? color+"66" : "#e0e0e0"}`,
                  borderLeft:`3px solid ${filled ? color : "#d0d0d0"}`,
                  borderRadius:12, padding:14, marginBottom:10,
                  boxShadow: filled ? `0 0 12px ${color}18` : "none",
                  transition:"all 0.2s",
                }}>
                  <div style={{display:"flex",gap:8,marginBottom:8,alignItems:"center",justifyContent:"space-between"}}>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <span style={{fontSize:14}}>{icon}</span>
                      <span style={{fontSize:12,fontWeight:800,color: filled ? color : C.muted,letterSpacing:"0.06em"}}>{label}</span>
                      <span style={{fontSize:10,color:C.muted,background:C.card2,padding:"2px 8px",borderRadius:20}}>{tag}</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      {filled && <span style={{width:7,height:7,borderRadius:"50%",background:color,boxShadow:`0 0 6px ${color}`,display:"inline-block"}}/>}
                      <span style={{fontSize:10,color:C.muted}}>{val.length}字</span>
                    </div>
                  </div>
                  <textarea value={val} onChange={e=>setD(p=>({...p,[k]:e.target.value}))}
                    rows={2} placeholder={`${label}を入力...`}
                    style={{...inp,resize:"vertical",fontFamily:"inherit",
                      borderColor: filled ? color+"44" : C.border,
                      boxShadow: filled ? `inset 0 0 0 1px ${color}22` : "none"
                    }}/>
                </div>
              );
            })}
          </Sec>

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

          {/* AI 戦略分析 (修正版) */}
          <Sec label="AI 戦略分析">
            {/* APIキー設定 */}
            {showKeyInput && (
              <div style={{background:C.card2,border:`1px solid ${C.yellow}44`,borderRadius:12,padding:14,marginBottom:12}}>
                <div style={{fontSize:11,color:C.yellow,fontWeight:700,marginBottom:8}}>⚙️ Anthropic APIキーを設定</div>
                <div style={{display:"flex",gap:8}}>
                  <input
                    type="password"
                    value={aiKeyInput}
                    onChange={e=>setAiKeyInput(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&saveAiKey()}
                    placeholder="sk-ant-..."
                    style={{...inp,flex:1,fontSize:12}}/>
                  <button onClick={saveAiKey}
                    style={{padding:"8px 14px",borderRadius:9,border:"none",background:C.accent,color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer",whiteSpace:"nowrap"}}>
                    保存
                  </button>
                </div>
                <div style={{fontSize:10,color:C.muted,marginTop:6}}>console.anthropic.com で取得。ブラウザに保存されます。</div>
              </div>
            )}

            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:16,marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                <div style={{width:32,height:32,borderRadius:9,background:C.accentGlow,border:`1px solid ${C.accent}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>✦</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:C.text}}>AI 戦略分析</div>
                  <div style={{fontSize:10,color:C.muted}}>Claude による経営アドバイス</div>
                </div>
                {!showKeyInput && (
                  <button onClick={()=>setShowKeyInput(true)}
                    style={{background:"none",border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,fontSize:10,cursor:"pointer",padding:"4px 8px"}}>
                    🔑 キー
                  </button>
                )}
              </div>
              {aiText
                ? <div style={{fontSize:12,color:aiText.startsWith("❌")?C.red:C.sub,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{aiText}</div>
                : <div style={{fontSize:12,color:C.muted,fontStyle:"italic"}}>ボタンを押してAI分析を実行...</div>
              }
            </div>
            <button onClick={runAI} disabled={aiLoading}
              style={{width:"100%",padding:"12px 0",borderRadius:11,border:`1px solid ${C.accent}`,background:aiLoading?C.card:C.accentGlow,color:C.accent,fontWeight:700,fontSize:13,cursor:aiLoading?"not-allowed":"pointer"}}>
              {aiLoading ? "✦ 分析中..." : "✦ AI分析を実行"}
            </button>
          </Sec>

          <button onClick={()=>{onSave(d);onClose();}}
            style={{width:"100%",padding:"15px 0",borderRadius:13,border:"none",background:`linear-gradient(135deg,${C.accent},${C.purple})`,color:"#fff",fontWeight:800,fontSize:15,cursor:"pointer",marginTop:6}}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── COMPETITOR MODAL ─────────────────────────────────────────────────────────
function CompetitorModal({ comp, onClose, onSave, onDelete }) {
  const [d, setD] = useState({...comp});
  const isNew = !comp.id;

  function handleSave() {
    const c = { ...d, id: d.id || Date.now()+"" };
    onSave(c);
    onClose();
  }

  return (
    <div style={{position:"fixed",inset:0,background:"#000c",zIndex:400,overflowY:"auto"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()}
        style={{width:"100%",maxWidth:430,margin:"0 auto",background:C.surface,minHeight:"100vh",padding:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontSize:15,fontWeight:900,color:C.text}}>
            {isNew ? "競合他社を追加" : "競合他社 編集"}
          </div>
          <button onClick={onClose} style={{background:C.card,border:`1px solid ${C.border}`,color:C.sub,borderRadius:"50%",width:34,height:34,cursor:"pointer",fontSize:16}}>✕</button>
        </div>

        {/* 色選択 */}
        <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
          {COMP_COLORS.map(col=>(
            <div key={col} onClick={()=>setD(p=>({...p,color:col}))}
              style={{width:28,height:28,borderRadius:8,background:col,cursor:"pointer",border:d.color===col?`2px solid ${C.text}`:"2px solid transparent",boxShadow:d.color===col?`0 0 8px ${col}`:"none"}}/>
          ))}
        </div>

        <Sec label="基本情報">
          <FRow label="会社名">
            <input value={d.name||""} onChange={e=>setD(p=>({...p,name:e.target.value}))} placeholder="競合他社名" style={inp}/>
          </FRow>
          <FRow label="業種">
            <input value={d.industry||""} onChange={e=>setD(p=>({...p,industry:e.target.value}))} placeholder="例：民泊・ホテル業" style={inp}/>
          </FRow>
          <FRow label="市場シェア">
            <input value={d.share||""} onChange={e=>setD(p=>({...p,share:e.target.value}))} placeholder="例：15%" style={inp}/>
          </FRow>
        </Sec>

        {[
          {k:"overview",  label:"🏢 概要",     tag:"会社の説明・特徴",   rows:3},
          {k:"strengths", label:"💪 強み",     tag:"競合の強い点",       rows:3},
          {k:"weaknesses",label:"⚠️ 弱み",    tag:"競合の弱い点・隙間", rows:3},
          {k:"strategy",  label:"🎯 戦略",     tag:"競合の主な戦略",     rows:2},
          {k:"notes",     label:"📝 メモ",     tag:"その他の気づき",     rows:3},
        ].map(({k,label,tag,rows})=>(
          <div key={k} style={{marginBottom:14}}>
            <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
              <span style={{fontSize:12,fontWeight:700,color:C.text}}>{label}</span>
              <span style={{fontSize:10,color:C.muted}}>{tag}</span>
            </div>
            <textarea value={d[k]||""} onChange={e=>setD(p=>({...p,[k]:e.target.value}))}
              rows={rows} style={{...inp,resize:"none",fontFamily:"inherit"}}/>
          </div>
        ))}

        <div style={{display:"flex",gap:10,marginTop:20}}>
          <button onClick={handleSave}
            style={{flex:3,padding:"14px 0",borderRadius:13,border:"none",background:`linear-gradient(135deg,${d.color||C.accent},${C.purple})`,color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer"}}>
            {isNew?"追加する":"更新する"}
          </button>
          {!isNew && (
            <button onClick={()=>{onDelete(d.id);onClose();}}
              style={{flex:1,padding:"14px 0",borderRadius:13,border:`1px solid ${C.red}44`,background:"transparent",color:C.red,fontWeight:700,fontSize:13,cursor:"pointer"}}>
              削除
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── COMPETITOR STRIP (HOME上部) ──────────────────────────────────────────────
function CompetitorStrip({ competitors, onAdd, onEdit }) {
  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:13,padding:12,marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <span style={{fontSize:10,fontWeight:700,color:C.sub,letterSpacing:"0.08em",textTransform:"uppercase"}}>
          競合他社
        </span>
        <button onClick={onAdd}
          style={{fontSize:11,color:C.accent,background:C.accentGlow,border:`1px solid ${C.accent}44`,borderRadius:20,padding:"3px 12px",cursor:"pointer",fontWeight:700}}>
          + 追加
        </button>
      </div>

      {competitors.length === 0 ? (
        <div style={{fontSize:11,color:C.muted,textAlign:"center",padding:"6px 0"}}>
          競合他社を登録してください
        </div>
      ) : (
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {competitors.map(c=>(
            <button key={c.id} onClick={()=>onEdit(c)}
              style={{
                display:"flex",alignItems:"center",gap:6,
                background: c.color+"18",
                border:`1px solid ${c.color}44`,
                borderRadius:20, padding:"5px 12px", cursor:"pointer",
              }}>
              <span style={{width:8,height:8,borderRadius:"50%",background:c.color,boxShadow:`0 0 6px ${c.color}`,flexShrink:0}}/>
              <span style={{fontSize:12,fontWeight:700,color:c.color}}>{c.name}</span>
              {c.share && <span style={{fontSize:10,color:C.muted}}>{c.share}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── HOME TAB ─────────────────────────────────────────────────────────────────
function HomeTab({ matrix, onCellClick, competitors, onAddComp, onEditComp }) {
  function cellBg(p) {
    if(p===0) return {bg:"#ffffff",border:"#e0e0e0"};
    if(p>=70) return {bg:"#1a1f3a",border:"#3a4070"};
    if(p>=40) return {bg:"#1f1a0a",border:"#504010"};
    return {bg:"#1f0f18",border:"#50203a"};
  }

  return (
    <div>
      {/* 競合他社ストリップ */}
      <CompetitorStrip competitors={competitors} onAdd={onAddComp} onEdit={onEditComp}/>

      {/* Column headers */}
      <div style={{display:"flex",gap:6,marginBottom:6,paddingLeft:34}}>
        {COL_LABELS.map(c=>(
          <div key={c} style={{flex:1,textAlign:"center",fontSize:13,fontWeight:700,color:C.sub,padding:"4px 0"}}>{c}</div>
        ))}
      </div>

      {ROW_LABELS.map(row=>(
        <div key={row} style={{display:"grid",gridTemplateColumns:"28px 1fr 1fr 1fr",gap:6,marginBottom:6}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{fontSize:10,color:C.sub,writingMode:"vertical-rl",letterSpacing:"0.1em"}}>{row}</span>
          </div>
          {COL_LABELS.map(col=>{
            const cells=Object.values(matrix).filter(c=>c.row===row&&c.col===col);
            const avg=Math.round(cells.reduce((a,c)=>a+c.progress,0)/cells.length);
            const alerts=cells.filter(c=>c.priority==="高"&&c.progress<50).length;
            return (
              <div key={col} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:13,padding:8}}>
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
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gridAutoRows:"1fr",gap:3}}>
                  {TYPES.flatMap(t1=>TYPES.map(t2=>{
                    const key=`${row}__${col}__${t1}__${t2}`;
                    const cell=matrix[key]; if(!cell)return null;
                    const {bg,border}=cellBg(cell.progress);
                    const isAlert=cell.priority==="高"&&cell.progress<50;
                    const isEmpty=cell.progress===0&&!cell.kpi&&!cell.kgi&&!cell.ksf&&!cell.risk&&!cell.next;
                    return (
                      <button key={key} onClick={()=>onCellClick(cell)}
                        style={{padding:0,borderRadius:7,border:`1px solid ${border}`,background:bg,cursor:"pointer",textAlign:"center",position:"relative",aspectRatio:"1",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:0}}>
                        {isAlert&&<span style={{position:"absolute",top:2,right:2,width:5,height:5,borderRadius:"50%",background:C.red,display:"block"}}/>}
                        <div style={{fontSize:10,fontWeight:800,color:isEmpty?"transparent":pColor(cell.progress)}}>{cell.progress+"%"}</div>
                        <div style={{fontSize:7,color:isEmpty?"transparent":pColor(cell.progress),marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:36,opacity:0.85}}>{cell.name.slice(0,4)}</div>
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

  const ownerStats=members.map(m=>{
    const oc=cells.filter(c=>c.assignee===m.name);
    const avg=oc.length?Math.round(oc.reduce((a,c)=>a+c.progress,0)/oc.length):0;
    const prf=oc.reduce((a,c)=>a+(c.income||0)-(c.expense||0),0);
    return {...m,count:oc.length,avg,profit:prf};
  }).filter(m=>m.count>0).sort((a,b)=>b.count-a.count);

  const secStats=ROW_LABELS.flatMap(row=>COL_LABELS.map(col=>{
    const sc=cells.filter(c=>c.row===row&&c.col===col);
    const avg=Math.round(sc.reduce((a,c)=>a+c.progress,0)/sc.length);
    return {label:`${row}-${col}`,avg};
  }));

  return (
    <div>
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
function RoadTab({ matrix }) {
  const [filter, setFilter]=useState("すべて");
  const FILTERS=["すべて","高優先","実行中","危険"];
  const MONTHS=["4月","5月","6月","7月","8月","9月"];
  let cells=Object.values(matrix);
  if(filter==="高優先") cells=cells.filter(c=>c.priority==="高");
  else if(filter==="実行中") cells=cells.filter(c=>c.status==="実行"||c.status==="改善");
  else if(filter==="危険") cells=cells.filter(c=>c.progress<40);

  return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {FILTERS.map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            style={{padding:"7px 16px",borderRadius:50,border:`1px solid ${f===filter?C.accent:C.border}`,background:f===filter?C.accentGlow:"transparent",color:f===filter?C.accent:C.sub,fontSize:12,fontWeight:f===filter?700:400,cursor:"pointer"}}>
            {f}
          </button>
        ))}
      </div>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"8px 14px",marginBottom:8,display:"grid",gridTemplateColumns:"110px 1fr",gap:8}}>
        <div style={{fontSize:11,color:C.sub}}>担当 / 案件</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)"}}>
          {MONTHS.map(m=><div key={m} style={{fontSize:10,color:C.sub,textAlign:"center"}}>{m}</div>)}
        </div>
      </div>
      {cells.slice(0,30).map(cell=>{
        const col2=pColor(cell.progress);
        const barEnd=Math.max(1,Math.round(cell.progress/17));
        return (
          <div key={cell.key} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",marginBottom:5}}>
            <div style={{display:"grid",gridTemplateColumns:"110px 1fr",gap:8,alignItems:"center"}}>
              <div>
                <div style={{fontSize:12,color:C.text,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cell.name.length>9?cell.name.slice(0,9)+"...":cell.name}</div>
                <div style={{fontSize:10,color:C.muted,marginTop:2}}>{cell.assignee||"未割当"} · {cell.row}</div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:3}}>
                {MONTHS.map((m,i)=>(
                  <div key={m} style={{height:22,borderRadius:5,overflow:"hidden",background:i<barEnd?col2+"18":"transparent",border:`1px solid ${i<barEnd?col2+"44":"transparent"}`,display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
                    {i===0&&cell.progress>0&&<div style={{position:"absolute",left:0,top:0,width:`${cell.progress}%`,height:"100%",background:barGrad(cell.progress),opacity:0.7,borderRadius:5}}/>}
                    {i===0&&<span style={{fontSize:9,color:"#fff",fontWeight:800,position:"relative",zIndex:1}}>{cell.progress}%</span>}
                  </div>
                ))}
              </div>
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

// ─── ROBOT SPLASH ─────────────────────────────────────────────────────────────
function RobotSplash() {
  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = `
      @keyframes rwalk { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-9px)} }
      @keyframes rblink { 0%,88%,100%{opacity:1} 93%{opacity:0} }
      @keyframes rdot { 0%,100%{opacity:0.3} 50%{opacity:1} }
      .ra{animation:rwalk 0.55s ease-in-out infinite}
      .rb{animation:rwalk 0.55s ease-in-out infinite 0.18s}
      .rc{animation:rwalk 0.55s ease-in-out infinite 0.36s}
      .reye{animation:rblink 2.8s ease-in-out infinite}
      .rdot{animation:rdot 1.2s ease-in-out infinite}
      .rdot2{animation:rdot 1.2s ease-in-out infinite 0.4s}
      .rdot3{animation:rdot 1.2s ease-in-out infinite 0.8s}
    `;
    document.head.appendChild(s);
    return () => document.head.removeChild(s);
  }, []);
  const bots=[{cls:"ra",color:"#6c63ff",id:"A",task:"設計中"},{cls:"rb",color:"#00c896",id:"B",task:"修正中"},{cls:"rc",color:"#c8a830",id:"C",task:"最適化"}];
  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:28}}>
      <div style={{fontSize:13,fontWeight:900,color:C.accent,letterSpacing:"0.14em"}}>YASUHIRO AI TEAM</div>
      <div style={{display:"flex",gap:30,alignItems:"flex-end"}}>
        {bots.map(b=>(
          <div key={b.id} className={b.cls} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5}}>
            <div style={{width:2,height:9,background:b.color,borderRadius:1,marginBottom:0}}/>
            <div style={{width:6,height:6,borderRadius:"50%",background:b.color,marginTop:-4,boxShadow:`0 0 6px ${b.color}`}}/>
            <div style={{width:38,height:30,background:b.color,borderRadius:9,position:"relative",marginTop:2}}>
              <div className="reye" style={{position:"absolute",top:9,left:7,width:7,height:7,background:"#0a0a12",borderRadius:"50%"}}/>
              <div className="reye" style={{position:"absolute",top:9,right:7,width:7,height:7,background:"#0a0a12",borderRadius:"50%"}}/>
            </div>
            <div style={{width:32,height:22,background:b.color+"bb",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span style={{fontSize:11,fontWeight:900,color:"#0a0a12"}}>{b.id}</span>
            </div>
            <div style={{display:"flex",gap:5}}>
              <div style={{width:9,height:11,background:b.color+"88",borderRadius:"0 0 4px 4px"}}/>
              <div style={{width:9,height:11,background:b.color+"88",borderRadius:"0 0 4px 4px"}}/>
            </div>
            <div style={{fontSize:10,color:b.color,fontWeight:700,marginTop:2}}>{b.task}</div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:5,marginTop:4}}>
        <div className="rdot"  style={{width:6,height:6,borderRadius:"50%",background:C.accent}}/>
        <div className="rdot2" style={{width:6,height:6,borderRadius:"50%",background:C.accent}}/>
        <div className="rdot3" style={{width:6,height:6,borderRadius:"50%",background:C.accent}}/>
      </div>
      <div style={{color:C.muted,fontSize:11,letterSpacing:"0.08em"}}>Supabaseに接続中...</div>
    </div>
  );
}

// ─── HELPER COMPONENTS ────────────────────────────────────────────────────────
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

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab]=useState("home");
  const [matrix, setMatrix]=useState(null);
  const [members, setMembers]=useState([]);
  const [selected, setSelected]=useState(null);
  const [loading, setLoading]=useState(true);
  const [saving, setSaving]=useState(false);
  const [competitors, setCompetitors]=useState(()=>loadCompetitors());
  const [compModal, setCompModal]=useState(null); // null | {comp, isNew}

  useEffect(()=>{
    Promise.all([loadCells(),loadMembers()]).then(([m,mb])=>{setMatrix(m);setMembers(mb);setLoading(false);});
  },[]);

  function exportCSV() {
    if(!matrix) return;
    const rows = Object.values(matrix);
    const header = ["key","row","col","type1","type2","name","progress","status","priority","assignee","startDate","deadline","kpi","kgi","ksf","risk","next","income","expense","description"];
    const csv = [header.join(","), ...rows.map(r => header.map(h => `"${String(r[h]??'').replace(/"/g,'""')}"`).join(","))].join("\n");
    const blob = new Blob(["﻿"+csv], {type:"text/csv;charset=utf-8;"});
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `trizos_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  }

  function handleSave(updated) {
    setMatrix(prev => ({ ...prev, [updated.key]: updated }));
    setSelected(null);
    setSaving(true);
    saveCell(updated).finally(() => setSaving(false));
  }

  function handleAddComp() {
    setCompModal({ comp: { name:"", color: COMP_COLORS[competitors.length % COMP_COLORS.length], overview:"", strengths:"", weaknesses:"", strategy:"", share:"", industry:"", notes:"" }});
  }
  function handleEditComp(c) { setCompModal({ comp: c }); }
  function handleSaveComp(c) {
    const updated = compModal?.comp?.id
      ? competitors.map(x => x.id===c.id ? c : x)
      : [...competitors, c];
    setCompetitors(updated);
    saveCompetitors(updated);
  }
  function handleDeleteComp(id) {
    const updated = competitors.filter(c => c.id !== id);
    setCompetitors(updated);
    saveCompetitors(updated);
  }

  if(loading) return <RobotSplash />;

  return (
    <div style={{maxWidth:430,margin:"0 auto",minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'Noto Sans JP','Hiragino Sans',sans-serif",display:"flex",flexDirection:"column"}}>

      {/* TOP HEADER */}
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,borderRadius:8,background:C.accentGlow,border:`1px solid ${C.accent}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>⊞</div>
          <div>
            <div style={{fontSize:15,fontWeight:900,color:C.accent,lineHeight:1.1}}>{TAB_PAGE_TITLES[tab]}</div>
            <div style={{fontSize:10,color:C.muted}}>{TAB_PAGE_SUBS[tab]}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button style={{padding:"6px 12px",borderRadius:20,border:`1px solid ${C.border}`,background:"transparent",color:C.sub,fontSize:11,cursor:"pointer"}}>ローカル</button>
          <button onClick={exportCSV} style={{padding:"6px 14px",borderRadius:20,border:"none",background:C.card2,color:C.text,fontSize:11,fontWeight:600,cursor:"pointer"}}>CSV{saving?" ●":""}</button>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{flex:1,overflowY:"auto",padding:"14px 12px 90px"}}>
        {tab==="home"&&<HomeTab matrix={matrix} onCellClick={setSelected} competitors={competitors} onAddComp={handleAddComp} onEditComp={handleEditComp}/>}
        {tab==="dash"&&<DashTab matrix={matrix} members={members}/>}
        {tab==="road"&&<RoadTab matrix={matrix}/>}
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

      {selected && <CellModal cell={matrix[selected.key]} onClose={()=>setSelected(null)} onSave={handleSave}/>}

      {compModal && (
        <CompetitorModal
          comp={compModal.comp}
          onClose={()=>setCompModal(null)}
          onSave={handleSaveComp}
          onDelete={handleDeleteComp}
        />
      )}
    </div>
  );
}
