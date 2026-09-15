import { useState, useEffect, useMemo, useRef } from "react";
import { Plus, Pencil, Trash2, X, Search, Download, Upload, Wallet, HandCoins, Scale, CalendarDays, LayoutDashboard, Receipt, PartyPopper, Users, FileText, Share2, MessageCircle, Lock, Unlock, RefreshCw, Cloud } from "lucide-react";

const STORE_KEY = "karmbhumi-society-v1";      // shared: visible to everyone using the app
const ADMIN_KEY = "karmbhumi-admin-pin";        // personal: this device's unlocked PIN hash
const PHONE_KEY = "karmbhumi-wa-phone";         // personal: saved WhatsApp number

const normalize = (d) => ({ ...d, festivals: d.festivals || [], expenses: d.expenses || [], collections: d.collections || [], members: d.members || SEED_MEMBERS, settings: { ...(d.settings || {}) } });
const hashPin = async (pin) => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("karmbhumi-patan:" + pin));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
};
const loadShared = async () => {
  try {
    const r = await window.storage.get(STORE_KEY, true);
    return r?.value ? normalize(JSON.parse(r.value)) : null;
  } catch { return null; }
};
const getPersonal = async (key) => {
  try { const r = await window.storage.get(key, false); return r?.value ?? null; } catch { return null; }
};

const CATEGORIES = ["સજાવટ", "ભોજન / પ્રસાદ", "સાઉન્ડ / લાઇટ", "મંડપ", "પૂજા સામગ્રી", "ઇનામ / ભેટ", "કલાકાર / ગરબા", "પરિવહન", "સફાઈ", "અન્ય"];
const MODES = ["રોકડ", "UPI", "બેંક ટ્રાન્સફર", "ચેક"];

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const fmt = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("gu-IN", { day: "numeric", month: "short", year: "numeric" }) : "-");

const SEED_MEMBERS = [
  { id: "m1", order: 1, house: "A-1", name: "HIMMATLAL MANGALDAS ZAVERI" },
  { id: "m2", order: 2, house: "A-2", name: "SHIRISHBHAI PATEL" },
  { id: "m3", order: 3, house: "A-3", name: "RAJUBHAI KATVALA" },
  { id: "m4", order: 4, house: "A-4", name: "PARTH GORDHANBHAI PRAJAPATI" },
  { id: "m5", order: 5, house: "A-5", name: "SATISHBHAI SWAMI" },
  { id: "m6", order: 6, house: "A-6", name: "YOGESHBHAI GUPTA" },
  { id: "m7", order: 7, house: "A-7", name: "MANISHBHAI GANDHI" },
  { id: "m8", order: 8, house: "A-8", name: "RAHULBHAI PANCHIVALA" },
  { id: "m9", order: 9, house: "A-9", name: "NIRAVBHAI PANCHIVALA" },
  { id: "m10", order: 10, house: "A-10", name: "BHARATBHAI AMBALAL PRAJAPATI" },
  { id: "m11", order: 11, house: "A-11", name: "PRAVINBHAI CHHAGANBHAI PATEL" },
  { id: "m12", order: 12, house: "A-12", name: "MAHESHBHAI SOMABHAI JOSHI" },
  { id: "m13", order: 13, house: "A-13", name: "RAKESHBHAI MODI" },
  { id: "m14", order: 14, house: "5", name: "ABHISHEK PRAJAPATI (REKHABEN)" },
  { id: "m15", order: 15, house: "4", name: "LILABEN JOSHI" },
  { id: "m16", order: 16, house: "3", name: "YOGESHBHAI BALCHANDBHAI PRAJAPATI" },
  { id: "m17", order: 17, house: "7", name: "ASHOKBHAI MAGANBHAI PRAJAPATI" },
  { id: "m18", order: 18, house: "8", name: "CHANDRAKANTBHAI D SWAMI" },
  { id: "m19", order: 19, house: "12", name: "VINODBHAI JOSHI" },
  { id: "m20", order: 20, house: "13", name: "ANILBHAI JAYANTILAL PRAJAPATI" },
  { id: "m21", order: 21, house: "14", name: "KISHANBHAI MODI" },
  { id: "m22", order: 22, house: "15", name: "BABUBHAI LALLUBHAI PATEL" },
  { id: "m23", order: 23, house: "16", name: "BHAILALBHAI DAVE" },
  { id: "m24", order: 24, house: "17", name: "RANJITBHAI BAROT" },
  { id: "m25", order: 25, house: "18", name: "BHIKHABHAI PATEL" },
  { id: "m26", order: 26, house: "19", name: "HIMMATBHAI SONI" },
  { id: "m27", order: 27, house: "20", name: "SHAMBHUBHAI PATEL" },
  { id: "m28", order: 28, house: "21", name: "KANAKBEN PARIKH" },
  { id: "m29", order: 29, house: "22", name: "RAMESHBHAI C. PATEL" },
  { id: "m30", order: 30, house: "23", name: "RAMENDRABHAI M ADHYARU" },
  { id: "m31", order: 31, house: "24", name: "VIJAYBHAI DASRATHBHAI PRAJAPATI" },
  { id: "m32", order: 32, house: "25", name: "PRADIPBHAI PATANI" },
  { id: "m33", order: 33, house: "26", name: "BHARATBHAI PUNAMCHANDDAS PRAJAPATI" },
  { id: "m34", order: 34, house: "27", name: "PARESHBHAI VYASH" },
  { id: "m35", order: 35, house: "28", name: "DEVANSHUBHAI R PATEL" },
  { id: "m36", order: 36, house: "29", name: "RAJUBHAI MODI" },
  { id: "m37", order: 37, house: "30", name: "KAMLESHKUMAR BHAGVANDAS PRAJAPATI (RENT - VASHANTBHAI)" },
  { id: "m38", order: 38, house: "31", name: "HEMANTBHAI KATVALA" },
  { id: "m39", order: 39, house: "32", name: "SHANKARBHAI CHAUDHARI" },
  { id: "m40", order: 40, house: "33", name: "RAVIBHAI TRIVEDI" },
  { id: "m41", order: 41, house: "34", name: "RAJENDRAKUMAR MAFATLAL PRAJAPATI (USA)" },
  { id: "m42", order: 42, house: "35", name: "DR. RANJITBHAI GHEEWALA" },
  { id: "m43", order: 43, house: "36/37", name: "CHANDRAKANTBHAI PATEL" },
  { id: "m44", order: 44, house: "38", name: "HITESHBHAI SEVANTILAL PRAJAPATI" },
  { id: "m45", order: 45, house: "39", name: "RAJUBHAI MAFATLAL JANI" },
  { id: "m46", order: 46, house: "40", name: "MANOJBHAI PRAJAPATI" },
  { id: "m47", order: 47, house: "41", name: "MANILAL PRAJAPATI (RENT - SHAILESHBHAI)" },
  { id: "m48", order: 48, house: "42", name: "VISHNUBHAI PATEL (BHAVESHBHAI SHRIMALI)" },
  { id: "m49", order: 49, house: "43", name: "CHHAGANBHAI MODI (RENT - RAMESHBHAI PRAJAPATI)" },
];

const SEED = {
  members: SEED_MEMBERS,
  settings: {},
  festivals: [
    { id: "f1", name: "ગણેશ ચતુર્થી", year: 2026, date: "2026-09-14", budget: 80000, note: "" },
    { id: "f2", name: "નવરાત્રી", year: 2026, date: "2026-10-11", budget: 250000, note: "૯ દિવસ ગરબા" },
    { id: "f3", name: "દિવાળી", year: 2026, date: "2026-11-08", budget: 60000, note: "" },
  ],
  expenses: [],
  collections: [],
};

const css = `
@import url('https://fonts.googleapis.com/css2?family=Baloo+Bhai+2:wght@500;700;800&family=Hind+Vadodara:wght@400;500;600&display=swap');
.kb{--ink:#14303A;--peacock:#0F5E6B;--marigold:#E9A21B;--kumkum:#B42A2A;--leaf:#2F7D4F;--bg:#F2F5F3;--paper:#FFFFFF;--line:#D9E2DF;--muted:#5D7178;
 font-family:'Hind Vadodara',sans-serif;background:var(--bg);color:var(--ink);min-height:100vh;line-height:1.55}
.kb *{box-sizing:border-box}
.kb h1,.kb h2,.kb h3,.kb .num{font-family:'Baloo Bhai 2',sans-serif}
.kb button{font-family:inherit;cursor:pointer}
.kb button:focus-visible,.kb input:focus-visible,.kb select:focus-visible,.kb textarea:focus-visible{outline:3px solid var(--marigold);outline-offset:2px}
.hdr{background:var(--peacock);color:#fff;padding:28px 20px 22px}
.wrap{max-width:1100px;margin:0 auto}
.hdr h1{font-size:clamp(30px,5vw,46px);line-height:1.05;margin:0;font-weight:800}
.hdr p{margin:4px 0 0;opacity:.85}
.hdr-row{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap}
.ghost{background:rgba(255,255,255,.12);color:#fff;border:1px solid rgba(255,255,255,.3);border-radius:8px;padding:7px 12px;display:inline-flex;gap:6px;align-items:center;font-size:14px}
.ghost:hover{background:rgba(255,255,255,.22)}
.chips{display:flex;gap:8px;overflow-x:auto;padding:16px 20px 4px;max-width:1100px;margin:0 auto}
.chip{border:1.5px solid var(--line);background:var(--paper);border-radius:999px;padding:6px 14px;white-space:nowrap;font-size:15px;color:var(--ink)}
.chip.on{background:var(--ink);color:#fff;border-color:var(--ink)}
.tabs{display:flex;gap:4px;max-width:1100px;margin:10px auto 0;padding:0 20px;border-bottom:1px solid var(--line)}
.tab{background:none;border:none;padding:10px 14px;font-size:16px;color:var(--muted);display:flex;gap:6px;align-items:center;border-bottom:3px solid transparent;margin-bottom:-1px}
.tab.on{color:var(--ink);border-color:var(--marigold);font-weight:600}
.main{max-width:1100px;margin:0 auto;padding:22px 20px 60px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px}
.stat{background:var(--paper);border-left:5px solid var(--c);padding:14px 16px;border-radius:4px 10px 10px 4px}
.stat .lbl{color:var(--muted);font-size:14px;display:flex;gap:6px;align-items:center}
.stat .num{font-size:30px;font-weight:700;line-height:1.2}
.panel{background:var(--paper);border-radius:12px;padding:18px;margin-top:18px;border:1px solid var(--line)}
.panel h3{margin:0 0 12px;font-size:21px}
.bar{height:10px;background:#E6ECEA;border-radius:6px;overflow:hidden}
.bar>i{display:block;height:100%;border-radius:6px}
.row{display:flex;align-items:center;gap:12px;padding:11px 0;border-top:1px solid var(--line)}
.row:first-child{border-top:none}
.row .grow{flex:1;min-width:0}
.row .t{font-weight:600}
.row .s{font-size:13px;color:var(--muted)}
.tag{display:inline-block;background:#E8F1EF;color:var(--peacock);border-radius:5px;padding:1px 8px;font-size:12px;margin-right:6px}
.amt{font-family:'Baloo Bhai 2';font-weight:700;font-size:18px;white-space:nowrap}
.icon{background:none;border:1px solid var(--line);border-radius:8px;width:34px;height:34px;display:grid;place-items:center;color:var(--muted)}
.icon:hover{color:var(--ink);border-color:var(--ink)}
.icon.del:hover{color:var(--kumkum);border-color:var(--kumkum)}
.toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px}
.inp{border:1.5px solid var(--line);border-radius:8px;padding:9px 11px;font-size:15px;font-family:inherit;background:#fff;color:var(--ink);width:100%}
.searchbox{position:relative;flex:1;min-width:200px}
.searchbox svg{position:absolute;left:10px;top:11px;color:var(--muted)}
.searchbox .inp{padding-left:34px}
.btn{background:var(--marigold);color:var(--ink);border:none;border-radius:8px;padding:10px 16px;font-weight:600;font-size:15px;display:inline-flex;gap:6px;align-items:center}
.btn:hover{filter:brightness(.95)}
.btn.sec{background:#fff;border:1.5px solid var(--line)}
.btn.danger{background:var(--kumkum);color:#fff}
.empty{text-align:center;padding:40px 10px;color:var(--muted)}
.overlay{position:fixed;inset:0;background:rgba(20,48,58,.5);display:grid;place-items:center;padding:16px;z-index:50}
.modal{background:#fff;border-radius:14px;width:100%;max-width:480px;max-height:92vh;overflow:auto;padding:22px;animation:pop .18s ease-out}
@keyframes pop{from{transform:scale(.96);opacity:0}to{transform:none;opacity:1}}
@media (prefers-reduced-motion:reduce){.modal{animation:none}}
.modal h2{margin:0 0 14px;font-size:24px;display:flex;justify-content:space-between;align-items:center}
.fld{margin-bottom:12px}
.fld label{display:block;font-size:14px;font-weight:500;margin-bottom:4px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.err{color:var(--kumkum);font-size:13px;margin-top:3px}
.actions{display:flex;gap:10px;justify-content:flex-end;margin-top:16px}
.kb.viewer .row .icon,.kb.viewer .fest-card .icon,.kb.viewer .row .btn,.kb.viewer .empty .btn,.kb.viewer .toolbar .btn:not(.sec),.kb.viewer .adm{display:none}
.sync{font-size:13px;opacity:.85;display:flex;align-items:center;gap:6px;margin-top:6px}
.pinbox{letter-spacing:.5em;text-align:center;font-size:24px}
.toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--ink);color:#fff;padding:10px 18px;border-radius:8px;z-index:60}
.fest-card{display:flex;gap:14px;align-items:center;padding:14px 0;border-top:1px solid var(--line)}
.fest-card:first-child{border-top:none}
.fest-date{background:var(--marigold);border-radius:10px;width:58px;text-align:center;padding:6px 0;font-family:'Baloo Bhai 2';line-height:1.1;flex-shrink:0}
.fest-date b{display:block;font-size:22px}
@media (max-width:560px){.grid2{grid-template-columns:1fr}.tab span{display:none}.tab{padding:10px 12px}}
`;

function Toran() {
  const flags = Array.from({ length: 40 });
  const colors = ["#E9A21B", "#B42A2A", "#2F7D4F", "#E9A21B", "#F1C24B"];
  return (
    <svg viewBox="0 0 800 34" preserveAspectRatio="none" style={{ display: "block", width: "100%", height: 34, background: "#0F5E6B" }} aria-hidden="true">
      <path d="M0 4 Q400 14 800 4" stroke="#F1C24B" strokeWidth="2" fill="none" />
      {flags.map((_, i) => {
        const x = i * 20 + 10;
        const y = 4 + 10 * (1 - Math.pow((x - 400) / 400, 2));
        return i % 2 === 0
          ? <path key={i} d={`M${x - 7} ${y} L${x + 7} ${y} L${x} ${y + 18} Z`} fill={colors[i % 5]} />
          : <path key={i} d={`M${x} ${y} C${x - 7} ${y + 8} ${x - 3} ${y + 16} ${x} ${y + 20} C${x + 3} ${y + 16} ${x + 7} ${y + 8} ${x} ${y} Z`} fill="#2F7D4F" />;
      })}
    </svg>
  );
}

function Modal({ title, onClose, children }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>{title}<button className="icon" onClick={onClose} aria-label="બંધ કરો"><X size={18} /></button></h2>
        {children}
      </div>
    </div>
  );
}

function Field({ label, error, children }) {
  return <div className="fld"><label>{label}</label>{children}{error && <div className="err">{error}</div>}</div>;
}

function ExpenseForm({ initial, festivals, defaultFest, onSave, onClose }) {
  const [f, setF] = useState(initial || { festivalId: defaultFest || festivals[0]?.id || "", title: "", category: CATEGORIES[0], amount: "", date: today(), paidBy: "", vendor: "", mode: MODES[0], note: "" });
  const [err, setErr] = useState({});
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = () => {
    const e = {};
    if (!f.festivalId) e.festivalId = "તહેવાર પસંદ કરો";
    if (!f.title.trim()) e.title = "ખર્ચની વિગત લખો";
    if (!(Number(f.amount) > 0)) e.amount = "રકમ ૦ થી વધુ હોવી જોઈએ";
    setErr(e);
    if (Object.keys(e).length) return;
    onSave({ ...f, amount: Number(f.amount), id: f.id || uid() });
  };
  return (
    <Modal title={initial ? "ખર્ચ સુધારો" : "નવો ખર્ચ ઉમેરો"} onClose={onClose}>
      <Field label="તહેવાર" error={err.festivalId}>
        <select className="inp" value={f.festivalId} onChange={set("festivalId")}>
          {festivals.map((x) => <option key={x.id} value={x.id}>{x.name} {x.year}</option>)}
        </select>
      </Field>
      <Field label="ખર્ચની વિગત" error={err.title}><input className="inp" value={f.title} onChange={set("title")} placeholder="દા.ત. ગરબા માટે સાઉન્ડ સિસ્ટમ" autoFocus /></Field>
      <div className="grid2">
        <Field label="રકમ (₹)" error={err.amount}><input className="inp" type="number" min="0" inputMode="decimal" value={f.amount} onChange={set("amount")} /></Field>
        <Field label="તારીખ"><input className="inp" type="date" value={f.date} onChange={set("date")} /></Field>
        <Field label="પ્રકાર"><select className="inp" value={f.category} onChange={set("category")}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="ચુકવણી રીત"><select className="inp" value={f.mode} onChange={set("mode")}>{MODES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="ચૂકવનાર સભ્ય"><input className="inp" value={f.paidBy} onChange={set("paidBy")} placeholder="નામ" /></Field>
        <Field label="વેપારી / દુકાન"><input className="inp" value={f.vendor} onChange={set("vendor")} /></Field>
      </div>
      <Field label="નોંધ"><textarea className="inp" rows="2" value={f.note} onChange={set("note")} /></Field>
      <div className="actions"><button className="btn sec" onClick={onClose}>રદ કરો</button><button className="btn" onClick={save}>ખર્ચ સાચવો</button></div>
    </Modal>
  );
}

function CollectionForm({ initial, isEdit, festivals, members, collections, defaultFest, onSave, onClose }) {
  const [f, setF] = useState(initial || { festivalId: defaultFest || festivals[0]?.id || "", memberId: "", flat: "", name: "", amount: "", date: today(), mode: MODES[0], note: "" });
  const [err, setErr] = useState({});
  const [mq, setMq] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const shown = members.filter((m) => !mq || m.house.toLowerCase().includes(mq.toLowerCase()) || m.name.toLowerCase().includes(mq.toLowerCase()));
  const pickMember = (id) => {
    const m = members.find((x) => x.id === id);
    setF({ ...f, memberId: id, flat: m ? m.house : "", name: m ? m.name : "" });
  };
  const already = f.memberId && collections.some((c) => c.id !== f.id && c.festivalId === f.festivalId && c.memberId === f.memberId);
  const save = () => {
    const e = {};
    if (!f.festivalId) e.festivalId = "તહેવાર પસંદ કરો";
    if (!f.name.trim() && !f.flat.trim()) e.name = "ઘર પસંદ કરો અથવા નામ લખો";
    if (!(Number(f.amount) > 0)) e.amount = "રકમ ૦ થી વધુ હોવી જોઈએ";
    setErr(e);
    if (Object.keys(e).length) return;
    onSave({ ...f, amount: Number(f.amount), id: f.id || uid() });
  };
  return (
    <Modal title={isEdit ? "ફાળો સુધારો" : "ફાળો ઉમેરો"} onClose={onClose}>
      <Field label="તહેવાર" error={err.festivalId}>
        <select className="inp" value={f.festivalId} onChange={set("festivalId")}>
          {festivals.map((x) => <option key={x.id} value={x.id}>{x.name} {x.year}</option>)}
        </select>
      </Field>
      <Field label="ઘર નં. / સભ્ય" error={err.name}>
        <input className="inp" style={{ marginBottom: 6 }} placeholder="ઘર નં. કે નામથી શોધો" value={mq} onChange={(e) => setMq(e.target.value)} autoFocus={!initial} />
        <select className="inp" value={f.memberId || ""} onChange={(e) => pickMember(e.target.value)} size={Math.min(6, shown.length + 1)}>
          <option value="">બહારના દાતા / અન્ય (નીચે નામ લખો)</option>
          {shown.map((m) => <option key={m.id} value={m.id}>{m.house}  |  {m.name}</option>)}
        </select>
        {already && <div className="err">આ ઘરનો આ તહેવારનો ફાળો પહેલેથી નોંધાયેલ છે. વધારાનો ફાળો હોય તો જ સાચવો.</div>}
      </Field>
      {!f.memberId && (
        <div className="grid2">
          <Field label="ઘર નં. (વૈકલ્પિક)"><input className="inp" value={f.flat} onChange={set("flat")} /></Field>
          <Field label="દાતાનું નામ"><input className="inp" value={f.name} onChange={set("name")} /></Field>
        </div>
      )}
      <div className="grid2">
        <Field label="રકમ (₹)" error={err.amount}><input className="inp" type="number" min="0" inputMode="decimal" value={f.amount} onChange={set("amount")} /></Field>
        <Field label="તારીખ"><input className="inp" type="date" value={f.date} onChange={set("date")} /></Field>
      </div>
      <Field label="ચુકવણી રીત"><select className="inp" value={f.mode} onChange={set("mode")}>{MODES.map((c) => <option key={c}>{c}</option>)}</select></Field>
      <Field label="નોંધ"><textarea className="inp" rows="2" value={f.note} onChange={set("note")} placeholder="દા.ત. સ્પોન્સર, દાન" /></Field>
      <div className="actions"><button className="btn sec" onClick={onClose}>રદ કરો</button><button className="btn" onClick={save}>ફાળો સાચવો</button></div>
    </Modal>
  );
}

function MemberForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(initial || { house: "", name: "", phone: "" });
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = () => {
    if (!f.house.trim() || !f.name.trim()) return setErr("ઘર નં. અને નામ બંને લખો");
    onSave({ ...f, id: f.id || uid(), order: f.order || Date.now() });
  };
  return (
    <Modal title={initial ? "સભ્ય સુધારો" : "નવો સભ્ય ઉમેરો"} onClose={onClose}>
      <Field label="ઘર નં."><input className="inp" value={f.house} onChange={set("house")} autoFocus /></Field>
      <Field label="સભ્યનું નામ" error={err}><input className="inp" value={f.name} onChange={set("name")} /></Field>
      <Field label="મોબાઇલ નંબર (વૈકલ્પિક)"><input className="inp" type="tel" value={f.phone || ""} onChange={set("phone")} /></Field>
      <div className="actions"><button className="btn sec" onClick={onClose}>રદ કરો</button><button className="btn" onClick={save}>સભ્ય સાચવો</button></div>
    </Modal>
  );
}

const th = { border: "1px solid #9fb3b0", padding: "5px 8px", background: "#0F5E6B", color: "#fff", textAlign: "left", fontWeight: 600 };
const td = { border: "1px solid #c9d6d3", padding: "4px 8px" };
const tdR = { ...td, textAlign: "right", whiteSpace: "nowrap" };

function Report({ data, fest, festMap, sortedFests, paidFor }) {
  const f = fest === "all" ? null : festMap[fest];
  const exps = data.expenses.filter((e) => !f || e.festivalId === f.id).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const cols = data.collections.filter((c) => !f || c.festivalId === f.id);
  const spent = exps.reduce((s, e) => s + e.amount, 0);
  const collected = cols.reduce((s, c) => s + c.amount, 0);
  const members = [...data.members].sort((a, b) => a.order - b.order);
  const memberIds = new Set(members.map((m) => m.id));
  const others = cols.filter((c) => !c.memberId || !memberIds.has(c.memberId));
  return (
    <div style={{ width: 794, padding: 36, background: "#fff", color: "#14303A", fontFamily: "'Hind Vadodara',sans-serif", fontSize: 13, lineHeight: 1.5 }}>
      <div style={{ borderBottom: "4px solid #E9A21B", paddingBottom: 10, marginBottom: 14 }}>
        <div style={{ fontFamily: "'Baloo Bhai 2'", fontSize: 30, fontWeight: 800, lineHeight: 1.1 }}>કર્મભૂમિ સોસાયટી, પાટણ</div>
        <div style={{ fontSize: 17 }}>{f ? `${f.name} ${f.year} : ફાળો અને ખર્ચનો હિસાબ` : "બધા તહેવારોનો હિસાબ"}</div>
        <div style={{ fontSize: 12, color: "#5D7178" }}>રિપોર્ટ તારીખ: {fmtDate(today())}</div>
      </div>
      <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: 16, fontSize: 15 }}>
        <tbody>
          <tr><td style={td}>કુલ ફાળો</td><td style={{ ...tdR, fontWeight: 700, color: "#2F7D4F" }}>{fmt(collected)}</td>
            <td style={td}>કુલ ખર્ચ</td><td style={{ ...tdR, fontWeight: 700, color: "#B42A2A" }}>{fmt(spent)}</td>
            <td style={td}>બાકી સિલક</td><td style={{ ...tdR, fontWeight: 700 }}>{fmt(collected - spent)}</td></tr>
        </tbody>
      </table>

      {!f && (
        <>
          <div style={{ fontFamily: "'Baloo Bhai 2'", fontSize: 19, fontWeight: 700, margin: "6px 0" }}>તહેવાર મુજબ</div>
          <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: 16 }}>
            <thead><tr><th style={th}>તહેવાર</th><th style={th}>બજેટ</th><th style={th}>ફાળો</th><th style={th}>ખર્ચ</th><th style={th}>સિલક</th></tr></thead>
            <tbody>{sortedFests.map((x) => {
              const c = data.collections.filter((k) => k.festivalId === x.id).reduce((s, k) => s + k.amount, 0);
              const e = data.expenses.filter((k) => k.festivalId === x.id).reduce((s, k) => s + k.amount, 0);
              return <tr key={x.id}><td style={td}>{x.name} {x.year}</td><td style={tdR}>{fmt(x.budget)}</td><td style={tdR}>{fmt(c)}</td><td style={tdR}>{fmt(e)}</td><td style={tdR}>{fmt(c - e)}</td></tr>;
            })}</tbody>
          </table>
        </>
      )}

      {f && (
        <>
          <div style={{ fontFamily: "'Baloo Bhai 2'", fontSize: 19, fontWeight: 700, margin: "6px 0" }}>ઘર મુજબ ફાળો</div>
          <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: 16 }}>
            <thead><tr><th style={{ ...th, width: 36 }}>ક્ર.</th><th style={{ ...th, width: 70 }}>ઘર નં.</th><th style={th}>સભ્યનું નામ</th><th style={{ ...th, width: 110 }}>ફાળો</th></tr></thead>
            <tbody>
              {members.map((m, i) => {
                const p = paidFor(f.id, m.id);
                return <tr key={m.id}><td style={td}>{i + 1}</td><td style={td}>{m.house}</td><td style={td}>{m.name}</td>
                  <td style={{ ...tdR, color: p ? "#14303A" : "#B42A2A" }}>{p ? fmt(p) : "બાકી"}</td></tr>;
              })}
              {others.map((c, i) => <tr key={c.id}><td style={td}>{members.length + i + 1}</td><td style={td}>{c.flat || "-"}</td><td style={td}>{c.name}{c.note ? ` (${c.note})` : ""}</td><td style={tdR}>{fmt(c.amount)}</td></tr>)}
              <tr><td style={{ ...td, fontWeight: 700 }} colSpan={3}>કુલ ફાળો</td><td style={{ ...tdR, fontWeight: 700 }}>{fmt(collected)}</td></tr>
            </tbody>
          </table>
        </>
      )}

      <div style={{ fontFamily: "'Baloo Bhai 2'", fontSize: 19, fontWeight: 700, margin: "6px 0" }}>ખર્ચની વિગત</div>
      {exps.length === 0 ? <div style={{ color: "#5D7178" }}>કોઈ ખર્ચ નોંધાયો નથી.</div> : (
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead><tr><th style={{ ...th, width: 36 }}>ક્ર.</th><th style={{ ...th, width: 90 }}>તારીખ</th><th style={th}>વિગત</th><th style={th}>પ્રકાર</th>{!f && <th style={th}>તહેવાર</th>}<th style={{ ...th, width: 100 }}>રકમ</th></tr></thead>
          <tbody>
            {exps.map((e, i) => <tr key={e.id}><td style={td}>{i + 1}</td><td style={td}>{fmtDate(e.date)}</td><td style={td}>{e.title}{e.vendor ? ` (${e.vendor})` : ""}</td><td style={td}>{e.category}</td>{!f && <td style={td}>{festMap[e.festivalId]?.name}</td>}<td style={tdR}>{fmt(e.amount)}</td></tr>)}
            <tr><td style={{ ...td, fontWeight: 700 }} colSpan={f ? 4 : 5}>કુલ ખર્ચ</td><td style={{ ...tdR, fontWeight: 700 }}>{fmt(spent)}</td></tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

function ShareModal({ phone, setPhone, summary, busy, onDownload, onShare, canShareFiles, onClose }) {
  const digits = (phone || "").replace(/\D/g, "");
  const num = digits.length === 10 ? "91" + digits : digits;
  const text = encodeURIComponent(summary);
  return (
    <Modal title="PDF અને WhatsApp" onClose={onClose}>
      <div style={{ display: "grid", gap: 10 }}>
        <button className="btn" disabled={busy} onClick={onDownload}><FileText size={16} />{busy ? "PDF બની રહી છે…" : "PDF ડાઉનલોડ કરો"}</button>
        {canShareFiles && <button className="btn sec" disabled={busy} onClick={onShare}><Share2 size={16} />PDF સીધી WhatsApp માં શેર કરો</button>}
      </div>
      <hr style={{ border: "none", borderTop: "1px solid var(--line)", margin: "18px 0" }} />
      <Field label="WhatsApp નંબર">
        <input className="inp" type="tel" placeholder="દા.ત. 98xxxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>
      <div style={{ display: "grid", gap: 10 }}>
        <a className="btn sec" style={{ textDecoration: "none", justifyContent: "center", opacity: num.length >= 11 ? 1 : 0.5, pointerEvents: num.length >= 11 ? "auto" : "none" }} href={`https://wa.me/${num}?text=${text}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} />આ નંબર પર હિસાબ મોકલો</a>
        <a className="btn sec" style={{ textDecoration: "none", justifyContent: "center" }} href={`https://wa.me/?text=${text}`} target="_blank" rel="noopener noreferrer"><Users size={16} />સોસાયટી ગ્રુપમાં મોકલો</a>
      </div>
      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 0 }}>
        WhatsApp લિંકથી ફક્ત હિસાબનો સારાંશ મેસેજ તરીકે જાય છે. PDF મોકલવા માટે પહેલા PDF ડાઉનલોડ કરો, પછી WhatsApp ચેટમાં 📎 દબાવીને "Document" માંથી ફાઇલ જોડો. ગ્રુપ બટન દબાવ્યા પછી WhatsApp માં તમારું સોસાયટી ગ્રુપ પસંદ કરો.
      </p>
    </Modal>
  );
}

function FestivalForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(initial || { name: "", year: new Date().getFullYear(), date: today(), budget: "", note: "" });
  const [err, setErr] = useState({});
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const presets = ["નવરાત્રી", "દિવાળી", "ગણેશ ચતુર્થી", "ઉત્તરાયણ", "જન્માષ્ટમી", "હોળી", "સ્વાતંત્ર્ય દિન", "પ્રજાસત્તાક દિન", "રામ નવમી", "નવું વર્ષ"];
  const save = () => {
    if (!f.name.trim()) return setErr({ name: "તહેવારનું નામ લખો" });
    onSave({ ...f, year: Number(f.year), budget: Number(f.budget) || 0, id: f.id || uid() });
  };
  return (
    <Modal title={initial ? "તહેવાર સુધારો" : "નવો તહેવાર ઉમેરો"} onClose={onClose}>
      <Field label="તહેવારનું નામ" error={err.name}>
        <input className="inp" list="fest-presets" value={f.name} onChange={set("name")} autoFocus />
        <datalist id="fest-presets">{presets.map((p) => <option key={p} value={p} />)}</datalist>
      </Field>
      <div className="grid2">
        <Field label="વર્ષ"><input className="inp" type="number" value={f.year} onChange={set("year")} /></Field>
        <Field label="તારીખ"><input className="inp" type="date" value={f.date} onChange={set("date")} /></Field>
      </div>
      <Field label="અંદાજિત બજેટ (₹)"><input className="inp" type="number" min="0" value={f.budget} onChange={set("budget")} /></Field>
      <Field label="નોંધ"><textarea className="inp" rows="2" value={f.note} onChange={set("note")} /></Field>
      <div className="actions"><button className="btn sec" onClick={onClose}>રદ કરો</button><button className="btn" onClick={save}>તહેવાર સાચવો</button></div>
    </Modal>
  );
}

function Confirm({ text, onYes, onClose }) {
  return (
    <Modal title="કાઢી નાખવું છે?" onClose={onClose}>
      <p style={{ margin: 0 }}>{text}</p>
      <div className="actions"><button className="btn sec" onClick={onClose}>ના, રાખો</button><button className="btn danger" onClick={onYes}>હા, કાઢી નાખો</button></div>
    </Modal>
  );
}

function downloadCSV(name, rows) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = "\uFEFF" + rows.map((r) => r.map(esc).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = name;
  a.click();
}

function PinModal({ hasPin, isAdmin, onCreate, onUnlock, onLogout, onClose }) {
  const [mode, setMode] = useState(hasPin ? (isAdmin ? "menu" : "unlock") : "create");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [oldPin, setOldPin] = useState("");
  const [err, setErr] = useState("");
  const clean = (v) => v.replace(/\D/g, "").slice(0, 8);
  const submit = async () => {
    setErr("");
    if (mode === "unlock") {
      if (!(await onUnlock(pin))) setErr("PIN ખોટો છે");
      return;
    }
    if (pin.length < 4) return setErr("PIN ઓછામાં ઓછો ૪ અંકનો રાખો");
    if (pin !== pin2) return setErr("બંને PIN સરખા નથી");
    const res = await onCreate(pin, mode === "change" ? oldPin : null);
    if (res) setErr(res);
  };
  const titles = { create: "એડમિન PIN બનાવો", unlock: "એડમિન તરીકે ખોલો", menu: "એડમિન", change: "PIN બદલો" };
  return (
    <Modal title={titles[mode]} onClose={onClose}>
      {mode === "menu" ? (
        <div style={{ display: "grid", gap: 10 }}>
          <p style={{ margin: 0 }}>આ ઉપકરણ પર તમે એડમિન છો, એટલે ઉમેરવું, સુધારવું અને કાઢી નાખવું ચાલુ છે.</p>
          <button className="btn sec" onClick={() => setMode("change")}>PIN બદલો</button>
          <button className="btn danger" onClick={onLogout}><Lock size={16} />એડમિન લૉગઆઉટ</button>
        </div>
      ) : (
        <>
          {mode === "create" && <p style={{ marginTop: 0 }}>આ PIN થી જ ખર્ચ અને ફાળો ઉમેરી કે સુધારી શકાશે. બાકીના સભ્યો ફક્ત હિસાબ જોઈ શકશે. PIN ભૂલશો નહીં.</p>}
          {mode === "change" && <Field label="જૂનો PIN"><input className="inp pinbox" type="password" inputMode="numeric" value={oldPin} onChange={(e) => setOldPin(clean(e.target.value))} autoFocus /></Field>}
          <Field label={mode === "unlock" ? "PIN" : "નવો PIN (૪ થી ૮ અંક)"}>
            <input className="inp pinbox" type="password" inputMode="numeric" value={pin} autoFocus={mode !== "change"} onChange={(e) => setPin(clean(e.target.value))} onKeyDown={(e) => e.key === "Enter" && submit()} />
          </Field>
          {mode !== "unlock" && <Field label="PIN ફરી લખો"><input className="inp pinbox" type="password" inputMode="numeric" value={pin2} onChange={(e) => setPin2(clean(e.target.value))} onKeyDown={(e) => e.key === "Enter" && submit()} /></Field>}
          {err && <div className="err" style={{ fontSize: 14 }}>{err}</div>}
          <div className="actions"><button className="btn sec" onClick={onClose}>રદ કરો</button><button className="btn" onClick={submit}>{mode === "unlock" ? "ખોલો" : "PIN સાચવો"}</button></div>
        </>
      )}
    </Modal>
  );
}

export default function App() {
  const [data, setData] = useState(SEED);
  const [loaded, setLoaded] = useState(false);
  const [fest, setFest] = useState("all");
  const [tab, setTab] = useState("dash");
  const [modal, setModal] = useState(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const reportRef = useRef(null);
  const [adminHash, setAdminHash] = useState(null);
  const [phone, setPhoneState] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncedAt, setSyncedAt] = useState(null);
  const [online, setOnline] = useState(true);

  const pinHash = data.settings?.pinHash || null;
  const isAdmin = !!pinHash && adminHash === pinHash;

  // First load: shared database, falling back to this device's older personal data
  useEffect(() => {
    (async () => {
      let d = await loadShared();
      if (!d) {
        const old = await getPersonal(STORE_KEY);
        d = old ? normalize(JSON.parse(old)) : normalize(SEED);
        delete d.settings.phone;
      }
      setData(d);
      setAdminHash(await getPersonal(ADMIN_KEY));
      setPhoneState((await getPersonal(PHONE_KEY)) || "");
      setSyncedAt(new Date());
      setLoaded(true);
    })();
  }, []);

  const refresh = async (silent) => {
    const d = await loadShared();
    if (d) { setData(d); setOnline(true); setSyncedAt(new Date()); if (!silent) setToast("નવો ડેટા લોડ થયો"); }
    else if (!silent) setToast("ડેટા લોડ ન થયો, ઇન્ટરનેટ ચેક કરો");
  };

  // Pick up changes made by other committee members every 20 seconds
  useEffect(() => {
    if (!loaded) return;
    const t = setInterval(() => { if (!modal && !saving) refresh(true); }, 20000);
    return () => clearInterval(t);
  }, [loaded, modal, saving]);

  // Every change: read latest shared copy, apply the change, write it back
  const mutate = async (fn, msg, { allowNonAdmin = false } = {}) => {
    if (!isAdmin && !allowNonAdmin) { setToast("ફેરફાર માટે એડમિન PIN જરૂરી છે"); return false; }
    setSaving(true);
    try {
      const latest = (await loadShared()) || data;
      const next = { ...fn(latest), updatedAt: new Date().toISOString() };
      const r = await window.storage.set(STORE_KEY, JSON.stringify(next), true);
      if (!r) throw new Error("save failed");
      setData(next); setOnline(true); setSyncedAt(new Date());
      if (msg) setToast(msg);
      return true;
    } catch {
      setOnline(false);
      setToast("સાચવી શકાયું નહીં, ઇન્ટરનેટ ચેક કરી ફરી પ્રયાસ કરો");
      return false;
    } finally { setSaving(false); }
  };

  const createPin = async (pin, oldPin) => {
    if (oldPin !== null && (await hashPin(oldPin)) !== pinHash) return "જૂનો PIN ખોટો છે";
    const latest = await loadShared();
    if (oldPin === null && latest?.settings?.pinHash) { setData(latest); return "PIN પહેલેથી બનેલો છે, તેનાથી ખોલો"; }
    const h = await hashPin(pin);
    const ok = await mutate((d) => ({ ...d, settings: { ...d.settings, pinHash: h } }), "PIN સાચવ્યો", { allowNonAdmin: oldPin === null });
    if (!ok) return "PIN સાચવી શકાયો નહીં";
    try { await window.storage.set(ADMIN_KEY, h, false); } catch {}
    setAdminHash(h); setModal(null);
    return null;
  };
  const unlock = async (pin) => {
    const h = await hashPin(pin);
    try { await window.storage.set(ADMIN_KEY, h, false); } catch {}
    const d = await loadShared(); // server returns the real PIN hash only when this hash is correct
    if (d?.settings?.pinHash !== h) {
      try { await window.storage.delete(ADMIN_KEY, false); } catch {}
      return false;
    }
    setData(d); setAdminHash(h); setModal(null); setToast("એડમિન મોડ ચાલુ");
    return true;
  };
  const logout = async () => {
    try { await window.storage.delete(ADMIN_KEY, false); } catch {}
    setAdminHash(null); setModal(null); setToast("એડમિન મોડ બંધ");
  };

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(""), 2400); return () => clearTimeout(t); } }, [toast]);

  const festMap = useMemo(() => Object.fromEntries(data.festivals.map((f) => [f.id, f])), [data.festivals]);
  const sortedFests = useMemo(() => [...data.festivals].sort((a, b) => (a.date || "").localeCompare(b.date || "")), [data.festivals]);
  const sortedMembers = useMemo(() => [...data.members].sort((a, b) => a.order - b.order), [data.members]);
  const paidFor = (festId, memberId) => data.collections.filter((c) => c.festivalId === festId && c.memberId === memberId).reduce((s, c) => s + c.amount, 0);
  const inFest = (x) => fest === "all" || x.festivalId === fest;

  const exps = data.expenses.filter(inFest);
  const cols = data.collections.filter(inFest);
  const spent = exps.reduce((s, x) => s + x.amount, 0);
  const collected = cols.reduce((s, x) => s + x.amount, 0);
  const budget = fest === "all" ? data.festivals.reduce((s, f) => s + (f.budget || 0), 0) : festMap[fest]?.budget || 0;

  const pending = fest === "all" ? [] : sortedMembers.filter((m) => !paidFor(fest, m.id));
  const festTitle = fest === "all" ? "બધા તહેવાર" : `${festMap[fest]?.name} ${festMap[fest]?.year}`;

  const summary = [
    "*કર્મભૂમિ સોસાયટી, પાટણ*",
    `*${festTitle} : હિસાબ*`,
    "",
    `કુલ ફાળો: ${fmt(collected)}`,
    `કુલ ખર્ચ: ${fmt(spent)}`,
    `બાકી સિલક: ${fmt(collected - spent)}`,
    ...(fest !== "all" ? [`ફાળો આપનાર ઘર: ${sortedMembers.length - pending.length} / ${sortedMembers.length}`] : []),
    "",
    "વિગતવાર હિસાબ PDF માં જોડેલ છે.",
  ].join("\n");

  const makePdf = async () => {
    const { default: html2canvas } = await import("html2canvas");
    const { jsPDF } = await import("jspdf");
    if (document.fonts?.ready) await document.fonts.ready;
    const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: "#ffffff" });
    const pdf = new jsPDF("p", "mm", "a4");
    const pagePx = Math.floor((canvas.width * 297) / 210);
    for (let y = 0, p = 0; y < canvas.height; y += pagePx, p++) {
      const h = Math.min(pagePx, canvas.height - y);
      const pc = document.createElement("canvas");
      pc.width = canvas.width; pc.height = h;
      pc.getContext("2d").drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
      if (p) pdf.addPage();
      pdf.addImage(pc.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 210, (h * 210) / canvas.width);
    }
    return pdf.output("blob");
  };
  const pdfName = () => `Karmbhumi-${fest === "all" ? "Hisab" : (festMap[fest]?.year + "-" + fest)}-${today()}.pdf`;
  const downloadPdf = async () => {
    setBusy(true);
    try {
      const blob = await makePdf();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = pdfName(); a.click();
      setToast("PDF ડાઉનલોડ થઈ ગઈ");
    } catch (e) { setToast("PDF બની શકી નહીં, ઇન્ટરનેટ ચેક કરીને ફરી પ્રયાસ કરો"); }
    setBusy(false);
  };
  const sharePdf = async () => {
    setBusy(true);
    try {
      const blob = await makePdf();
      const file = new File([blob], pdfName(), { type: "application/pdf" });
      await navigator.share({ files: [file], text: summary });
    } catch (e) {
      if (e?.name !== "AbortError") setToast("આ ઉપકરણ પર સીધું શેર ન થયું, PDF ડાઉનલોડ કરીને મોકલો");
    }
    setBusy(false);
  };
  const canShareFiles = typeof navigator !== "undefined" && !!navigator.canShare && (() => { try { return navigator.canShare({ files: [new File(["x"], "x.pdf", { type: "application/pdf" })] }); } catch { return false; } })();
  const setPhone = (p) => {
    setPhoneState(p);
    window.storage.set(PHONE_KEY, p, false).catch(() => {});
  };

  const byCat = CATEGORIES.map((c) => ({ c, v: exps.filter((e) => e.category === c).reduce((s, e) => s + e.amount, 0) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  const maxCat = Math.max(1, ...byCat.map((x) => x.v));

  const upsert = (key, item, msg) => {
    setModal(null);
    mutate((d) => {
      const exists = d[key].some((x) => x.id === item.id);
      return { ...d, [key]: exists ? d[key].map((x) => (x.id === item.id ? item : x)) : [item, ...d[key]] };
    }, msg);
  };
  const remove = (key, id, msg) => {
    mutate((d) => {
      const next = { ...d, [key]: d[key].filter((x) => x.id !== id) };
      if (key === "festivals") {
        next.expenses = d.expenses.filter((x) => x.festivalId !== id);
        next.collections = d.collections.filter((x) => x.festivalId !== id);
      }
      return next;
    }, msg);
    if (key === "festivals" && fest === id) setFest("all");
    setModal(null);
  };

  const match = (x, fields) => !q || fields.some((k) => String(x[k] || "").toLowerCase().includes(q.toLowerCase()));
  const expList = exps.filter((e) => (cat === "all" || e.category === cat) && match(e, ["title", "vendor", "paidBy", "note"])).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const colList = cols.filter((c) => match(c, ["name", "flat", "note"])).sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const exportBackup = () => {
    const a = document.createElement("a");
    const { pinHash: _omit, ...settings } = data.settings || {};
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ ...data, settings }, null, 2)], { type: "application/json" }));
    a.download = `karmbhumi-backup-${today()}.json`;
    a.click();
  };
  const importBackup = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (!Array.isArray(d.festivals) || !Array.isArray(d.expenses) || !Array.isArray(d.collections)) throw new Error();
        const imported = normalize(d);
        mutate((latest) => ({ ...imported, settings: { ...imported.settings, pinHash: latest.settings?.pinHash } }), "બેકઅપ પાછો લાવવામાં આવ્યો");
        setFest("all");
      } catch { setToast("આ ફાઇલ માન્ય બેકઅપ નથી"); }
    };
    r.readAsText(file);
    e.target.value = "";
  };

  const noFests = data.festivals.length === 0;
  const needFest = () => { setTab("fests"); setModal({ type: "fest" }); setToast("પહેલા તહેવાર ઉમેરો"); };

  const TABS = [
    { id: "dash", label: "ડેશબોર્ડ", icon: LayoutDashboard },
    { id: "exp", label: "ખર્ચ", icon: Receipt },
    { id: "col", label: "ફાળો", icon: HandCoins },
    { id: "members", label: "સભ્યો", icon: Users },
    { id: "fests", label: "તહેવારો", icon: PartyPopper },
  ];

  const ExpRow = ({ e }) => (
    <div className="row">
      <div className="grow">
        <div className="t">{e.title}</div>
        <div className="s"><span className="tag">{e.category}</span>{fest === "all" && `${festMap[e.festivalId]?.name || ""} · `}{fmtDate(e.date)} · {e.mode}{e.paidBy && ` · ${e.paidBy}`}{e.vendor && ` · ${e.vendor}`}</div>
        {e.note && <div className="s">{e.note}</div>}
      </div>
      <div className="amt" style={{ color: "var(--kumkum)" }}>{fmt(e.amount)}</div>
      <button className="icon" aria-label="સુધારો" onClick={() => setModal({ type: "exp", item: e })}><Pencil size={15} /></button>
      <button className="icon del" aria-label="કાઢી નાખો" onClick={() => setModal({ type: "del", key: "expenses", id: e.id, text: `"${e.title}" (${fmt(e.amount)}) ખર્ચ કાઢી નાખવામાં આવશે.`, msg: "ખર્ચ કાઢી નાખ્યો" })}><Trash2 size={15} /></button>
    </div>
  );

  return (
    <div className={`kb ${isAdmin ? "" : "viewer"}`}>
      <style>{css}</style>
      <Toran />
      <header className="hdr">
        <div className="wrap hdr-row">
          <div>
            <h1>કર્મભૂમિ સોસાયટી, પાટણ</h1>
            <p>તહેવાર ખર્ચ અને ફાળાનો હિસાબ</p>
            <div className="sync" role="status">
              <Cloud size={14} />
              {saving ? "સાચવી રહ્યા છીએ…" : !online ? "ઑફલાઇન: છેલ્લો ફેરફાર સાચવાયો નથી" : syncedAt ? `ડેટાબેઝ સાથે જોડાયેલ, છેલ્લે ${syncedAt.toLocaleTimeString("gu-IN", { hour: "2-digit", minute: "2-digit" })}` : "લોડ થઈ રહ્યું છે…"}
              {!isAdmin && loaded && <span> · ફક્ત જોવા માટે</span>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="ghost" onClick={() => setModal({ type: "pin" })} style={{ background: isAdmin ? "rgba(233,162,27,.35)" : undefined }}>{isAdmin ? <Unlock size={15} /> : <Lock size={15} />}{isAdmin ? "એડમિન" : pinHash ? "એડમિન લૉગિન" : "એડમિન PIN બનાવો"}</button>
            <button className="ghost" onClick={() => refresh(false)} aria-label="ડેટા તાજો કરો"><RefreshCw size={15} /></button>
            <button className="ghost" onClick={() => setModal({ type: "share" })}><FileText size={15} />PDF / WhatsApp</button>
            <button className="ghost" onClick={exportBackup}><Download size={15} />બેકઅપ લો</button>
            <label className="ghost adm" style={{ cursor: "pointer" }}><Upload size={15} />બેકઅપ પાછો લાવો<input type="file" accept="application/json" hidden onChange={importBackup} /></label>
          </div>
        </div>
      </header>

      <div className="chips" role="tablist" aria-label="તહેવાર પસંદ કરો">
        <button className={`chip ${fest === "all" ? "on" : ""}`} onClick={() => setFest("all")}>બધા તહેવાર</button>
        {sortedFests.map((f) => (
          <button key={f.id} className={`chip ${fest === f.id ? "on" : ""}`} onClick={() => setFest(f.id)}>{f.name} {f.year}</button>
        ))}
      </div>

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? "on" : ""}`} onClick={() => { setTab(t.id); setQ(""); }} aria-label={t.label}>
            <t.icon size={17} /><span>{t.label}</span>
          </button>
        ))}
      </nav>

      <main className="main">
        {!loaded && <div className="empty">ડેટા લોડ થઈ રહ્યો છે…</div>}

        {loaded && tab === "dash" && (
          <>
            <div className="stats">
              <div className="stat" style={{ "--c": "var(--leaf)" }}><div className="lbl"><HandCoins size={15} />કુલ ફાળો</div><div className="num">{fmt(collected)}</div><div className="s" style={{ fontSize: 13, color: "var(--muted)" }}>{cols.length} એન્ટ્રી</div></div>
              <div className="stat" style={{ "--c": "var(--kumkum)" }}><div className="lbl"><Wallet size={15} />કુલ ખર્ચ</div><div className="num">{fmt(spent)}</div><div style={{ fontSize: 13, color: "var(--muted)" }}>{exps.length} એન્ટ્રી</div></div>
              <div className="stat" style={{ "--c": collected - spent >= 0 ? "var(--peacock)" : "var(--kumkum)" }}><div className="lbl"><Scale size={15} />બાકી સિલક</div><div className="num" style={{ color: collected - spent < 0 ? "var(--kumkum)" : undefined }}>{fmt(collected - spent)}</div><div style={{ fontSize: 13, color: "var(--muted)" }}>{collected - spent < 0 ? "ફાળા કરતાં ખર્ચ વધુ છે" : "ફાળો − ખર્ચ"}</div></div>
            </div>

            {budget > 0 && (
              <div className="panel">
                <h3>બજેટ વપરાશ</h3>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 6 }}>
                  <span>{fmt(spent)} વપરાયા</span><span>બજેટ {fmt(budget)}</span>
                </div>
                <div className="bar"><i style={{ width: `${Math.min(100, (spent / budget) * 100)}%`, background: spent > budget ? "var(--kumkum)" : "var(--marigold)" }} /></div>
                <div style={{ fontSize: 14, marginTop: 6, color: spent > budget ? "var(--kumkum)" : "var(--muted)" }}>
                  {spent > budget ? `બજેટ કરતાં ${fmt(spent - budget)} વધુ ખર્ચ` : `હજુ ${fmt(budget - spent)} બાકી (${Math.round((spent / budget) * 100)}% વપરાયું)`}
                </div>
              </div>
            )}

            {fest !== "all" && (
              <div className="panel">
                <h3>ફાળો બાકી: {pending.length} ઘર</h3>
                <div className="bar" style={{ marginBottom: 10 }}><i style={{ width: `${sortedMembers.length ? ((sortedMembers.length - pending.length) / sortedMembers.length) * 100 : 0}%`, background: "var(--leaf)" }} /></div>
                {pending.length === 0 ? <div className="s">બધા ઘરનો ફાળો આવી ગયો છે.</div> :
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {pending.map((m) => <button key={m.id} className="chip" style={{ fontSize: 13 }} title={m.name} onClick={() => isAdmin && setModal({ type: "col", preset: m })}>{m.house}</button>)}
                  </div>}
                {pending.length > 0 && isAdmin && <div className="s" style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>ઘર નં. પર દબાવીને સીધો ફાળો નોંધો.</div>}
              </div>
            )}

            <div className="panel">
              <h3>પ્રકાર મુજબ ખર્ચ</h3>
              {byCat.length === 0 ? <div className="empty">હજુ કોઈ ખર્ચ નથી. <br /><button className="btn" style={{ marginTop: 10 }} onClick={() => noFests ? needFest() : setModal({ type: "exp" })}><Plus size={16} />પહેલો ખર્ચ ઉમેરો</button></div> :
                byCat.map((x) => (
                  <div key={x.c} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15 }}><span>{x.c}</span><b>{fmt(x.v)}</b></div>
                    <div className="bar"><i style={{ width: `${(x.v / maxCat) * 100}%`, background: "var(--peacock)" }} /></div>
                  </div>
                ))}
            </div>

            {fest === "all" && data.festivals.length > 0 && (
              <div className="panel">
                <h3>તહેવાર મુજબ હિસાબ</h3>
                {sortedFests.map((f) => {
                  const s = data.expenses.filter((e) => e.festivalId === f.id).reduce((a, e) => a + e.amount, 0);
                  const c = data.collections.filter((e) => e.festivalId === f.id).reduce((a, e) => a + e.amount, 0);
                  return (
                    <div className="row" key={f.id} style={{ cursor: "pointer" }} onClick={() => setFest(f.id)}>
                      <div className="grow"><div className="t">{f.name} {f.year}</div><div className="s">ફાળો {fmt(c)} · ખર્ચ {fmt(s)}</div></div>
                      <div className="amt" style={{ color: c - s < 0 ? "var(--kumkum)" : "var(--leaf)" }}>{fmt(c - s)}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {exps.length > 0 && (
              <div className="panel">
                <h3>તાજેતરના ખર્ચ</h3>
                {[...exps].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 5).map((e) => <ExpRow key={e.id} e={e} />)}
              </div>
            )}
          </>
        )}

        {loaded && tab === "exp" && (
          <>
            <div className="toolbar">
              <div className="searchbox"><Search size={16} /><input className="inp" placeholder="ખર્ચ, વેપારી કે સભ્ય શોધો" value={q} onChange={(e) => setQ(e.target.value)} /></div>
              <select className="inp" style={{ width: "auto" }} value={cat} onChange={(e) => setCat(e.target.value)}>
                <option value="all">બધા પ્રકાર</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <button className="btn sec" onClick={() => downloadCSV(`kharch-${today()}.csv`, [["તહેવાર", "વિગત", "પ્રકાર", "રકમ", "તારીખ", "ચુકવણી", "ચૂકવનાર", "વેપારી", "નોંધ"], ...expList.map((e) => [festMap[e.festivalId]?.name, e.title, e.category, e.amount, e.date, e.mode, e.paidBy, e.vendor, e.note])])}><Download size={16} />Excel</button>
              <button className="btn" onClick={() => noFests ? needFest() : setModal({ type: "exp" })}><Plus size={16} />ખર્ચ ઉમેરો</button>
            </div>
            <div className="panel" style={{ marginTop: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><b>{expList.length} ખર્ચ</b><b style={{ color: "var(--kumkum)" }}>{fmt(expList.reduce((s, e) => s + e.amount, 0))}</b></div>
              {expList.length === 0 ? <div className="empty">{q || cat !== "all" ? "શોધ મુજબ કોઈ ખર્ચ મળ્યો નહીં." : "હજુ કોઈ ખર્ચ નોંધાયો નથી. ઉપર \"ખર્ચ ઉમેરો\" દબાવો."}</div> : expList.map((e) => <ExpRow key={e.id} e={e} />)}
            </div>
          </>
        )}

        {loaded && tab === "col" && (
          <>
            <div className="toolbar">
              <div className="searchbox"><Search size={16} /><input className="inp" placeholder="નામ કે ફ્લેટ નંબર શોધો" value={q} onChange={(e) => setQ(e.target.value)} /></div>
              <button className="btn sec" onClick={() => downloadCSV(`falo-${today()}.csv`, [["તહેવાર", "ફ્લેટ", "નામ", "રકમ", "તારીખ", "ચુકવણી", "નોંધ"], ...colList.map((c) => [festMap[c.festivalId]?.name, c.flat, c.name, c.amount, c.date, c.mode, c.note])])}><Download size={16} />Excel</button>
              <button className="btn" onClick={() => noFests ? needFest() : setModal({ type: "col" })}><Plus size={16} />ફાળો ઉમેરો</button>
            </div>
            <div className="panel" style={{ marginTop: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><b>{colList.length} એન્ટ્રી</b><b style={{ color: "var(--leaf)" }}>{fmt(colList.reduce((s, c) => s + c.amount, 0))}</b></div>
              {colList.length === 0 ? <div className="empty">{q ? "શોધ મુજબ કોઈ ફાળો મળ્યો નહીં." : "હજુ કોઈ ફાળો નોંધાયો નથી. ઉપર \"ફાળો ઉમેરો\" દબાવો."}</div> :
                colList.map((c) => (
                  <div className="row" key={c.id}>
                    <div className="grow">
                      <div className="t">{c.flat && <span className="tag">{c.flat}</span>}{c.name}</div>
                      <div className="s">{fest === "all" && `${festMap[c.festivalId]?.name || ""} · `}{fmtDate(c.date)} · {c.mode}{c.note && ` · ${c.note}`}</div>
                    </div>
                    <div className="amt" style={{ color: "var(--leaf)" }}>{fmt(c.amount)}</div>
                    <button className="icon" aria-label="સુધારો" onClick={() => setModal({ type: "col", item: c })}><Pencil size={15} /></button>
                    <button className="icon del" aria-label="કાઢી નાખો" onClick={() => setModal({ type: "del", key: "collections", id: c.id, text: `${c.name || c.flat} નો ${fmt(c.amount)} ફાળો કાઢી નાખવામાં આવશે.`, msg: "ફાળો કાઢી નાખ્યો" })}><Trash2 size={15} /></button>
                  </div>
                ))}
            </div>
          </>
        )}

        {loaded && tab === "members" && (
          <>
            <div className="toolbar">
              <div className="searchbox"><Search size={16} /><input className="inp" placeholder="ઘર નં. કે નામ શોધો" value={q} onChange={(e) => setQ(e.target.value)} /></div>
              <button className="btn" onClick={() => setModal({ type: "member" })}><Plus size={16} />સભ્ય ઉમેરો</button>
            </div>
            <div className="panel" style={{ marginTop: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <b>{sortedMembers.length} ઘર</b>
                {fest !== "all" ? <span className="s" style={{ color: "var(--muted)" }}>{festTitle} ના ફાળાની સ્થિતિ</span> : <span className="s" style={{ color: "var(--muted)" }}>ફાળાની સ્થિતિ જોવા ઉપરથી તહેવાર પસંદ કરો</span>}
              </div>
              {sortedMembers.filter((m) => !q || m.house.toLowerCase().includes(q.toLowerCase()) || m.name.toLowerCase().includes(q.toLowerCase())).map((m) => {
                const p = fest !== "all" ? paidFor(fest, m.id) : 0;
                return (
                  <div className="row" key={m.id}>
                    <div style={{ minWidth: 52, fontFamily: "'Baloo Bhai 2'", fontWeight: 700, fontSize: 18 }}>{m.house}</div>
                    <div className="grow"><div className="t">{m.name}</div>{m.phone && <div className="s">{m.phone}</div>}</div>
                    {fest !== "all" && (p ? <div className="amt" style={{ color: "var(--leaf)" }}>{fmt(p)}</div> :
                      <button className="btn sec" style={{ padding: "6px 10px", fontSize: 14, color: "var(--kumkum)" }} onClick={() => setModal({ type: "col", preset: m })}><Plus size={14} />ફાળો</button>)}
                    <button className="icon" aria-label="સુધારો" onClick={() => setModal({ type: "member", item: m })}><Pencil size={15} /></button>
                    <button className="icon del" aria-label="કાઢી નાખો" onClick={() => setModal({ type: "del", key: "members", id: m.id, text: `${m.house} - ${m.name} ને સભ્ય યાદીમાંથી કાઢી નાખવામાં આવશે. તેમની જૂની ફાળાની એન્ટ્રી રહેશે.`, msg: "સભ્ય કાઢી નાખ્યા" })}><Trash2 size={15} /></button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {loaded && tab === "fests" && (
          <>
            <div className="toolbar" style={{ justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setModal({ type: "fest" })}><Plus size={16} />તહેવાર ઉમેરો</button>
            </div>
            <div className="panel" style={{ marginTop: 0 }}>
              {sortedFests.length === 0 ? <div className="empty">કોઈ તહેવાર નથી. નવો તહેવાર ઉમેરો.</div> :
                sortedFests.map((f) => {
                  const s = data.expenses.filter((e) => e.festivalId === f.id).reduce((a, e) => a + e.amount, 0);
                  const d = f.date ? new Date(f.date) : null;
                  return (
                    <div className="fest-card" key={f.id}>
                      <div className="fest-date">{d ? <><b>{d.getDate()}</b><small>{d.toLocaleDateString("gu-IN", { month: "short" })}</small></> : <CalendarDays size={22} style={{ margin: "8px auto" }} />}</div>
                      <div className="grow" style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ margin: 0, fontSize: 20 }}>{f.name} {f.year}</h3>
                        <div className="s" style={{ fontSize: 13, color: "var(--muted)" }}>બજેટ {fmt(f.budget)} · ખર્ચ {fmt(s)}{f.note && ` · ${f.note}`}</div>
                        {f.budget > 0 && <div className="bar" style={{ marginTop: 6, maxWidth: 320 }}><i style={{ width: `${Math.min(100, (s / f.budget) * 100)}%`, background: s > f.budget ? "var(--kumkum)" : "var(--marigold)" }} /></div>}
                      </div>
                      <button className="icon" aria-label="સુધારો" onClick={() => setModal({ type: "fest", item: f })}><Pencil size={15} /></button>
                      <button className="icon del" aria-label="કાઢી નાખો" onClick={() => setModal({ type: "del", key: "festivals", id: f.id, text: `"${f.name} ${f.year}" અને તેના બધા ખર્ચ તથા ફાળાની એન્ટ્રી કાઢી નાખવામાં આવશે. આ પાછું નહીં આવે.`, msg: "તહેવાર કાઢી નાખ્યો" })}><Trash2 size={15} /></button>
                    </div>
                  );
                })}
            </div>
          </>
        )}
      </main>

      {modal?.type === "exp" && <ExpenseForm initial={modal.item} festivals={sortedFests} defaultFest={fest !== "all" ? fest : undefined} onClose={() => setModal(null)} onSave={(x) => upsert("expenses", x, modal.item ? "ખર્ચ સુધાર્યો" : "ખર્ચ ઉમેર્યો")} />}
      {modal?.type === "col" && <CollectionForm initial={modal.item || (modal.preset && { festivalId: fest !== "all" ? fest : sortedFests[0]?.id, memberId: modal.preset.id, flat: modal.preset.house, name: modal.preset.name, amount: "", date: today(), mode: MODES[0], note: "" })} isEdit={!!modal.item} festivals={sortedFests} members={sortedMembers} collections={data.collections} defaultFest={fest !== "all" ? fest : undefined} onClose={() => setModal(null)} onSave={(x) => upsert("collections", x, modal.item ? "ફાળો સુધાર્યો" : "ફાળો ઉમેર્યો")} />}
      {modal?.type === "fest" && <FestivalForm initial={modal.item} onClose={() => setModal(null)} onSave={(x) => upsert("festivals", x, modal.item ? "તહેવાર સુધાર્યો" : "તહેવાર ઉમેર્યો")} />}
      {modal?.type === "member" && <MemberForm initial={modal.item} onClose={() => setModal(null)} onSave={(x) => upsert("members", x, modal.item ? "સભ્ય સુધાર્યા" : "સભ્ય ઉમેર્યા")} />}
      {modal?.type === "share" && <ShareModal phone={phone} setPhone={setPhone} summary={summary} busy={busy} canShareFiles={canShareFiles} onDownload={downloadPdf} onShare={sharePdf} onClose={() => setModal(null)} />}
      {modal?.type === "share" && (
        <div style={{ position: "fixed", left: -10000, top: 0 }} aria-hidden="true">
          <div ref={reportRef}><Report data={data} fest={fest} festMap={festMap} sortedFests={sortedFests} paidFor={paidFor} /></div>
        </div>
      )}
      {modal?.type === "pin" && <PinModal hasPin={!!pinHash} isAdmin={isAdmin} onCreate={createPin} onUnlock={unlock} onLogout={logout} onClose={() => setModal(null)} />}
      {modal?.type === "del" && <Confirm text={modal.text} onClose={() => setModal(null)} onYes={() => remove(modal.key, modal.id, modal.msg)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
