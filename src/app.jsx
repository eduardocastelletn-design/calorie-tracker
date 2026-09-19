import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Camera, Flame, ChefHat, Settings as SettingsIcon, Plus, X,
  ChevronLeft, ChevronRight, Loader2, UtensilsCrossed, Dumbbell,
  Trash2, Sparkles, Check, Scale, TrendingUp
} from "lucide-react";

/* ---------------------------------------------------------------
   Storage (plain browser localStorage — this app runs as a real
   deployed site, not inside a Claude artifact sandbox)
--------------------------------------------------------------- */

const storage = {
  async get(key) {
    const v = localStorage.getItem(key);
    return v === null ? null : { key, value: v };
  },
  async set(key, value) {
    localStorage.setItem(key, value);
    return { key, value };
  },
};

/* ---------------------------------------------------------------
   Helpers
--------------------------------------------------------------- */

const pad = (n) => String(n).padStart(2, "0");
const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => toDateStr(new Date());
const prettyDate = (dStr) => {
  const [y, m, d] = dStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const isToday = dStr === todayStr();
  if (isToday) return "Today";
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  if (dStr === toDateStr(yest)) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
};
const shiftDate = (dStr, delta) => {
  const [y, m, d] = dStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + delta);
  return toDateStr(date);
};
const uid = () => Math.random().toString(36).slice(2, 10);

const ACTIVITY_METS = {
  "Walking": 3.5,
  "Brisk walking": 4.3,
  "Running": 9.8,
  "Jogging": 7.0,
  "Cycling": 7.5,
  "Swimming": 7.0,
  "Strength training": 5.0,
  "Yoga": 2.5,
  "HIIT": 8.0,
  "Hiking": 6.0,
  "Dancing": 4.8,
  "Rowing": 7.0,
  "Elliptical": 5.0,
};

function estimateBurn(met, weightKg, minutes) {
  return Math.round(((met * 3.5 * weightKg) / 200) * minutes);
}

function estimateStepsBurn(steps, weightKg) {
  return Math.round(steps * (weightKg || 70) * 0.0006);
}

async function askClaude(content, system) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, system }),
  });
  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw new Error(`Server returned a non-JSON response (status ${res.status}). The /api/claude function may not be deployed correctly.`);
  }
  if (!res.ok) {
    throw new Error(data?.error || `Request failed with status ${res.status}.`);
  }
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return text;
}

function parseJSON(text) {
  const cleaned = (text || "").replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const match = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e2) {
        return null;
      }
    }
    return null;
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function recalcItemCalories(name) {
  const text = await askClaude(
    `Food item: "${name}"`,
    `You are a rigorous nutrition-estimation assistant. Estimate the calories for a single food item or ingredient, using a typical restaurant/home-cooked portion size if none is specified. If the item is something normally cooked or served with oil, butter, dressing, or sauce (e.g. a sautéed, fried, roasted, or dressed item), assume that fat/sauce is included in your estimate unless the name explicitly says otherwise (e.g. "plain," "dry," "no oil"). Form a plausible low-to-high range and report a figure in the upper third of that range rather than the midpoint, since underestimating is the costlier mistake for someone tracking calories for fat loss. Respond ONLY with strict JSON, no markdown fences, no commentary, in exactly this shape: {"calories": number}. Always give your best estimate even if the description is vague.`
  );
  const parsed = parseJSON(text);
  return parsed && typeof parsed.calories === "number" ? Math.round(parsed.calories) : null;
}

const LB_PER_KG = 2.20462;
const toKg = (value, unit) => (unit === "lb" ? value / LB_PER_KG : value);
const fromKg = (kg, unit) => (unit === "lb" ? kg * LB_PER_KG : kg);

/* ---------------------------------------------------------------
   Styles
--------------------------------------------------------------- */

const CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@600;700&display=swap');
  :root{
    --cream:#0B3B2C;
    --card:#123F30;
    --sage:#6FBF8B;
    --sage-dark:#4E9A6C;
    --coral:#F0A98B;
    --coral-dark:#E8A47B;
    --gold:#E4C567;
    --gold-dark:#D4AF37;
    --lavender:#C6B7DE;
    --ink:#FFFFFF;
    --ink-soft:rgba(255,255,255,0.62);
    --track:rgba(255,255,255,0.12);
    --danger:#E2725B;
    --radius:20px;
  }
  .ct-root{
    font-family:'Inter',system-ui,sans-serif;
    background:var(--cream);
    color:var(--ink);
    min-height:100vh;
    display:flex;
    flex-direction:column;
    max-width:480px;
    margin:0 auto;
    position:relative;
  }
  .ct-display{ font-family:'Fraunces',Georgia,serif; }
  .ct-mono{ font-family:'JetBrains Mono',monospace; }
  .ct-header{
    padding:22px 20px 10px;
    display:flex; align-items:center; justify-content:space-between;
  }
  .ct-header h1{ font-size:22px; font-weight:600; margin:0; letter-spacing:-0.01em; }
  .ct-header .lock{ display:flex; align-items:center; gap:4px; font-size:11px; color:var(--ink-soft); }
  .ct-date-row{
    display:flex; align-items:center; justify-content:center; gap:14px;
    padding:2px 20px 14px; font-size:14px; font-weight:600; color:var(--ink-soft);
  }
  .ct-date-row button{
    background:var(--card); border:none; border-radius:10px; width:30px;height:30px;
    display:flex; align-items:center; justify-content:center; color:var(--ink);
    box-shadow:0 1px 3px rgba(0,0,0,0.35); cursor:pointer;
  }
  .ct-date-row span{ min-width:110px; text-align:center; }
  .ct-body{ flex:1; overflow-y:auto; padding:0 20px 110px; }
  .ct-card{
    background:var(--card); border-radius:var(--radius); padding:18px;
    box-shadow:0 2px 12px rgba(0,0,0,0.35); margin-bottom:16px;
  }
  .ct-gauge-wrap{ display:flex; flex-direction:column; align-items:center; padding:8px 0 4px; }
  .ct-gauge-readout{ display:flex; flex-direction:column; align-items:center; margin-top:-18px; }
  .ct-gauge-readout .num{ font-size:34px; font-weight:700; line-height:1; }
  .ct-gauge-readout .lbl{ font-size:12px; color:var(--ink-soft); margin-top:4px; }
  .ct-stats-row{ display:flex; justify-content:center; align-items:flex-start; margin-top:28px; }
  .ct-stat{ text-align:center; padding:0 26px; }
  .ct-stat:not(:first-child){ border-left:1px solid var(--track); }
  .ct-stat .v{ font-size:19px; font-weight:700; }
  .ct-stat .l{ font-size:11px; color:var(--ink-soft); text-transform:uppercase; letter-spacing:0.06em; margin-top:8px;}
  .ct-section-title{ font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:var(--ink-soft); margin:0 0 10px 2px; }
  .ct-item{
    display:flex; align-items:center; gap:12px; background:var(--card);
    border-radius:14px; padding:12px 14px; margin-bottom:8px; box-shadow:0 1px 4px rgba(0,0,0,0.3);
  }
  .ct-item .icon{
    width:36px;height:36px;border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0;
  }
  .ct-item .name{ font-weight:600; font-size:14px; }
  .ct-item .sub{ font-size:12px; color:var(--ink-soft); }
  .ct-item .cal{ margin-left:auto; font-weight:700; font-size:14px; }
  .ct-item button{ background:none; border:none; color:var(--ink-soft); cursor:pointer; padding:4px; }
  .ct-empty{ text-align:center; color:var(--ink-soft); font-size:13px; padding:18px 0; }
  .ct-fab{
    position:absolute; bottom:88px; right:20px; width:58px; height:58px; border-radius:50%;
    background:var(--sage-dark); color:#fff; border:none; display:flex; align-items:center; justify-content:center;
    box-shadow:0 6px 16px rgba(212,175,55,0.4); cursor:pointer; z-index:20;
  }
  .ct-nav{
    display:flex; justify-content:space-around; align-items:center;
    background:var(--card); border-top:1px solid var(--track); padding:10px 0 14px;
    position:sticky; bottom:0; z-index:10;
  }
  .ct-nav button{
    background:none; border:none; display:flex; flex-direction:column; align-items:center; gap:3px;
    color:var(--ink-soft); font-size:10px; font-weight:600; cursor:pointer; width:70px;
  }
  .ct-nav button.active{ color:var(--sage-dark); }
  .ct-overlay{
    position:fixed; inset:0; background:rgba(58,51,46,0.4); display:flex; align-items:flex-end;
    justify-content:center; z-index:50;
  }
  .ct-sheet{
    background:var(--cream); width:100%; max-width:480px; border-radius:24px 24px 0 0;
    padding:22px 20px 30px; max-height:88vh; overflow-y:auto;
  }
  .ct-sheet h2{ font-size:19px; margin:0 0 16px; font-weight:700; }
  .ct-close{ position:absolute; top:16px; right:16px; background:var(--track); border:none; border-radius:50%; width:30px; height:30px; display:flex; align-items:center; justify-content:center; cursor:pointer; }
  .ct-btn{
    display:flex; align-items:center; justify-content:center; gap:8px; width:100%; padding:14px;
    border-radius:14px; border:none; font-weight:700; font-size:14px; cursor:pointer; margin-bottom:10px;
  }
  .ct-btn.primary{ background:var(--sage-dark); color:#fff; }
  .ct-btn.secondary{ background:var(--card); color:var(--ink); box-shadow:0 1px 4px rgba(0,0,0,0.3); }
  .ct-btn.coral{ background:var(--coral-dark); color:#fff; }
  .ct-btn:disabled{ opacity:0.55; cursor:default; }
  .ct-input{
    width:100%; padding:12px 14px; border-radius:12px; border:1.5px solid var(--track);
    background:rgba(255,255,255,0.07); font-size:16px; margin-bottom:12px; box-sizing:border-box; color:var(--ink);
  }
  .ct-input::placeholder{ color:rgba(255,255,255,0.4); }
  .ct-input:focus{ outline:none; border-color:var(--sage); }
  .ct-label{ font-size:12px; font-weight:700; color:var(--ink-soft); margin:0 0 6px 2px; text-transform:uppercase; letter-spacing:0.04em; }
  .ct-select-grid{ display:flex; flex-wrap:wrap; gap:8px; margin-bottom:14px; }
  .ct-chip{
    padding:8px 14px; border-radius:20px; background:var(--card); font-size:13px; font-weight:600;
    border:1.5px solid var(--track); cursor:pointer; color:var(--ink);
  }
  .ct-chip.active{ background:var(--sage); border-color:var(--sage); color:#0B3B2C; }
  .ct-unit-toggle{ display:flex; flex-shrink:0; border-radius:12px; overflow:hidden; border:1.5px solid var(--track); }
  .ct-unit-toggle button{
    padding:0 16px; background:var(--card); border:none; color:var(--ink);
    font-size:13px; font-weight:700; cursor:pointer; font-family:inherit;
  }
  .ct-unit-toggle button.active{ background:var(--sage); color:#0B3B2C; }
  .ct-recipe-card{ background:var(--card); border-radius:18px; padding:16px; margin-bottom:14px; box-shadow:0 2px 8px rgba(0,0,0,0.3); }
  .ct-recipe-card h3{ margin:0 0 4px; font-size:16px; }
  .ct-recipe-meta{ display:flex; gap:14px; font-size:12px; color:var(--ink-soft); margin-bottom:8px; font-weight:600; }
  .ct-recipe-card p{ font-size:13px; color:var(--ink); margin:0 0 8px; line-height:1.5; }
  .ct-recipe-card ul{ margin:0; padding-left:18px; font-size:12.5px; color:var(--ink-soft); }
  .ct-photo-preview{ width:100%; border-radius:14px; margin-bottom:12px; max-height:220px; object-fit:cover; }
  .ct-spin{ animation:ct-spin 1s linear infinite; }
  @keyframes ct-spin{ to{ transform:rotate(360deg); } }
  .ct-banner{ font-size:12px; background:var(--track); color:var(--ink-soft); border-radius:10px; padding:9px 12px; margin-bottom:14px; }
`;

/* ---------------------------------------------------------------
   Small components
--------------------------------------------------------------- */

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return ["M", start.x, start.y, "A", r, r, 0, largeArcFlag, 0, end.x, end.y].join(" ");
}

function GaugeArc({ cx, cy, r, strokeWidth, ratio, trackColor, fillColor }) {
  const start = -90;
  const end = 90;
  const fillEnd = start + 180 * Math.min(Math.max(ratio, 0), 1);
  return (
    <>
      <path
        d={describeArc(cx, cy, r, start, end)}
        fill="none"
        stroke={trackColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {ratio > 0 && (
        <path
          d={describeArc(cx, cy, r, start, fillEnd)}
          fill="none"
          stroke={fillColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      )}
    </>
  );
}

function BalanceRing({ eaten, burned, goal, burnGoal }) {
  const adjustedGoal = Math.max(goal + burned, 1);
  const over = eaten > adjustedGoal;
  const remaining = adjustedGoal - eaten;
  const eatenRatio = goal > 0 ? eaten / goal : 0;
  const burnedRatio = burnGoal > 0 ? burned / burnGoal : 0;

  return (
    <div className="ct-gauge-wrap">
      <svg width="240" height="132" viewBox="0 0 240 132">
        <GaugeArc
          cx={120} cy={118} r={96} strokeWidth={18}
          ratio={eatenRatio}
          trackColor="var(--track)"
          fillColor={over ? "var(--danger)" : "var(--sage)"}
        />
        <GaugeArc
          cx={120} cy={118} r={68} strokeWidth={16}
          ratio={burnedRatio}
          trackColor="var(--track)"
          fillColor="var(--gold)"
        />
      </svg>
      <div className="ct-gauge-readout">
        <div className="num ct-mono" style={{ color: over ? "var(--danger)" : "var(--ink)" }}>
          {Math.abs(remaining)}
        </div>
        <div className="lbl">{over ? "over budget" : "remaining"}</div>
      </div>
      <div className="ct-stats-row">
        <div className="ct-stat">
          <div className="v" style={{ color: "var(--sage)" }}>{eaten}</div>
          <div className="l">Eaten</div>
        </div>
        <div className="ct-stat">
          <div className="v" style={{ color: "var(--gold)" }}>{burned}</div>
          <div className="l" style={{ color: "var(--gold-dark)" }}>Burned</div>
        </div>
        <div className="ct-stat">
          <div className="v">{adjustedGoal}</div>
          <div className="l">Goal</div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Main App
--------------------------------------------------------------- */

function WeightChart({ points, unit }) {
  if (points.length === 0) return null;
  const W = 320, H = 180, padL = 38, padR = 16, padT = 16, padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const values = points.map((p) => p.displayValue);
  let minV = Math.min(...values);
  let maxV = Math.max(...values);
  if (minV === maxV) { minV -= 1; maxV += 1; }
  const pad = (maxV - minV) * 0.15;
  minV -= pad;
  maxV += pad;

  const minT = points[0].t;
  const maxT = points[points.length - 1].t;
  const xFor = (t) => (points.length === 1 ? padL + plotW / 2 : padL + ((t - minT) / (maxT - minT)) * plotW);
  const yFor = (v) => padT + plotH - ((v - minV) / (maxV - minV)) * plotH;

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(p.t)} ${yFor(p.displayValue)}`).join(" ");
  const gridLines = 3;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block", maxWidth: "100%", overflow: "visible" }}>
      {Array.from({ length: gridLines + 1 }).map((_, i) => {
        const v = minV + ((maxV - minV) / gridLines) * i;
        const y = yFor(v);
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--track)" strokeWidth="1" />
            <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="9" fill="var(--ink-soft)">{v.toFixed(1)}</text>
          </g>
        );
      })}
      <path d={linePath} fill="none" stroke="var(--sage)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={xFor(p.t)} cy={yFor(p.displayValue)} r="4" fill="var(--gold)" />
      ))}
      <text x={padL} y={H - 8} fontSize="9" fill="var(--ink-soft)">{points[0].dateLabel}</text>
      <text x={W - padR} y={H - 8} fontSize="9" fill="var(--ink-soft)" textAnchor="end">
        {points[points.length - 1].dateLabel}
      </text>
    </svg>
  );
}

function WeightView({ weightLog, unit, onChangeUnit, onAdd, onRemove }) {
  const [date, setDate] = useState(todayStr());
  const [value, setValue] = useState("");

  const points = weightLog.map((w) => ({
    t: new Date(w.date).getTime(),
    displayValue: Number(fromKg(w.kg, unit).toFixed(1)),
    dateLabel: new Date(w.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  }));

  const submit = () => {
    const num = Number(value);
    if (!value || Number.isNaN(num)) return;
    onAdd({ id: uid(), date, kg: toKg(num, unit) });
    setValue("");
  };

  return (
    <div className="ct-body" style={{ paddingTop: 16 }}>
      <div className="ct-card">
        <div className="ct-label">Log a weight entry</div>
        <input className="ct-input" type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} />
        <input
          className="ct-input"
          type="number"
          step="0.1"
          placeholder={unit === "kg" ? "e.g. 78.5" : "e.g. 173.0"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <div className="ct-unit-toggle">
            <button type="button" className={unit === "kg" ? "active" : ""} onClick={() => onChangeUnit("kg")}>kg</button>
            <button type="button" className={unit === "lb" ? "active" : ""} onClick={() => onChangeUnit("lb")}>lb</button>
          </div>
        </div>
        <button className="ct-btn primary" disabled={!value} onClick={submit}>
          <Check size={16} /> Log weight
        </button>
      </div>

      <div className="ct-card">
        <div className="ct-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <TrendingUp size={14} /> Weight over time
        </div>
        {points.length === 0 ? (
          <div className="ct-empty">Log your first entry above to see your trend here.</div>
        ) : (
          <WeightChart points={points} unit={unit} />
        )}
      </div>

      {weightLog.length > 0 && (
        <>
          <div className="ct-section-title">Entries</div>
          {[...weightLog].reverse().map((w) => (
            <div className="ct-item" key={w.id}>
              <div className="icon" style={{ background: "rgba(111,191,139,0.18)" }}>
                <Scale size={16} color="var(--sage)" />
              </div>
              <div>
                <div className="name">{fromKg(w.kg, unit).toFixed(1)} {unit}</div>
                <div className="sub">{new Date(w.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</div>
              </div>
              <button onClick={() => onRemove(w.id)}><Trash2 size={15} /></button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export default function CalorieTracker() {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState({ goal: 1800, weightKg: 70, burnGoal: 500, weightUnit: "kg" });
  const [view, setView] = useState("today");
  const [dateStr, setDateStr] = useState(todayStr());
  const [dayLog, setDayLog] = useState({ foods: [], activities: [] });
  const [weightLog, setWeightLog] = useState([]);

  const [sheet, setSheet] = useState(null); // 'add' | 'photo' | 'manualFood' | 'activity'
  const [recipes, setRecipes] = useState(null);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [recipeError, setRecipeError] = useState("");

  // load settings + weight log once
  useEffect(() => {
    (async () => {
      try {
        const s = await storage.get("settings");
        if (s && s.value) setSettings((prev) => ({ ...prev, ...JSON.parse(s.value) }));
      } catch (e) {
        /* no settings yet */
      }
      try {
        const w = await storage.get("weightLog");
        if (w && w.value) setWeightLog(JSON.parse(w.value));
      } catch (e) {
        /* no weight log yet */
      }
      setReady(true);
    })();
  }, []);

  // load log whenever date changes
  useEffect(() => {
    (async () => {
      try {
        const r = await storage.get(`log:${dateStr}`);
        setDayLog(r && r.value ? JSON.parse(r.value) : { foods: [], activities: [] });
      } catch (e) {
        setDayLog({ foods: [], activities: [] });
      }
    })();
  }, [dateStr]);

  const persistSettings = useCallback(async (next) => {
    setSettings(next);
    try {
      await storage.set("settings", JSON.stringify(next));
    } catch (e) {}
  }, []);

  const persistLog = useCallback(
    async (next) => {
      setDayLog(next);
      try {
        await storage.set(`log:${dateStr}`, JSON.stringify(next));
      } catch (e) {}
    },
    [dateStr]
  );

  const addFood = (food) => persistLog({ ...dayLog, foods: [...dayLog.foods, food] });
  const addActivity = (act) => persistLog({ ...dayLog, activities: [...dayLog.activities, act] });
  const removeFood = (id) => persistLog({ ...dayLog, foods: dayLog.foods.filter((f) => f.id !== id) });
  const removeActivity = (id) => persistLog({ ...dayLog, activities: dayLog.activities.filter((a) => a.id !== id) });

  const persistWeightLog = useCallback(async (next) => {
    const sorted = [...next].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    setWeightLog(sorted);
    try {
      await storage.set("weightLog", JSON.stringify(sorted));
    } catch (e) {}
  }, []);

  const addWeightEntry = (entry) => persistWeightLog([...weightLog, entry]);
  const removeWeightEntry = (id) => persistWeightLog(weightLog.filter((w) => w.id !== id));

  const totalEaten = dayLog.foods.reduce((s, f) => s + (f.calories || 0), 0);
  const totalBurned = dayLog.activities.reduce((s, a) => s + (a.calories || 0), 0);

  if (!ready) {
    return (
      <div className="ct-root" style={{ alignItems: "center", justifyContent: "center" }}>
        <style>{CSS}</style>
        <Loader2 className="ct-spin" size={28} color="#E4C567" />
      </div>
    );
  }

  return (
    <div className="ct-root">
      <style>{CSS}</style>

      <div className="ct-header">
        <h1 className="ct-display">Balance</h1>
      </div>

      {view === "today" && (
        <>
          <div className="ct-date-row">
            <button onClick={() => setDateStr(shiftDate(dateStr, -1))}><ChevronLeft size={16} /></button>
            <span>{prettyDate(dateStr)}</span>
            <button
              onClick={() => setDateStr(shiftDate(dateStr, 1))}
              disabled={dateStr >= todayStr()}
              style={{ opacity: dateStr >= todayStr() ? 0.35 : 1 }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="ct-body">
            <div className="ct-card">
              <BalanceRing eaten={totalEaten} burned={totalBurned} goal={settings.goal} burnGoal={settings.burnGoal} />
            </div>

            <div className="ct-section-title">Food logged</div>
            {dayLog.foods.length === 0 && <div className="ct-empty">Nothing logged yet today.</div>}
            {dayLog.foods.map((f) => (
              <div className="ct-item" key={f.id}>
                <div className="icon" style={{ background: "#FCE9DE" }}>
                  <UtensilsCrossed size={16} color="var(--coral-dark)" />
                </div>
                <div>
                  <div className="name">{f.name}</div>
                  {f.sub && <div className="sub">{f.sub}</div>}
                </div>
                <div className="cal" style={{ color: "var(--coral-dark)" }}>+{f.calories}</div>
                <button onClick={() => removeFood(f.id)}><Trash2 size={15} /></button>
              </div>
            ))}

            <div className="ct-section-title" style={{ marginTop: 18 }}>Activity logged</div>
            {dayLog.activities.length === 0 && <div className="ct-empty">No activity logged yet today.</div>}
            {dayLog.activities.map((a) => (
              <div className="ct-item" key={a.id}>
                <div className="icon" style={{ background: "rgba(228,197,103,0.18)" }}>
                  <Dumbbell size={16} color="var(--gold)" />
                </div>
                <div>
                  <div className="name" style={{ color: "var(--gold)" }}>{a.name}</div>
                  <div className="sub">{a.minutes} min</div>
                </div>
                <div className="cal" style={{ color: "var(--gold)" }}>-{a.calories}</div>
                <button onClick={() => removeActivity(a.id)}><Trash2 size={15} /></button>
              </div>
            ))}
          </div>

          <button className="ct-fab" onClick={() => setSheet("add")}><Plus size={26} /></button>
        </>
      )}

      {view === "weight" && (
        <WeightView
          weightLog={weightLog}
          unit={settings.weightUnit}
          onChangeUnit={(u) => persistSettings({ ...settings, weightUnit: u })}
          onAdd={addWeightEntry}
          onRemove={removeWeightEntry}
        />
      )}

      {view === "recipes" && (
        <div className="ct-body" style={{ paddingTop: 16 }}>
          <div className="ct-card" style={{ textAlign: "center" }}>
            <ChefHat size={26} color="var(--lavender)" style={{ marginBottom: 8 }} />
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Recipe ideas</div>
            <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 14 }}>
              Delicious, low-fat, high-protein recipes, tailored to what's left in today's budget.
            </div>
            <button
              className="ct-btn primary"
              onClick={async () => {
                setRecipeLoading(true);
                setRecipeError("");
                const remaining = Math.max(settings.goal + totalBurned - totalEaten, 0);
                try {
                  const text = await askClaude(
                    `The user has roughly ${remaining} calories left in today's budget. Suggest 4 recipes.`,
                    `You are a nutrition-focused recipe assistant. Suggest delicious, satisfying recipes that are low-fat, low-calorie, and high in protein, suitable for someone trying to lose weight sustainably. Respond ONLY with strict JSON, no markdown fences, no commentary, in exactly this shape: [{"title":string,"calories":number,"protein_g":number,"time_minutes":number,"description":string,"ingredients":[string]}]`
                  );
                  const parsed = parseJSON(text);
                  if (Array.isArray(parsed)) setRecipes(parsed);
                  else setRecipeError("Couldn't parse recipe suggestions. Try again.");
                } catch (e) {
                  setRecipeError(e.message || "Something went wrong fetching recipes.");
                }
                setRecipeLoading(false);
              }}
              disabled={recipeLoading}
            >
              {recipeLoading ? <Loader2 className="ct-spin" size={16} /> : <Sparkles size={16} />}
              {recipeLoading ? "Thinking of ideas..." : "Get recipe ideas"}
            </button>
            {recipeError && <div className="ct-banner">{recipeError}</div>}
          </div>

          {recipes && recipes.map((r, i) => (
            <div className="ct-recipe-card" key={i}>
              <h3>{r.title}</h3>
              <div className="ct-recipe-meta">
                <span>{r.calories} kcal</span>
                <span>{r.protein_g}g protein</span>
                <span>{r.time_minutes} min</span>
              </div>
              <p>{r.description}</p>
              {Array.isArray(r.ingredients) && (
                <ul>{r.ingredients.map((ing, j) => <li key={j}>{ing}</li>)}</ul>
              )}
            </div>
          ))}
        </div>
      )}

      {view === "settings" && (
        <div className="ct-body" style={{ paddingTop: 16 }}>
          <div className="ct-card">
            <div className="ct-label">Daily calorie goal</div>
            <input
              className="ct-input"
              type="number"
              value={settings.goal}
              onChange={(e) => persistSettings({ ...settings, goal: Number(e.target.value) || 0 })}
            />
            <div className="ct-label">Your weight (kg) — used to estimate calories burned</div>
            <input
              className="ct-input"
              type="number"
              value={settings.weightKg}
              onChange={(e) => persistSettings({ ...settings, weightKg: Number(e.target.value) || 0 })}
            />
            <div className="ct-label">Daily exercise burn goal — fills the gold ring</div>
            <input
              className="ct-input"
              type="number"
              value={settings.burnGoal}
              onChange={(e) => persistSettings({ ...settings, burnGoal: Number(e.target.value) || 0 })}
            />
            <div className="ct-banner">
              This app estimates calories using AI photo analysis and standard exercise formulas —
              treat the numbers as a helpful guide, not a lab-accurate measurement.
            </div>
          </div>
        </div>
      )}

      <div className="ct-nav">
        <button className={view === "today" ? "active" : ""} onClick={() => setView("today")}>
          <Flame size={20} /> Today
        </button>
        <button className={view === "weight" ? "active" : ""} onClick={() => setView("weight")}>
          <Scale size={20} /> Weight
        </button>
        <button className={view === "recipes" ? "active" : ""} onClick={() => setView("recipes")}>
          <ChefHat size={20} /> Recipes
        </button>
        <button className={view === "settings" ? "active" : ""} onClick={() => setView("settings")}>
          <SettingsIcon size={20} /> Settings
        </button>
      </div>

      {sheet === "add" && (
        <AddSheet
          onClose={() => setSheet(null)}
          onPickPhoto={() => setSheet("photo")}
          onPickManualFood={() => setSheet("manualFood")}
          onPickActivity={() => setSheet("activity")}
        />
      )}
      {sheet === "photo" && (
        <PhotoFoodSheet
          onClose={() => setSheet(null)}
          onAdd={(food) => { addFood(food); setSheet(null); }}
        />
      )}
      {sheet === "manualFood" && (
        <ManualFoodSheet
          onClose={() => setSheet(null)}
          onAdd={(food) => { addFood(food); setSheet(null); }}
        />
      )}
      {sheet === "activity" && (
        <ActivitySheet
          weightKg={settings.weightKg}
          onClose={() => setSheet(null)}
          onAdd={(act) => { addActivity(act); setSheet(null); }}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   Gate screens
--------------------------------------------------------------- */



/* ---------------------------------------------------------------
   Sheets
--------------------------------------------------------------- */

function IngredientRow({ item, onNameChange, onCaloriesChange, onDelete, onRecalc, recalcing }) {
  const focusValueRef = useRef(item.name);
  return (
    <div className="ct-item" style={{ alignItems: item.grams != null ? "flex-start" : "center" }}>
      <div className="icon" style={{ background: "#FCE9DE", marginTop: item.grams != null ? 2 : 0, flexShrink: 0 }}>
        <UtensilsCrossed size={16} color="var(--coral-dark)" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <input
          className="ct-input"
          style={{ margin: 0, width: "100%", padding: "8px 10px", boxSizing: "border-box" }}
          value={item.name}
          onChange={(e) => onNameChange(e.target.value)}
          onFocus={() => { focusValueRef.current = item.name; }}
          onBlur={() => {
            if (item.name !== focusValueRef.current) onRecalc();
          }}
        />
        {(item.grams != null || item.hidden) && (
          <div style={{ fontSize: 11, color: "var(--ink-soft)", margin: "4px 0 0 4px" }}>
            {item.grams != null && `~${item.grams}g`}
            {item.hidden && (
              <span style={{ marginLeft: 6, color: "var(--gold-dark)", fontWeight: 600 }}>assumed</span>
            )}
          </div>
        )}
      </div>
      <button onClick={onRecalc} disabled={recalcing} title="Recalculate calories for this item" style={{ flexShrink: 0 }}>
        {recalcing ? <Loader2 className="ct-spin" size={15} /> : <Sparkles size={15} />}
      </button>
      <input
        className="ct-input ct-mono"
        type="number"
        style={{ margin: 0, width: 64, padding: "8px 8px", textAlign: "right", flexShrink: 0, boxSizing: "border-box" }}
        value={item.calories}
        onChange={(e) => onCaloriesChange(Number(e.target.value) || 0)}
      />
      <button onClick={onDelete} style={{ flexShrink: 0 }}><Trash2 size={15} /></button>
    </div>
  );
}

function SheetShell({ title, onClose, children }) {
  return (
    <div className="ct-overlay" onClick={onClose}>
      <div className="ct-sheet" onClick={(e) => e.stopPropagation()} style={{ position: "relative" }}>
        <button className="ct-close" onClick={onClose}><X size={16} /></button>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

function AddSheet({ onClose, onPickPhoto, onPickManualFood, onPickActivity }) {
  return (
    <SheetShell title="What are you logging?" onClose={onClose}>
      <button className="ct-btn coral" onClick={onPickPhoto}><Camera size={16} /> Snap a photo of food</button>
      <button className="ct-btn secondary" onClick={onPickManualFood}><UtensilsCrossed size={16} /> Log food manually</button>
      <button className="ct-btn secondary" onClick={onPickActivity}><Dumbbell size={16} /> Log activity</button>
    </SheetShell>
  );
}

function PhotoFoodSheet({ onClose, onAdd }) {
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [recalcId, setRecalcId] = useState(null);
  const cameraRef = useRef(null);
  const libraryRef = useRef(null);

  const updateItemName = (i, name) => {
    const next = [...items];
    next[i] = { ...next[i], name };
    setItems(next);
  };
  const updateItemCalories = (i, calories) => {
    const next = [...items];
    next[i] = { ...next[i], calories };
    setItems(next);
  };
  const recalcItem = async (i) => {
    const it = items[i];
    if (!it || !it.name) return;
    setRecalcId(it.id);
    try {
      const cal = await recalcItemCalories(it.name);
      if (cal != null) updateItemCalories(i, cal);
    } catch (e) {
      /* leave the existing value if recalculation fails */
    }
    setRecalcId(null);
  };

  const handleFile = async (f) => {
    setFile(f);
    setResult(null);
    setItems([]);
    setError("");
    setPreview(URL.createObjectURL(f));
  };

  const analyze = async () => {
    setLoading(true);
    setError("");
    try {
      const base64 = await fileToBase64(file);
      const mediaType = file.type || "image/jpeg";
      const text = await askClaude(
        [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: "Analyze the food in this photo and break it down component by component." },
        ],
        `You are a rigorous nutrition-estimation assistant. Analyze the food in the image using this exact process — do not skip steps or estimate the total directly:

1. HIDDEN INGREDIENTS: Assume cooking oil, butter, salad dressing, sauces, and condiments ARE present in typical restaurant/home-cooked portions, UNLESS the image clearly shows a dry-cooked, plain, or unseasoned preparation. Visible sheen, pooling, or a dressed/glossy look is a strong signal real oil or sauce was used — don't default to "none" just because it isn't a distinct visible blob.

2. COMPONENT BREAKDOWN: Identify every visible food component separately — proteins, starches, vegetables, sauces/dressings, oils/fats, and garnishes — including the hidden ingredients you assumed in step 1 as their own line items. For each component, estimate its portion size in grams using visual reference objects: a palm ≈ 100g of protein, a fist ≈ 1 cup, a thumb ≈ 1 tablespoon, a deck-of-cards or phone-sized portion ≈ 100-150g. Then estimate calories for that component from its estimated grams.

3. UPPER-BOUND BIAS: For each component and for the final total, mentally form a plausible low-to-high calorie range, then report a figure in the upper third of that range — not the midpoint. Underestimating is the costlier mistake for someone tracking calories for fat loss, so when genuinely unsure, lean high rather than low.

4. TOTAL: Sum every component, including hidden ones, into total_calories.

5. CONFIDENCE: If you can't reasonably judge a portion size or whether hidden ingredients like oil, butter, or dressing are present, do not silently default to a low "safe" number. Instead set confidence to "low" and describe the specific uncertainty in uncertainty_note.

Respond ONLY with strict JSON, no markdown fences, no commentary, in exactly this shape:
{"items":[{"name":string,"grams":number,"calories":number,"hidden":boolean}],"total_calories":number,"protein_g":number,"carbs_g":number,"fat_g":number,"confidence":"low"|"medium"|"high","uncertainty_note":string}

Set "hidden":true for components you assumed rather than directly saw (e.g. cooking oil, dressing, butter). uncertainty_note should be one short, specific sentence about what's uncertain (e.g. "Couldn't tell how much oil the stir-fry was cooked in — assumed a moderate amount."), or an empty string if nothing needs flagging. Always give your best estimate for every field — never refuse or omit a component because you're unsure.`
      );
      const parsed = parseJSON(text);
      if (parsed && typeof parsed.total_calories === "number") {
        setResult(parsed);
        setItems(Array.isArray(parsed.items) ? parsed.items.map((it) => ({ ...it, id: uid() })) : []);
      } else {
        setError("Couldn't read that photo clearly — try a closer, well-lit shot, or log it manually.");
      }
    } catch (e) {
      setError(e.message || "Something went wrong analyzing the photo.");
    }
    setLoading(false);
  };

  return (
    <SheetShell title="Log food from a photo" onClose={onClose}>
      {!preview && (
        <>
          <button className="ct-btn coral" onClick={() => cameraRef.current?.click()}>
            <Camera size={16} /> Take a photo now
          </button>
          <button className="ct-btn secondary" onClick={() => libraryRef.current?.click()}>
            <UtensilsCrossed size={16} /> Choose a past photo
          </button>
        </>
      )}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
      />
      {preview && <img src={preview} className="ct-photo-preview" alt="Food preview" />}
      {preview && (
        <button
          className="ct-btn secondary"
          style={{ marginTop: -4 }}
          onClick={() => { setPreview(null); setFile(null); setResult(null); setItems([]); setError(""); }}
        >
          <X size={14} /> Choose a different photo
        </button>
      )}

      {preview && !result && (
        <button className="ct-btn primary" onClick={analyze} disabled={loading}>
          {loading ? <Loader2 className="ct-spin" size={16} /> : <Sparkles size={16} />}
          {loading ? "Analyzing plate..." : "Estimate calories"}
        </button>
      )}

      {error && <div className="ct-banner">{error}</div>}

      {result && (
        <>
          <div className="ct-banner">
            Confidence: {result.confidence || "medium"} — edit anything that looks off before adding.
            {result.uncertainty_note && (
              <div style={{ marginTop: 6, fontStyle: "italic" }}>{result.uncertainty_note}</div>
            )}
          </div>
          {items.map((it, i) => (
            <IngredientRow
              key={it.id}
              item={it}
              onNameChange={(name) => updateItemName(i, name)}
              onCaloriesChange={(cal) => updateItemCalories(i, cal)}
              onDelete={() => setItems(items.filter((_, j) => j !== i))}
              onRecalc={() => recalcItem(i)}
              recalcing={recalcId === it.id}
            />
          ))}
          <div style={{ fontWeight: 700, margin: "10px 0", fontSize: 15 }}>
            Total: {items.reduce((s, it) => s + (Number(it.calories) || 0), 0)} kcal
            {result.protein_g != null && (
              <span style={{ fontWeight: 400, fontSize: 12, color: "var(--ink-soft)", marginLeft: 8 }}>
                ~{result.protein_g}g protein · {result.carbs_g}g carbs · {result.fat_g}g fat
              </span>
            )}
          </div>
          <button
            className="ct-btn primary"
            disabled={items.length === 0}
            onClick={() =>
              onAdd({
                id: uid(),
                name: items.map((i) => i.name).join(", ") || "Plate from photo",
                calories: items.reduce((s, it) => s + (Number(it.calories) || 0), 0),
                sub: result.protein_g != null ? `~${result.protein_g}g protein` : undefined,
              })
            }
          >
            <Check size={16} /> Add to today's log
          </button>
        </>
      )}
    </SheetShell>
  );
}

function ManualFoodSheet({ onClose, onAdd }) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [recalcId, setRecalcId] = useState(null);

  const updateItemName = (i, val) => {
    const next = [...items];
    next[i] = { ...next[i], name: val };
    setItems(next);
  };
  const updateItemCalories = (i, val) => {
    const next = [...items];
    next[i] = { ...next[i], calories: val };
    setItems(next);
  };
  const recalcItem = async (i) => {
    const it = items[i];
    if (!it || !it.name) return;
    setRecalcId(it.id);
    try {
      const cal = await recalcItemCalories(it.name);
      if (cal != null) updateItemCalories(i, cal);
    } catch (e) {
      /* leave the existing value if recalculation fails */
    }
    setRecalcId(null);
  };

  const calculate = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    setItems([]);
    try {
      const text = await askClaude(
        `Food description: "${name}"`,
        `You are a rigorous nutrition-estimation assistant. Given a short text description of a food or meal, break it down into individual components (proteins, starches, vegetables, sauces/dressings, oils/fats, garnishes) the way a careful nutritionist would, using typical restaurant/home-cooked portions when quantities aren't given.

Assume cooking oil, butter, dressing, or sauce is present for any component that would normally involve it (sautéed, fried, roasted, dressed, pan-seared, etc.) UNLESS the description explicitly says otherwise (e.g. "dry," "plain," "no oil," "steamed"). Include that as its own line item rather than folding it invisibly into the main component.

For each component and the overall total, form a plausible low-to-high calorie range and report a figure in the upper third of that range rather than the midpoint — underestimating is the costlier mistake for someone tracking calories for fat loss.

Respond ONLY with strict JSON, no markdown fences, no commentary, in exactly this shape: {"items":[{"name":string,"calories":number,"hidden":boolean}],"protein_g":number,"carbs_g":number,"fat_g":number}. Set "hidden":true for a component you assumed rather than the person explicitly mentioning (e.g. added cooking oil). Always give your best estimate even if the description is vague, and always include at least one item.`
      );
      const parsed = parseJSON(text);
      if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
        setResult(parsed);
        setItems(parsed.items.map((it) => ({ ...it, id: uid() })));
      } else {
        setError("Couldn't estimate that one — try describing it a bit more, e.g. with quantity.");
      }
    } catch (e) {
      setError(e.message || "Something went wrong estimating calories.");
    }
    setLoading(false);
  };

  const total = items.reduce((s, it) => s + (Number(it.calories) || 0), 0);

  return (
    <SheetShell title="Log food manually" onClose={onClose}>
      <div className="ct-label">What did you eat?</div>
      <input
        className="ct-input"
        value={name}
        onChange={(e) => { setName(e.target.value); setResult(null); setItems([]); }}
        placeholder="e.g. 2 scrambled eggs and a slice of toast"
      />
      {items.length === 0 && (
        <button className="ct-btn primary" disabled={!name || loading} onClick={calculate}>
          {loading ? <Loader2 className="ct-spin" size={16} /> : <Sparkles size={16} />}
          {loading ? "Calculating..." : "Calculate calories"}
        </button>
      )}
      {error && <div className="ct-banner">{error}</div>}
      {items.length > 0 && (
        <>
          <div className="ct-banner">Edit anything that looks off before adding.</div>
          {items.map((it, i) => (
            <IngredientRow
              key={it.id}
              item={it}
              onNameChange={(val) => updateItemName(i, val)}
              onCaloriesChange={(val) => updateItemCalories(i, val)}
              onDelete={() => setItems(items.filter((_, j) => j !== i))}
              onRecalc={() => recalcItem(i)}
              recalcing={recalcId === it.id}
            />
          ))}
          <div style={{ fontWeight: 700, margin: "10px 0", fontSize: 15 }}>
            Total: {total} kcal
            {result?.protein_g != null && (
              <span style={{ fontWeight: 400, fontSize: 12, color: "var(--ink-soft)", marginLeft: 8 }}>
                ~{result.protein_g}g protein · {result.carbs_g}g carbs · {result.fat_g}g fat
              </span>
            )}
          </div>
          <button className="ct-btn secondary" onClick={calculate} disabled={loading}>
            {loading ? <Loader2 className="ct-spin" size={16} /> : <Sparkles size={16} />} Recalculate from description
          </button>
          <button
            className="ct-btn primary"
            disabled={items.length === 0}
            onClick={() =>
              onAdd({
                id: uid(),
                name: items.map((i) => i.name).join(", "),
                calories: total,
                sub: result?.protein_g != null ? `~${result.protein_g}g protein` : undefined,
              })
            }
          >
            <Check size={16} /> Add to today's log
          </button>
        </>
      )}
    </SheetShell>
  );
}

function ActivitySheet({ weightKg, onClose, onAdd }) {
  const [type, setType] = useState("Walking");
  const [minutes, setMinutes] = useState("30");
  const [steps, setSteps] = useState("5000");
  const [customCalories, setCustomCalories] = useState("");
  const isCustom = type === "Custom";
  const isSteps = type === "Steps";

  let estimated = 0;
  if (isSteps) estimated = estimateStepsBurn(Number(steps) || 0, weightKg);
  else if (isCustom) estimated = Number(customCalories) || 0;
  else estimated = estimateBurn(ACTIVITY_METS[type], weightKg || 70, Number(minutes) || 0);

  return (
    <SheetShell title="Log activity" onClose={onClose}>
      <div className="ct-label">Activity</div>
      <div className="ct-select-grid">
        <div className={`ct-chip ${isSteps ? "active" : ""}`} onClick={() => setType("Steps")}>Steps</div>
        {Object.keys(ACTIVITY_METS).map((k) => (
          <div key={k} className={`ct-chip ${type === k ? "active" : ""}`} onClick={() => setType(k)}>{k}</div>
        ))}
        <div className={`ct-chip ${isCustom ? "active" : ""}`} onClick={() => setType("Custom")}>Other</div>
      </div>

      {isSteps && (
        <>
          <div className="ct-label">Steps taken</div>
          <input className="ct-input" type="number" value={steps} onChange={(e) => setSteps(e.target.value)} placeholder="e.g. 8000" />
        </>
      )}
      {!isCustom && !isSteps && (
        <>
          <div className="ct-label">Duration (minutes)</div>
          <input className="ct-input" type="number" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </>
      )}
      {isCustom && (
        <>
          <div className="ct-label">Calories burned</div>
          <input className="ct-input" type="number" value={customCalories} onChange={(e) => setCustomCalories(e.target.value)} placeholder="e.g. 200" />
        </>
      )}

      <div className="ct-banner">
        Estimated burn: <strong style={{ color: "var(--gold)" }}>{estimated} kcal</strong>
        {isSteps && " (based on step count and your weight)"}
        {!isCustom && !isSteps && " (based on activity type, your weight, and duration)"}
      </div>

      <button
        className="ct-btn primary"
        disabled={estimated <= 0}
        onClick={() =>
          onAdd({
            id: uid(),
            name: isCustom ? "Custom activity" : isSteps ? `${steps} steps` : type,
            minutes: isSteps ? "-" : isCustom ? "-" : minutes,
            calories: estimated,
          })
        }
      >
        <Check size={16} /> Add to today's log
      </button>
    </SheetShell>
  );
}
