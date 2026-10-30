import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
} from "recharts";

/* ============================================================
   BORKAIFX ELITE — Bitácora & Portafolio de Trading
   Componente único. Requiere: react, recharts, tailwindcss
   ============================================================ */

const BRAND = "BORKAIFX ELITE";
const TELEGRAM_URL = "https://t.me/borkaifxoficial";
const ADMIN_KEY = "796586";
const STORAGE_KEY = "borkaifx_elite_trades_v1";
const SESSION_KEY = "borkaifx_elite_admin";

const CFD_SUBS = ["Forex", "Oro/Metales", "Índices"];
const BROKERS = ["WELTRADE", "DERIV"];
const STATUSES = ["Abierta", "TP", "SL", "BE", "Descartada"];

const C = {
  bg: "#090d16",
  panel: "#0e1422",
  panel2: "#121a2c",
  gold: "#f59e0b",
  gold2: "#fbbf24",
  green: "#10b981",
  red: "#f43f5e",
  line: "rgba(245,158,11,0.18)",
};

const SEED = [
  { id: "d1", date: "2026-10-20", category: "CFD", sub: "Oro/Metales", broker: "", asset: "XAUUSD", direction: "BUY", entry: 3985.5, exit: 4002.3, sl: 3978, tp: 4002, lots: 0.5, pnl: 840, r: 2.24, status: "TP", chart: "", notes: "Rebote en zona de demanda H1. (Ejemplo demo)", tags: ["VIP Signal", "Demo"] },
  { id: "d2", date: "2026-10-21", category: "CFD", sub: "Forex", broker: "", asset: "EURUSD", direction: "SELL", entry: 1.0905, exit: 1.0925, sl: 1.0925, tp: 1.085, lots: 1, pnl: -200, r: -1, status: "SL", chart: "", notes: "Stop por noticias. (Ejemplo demo)", tags: ["VIP Signal", "Demo"] },
  { id: "d3", date: "2026-10-22", category: "CFD", sub: "Índices", broker: "", asset: "US30", direction: "BUY", entry: 42100, exit: 42100, sl: 42020, tp: 42300, lots: 0.3, pnl: 0, r: 0, status: "BE", chart: "", notes: "Movido a BE. (Ejemplo demo)", tags: ["Demo"] },
  { id: "d4", date: "2026-10-23", category: "SINTETICO", sub: "", broker: "DERIV", asset: "Volatility 75", direction: "SELL", entry: 98250, exit: 97600, sl: 98500, tp: 97600, lots: 0.01, pnl: 325, r: 2.6, status: "TP", chart: "", notes: "Ruptura de estructura M15. (Ejemplo demo)", tags: ["VIP Signal", "Demo"] },
  { id: "d5", date: "2026-10-26", category: "SINTETICO", sub: "", broker: "WELTRADE", asset: "Boom 1000", direction: "BUY", entry: 12450, exit: 12510, sl: 12400, tp: 12510, lots: 0.2, pnl: 180, r: 1.2, status: "TP", chart: "", notes: "(Ejemplo demo)", tags: ["VIP Signal", "Demo"] },
  { id: "d6", date: "2026-10-27", category: "SINTETICO", sub: "", broker: "WELTRADE", asset: "Crash 500", direction: "SELL", entry: 8800, exit: "", sl: 8860, tp: 8700, lots: 0.2, pnl: 0, r: "", status: "Descartada", chart: "", notes: "Señal cancelada antes de ejecutarse. (Ejemplo demo)", tags: ["Demo"] },
];

/* ----------------------------- helpers ----------------------------- */
const num = (v) => (v === "" || v === null || v === undefined || isNaN(Number(v)) ? null : Number(v));
const money = (v) => {
  const n = Number(v) || 0;
  return (n < 0 ? "-" : "") + "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtDate = (d) => {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const isImageUrl = (u) => /\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(u) || u.includes("s3.tradingview.com/snapshots");

// https://www.tradingview.com/x/ABC123/ -> imagen directa del snapshot
const tvImage = (u) => {
  const m = /tradingview\.com\/x\/([A-Za-z0-9]+)/i.exec(u || "");
  return m ? `https://s3.tradingview.com/snapshots/${m[1][0].toLowerCase()}/${m[1]}.png` : null;
};
const imgSrc = (t) => t.img || tvImage(t.chart) || (t.chart && isImageUrl(t.chart) ? t.chart : null);

// Niveles de TP (compatible con operaciones antiguas que solo tenían "tp")
const tpLevels = (t) => {
  if (t.tps && t.tps.length) return t.tps;
  if (t.tp !== "" && t.tp !== undefined && t.tp !== null) return [{ level: t.tp, hit: false }];
  return [];
};

function guessSub(asset) {
  const a = (asset || "").toUpperCase();
  if (/XAU|XAG|GOLD|SILVER/.test(a)) return "Oro/Metales";
  if (/NAS|US100|US30|US500|SPX|DJI|DAX|GER|UK100|JP225|NDX|USTEC/.test(a)) return "Índices";
  return "Forex";
}

const KNOWN_SYMBOLS = ["XAUUSD", "XAGUSD", "NAS100", "US100", "USTEC", "US30", "US500", "SPX500", "GER40", "DAX40", "UK100", "JP225", "EURUSD", "GBPUSD", "USDJPY", "GBPJPY", "AUDUSD", "NZDUSD", "USDCAD", "USDCHF", "EURJPY", "EURGBP"];

// Interpreta señales de CFDs (formato "Pair/Side/Entry/TP/SL" y formato "BUY NOW / Take Profit 1")
function parseSignal(raw) {
  const text = String(raw || "").replace(/\r/g, "");
  const numRe = "([0-9][0-9,]*\\.?[0-9]*)";
  const toNum = (s) => Number(String(s).replace(/,/g, ""));
  const out = { raw: text.trim(), asset: "", sub: "Forex", direction: "BUY", entry: "", sl: "", tps: [], chart: "", notes: "", warnings: [] };

  let m = /pair\s*[:\-]\s*([A-Za-z0-9./_]+)/i.exec(text);
  if (m) out.asset = m[1].replace(/[./_]/g, "").toUpperCase();
  else {
    const up = text.toUpperCase();
    const k = KNOWN_SYMBOLS.find((s) => up.includes(s));
    if (k) out.asset = k;
  }

  m = new RegExp("entry\\s*(?:price)?\\s*[:\\-]?\\s*" + numRe, "i").exec(text);
  if (m) out.entry = toNum(m[1]);
  m = new RegExp("(?:stop\\s*loss|\\bSL)\\s*[:\\-]?\\s*" + numRe, "i").exec(text);
  if (m) out.sl = toNum(m[1]);

  const seen = {};
  const re = new RegExp("(?:take\\s*profit|\\bTP)\\s*(\\d)\\s*[:\\-]?\\s*" + numRe, "gi");
  while ((m = re.exec(text))) seen[Number(m[1])] = toNum(m[2]);
  out.tps = Object.keys(seen).map(Number).sort((a, b) => a - b).map((k) => ({ level: seen[k], hit: false }));
  if (!out.tps.length) {
    m = new RegExp("\\bTP\\s*[:\\-]\\s*" + numRe, "i").exec(text);
    if (m) out.tps = [{ level: toNum(m[1]), hit: false }];
  }

  if (/side\s*[:\-]?[^\n]*\b(short|sell)\b/i.test(text) || /\bsell\s+now\b/i.test(text)) out.direction = "SELL";
  else if (/side\s*[:\-]?[^\n]*\b(long|buy)\b/i.test(text) || /\bbuy\s+now\b/i.test(text)) out.direction = "BUY";
  else if (/\b(sell|short)\b/i.test(text)) out.direction = "SELL";
  else if (/\b(buy|long)\b/i.test(text)) out.direction = "BUY";
  else if (out.entry !== "" && out.sl !== "") out.direction = out.sl > out.entry ? "SELL" : "BUY";

  m = /https?:\/\/[^\s]+/i.exec(text);
  if (m) out.chart = m[0].replace(/[).,;]+$/, "");

  m = /risk\s*[:\-]?\s*([0-9.\-\/ ]+%)/i.exec(text);
  if (m) out.notes = "Riesgo sugerido: " + m[1].trim();

  out.sub = guessSub(out.asset);

  if (!out.asset) out.warnings.push("No se detectó el activo: escríbelo manualmente.");
  if (out.entry === "") out.warnings.push("No se detectó la entrada.");
  if (out.sl === "") out.warnings.push("No se detectó el SL.");
  if (!out.tps.length) out.warnings.push("No se detectaron niveles de TP (¿TP abierto?).");
  if (out.entry !== "" && out.sl !== "" && (out.direction === "SELL") !== (out.sl > out.entry)) {
    out.warnings.push("La dirección no coincide con la posición del SL respecto a la entrada. Revísalo.");
  }
  return out;
}

// Reduce la imagen para que quepa en el almacenamiento del navegador
function compressImage(file, maxW = 1280, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function calcR(entry, sl, exit) {
  const e = num(entry), s = num(sl), x = num(exit);
  if (e === null || s === null || x === null) return "";
  const risk = Math.abs(e - s);
  if (!risk) return "";
  const dir = s < e ? 1 : -1; // BUY si SL por debajo
  return Number((((x - e) * dir) / risk).toFixed(2));
}

function computeMetrics(list) {
  const executed = list.filter((t) => ["TP", "SL", "BE"].includes(t.status));
  const wins = executed.filter((t) => t.status === "TP");
  const losses = executed.filter((t) => t.status === "SL");
  const be = executed.filter((t) => t.status === "BE");
  const discarded = list.filter((t) => t.status === "Descartada").length;
  const open = list.filter((t) => t.status === "Abierta").length;
  const decisive = wins.length + losses.length;
  const winRate = decisive ? (wins.length / decisive) * 100 : 0;
  const totalPnl = executed.reduce((a, t) => a + (Number(t.pnl) || 0), 0);
  const grossWin = executed.filter((t) => Number(t.pnl) > 0).reduce((a, t) => a + Number(t.pnl), 0);
  const grossLoss = Math.abs(executed.filter((t) => Number(t.pnl) < 0).reduce((a, t) => a + Number(t.pnl), 0));
  const winsPnl = executed.filter((t) => Number(t.pnl) > 0);
  const lossPnl = executed.filter((t) => Number(t.pnl) < 0);
  const avgWin = winsPnl.length ? grossWin / winsPnl.length : 0;
  const avgLoss = lossPnl.length ? grossLoss / lossPnl.length : 0;
  const rr = avgLoss ? avgWin / avgLoss : avgWin ? Infinity : 0;
  const profitFactor = grossLoss ? grossWin / grossLoss : grossWin ? Infinity : 0;
  const totalR = executed.reduce((a, t) => a + (num(t.r) || 0), 0);
  return { open, executed: executed.length, wins: wins.length, losses: losses.length, be: be.length, discarded, winRate, totalPnl, rr, profitFactor, totalR, total: list.length };
}

/* ----------------------------- UI pieces ----------------------------- */
const StatusBadge = ({ status }) => {
  const map = {
    TP: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
    SL: "bg-rose-500/15 text-rose-400 border-rose-500/40",
    BE: "bg-amber-500/15 text-amber-300 border-amber-500/40",
    Descartada: "bg-slate-500/15 text-slate-400 border-slate-500/40",
    Abierta: "bg-sky-500/15 text-sky-300 border-sky-500/40",
  };
  return <span className={`inline-block px-2 py-0.5 rounded border text-[11px] font-bold tracking-wide ${map[status]}`}>{status === "Descartada" ? "DESCARTADA" : status === "Abierta" ? "ABIERTA" : status}</span>;
};

const DirBadge = ({ dir }) => (
  <span className={`text-xs font-bold ${dir === "BUY" ? "text-emerald-400" : "text-rose-400"}`}>{dir}</span>
);

const Stat = ({ label, value, sub, tone }) => {
  const color = tone === "pos" ? "text-emerald-400" : tone === "neg" ? "text-rose-400" : "text-amber-400";
  return (
    <div className="rounded-xl border p-4" style={{ background: C.panel, borderColor: C.line }}>
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl md:text-3xl font-extrabold ${color}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
};

const Field = ({ label, children, className = "" }) => (
  <label className={`block ${className}`}>
    <span className="block text-[11px] uppercase tracking-wider text-slate-400 mb-1">{label}</span>
    {children}
  </label>
);

const inputCls =
  "w-full rounded-lg bg-[#090d16] border border-amber-500/20 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50";

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border px-3 py-2 text-xs" style={{ background: C.panel2, borderColor: C.line }}>
      <div className="text-slate-400">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="font-bold" style={{ color: p.payload.fill || C.gold2 }}>
          {p.name}: {p.dataKey === "equity" ? money(p.value) : p.value}
        </div>
      ))}
    </div>
  );
};

/* ----------------------------- Trade form ----------------------------- */
function emptyForm(category, sub, broker) {
  return {
    id: null,
    date: new Date().toISOString().slice(0, 10),
    category: category || "CFD",
    sub: category === "CFD" ? sub || "Forex" : "",
    broker: category === "SINTETICO" ? broker || "WELTRADE" : "",
    asset: "",
    direction: "BUY",
    entry: "",
    exit: "",
    sl: "",
    tp: "",
    lots: "",
    pnl: "",
    r: "",
    status: "Abierta",
    chart: "",
    notes: "",
    tagsText: "VIP Signal",
    tpsText: "",
    raw: "",
    img: "",
  };
}

function TradeForm({ initial, onCancel, onSave }) {
  const [f, setF] = useState(initial);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const [err, setErr] = useState("");

  const addImage = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    try { set("img", await compressImage(file)); } catch (e) { setErr("No se pudo leer la imagen."); }
  };
  const onPasteImg = (e) => {
    const it = Array.from(e.clipboardData?.items || []).find((i) => i.type.startsWith("image/"));
    if (it) { e.preventDefault(); addImage(it.getAsFile()); }
  };

  const submit = (e) => {
    e.preventDefault();
    if (!f.asset.trim()) return setErr("El activo es obligatorio.");
    if (!f.date) return setErr("La fecha es obligatoria.");
    const executed = ["TP", "SL", "BE"].includes(f.status);
    const prevTps = initial.tps || [];
    const levels = String(f.tpsText || "").split(/[,;\s]+/).map(num).filter((x) => x !== null);
    const tps = levels.map((l) => ({ level: l, hit: !!prevTps.find((p) => p.level === l && p.hit) }));
    const rAuto = f.r === "" && executed ? calcR(f.entry, f.sl, f.exit) : f.r;
    const trade = {
      id: f.id || uid(),
      date: f.date,
      category: f.category,
      sub: f.category === "CFD" ? f.sub : "",
      broker: f.category === "SINTETICO" ? f.broker : "",
      asset: f.asset.trim().toUpperCase() === f.asset.trim() ? f.asset.trim() : f.asset.trim(),
      direction: f.direction,
      entry: num(f.entry) ?? "",
      exit: num(f.exit) ?? "",
      sl: num(f.sl) ?? "",
      tp: tps.length ? tps[tps.length - 1].level : "",
      tps,
      raw: f.raw || "",
      img: f.img || "",
      lots: num(f.lots) ?? "",
      pnl: executed ? num(f.pnl) ?? 0 : 0,
      r: executed ? num(rAuto) ?? "" : "",
      status: f.status,
      chart: f.chart.trim(),
      notes: f.notes.trim(),
      tags: f.tagsText.split(",").map((t) => t.trim()).filter(Boolean),
    };
    onSave(trade);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4">
      <form onSubmit={submit} onPaste={onPasteImg} className="w-full max-w-3xl rounded-2xl border p-5 md:p-6 my-6" style={{ background: C.panel, borderColor: C.line }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-extrabold text-amber-400 tracking-wide">{f.id ? "EDITAR OPERACIÓN" : "NUEVA OPERACIÓN"}</h3>
          <button type="button" onClick={onCancel} className="text-slate-400 hover:text-white text-xl leading-none">×</button>
        </div>

        {f.warnings?.length > 0 && (
          <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300 text-xs p-2">
            ⚠ Revisa antes de guardar: {f.warnings.join(" · ")}
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Fecha">
            <input type="date" className={inputCls} value={f.date} onChange={(e) => set("date", e.target.value)} />
          </Field>
          <Field label="Categoría">
            <select
              className={inputCls}
              value={f.category}
              onChange={(e) => {
                const cat = e.target.value;
                setF((p) => ({ ...p, category: cat, sub: cat === "CFD" ? p.sub || "Forex" : "", broker: cat === "SINTETICO" ? p.broker || "WELTRADE" : "" }));
              }}
            >
              <option value="CFD">CFDs</option>
              <option value="SINTETICO">Sintéticos</option>
            </select>
          </Field>
          {f.category === "CFD" ? (
            <Field label="Subcategoría CFD">
              <select className={inputCls} value={f.sub} onChange={(e) => set("sub", e.target.value)}>
                {CFD_SUBS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
          ) : (
            <Field label="Broker">
              <select className={inputCls} value={f.broker} onChange={(e) => set("broker", e.target.value)}>
                {BROKERS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
          )}
          <Field label="Estado">
            <select className={inputCls} value={f.status} onChange={(e) => set("status", e.target.value)}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>

          <Field label="Activo" className="col-span-2">
            <input className={inputCls} placeholder="XAUUSD, EURUSD, Volatility 75..." value={f.asset} onChange={(e) => set("asset", e.target.value)} />
          </Field>
          <Field label="Dirección">
            <select className={inputCls} value={f.direction} onChange={(e) => set("direction", e.target.value)}>
              <option>BUY</option>
              <option>SELL</option>
            </select>
          </Field>
          <Field label="Lotaje">
            <input type="number" step="any" className={inputCls} value={f.lots} onChange={(e) => set("lots", e.target.value)} />
          </Field>

          <Field label="Precio entrada">
            <input type="number" step="any" className={inputCls} value={f.entry} onChange={(e) => set("entry", e.target.value)} />
          </Field>
          <Field label="Precio salida">
            <input type="number" step="any" className={inputCls} value={f.exit} onChange={(e) => set("exit", e.target.value)} />
          </Field>
          <Field label="Stop Loss">
            <input type="number" step="any" className={inputCls} value={f.sl} onChange={(e) => set("sl", e.target.value)} />
          </Field>
          <Field label="TPs (separados por coma)">
            <input className={inputCls} placeholder="4013, 4008, 4003" value={f.tpsText} onChange={(e) => set("tpsText", e.target.value)} />
          </Field>

          <Field label="PnL ($)">
            <input type="number" step="any" className={inputCls} placeholder="-200 / 450" value={f.pnl} onChange={(e) => set("pnl", e.target.value)} disabled={!["TP", "SL", "BE"].includes(f.status)} />
          </Field>
          <Field label="Ratio R">
            <div className="flex gap-1">
              <input type="number" step="any" className={inputCls} placeholder="auto" value={f.r} onChange={(e) => set("r", e.target.value)} disabled={!["TP", "SL", "BE"].includes(f.status)} />
              <button type="button" title="Calcular R con entrada/SL/salida" onClick={() => set("r", calcR(f.entry, f.sl, f.exit))} className="px-2 rounded-lg border border-amber-500/30 text-amber-400 text-xs hover:bg-amber-500/10">
                Auto
              </button>
            </div>
          </Field>
          <Field label="Captura / Gráfico (URL)" className="col-span-2">
            <input className={inputCls} placeholder="https://www.tradingview.com/x/... o imagen" value={f.chart} onChange={(e) => set("chart", e.target.value)} />
          </Field>

          <Field label="Captura (sube un archivo o pégala con Ctrl+V)" className="col-span-2 md:col-span-4">
            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => addImage(e.target.files?.[0])}
                className="text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-500 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-black"
              />
              {f.img && (
                <>
                  <img src={f.img} alt="" className="h-16 rounded border border-amber-500/30" />
                  <button type="button" onClick={() => set("img", "")} className="text-xs text-rose-400">Quitar</button>
                </>
              )}
            </div>
          </Field>
          <Field label="Señal original (texto)" className="col-span-2 md:col-span-4">
            <textarea rows={3} className={`${inputCls} text-xs`} value={f.raw} onChange={(e) => set("raw", e.target.value)} />
          </Field>
          <Field label="Etiquetas (separadas por coma)" className="col-span-2 md:col-span-4">
            <input className={inputCls} placeholder="VIP Signal, Scalping" value={f.tagsText} onChange={(e) => set("tagsText", e.target.value)} />
          </Field>
          <Field label="Notas" className="col-span-2 md:col-span-4">
            <textarea rows={3} className={inputCls} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>

        {err && <div className="mt-3 text-sm text-rose-400">{err}</div>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm hover:bg-slate-800">Cancelar</button>
          <button type="submit" className="px-5 py-2 rounded-lg text-sm font-extrabold text-black" style={{ background: `linear-gradient(90deg, ${C.gold}, ${C.gold2})` }}>
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
}

/* ----------------------------- TP chips ----------------------------- */
const TpChips = ({ t }) => {
  const l = tpLevels(t);
  if (!l.length) return <span className="text-slate-500 text-xs">TP Open</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {l.map((x, i) => (
        <span
          key={i}
          className={`text-[11px] px-1.5 py-0.5 rounded border whitespace-nowrap ${
            x.hit ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300 font-bold" : "border-slate-700 text-slate-400"
          }`}
        >
          {x.hit ? "✓ " : ""}TP{i + 1} {x.level}
        </span>
      ))}
    </div>
  );
};

/* ----------------------------- Panel de gestión (admin) ----------------------------- */
function ManagePanel({ t, onUpdate }) {
  const [pnl, setPnl] = useState("");
  useEffect(() => {
    setPnl(t.pnl === 0 || t.pnl === "" || t.pnl === undefined ? "" : String(t.pnl));
  }, [t.id, t.status, t.pnl]);

  const levels = tpLevels(t);
  const upd = (patch) => onUpdate({ ...t, ...patch });

  const toggleTp = (i) => {
    const list = levels.map((x, k) => (k === i ? { ...x, hit: !x.hit } : x));
    const hitIdx = list.map((x, k) => (x.hit ? k : -1)).filter((k) => k >= 0);
    if (hitIdx.length) {
      const best = list[Math.max(...hitIdx)];
      upd({ tps: list, status: "TP", exit: best.level, r: calcR(t.entry, t.sl, best.level) });
    } else {
      upd({ tps: list, status: "Abierta", exit: "", r: "", pnl: 0 });
    }
  };

  const setOutcome = (status) => {
    if (status === "SL") upd({ status, exit: t.sl, r: -1, pnl: 0 });
    else if (status === "BE") upd({ status, exit: t.entry, r: 0, pnl: 0 });
    else upd({ status, tps: levels.map((x) => ({ ...x, hit: false })), exit: "", r: "", pnl: 0 });
  };

  const savePnl = () => {
    let v = num(pnl) ?? 0;
    if (t.status === "SL") v = -Math.abs(v);
    upd({ pnl: v });
  };

  const onFile = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    try { upd({ img: await compressImage(file) }); } catch (e) {}
  };

  const outcomes = [
    ["SL", "Tocó SL", "rose"],
    ["BE", "Break Even", "amber"],
    ["Descartada", "Descartar", "slate"],
    ["Abierta", "Reabrir", "sky"],
  ];
  const tone = {
    rose: "border-rose-500/60 bg-rose-500/20 text-rose-300",
    amber: "border-amber-500/60 bg-amber-500/20 text-amber-300",
    slate: "border-slate-500/60 bg-slate-500/20 text-slate-300",
    sky: "border-sky-500/60 bg-sky-500/20 text-sky-300",
  };

  return (
    <div className="mt-5 rounded-xl border p-4 space-y-4" style={{ background: C.panel2, borderColor: C.line }}>
      <div className="text-[11px] uppercase tracking-[0.18em] text-amber-400 font-bold">Gestionar resultado</div>

      {levels.length > 0 && (
        <div>
          <div className="text-[11px] text-slate-500 mb-1">Marca cada TP alcanzado:</div>
          <div className="flex flex-wrap gap-2">
            {levels.map((x, i) => (
              <button
                key={i}
                onClick={() => toggleTp(i)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-bold ${
                  x.hit ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-300" : "border-slate-600 text-slate-400 hover:border-emerald-500/50"
                }`}
              >
                {x.hit ? "✅" : "○"} TP{i + 1} · {x.level}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {outcomes.map(([s, label, tn]) => (
          <button
            key={s}
            onClick={() => setOutcome(s)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-bold ${t.status === s ? tone[tn] : "border-slate-600 text-slate-400 hover:text-slate-200"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {["TP", "SL", "BE"].includes(t.status) && (
        <div className="flex items-end gap-2">
          <label className="block w-40">
            <span className="block text-[11px] uppercase tracking-wider text-slate-400 mb-1">PnL ($)</span>
            <input type="number" step="any" className={inputCls} value={pnl} onChange={(e) => setPnl(e.target.value)} placeholder={t.status === "SL" ? "200" : "450"} />
          </label>
          <button onClick={savePnl} className="px-3 py-2 rounded-lg text-xs font-extrabold text-black" style={{ background: `linear-gradient(90deg, ${C.gold}, ${C.gold2})` }}>
            Guardar PnL
          </button>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="file"
          accept="image/*"
          onChange={(e) => onFile(e.target.files?.[0])}
          className="text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-500 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-black"
        />
        {t.img && <button onClick={() => upd({ img: "" })} className="text-xs text-rose-400">Quitar captura</button>}
      </div>
    </div>
  );
}

/* ----------------------------- Detail modal ----------------------------- */
function DetailModal({ t, onClose, isAdmin, onUpdate }) {
  if (!t) return null;
  const where = t.category === "CFD" ? `CFD · ${t.sub}` : `Sintético · ${t.broker}`;
  const rows = [
    ["Fecha", fmtDate(t.date)],
    ["Mercado", where],
    ["Entrada", t.entry === "" ? "—" : t.entry],
    ["Salida", t.exit === "" ? "—" : t.exit],
    ["Stop Loss", t.sl === "" ? "—" : t.sl],
    ["Take Profits", tpLevels(t).map((x) => x.level).join(" / ") || "Open"],
    ["Lotaje", t.lots === "" ? "—" : t.lots],
    ["PnL", money(t.pnl)],
    ["Ratio R", t.r === "" ? "—" : `${t.r}R`],
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl border p-5 md:p-6 my-6" style={{ background: C.panel, borderColor: C.line }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-extrabold text-amber-400">{t.asset}</h3>
              <DirBadge dir={t.direction} />
              <StatusBadge status={t.status} />
            </div>
            <div className="text-xs text-slate-500 mt-1">{where}</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4">
          {rows.map(([k, v]) => (
            <div key={k} className="rounded-lg p-2" style={{ background: C.panel2 }}>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">{k}</div>
              <div className={`text-sm font-semibold ${k === "PnL" ? (Number(t.pnl) > 0 ? "text-emerald-400" : Number(t.pnl) < 0 ? "text-rose-400" : "text-slate-200") : "text-slate-200"}`}>{v}</div>
            </div>
          ))}
        </div>

        {t.tags?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {t.tags.map((g) => (
              <span key={g} className="text-[11px] px-2 py-0.5 rounded-full border border-amber-500/40 text-amber-300">#{g}</span>
            ))}
          </div>
        )}

        {t.notes && <p className="mt-4 text-sm text-slate-300 whitespace-pre-wrap">{t.notes}</p>}

        <div className="mt-4"><TpChips t={t} /></div>

        {imgSrc(t) && (
          <img
            src={imgSrc(t)}
            alt="Captura de la operación"
            className="mt-4 w-full rounded-lg border border-amber-500/20"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        )}

        {t.chart && (
          <a href={t.chart} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-amber-400 underline hover:text-amber-300">
            Abrir gráfico en TradingView ↗
          </a>
        )}

        {t.raw && (
          <details className="mt-4">
            <summary className="cursor-pointer text-xs uppercase tracking-wider text-slate-500">Señal original</summary>
            <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-400 rounded-lg p-3" style={{ background: C.panel2 }}>{t.raw}</pre>
          </details>
        )}

        {isAdmin && <ManagePanel key={t.id} t={t} onUpdate={onUpdate} />}
      </div>
    </div>
  );
}

/* ----------------------------- Login modal ----------------------------- */
function LoginModal({ onClose, onOk }) {
  const [key, setKey] = useState("");
  const [err, setErr] = useState(false);
  const ref = useRef(null);
  useEffect(() => ref.current?.focus(), []);
  const submit = (e) => {
    e.preventDefault();
    if (key === ADMIN_KEY) onOk();
    else setErr(true);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl border p-6" style={{ background: C.panel, borderColor: C.line }}>
        <h3 className="text-lg font-extrabold text-amber-400 tracking-wide">ACCESO ADMIN</h3>
        <p className="text-xs text-slate-500 mt-1">Ingresa tu clave de acceso para gestionar la bitácora.</p>
        <input ref={ref} type="password" inputMode="numeric" className={`${inputCls} mt-4`} placeholder="Clave" value={key} onChange={(e) => { setKey(e.target.value); setErr(false); }} />
        {err && <div className="text-sm text-rose-400 mt-2">Clave incorrecta.</div>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm">Cancelar</button>
          <button type="submit" className="px-5 py-2 rounded-lg text-sm font-extrabold text-black" style={{ background: `linear-gradient(90deg, ${C.gold}, ${C.gold2})` }}>Entrar</button>
        </div>
      </form>
    </div>
  );
}

/* ============================== APP ============================== */
export default function App() {
  const [trades, setTrades] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return SEED;
  });
  const [isAdmin, setIsAdmin] = useState(() => {
    try { return sessionStorage.getItem(SESSION_KEY) === "1"; } catch (e) { return false; }
  });
  const [showLogin, setShowLogin] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  // navegación
  const [tab, setTab] = useState("CFD"); // CFD | SINTETICO
  const [cfdSub, setCfdSub] = useState("Todos");
  const [broker, setBroker] = useState("WELTRADE");

  // filtros tabla
  const [fStatus, setFStatus] = useState("Todos");
  const [fDir, setFDir] = useState("Todas");
  const [fTag, setFTag] = useState("Todas");
  const [q, setQ] = useState("");

  const fileRef = useRef(null);
  const [storageErr, setStorageErr] = useState(false);
  const [signalText, setSignalText] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
      setStorageErr(false);
    } catch (e) {
      setStorageErr(true);
    }
  }, [trades]);

  const login = () => {
    setIsAdmin(true);
    setShowLogin(false);
    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch (e) {}
  };
  const logout = () => {
    setIsAdmin(false);
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
  };

  // alcance según pestañas
  const scoped = useMemo(() => {
    return trades.filter((t) => {
      if (t.category !== tab) return false;
      if (tab === "CFD") return cfdSub === "Todos" || t.sub === cfdSub;
      return t.broker === broker;
    });
  }, [trades, tab, cfdSub, broker]);

  const allTags = useMemo(() => {
    const s = new Set();
    scoped.forEach((t) => (t.tags || []).forEach((g) => s.add(g)));
    return Array.from(s);
  }, [scoped]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return scoped
      .filter((t) => (fStatus === "Todos" ? true : t.status === fStatus))
      .filter((t) => (fDir === "Todas" ? true : t.direction === fDir))
      .filter((t) => (fTag === "Todas" ? true : (t.tags || []).includes(fTag)))
      .filter((t) => (term ? `${t.asset} ${t.notes} ${(t.tags || []).join(" ")}`.toLowerCase().includes(term) : true))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [scoped, fStatus, fDir, fTag, q]);

  const m = useMemo(() => computeMetrics(scoped), [scoped]);

  const equity = useMemo(() => {
    const ex = scoped.filter((t) => ["TP", "SL", "BE"].includes(t.status)).sort((a, b) => (a.date < b.date ? -1 : 1));
    let acc = 0;
    const pts = [{ name: "Inicio", equity: 0 }];
    ex.forEach((t, i) => {
      acc += Number(t.pnl) || 0;
      pts.push({ name: `${fmtDate(t.date)} #${i + 1}`, equity: Number(acc.toFixed(2)) });
    });
    return pts;
  }, [scoped]);

  const dist = useMemo(
    () => [
      { name: "TP", value: m.wins, fill: C.green },
      { name: "SL", value: m.losses, fill: C.red },
      { name: "BE", value: m.be, fill: C.gold2 },
      { name: "Descartada", value: m.discarded, fill: "#64748b" },
      { name: "Abierta", value: m.open, fill: "#38bdf8" },
    ],
    [m]
  );

  const saveTrade = (t) => {
    setTrades((prev) => {
      const i = prev.findIndex((x) => x.id === t.id);
      if (i >= 0) {
        const c = [...prev];
        c[i] = t;
        return c;
      }
      return [t, ...prev];
    });
    // llevar la vista a donde quedó la operación
    setTab(t.category);
    if (t.category === "CFD") setCfdSub("Todos");
    else setBroker(t.broker);
    setEditing(null);
  };

  const deleteTrade = (id) => {
    setTrades((p) => p.filter((t) => t.id !== id));
    setConfirmDel(null);
  };

  const updateTrade = (t) => setTrades((p) => p.map((x) => (x.id === t.id ? t : x)));

  const importSignal = () => {
    if (!signalText.trim()) return;
    const p = parseSignal(signalText);
    const base = emptyForm("CFD", p.sub, "");
    setEditing({
      ...base,
      asset: p.asset,
      sub: p.sub,
      direction: p.direction,
      entry: p.entry,
      sl: p.sl,
      tpsText: p.tps.map((x) => x.level).join(", "),
      chart: p.chart,
      notes: p.notes,
      raw: p.raw,
      status: "Abierta",
      warnings: p.warnings,
    });
    setSignalText("");
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(trades, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `borkaifx-elite-bitacora-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJson = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data)) throw new Error();
        if (window.confirm(`¿Reemplazar la bitácora actual por ${data.length} operaciones importadas?`)) setTrades(data);
      } catch (err) {
        window.alert("Archivo inválido.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const pnlTone = m.totalPnl > 0 ? "pos" : m.totalPnl < 0 ? "neg" : undefined;
  const scopeLabel = tab === "CFD" ? `CFDs · ${cfdSub}` : `Sintéticos · ${broker}`;

  return (
    <div className="min-h-screen text-slate-200" style={{ background: C.bg, fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      {/* ------------------------- HEADER ------------------------- */}
      <header className="border-b sticky top-0 z-30 backdrop-blur" style={{ borderColor: C.line, background: "rgba(9,13,22,0.92)" }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center font-black text-black text-lg" style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.gold2})` }}>
              B
            </div>
            <div>
              <div className="font-black tracking-[0.22em] text-amber-400 leading-none text-lg">{BRAND}</div>
              <div className="text-[10px] tracking-[0.3em] text-slate-500 mt-1">BITÁCORA & PORTAFOLIO · CANAL VIP</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg text-sm font-extrabold text-black hover:brightness-110 transition"
              style={{ background: `linear-gradient(90deg, ${C.gold}, ${C.gold2})` }}
            >
              ✈ Unirme al Telegram
            </a>
            {isAdmin ? (
              <button onClick={logout} className="px-3 py-2 rounded-lg border border-amber-500/40 text-amber-300 text-sm hover:bg-amber-500/10">
                Salir de Admin
              </button>
            ) : (
              <button onClick={() => setShowLogin(true)} className="px-3 py-2 rounded-lg border border-slate-600 text-slate-400 text-sm hover:text-amber-300 hover:border-amber-500/40">
                🔒 Admin
              </button>
            )}
          </div>
        </div>
        {isAdmin && (
          <div className="text-center text-[11px] tracking-[0.25em] py-1 font-bold text-black" style={{ background: C.gold }}>
            MODO ADMINISTRADOR ACTIVO
          </div>
        )}
      </header>

      {storageErr && isAdmin && (
        <div className="text-center text-xs py-2 px-4 bg-rose-500/20 text-rose-300 border-b border-rose-500/40">
          ⚠ No se pudo guardar: el almacenamiento del navegador está lleno (capturas pesadas). Exporta un respaldo y quita capturas antiguas.
        </div>
      )}
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* ------------------------- HERO ------------------------- */}
        <section className="rounded-2xl border p-5 md:p-7" style={{ background: `linear-gradient(135deg, ${C.panel}, #0b1120)`, borderColor: C.line }}>
          <h1 className="text-2xl md:text-4xl font-black tracking-wide">
            Resultados <span className="text-amber-400">reales</span>, sin filtros.
          </h1>
          <p className="mt-2 text-sm md:text-base text-slate-400 max-w-2xl">
            Historial público de las señales del canal VIP de {BRAND}: cada entrada, cada TP, cada SL y cada señal descartada, documentados con transparencia.
          </p>
        </section>

        {/* ------------------------- TABS PRINCIPALES ------------------------- */}
        <section className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {[
              ["CFD", "CFDs"],
              ["SINTETICO", "Sintéticos"],
            ].map(([k, label]) => (
              <button
                key={k}
                onClick={() => { setTab(k); setFTag("Todas"); }}
                className={`px-5 py-2.5 rounded-lg text-sm font-extrabold tracking-wider border transition ${
                  tab === k ? "text-black border-transparent" : "text-slate-400 border-slate-700 hover:text-amber-300 hover:border-amber-500/40"
                }`}
                style={tab === k ? { background: `linear-gradient(90deg, ${C.gold}, ${C.gold2})` } : {}}
              >
                {label.toUpperCase()}
              </button>
            ))}
          </div>

          {tab === "CFD" ? (
            <div className="flex flex-wrap gap-2">
              {["Todos", ...CFD_SUBS].map((s) => (
                <button
                  key={s}
                  onClick={() => { setCfdSub(s); setFTag("Todas"); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                    cfdSub === s ? "border-amber-400 text-amber-300 bg-amber-500/10" : "border-slate-700 text-slate-400 hover:border-amber-500/40"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {BROKERS.map((b) => (
                <button
                  key={b}
                  onClick={() => { setBroker(b); setFTag("Todas"); }}
                  className={`px-4 py-1.5 rounded-full text-xs font-extrabold tracking-wider border transition ${
                    broker === b ? "border-amber-400 text-amber-300 bg-amber-500/10" : "border-slate-700 text-slate-400 hover:border-amber-500/40"
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ------------------------- MÉTRICAS ------------------------- */}
        <section>
          <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500 mb-2">Métricas · {scopeLabel}</div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Stat label="Win Rate" value={`${m.winRate.toFixed(1)}%`} sub={`${m.wins} TP · ${m.losses} SL · ${m.be} BE`} tone={m.winRate >= 50 ? "pos" : m.winRate > 0 ? "neg" : undefined} />
            <Stat label="PnL Total" value={money(m.totalPnl)} sub={`${m.executed} operaciones ejecutadas`} tone={pnlTone} />
            <Stat label="Ratio R/R" value={m.rr === Infinity ? "∞" : m.rr.toFixed(2)} sub="Ganancia media / pérdida media" />
            <Stat label="Profit Factor" value={m.profitFactor === Infinity ? "∞" : m.profitFactor.toFixed(2)} sub={`R acumulado: ${m.totalR.toFixed(2)}R`} />
            <Stat label="Señales" value={m.total} sub={`${m.open} abiertas · ${m.discarded} descartadas`} />
          </div>
        </section>

        {/* ------------------------- GRÁFICOS ------------------------- */}
        <section className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-xl border p-4" style={{ background: C.panel, borderColor: C.line }}>
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400 mb-3">Curva de Capital (PnL acumulado)</div>
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer>
                <AreaChart data={equity} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.gold2} stopOpacity={0.45} />
                      <stop offset="100%" stopColor={C.gold2} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(148,163,184,0.1)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} hide={equity.length > 12} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} width={60} />
                  <Tooltip content={<ChartTooltip />} />
                  <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 4" />
                  <Area type="monotone" dataKey="equity" name="Capital" stroke={C.gold2} strokeWidth={2.5} fill="url(#eqFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border p-4" style={{ background: C.panel, borderColor: C.line }}>
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400 mb-3">Distribución de Resultados</div>
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={dist} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(148,163,184,0.1)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(245,158,11,0.06)" }} />
                  <Bar dataKey="value" name="Operaciones" radius={[6, 6, 0, 0]}>
                    {dist.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* ------------------------- PEGAR SEÑAL (admin) ------------------------- */}
        {isAdmin && (
          <section className="rounded-xl border p-4" style={{ background: C.panel, borderColor: C.line }}>
            <div className="text-xs uppercase tracking-[0.18em] text-amber-400 font-bold mb-2">Pegar señal (CFDs)</div>
            <textarea
              rows={6}
              className={inputCls}
              placeholder={"Pega aquí la señal tal como la envías al canal VIP…\n\nPair: XAUUSD 📊\nSide: Short / Sell\nEntry: 4018\nSL: 4030\nTP1 4013 …"}
              value={signalText}
              onChange={(e) => setSignalText(e.target.value)}
            />
            <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs text-slate-500">
                Detecta activo, dirección, entrada, SL, TPs y enlace de TradingView. Podrás revisar y adjuntar la captura antes de guardar.
              </span>
              <button
                onClick={importSignal}
                disabled={!signalText.trim()}
                className="px-4 py-2 rounded-lg text-sm font-extrabold text-black disabled:opacity-40"
                style={{ background: `linear-gradient(90deg, ${C.gold}, ${C.gold2})` }}
              >
                Interpretar y revisar
              </button>
            </div>
          </section>
        )}

        {/* ------------------------- TABLA ------------------------- */}
        <section className="rounded-xl border" style={{ background: C.panel, borderColor: C.line }}>
          <div className="p-4 flex flex-wrap items-end justify-between gap-3 border-b" style={{ borderColor: C.line }}>
            <div>
              <h2 className="font-extrabold tracking-wider text-amber-400">REGISTRO DE OPERACIONES</h2>
              <div className="text-xs text-slate-500">{filtered.length} de {scoped.length} entradas · {scopeLabel}</div>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <input className={`${inputCls} !w-44`} placeholder="Buscar activo, nota, tag…" value={q} onChange={(e) => setQ(e.target.value)} />
              <select className={`${inputCls} !w-auto`} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
                <option>Todos</option>
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
              <select className={`${inputCls} !w-auto`} value={fDir} onChange={(e) => setFDir(e.target.value)}>
                <option>Todas</option>
                <option>BUY</option>
                <option>SELL</option>
              </select>
              <select className={`${inputCls} !w-auto`} value={fTag} onChange={(e) => setFTag(e.target.value)}>
                <option>Todas</option>
                {allTags.map((g) => <option key={g}>{g}</option>)}
              </select>

              {isAdmin && (
                <button
                  onClick={() => setEditing(emptyForm(tab, cfdSub === "Todos" ? "Forex" : cfdSub, broker))}
                  className="px-4 py-2 rounded-lg text-sm font-extrabold text-black"
                  style={{ background: `linear-gradient(90deg, ${C.gold}, ${C.gold2})` }}
                >
                  + Nueva entrada
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-slate-500 text-left">
                  {["Fecha", "Activo", "Dir.", "Entrada", "Salida", "SL", "TP", "Lotes", "PnL", "R", "Estado", ""].map((h, i) => (
                    <th key={i} className="px-3 py-3 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={12} className="text-center text-slate-500 py-10">Sin operaciones para estos filtros.</td>
                  </tr>
                )}
                {filtered.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setDetail(t.id)}
                    className="border-t cursor-pointer hover:bg-amber-500/5 transition"
                    style={{ borderColor: "rgba(148,163,184,0.1)" }}
                  >
                    <td className="px-3 py-3 text-slate-400 whitespace-nowrap">{fmtDate(t.date)}</td>
                    <td className="px-3 py-3 font-bold text-slate-100 whitespace-nowrap">
                      {t.asset}
                      {t.tags?.includes("VIP Signal") && <span className="ml-2 text-[10px] text-amber-400 border border-amber-500/40 rounded px-1">VIP</span>}
                    </td>
                    <td className="px-3 py-3"><DirBadge dir={t.direction} /></td>
                    <td className="px-3 py-3 text-slate-300">{t.entry === "" ? "—" : t.entry}</td>
                    <td className="px-3 py-3 text-slate-300">{t.exit === "" ? "—" : t.exit}</td>
                    <td className="px-3 py-3 text-rose-300/80">{t.sl === "" ? "—" : t.sl}</td>
                    <td className="px-3 py-3"><TpChips t={t} /></td>
                    <td className="px-3 py-3 text-slate-300">{t.lots === "" ? "—" : t.lots}</td>
                    <td className={`px-3 py-3 font-bold whitespace-nowrap ${Number(t.pnl) > 0 ? "text-emerald-400" : Number(t.pnl) < 0 ? "text-rose-400" : "text-slate-400"}`}>
                      {t.status === "Descartada" ? "—" : money(t.pnl)}
                    </td>
                    <td className="px-3 py-3 text-slate-300">{t.r === "" ? "—" : `${t.r}R`}</td>
                    <td className="px-3 py-3"><StatusBadge status={t.status} /></td>
                    <td className="px-3 py-3 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                      {t.chart && (
                        <a href={t.chart} target="_blank" rel="noopener noreferrer" title="Ver gráfico" className="text-amber-400 hover:text-amber-300 mr-2">📈</a>
                      )}
                      {isAdmin && (
                        <>
                          <button
                            title="Editar"
                            onClick={() => setEditing({ ...t, tagsText: (t.tags || []).join(", "), tpsText: tpLevels(t).map((x) => x.level).join(", ") })}
                            className="text-slate-400 hover:text-amber-300 mr-2"
                          >
                            ✎
                          </button>
                          <button title="Eliminar" onClick={() => setConfirmDel(t)} className="text-slate-400 hover:text-rose-400">🗑</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ------------------------- ADMIN TOOLS ------------------------- */}
        {isAdmin && (
          <section className="rounded-xl border p-4 flex flex-wrap items-center gap-3" style={{ background: C.panel, borderColor: C.line }}>
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400 mr-auto">Herramientas de administración</div>
            <button onClick={exportJson} className="px-3 py-2 rounded-lg border border-amber-500/40 text-amber-300 text-sm hover:bg-amber-500/10">⬇ Exportar respaldo (JSON)</button>
            <button onClick={() => fileRef.current?.click()} className="px-3 py-2 rounded-lg border border-amber-500/40 text-amber-300 text-sm hover:bg-amber-500/10">⬆ Importar respaldo</button>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={importJson} />
            <button
              onClick={() => { if (window.confirm("¿Eliminar TODAS las operaciones (incluidas las de ejemplo)?")) setTrades([]); }}
              className="px-3 py-2 rounded-lg border border-rose-500/40 text-rose-400 text-sm hover:bg-rose-500/10"
            >
              Vaciar bitácora
            </button>
          </section>
        )}

        {/* ------------------------- FOOTER ------------------------- */}
        <footer className="pt-6 pb-10 text-center text-xs text-slate-500 space-y-2">
          <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300 font-bold">
            t.me/borkaifxoficial
          </a>
          <p className="max-w-3xl mx-auto leading-relaxed">
            Aviso de riesgo: operar CFDs e instrumentos sintéticos conlleva un alto riesgo de pérdida de capital. Los resultados pasados no garantizan resultados futuros. Este contenido es informativo y no constituye asesoría financiera.
          </p>
          <div className="tracking-[0.25em]">© {new Date().getFullYear()} {BRAND}</div>
        </footer>
      </main>

      {/* ------------------------- MODALES ------------------------- */}
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onOk={login} />}
      {editing && <TradeForm initial={editing} onCancel={() => setEditing(null)} onSave={saveTrade} />}
      {detail && trades.find((x) => x.id === detail) && (
        <DetailModal t={trades.find((x) => x.id === detail)} onClose={() => setDetail(null)} isAdmin={isAdmin} onUpdate={updateTrade} />
      )}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-sm rounded-2xl border p-6" style={{ background: C.panel, borderColor: C.line }}>
            <h3 className="font-extrabold text-rose-400">Eliminar operación</h3>
            <p className="text-sm text-slate-400 mt-2">
              ¿Seguro que deseas eliminar <b className="text-slate-200">{confirmDel.asset}</b> del {fmtDate(confirmDel.date)}? Esta acción no se puede deshacer.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setConfirmDel(null)} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm">Cancelar</button>
              <button onClick={() => deleteTrade(confirmDel.id)} className="px-4 py-2 rounded-lg bg-rose-500 text-white text-sm font-bold">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}