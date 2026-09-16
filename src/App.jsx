import { useState, useEffect, useMemo, useRef } from "react";
import { Plus, Pencil, Trash2, X, Search, Download, Upload, Wallet, HandCoins, Scale, CalendarDays, LayoutDashboard, Receipt, PartyPopper, Users, FileText, Share2, MessageCircle, Lock, Unlock, RefreshCw, Cloud, Eye, FileSpreadsheet, UtensilsCrossed, Minus, Gift, BellRing, CheckCircle2 } from "lucide-react";

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
const MEMBER_FUND = "સભ્ય ફાળો";
const PASS_TYPE = "ભોજન પાસ";
const SPONSOR = "સ્પોન્સર";
const INCOME_TYPES = [MEMBER_FUND, PASS_TYPE, "દાન", SPONSOR, "સ્ટોલ / જગ્યા ભાડું", "લકી ડ્રો / ટિકિટ", "વ્યાજ", "અન્ય આવક"];
const PASS_FOR = { society: "સોસાયટી સભ્ય", outside: "બહારના" };
const incType = (c) => c.type || MEMBER_FUND; // old entries have no type = member fund
const byDate = (a, b) => (a.date || "").localeCompare(b.date || "");

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const fmt = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
const today = () => new Date().toISOString().slice(0, 10);
// Meal pass payment: `amount` = cash actually received (counts as income),
// `passTotal` = full price of the passes. Older entries have no passTotal = fully paid.
const passTotalOf = (c) => Number(c.passTotal ?? c.amount) || 0;
const passDue = (c) => ((c.type || "") === PASS_TYPE ? Math.max(0, passTotalOf(c) - (Number(c.amount) || 0)) : 0);

// "ફુલ 2 × ₹300 + હાફ 1 × ₹150 (સોસાયટી સભ્ય)" for meal-pass entries, "" for everything else
const passText = (c) => {
  if ((c.type || "") !== PASS_TYPE) return "";
  const parts = [
    c.fullQty ? `ફુલ ${c.fullQty} × ${fmt(c.rateFull)}` : null,
    c.halfQty ? `હાફ ${c.halfQty} × ${fmt(c.rateHalf)}` : null,
  ].filter(Boolean).join(" + ");
  const due = passDue(c);
  return `${parts} (${PASS_FOR[c.passFor] || ""})`
    + (c.passNo ? ` · પાસ નં. ${c.passNo}` : "")
    + (c.guestLabel ? ` · મહેમાન: ${c.guestLabel}` : "")
    + (due ? ` · કુલ ${fmt(passTotalOf(c))}, મળ્યા ${fmt(c.amount)}, બાકી ${fmt(due)}` : "");
};
// Sponsor / donation given as an item (murti, gift, prizes...) instead of cash.
// Stored with amount 0 so cash totals and balance never include it.
const IN_KIND_TYPES = [SPONSOR, "દાન"];
const isInKind = (c) => !!c.inKind && IN_KIND_TYPES.includes(c.type || "");
const kindText = (c) => (isInKind(c)
  ? `વસ્તુ: ${c.item}${Number(c.itemQty) > 1 ? ` × ${c.itemQty}` : ""}${Number(c.estValue) ? ` (અંદાજે ${fmt(c.estValue)})` : ""}`
  : "");
const ITEM_SUGGEST = [
  [/ગણેશ|ગણપતિ/, ["ગણેશજીની મૂર્તિ", "મોદક / લાડુ પ્રસાદ", "પૂજા સામગ્રી", "ડેકોરેશન"]],
  [/નવરાત્ર|ગરબા/, ["માતાજીની મૂર્તિ / ફોટો", "ગરબા ઇનામ", "લ્હાણી", "પ્રસાદ", "ટ્રોફી"]],
  [/દિવાળી|નવું વર્ષ/, ["ફટાકડા", "મીઠાઈ", "દીવા / રોશની", "રંગોળી સામગ્રી"]],
  [/ઉત્તરાયણ|સંક્રાંત/, ["પતંગ", "દોરી", "ચીકી", "ઉંધિયું / જલેબી"]],
  [/જન્માષ્ટમી|કૃષ્ણ/, ["કૃષ્ણ ભગવાનની મૂર્તિ", "મટકી", "પારણું", "પ્રસાદ"]],
  [/હોળી|ધુળેટી/, ["રંગ / ગુલાલ", "હોલિકા લાકડાં", "ખજૂર / ધાણી"]],
  [/સ્વાતંત્ર્ય|પ્રજાસત્તાક/, ["રાષ્ટ્રધ્વજ", "મીઠાઈ", "બાળકો માટે ભેટ"]],
];
const itemSuggestions = (festName = "") => {
  const hit = ITEM_SUGGEST.find(([re]) => re.test(festName));
  return [...(hit ? hit[1] : []), "ઇનામ / ભેટ", "ટ્રોફી", "પ્રસાદ", "નાસ્તો", "ડેકોરેશન", "સાઉન્ડ સિસ્ટમ"];
};
const noteOf = (c) => [passText(c), kindText(c), c.note].filter(Boolean).join(" · ");
const passCounts = (list) => {
  const blank = () => ({ full: 0, half: 0, amount: 0, total: 0, due: 0, dueCount: 0 });
  const r = { society: blank(), outside: blank() };
  list.filter((c) => (c.type || "") === PASS_TYPE).forEach((c) => {
    const k = c.passFor === "outside" ? "outside" : "society";
    r[k].full += Number(c.fullQty) || 0;
    r[k].half += Number(c.halfQty) || 0;
    r[k].amount += Number(c.amount) || 0;
    r[k].total += passTotalOf(c);
    const d = passDue(c);
    r[k].due += d;
    if (d) r[k].dueCount += 1;
  });
  ["full", "half", "amount", "total", "due", "dueCount"].forEach((x) => { r[x] = r.society[x] + r.outside[x]; });
  return r;
};
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
.modal.wide{max-width:960px}
.vt-wrap{overflow-x:auto;margin-bottom:18px}
.vt{width:100%;border-collapse:collapse;font-size:14px}
.vt th{background:#E8F1EF;text-align:left;padding:7px 8px;font-weight:600;white-space:nowrap}
.vt td{padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top}
.vt td.r,.vt th.r{text-align:right;white-space:nowrap}
.vt tr.grp td{background:#F6F8F7;font-weight:600;font-family:'Baloo Bhai 2';font-size:15px}
.vt tr.tot td{font-weight:700;border-top:2px solid var(--ink)}
.sec-h{font-family:'Baloo Bhai 2';font-size:21px;font-weight:700;margin:6px 0 8px;display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.mini{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:16px}
.mini div{background:var(--bg);border-radius:8px;padding:10px 12px}
.mini small{display:block;color:var(--muted)}
.mini b{font-family:'Baloo Bhai 2';font-size:22px}
.stepper{display:flex;align-items:center;gap:6px}
.stepper button{width:38px;height:38px;border-radius:8px;border:1.5px solid var(--line);background:#fff;display:grid;place-items:center;color:var(--ink)}
.stepper input{text-align:center;font-size:18px;font-weight:600}
.total-box{background:var(--ink);color:#fff;border-radius:10px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;margin:4px 0 12px}
.total-box b{font-family:'Baloo Bhai 2';font-size:28px}
.hint{font-size:12px;color:var(--muted);margin-top:3px}
.linkbtn{background:none;border:none;color:var(--peacock);text-decoration:underline;padding:0;font-size:12px}
.due{color:var(--kumkum);font-size:13px;font-weight:600;white-space:nowrap}
.amtcol{display:flex;flex-direction:column;align-items:flex-end;gap:2px}
.duebox{background:#FBE9E9;color:var(--kumkum);border-radius:8px;padding:8px 12px;font-weight:600;margin-bottom:12px;display:flex;justify-content:space-between}
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

function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="overlay" onClick={onClose}>
      <div className={`modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
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
        <Field label="કોણે ચૂકવ્યા (સભ્ય)"><input className="inp" value={f.paidBy} onChange={set("paidBy")} placeholder="દા.ત. રાજુભાઈ" /></Field>
        <Field label="કોને ચૂકવ્યા (વેપારી / વ્યક્તિ)"><input className="inp" value={f.vendor} onChange={set("vendor")} placeholder="દા.ત. જય સાઉન્ડ" /></Field>
      </div>
      <Field label="નોંધ"><textarea className="inp" rows="2" value={f.note} onChange={set("note")} /></Field>
      <div className="actions"><button className="btn sec" onClick={onClose}>રદ કરો</button><button className="btn" onClick={save}>ખર્ચ સાચવો</button></div>
    </Modal>
  );
}

function CollectionForm({ initial, isEdit, festivals, members, collections, defaultFest, onSave, onClose }) {
  const [f, setF] = useState({ type: MEMBER_FUND, inKind: false, item: "", itemQty: 1, estValue: "", ...(initial || { festivalId: defaultFest || festivals[0]?.id || "", memberId: "", flat: "", name: "", amount: "", date: today(), mode: MODES[0], note: "" }) });
  const [err, setErr] = useState({});
  const [mq, setMq] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const shown = members.filter((m) => !mq || m.house.toLowerCase().includes(mq.toLowerCase()) || m.name.toLowerCase().includes(mq.toLowerCase()));
  const pickMember = (id) => {
    const m = members.find((x) => x.id === id);
    setF({ ...f, memberId: id, flat: m ? m.house : "", name: m ? m.name : "" });
  };
  const isFund = f.type === MEMBER_FUND;
  const canKind = IN_KIND_TYPES.includes(f.type);
  const kind = canKind && f.inKind;
  const festName = festivals.find((x) => x.id === f.festivalId)?.name || "";
  const already = isFund && f.memberId && collections.some((c) => c.id !== f.id && c.festivalId === f.festivalId && c.memberId === f.memberId && incType(c) === MEMBER_FUND);
  const save = () => {
    const e = {};
    if (!f.festivalId) e.festivalId = "તહેવાર પસંદ કરો";
    if (!f.name.trim() && !f.flat.trim()) e.name = isFund ? "ઘર પસંદ કરો" : "ઘર પસંદ કરો અથવા નામ લખો";
    if (isFund && !f.memberId) e.name = "સભ્ય ફાળા માટે યાદીમાંથી ઘર પસંદ કરો";
    if (kind) {
      if (!String(f.item).trim()) e.item = "કઈ વસ્તુ આપી તે લખો";
    } else if (!(Number(f.amount) > 0)) e.amount = "રકમ ૦ થી વધુ હોવી જોઈએ";
    setErr(e);
    if (Object.keys(e).length) return;
    if (kind) {
      onSave({ ...f, inKind: true, item: f.item.trim(), itemQty: Number(f.itemQty) || 1, estValue: Number(f.estValue) || 0, amount: 0, mode: "વસ્તુ રૂપે", id: f.id || uid() });
    } else {
      const { item, itemQty, estValue, ...rest } = f;
      onSave({ ...rest, inKind: false, amount: Number(f.amount), mode: f.mode === "વસ્તુ રૂપે" ? MODES[0] : f.mode, id: f.id || uid() });
    }
  };
  return (
    <Modal title={isEdit ? "આવક સુધારો" : "આવક ઉમેરો"} onClose={onClose}>
      <Field label="આવકનો પ્રકાર">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {INCOME_TYPES.filter((t) => t !== PASS_TYPE).map((t) => (
            <button type="button" key={t} className={`chip ${f.type === t ? "on" : ""}`} style={{ fontSize: 14 }} onClick={() => setF({ ...f, type: t, inKind: IN_KIND_TYPES.includes(t) ? f.inKind : false })}>{t}</button>
          ))}
        </div>
      </Field>
      <Field label="તહેવાર" error={err.festivalId}>
        <select className="inp" value={f.festivalId} onChange={set("festivalId")}>
          {festivals.map((x) => <option key={x.id} value={x.id}>{x.name} {x.year}</option>)}
        </select>
      </Field>
      <Field label={isFund ? "ઘર નં. / સભ્ય" : "કોની પાસેથી (સભ્ય હોય તો પસંદ કરો)"} error={err.name}>
        <input className="inp" style={{ marginBottom: 6 }} placeholder="ઘર નં. કે નામથી શોધો" value={mq} onChange={(e) => setMq(e.target.value)} autoFocus={!initial} />
        <select className="inp" value={f.memberId || ""} onChange={(e) => pickMember(e.target.value)} size={Math.min(6, shown.length + 1)}>
          <option value="">{isFund ? "-- ઘર પસંદ કરો --" : "બહારની વ્યક્તિ / સંસ્થા (નીચે નામ લખો)"}</option>
          {shown.map((m) => <option key={m.id} value={m.id}>{m.house}  |  {m.name}</option>)}
        </select>
        {f.type === SPONSOR && <div className="hint">સોસાયટીના સભ્ય સ્પોન્સર હોય તો ઘર પસંદ કરો, તેમનો સભ્ય ફાળો "બાકી" યાદીમાંથી નીકળી જશે.</div>}
        {already && <div className="err">આ ઘરનો આ તહેવારનો ફાળો પહેલેથી નોંધાયેલ છે. વધારાનો ફાળો હોય તો જ સાચવો.</div>}
      </Field>
      {!f.memberId && !isFund && (
        <div className="grid2">
          <Field label="નામ / સંસ્થા / દુકાન"><input className="inp" value={f.name} onChange={set("name")} /></Field>
          <Field label="ઘર નં. / સરનામું (વૈકલ્પિક)"><input className="inp" value={f.flat} onChange={set("flat")} /></Field>
        </div>
      )}
      {canKind && (
        <Field label={`${f.type} શેમાં આપ્યું?`}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button type="button" className={`chip ${!kind ? "on" : ""}`} onClick={() => setF({ ...f, inKind: false })}>₹ રોકડ / ઓનલાઈન રકમ</button>
            <button type="button" className={`chip ${kind ? "on" : ""}`} onClick={() => setF({ ...f, inKind: true })}><Gift size={14} style={{ verticalAlign: "-2px" }} /> વસ્તુ રૂપે (મૂર્તિ, ભેટ વગેરે)</button>
          </div>
          {kind && <div className="hint">વસ્તુ રૂપે મળેલું રોકડ આવક કે સિલકમાં ઉમેરાશે નહીં. હિસાબમાં અલગ યાદીમાં દેખાશે.</div>}
        </Field>
      )}
      {kind ? (
        <>
          <Field label="કઈ વસ્તુ આપી" error={err.item}>
            <input className="inp" list="kind-items" value={f.item} onChange={set("item")} placeholder="દા.ત. ગણેશજીની મૂર્તિ" />
            <datalist id="kind-items">{itemSuggestions(festName).map((x) => <option key={x} value={x} />)}</datalist>
          </Field>
          <div className="grid2">
            <Field label="સંખ્યા"><Stepper label="સંખ્યા" value={f.itemQty} onChange={(v) => setF({ ...f, itemQty: v })} /></Field>
            <Field label="અંદાજિત કિંમત ₹ (વૈકલ્પિક)"><input className="inp" type="number" min="0" value={f.estValue} onChange={set("estValue")} /></Field>
          </div>
          <Field label="તારીખ"><input className="inp" type="date" value={f.date} onChange={set("date")} /></Field>
        </>
      ) : (
        <>
          <div className="grid2">
            <Field label="રકમ (₹)" error={err.amount}><input className="inp" type="number" min="0" inputMode="decimal" value={f.amount} onChange={set("amount")} /></Field>
            <Field label="તારીખ"><input className="inp" type="date" value={f.date} onChange={set("date")} /></Field>
          </div>
          <Field label="ચુકવણી રીત"><select className="inp" value={MODES.includes(f.mode) ? f.mode : MODES[0]} onChange={set("mode")}>{MODES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        </>
      )}
      <Field label="નોંધ"><textarea className="inp" rows="2" value={f.note} onChange={set("note")} placeholder="દા.ત. ગરબાના ઇનામ માટે, સ્ટોલ નં. 3" /></Field>
      <div className="actions"><button className="btn sec" onClick={onClose}>રદ કરો</button><button className="btn" onClick={save}>આવક સાચવો</button></div>
    </Modal>
  );
}

function Stepper({ value, onChange, label }) {
  const v = Number(value) || 0;
  return (
    <div className="stepper">
      <button type="button" aria-label={`${label} ઓછા કરો`} onClick={() => onChange(Math.max(0, v - 1))}><Minus size={16} /></button>
      <input className="inp" type="number" min="0" inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value, 10) || 0))} />
      <button type="button" aria-label={`${label} વધારો`} onClick={() => onChange(v + 1)}><Plus size={16} /></button>
    </div>
  );
}

function PassForm({ initial, isEdit, festivals, festMap, members, defaultFest, onSave, onClose }) {
  const defaultRates = (fid, pf) => {
    const r = festMap[fid]?.passRates || {};
    return pf === "outside" ? { rateFull: r.oFull || 0, rateHalf: r.oHalf || 0 } : { rateFull: r.sFull || 0, rateHalf: r.sHalf || 0 };
  };
  const startFest = defaultFest || festivals[0]?.id || "";
  const [f, setF] = useState(initial || {
    type: PASS_TYPE, festivalId: startFest, passFor: "society", memberId: "", flat: "", name: "", phone: "", guestOf: "", guestLabel: "",
    fullQty: 1, halfQty: 0, ...defaultRates(startFest, "society"), date: today(), mode: MODES[0], note: "",
  });
  const [err, setErr] = useState({});
  const [mq, setMq] = useState("");
  const initTotal = initial ? passTotalOf(initial) : 0;
  const initPaid = initial ? Number(initial.amount) || 0 : 0;
  const [pay, setPay] = useState(!initial || initPaid >= initTotal ? "full" : initPaid === 0 ? "pending" : "part");
  const [paidAmt, setPaidAmt] = useState(initial && initPaid > 0 && initPaid < initTotal ? String(initPaid) : "");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const shown = members.filter((m) => !mq || m.house.toLowerCase().includes(mq.toLowerCase()) || m.name.toLowerCase().includes(mq.toLowerCase()));
  const std = defaultRates(f.festivalId, f.passFor);
  const custom = Number(f.rateFull) !== std.rateFull || Number(f.rateHalf) !== std.rateHalf;
  const total = (Number(f.fullQty) || 0) * (Number(f.rateFull) || 0) + (Number(f.halfQty) || 0) * (Number(f.rateHalf) || 0);
  const paid = pay === "full" ? total : pay === "pending" ? 0 : Math.min(total, Number(paidAmt) || 0);
  const due = Math.max(0, total - paid);

  const changeFest = (fid) => setF({ ...f, festivalId: fid, ...defaultRates(fid, f.passFor) });
  const changeFor = (pf) => setF({ ...f, passFor: pf, memberId: "", flat: "", name: "", guestOf: "", guestLabel: "", ...defaultRates(f.festivalId, pf) });
  const pickMember = (id) => {
    const m = members.find((x) => x.id === id);
    setF({ ...f, memberId: id, flat: m ? m.house : "", name: m ? m.name : "", phone: m?.phone || f.phone });
  };
  const pickGuestOf = (id) => {
    const m = members.find((x) => x.id === id);
    setF({ ...f, guestOf: id, guestLabel: m ? `${m.house} ${m.name}` : "" });
  };

  const save = () => {
    const e = {};
    if (!f.festivalId) e.festivalId = "તહેવાર પસંદ કરો";
    if (f.passFor === "society" && !f.memberId) e.name = "યાદીમાંથી ઘર પસંદ કરો";
    if (f.passFor === "outside" && !String(f.name).trim()) e.name = "નામ લખો";
    if (!((Number(f.fullQty) || 0) + (Number(f.halfQty) || 0))) e.qty = "ઓછામાં ઓછો એક પાસ પસંદ કરો";
    if (Number(f.fullQty) > 0 && !(Number(f.rateFull) > 0)) e.rate = "ફુલ પાસનો દર લખો";
    if (Number(f.halfQty) > 0 && !(Number(f.rateHalf) > 0)) e.rate = "હાફ પાસનો દર લખો";
    if (pay === "part" && !(Number(paidAmt) > 0 && Number(paidAmt) < total)) e.paid = `મળેલ રકમ ₹1 થી ${fmt(Math.max(0, total - 1))} વચ્ચે લખો`;
    setErr(e);
    if (Object.keys(e).length) return;
    onSave({
      ...f, type: PASS_TYPE, id: f.id || uid(),
      fullQty: Number(f.fullQty) || 0, halfQty: Number(f.halfQty) || 0,
      rateFull: Number(f.rateFull) || 0, rateHalf: Number(f.rateHalf) || 0,
      amount: paid, passTotal: total, passNo: String(f.passNo || "").trim(),
      mode: paid > 0 ? (MODES.includes(f.mode) ? f.mode : MODES[0]) : "બાકી",
      flat: f.passFor === "society" ? f.flat : "",
    });
  };

  return (
    <Modal title={isEdit ? "ભોજન પાસ સુધારો" : "ભોજન પાસ આપો"} onClose={onClose}>
      <Field label="તહેવાર" error={err.festivalId}>
        <select className="inp" value={f.festivalId} onChange={(e) => changeFest(e.target.value)}>
          {festivals.map((x) => <option key={x.id} value={x.id}>{x.name} {x.year}</option>)}
        </select>
      </Field>
      <Field label="પાસ કોના માટે">
        <div style={{ display: "flex", gap: 6 }}>
          {Object.entries(PASS_FOR).map(([k, v]) => (
            <button type="button" key={k} className={`chip ${f.passFor === k ? "on" : ""}`} onClick={() => changeFor(k)}>{v}</button>
          ))}
        </div>
      </Field>

      {f.passFor === "society" ? (
        <Field label="ઘર નં. / સભ્ય" error={err.name}>
          <input className="inp" style={{ marginBottom: 6 }} placeholder="ઘર નં. કે નામથી શોધો" value={mq} onChange={(e) => setMq(e.target.value)} />
          <select className="inp" value={f.memberId || ""} onChange={(e) => pickMember(e.target.value)} size={Math.min(6, shown.length + 1)}>
            <option value="">-- ઘર પસંદ કરો --</option>
            {shown.map((m) => <option key={m.id} value={m.id}>{m.house}  |  {m.name}</option>)}
          </select>
        </Field>
      ) : (
        <>
          <div className="grid2">
            <Field label="નામ" error={err.name}><input className="inp" value={f.name} onChange={set("name")} /></Field>
            <Field label="મોબાઇલ (વૈકલ્પિક)"><input className="inp" type="tel" value={f.phone || ""} onChange={set("phone")} /></Field>
          </div>
          <Field label="કોના મહેમાન (વૈકલ્પિક)">
            <select className="inp" value={f.guestOf || ""} onChange={(e) => pickGuestOf(e.target.value)}>
              <option value="">-- કોઈ નહીં --</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.house}  |  {m.name}</option>)}
            </select>
          </Field>
        </>
      )}

      <div className="grid2">
        <Field label="ફુલ પાસ (સંખ્યા)"><Stepper label="ફુલ પાસ" value={f.fullQty} onChange={(v) => setF({ ...f, fullQty: v })} /></Field>
        <Field label="ફુલ પાસનો દર (₹)"><input className="inp" type="number" min="0" value={f.rateFull} onChange={set("rateFull")} /></Field>
        <Field label="હાફ પાસ (સંખ્યા)"><Stepper label="હાફ પાસ" value={f.halfQty} onChange={(v) => setF({ ...f, halfQty: v })} /></Field>
        <Field label="હાફ પાસનો દર (₹)"><input className="inp" type="number" min="0" value={f.rateHalf} onChange={set("rateHalf")} /></Field>
      </div>
      <div className="hint" style={{ marginTop: -6, marginBottom: 8 }}>
        {std.rateFull || std.rateHalf
          ? <>નક્કી દર ({PASS_FOR[f.passFor]}): ફુલ {fmt(std.rateFull)} · હાફ {fmt(std.rateHalf)}{custom && <> · <button type="button" className="linkbtn" onClick={() => setF({ ...f, ...std })}>નક્કી દર લગાવો</button></>}</>
          : "આ તહેવારના પાસના દર નક્કી નથી. તહેવારો ટૅબમાં દર સેટ કરો અથવા અહીં હાથથી લખો."}
      </div>
      {(err.qty || err.rate) && <div className="err" style={{ marginBottom: 8 }}>{err.qty || err.rate}</div>}
      <div className="total-box"><span>કુલ રકમ</span><b>{fmt(total)}</b></div>

      <Field label="પેમેન્ટ" error={err.paid}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button type="button" className={`chip ${pay === "full" ? "on" : ""}`} onClick={() => setPay("full")}>પૂરા પૈસા મળ્યા</button>
          <button type="button" className={`chip ${pay === "part" ? "on" : ""}`} onClick={() => setPay("part")}>થોડા પૈસા મળ્યા</button>
          <button type="button" className={`chip ${pay === "pending" ? "on" : ""}`} onClick={() => setPay("pending")}>પૈસા બાકી (પછી આપશે)</button>
        </div>
      </Field>
      {pay === "part" && <Field label="અત્યારે મળેલ રકમ (₹)"><input className="inp" type="number" min="0" value={paidAmt} onChange={(e) => setPaidAmt(e.target.value)} autoFocus /></Field>}
      {due > 0 && <div className="duebox"><span>બાકી પેમેન્ટ</span><span>{fmt(due)}</span></div>}

      <div className="grid2">
        <Field label="તારીખ"><input className="inp" type="date" value={f.date} onChange={set("date")} /></Field>
        <Field label="પાસ નંબર (વૈકલ્પિક)"><input className="inp" value={f.passNo || ""} onChange={set("passNo")} placeholder="દા.ત. 101-103" /></Field>
      </div>
      {paid > 0 && <Field label="ચુકવણી રીત"><select className="inp" value={MODES.includes(f.mode) ? f.mode : MODES[0]} onChange={set("mode")}>{MODES.map((c) => <option key={c}>{c}</option>)}</select></Field>}
      <Field label="નોંધ"><input className="inp" value={f.note} onChange={set("note")} placeholder="દા.ત. રવિવારે પૈસા આપશે" /></Field>
      <div className="actions"><button className="btn sec" onClick={onClose}>રદ કરો</button><button className="btn" onClick={save}>પાસ સાચવો</button></div>
    </Modal>
  );
}

function PassPayModal({ c, onSave, onClose }) {
  const due = passDue(c);
  const [amt, setAmt] = useState(String(due));
  const [date, setDate] = useState(today());
  const [mode, setMode] = useState(MODES[0]);
  const [err, setErr] = useState("");
  const save = () => {
    const a = Number(amt);
    if (!(a > 0)) return setErr("રકમ લખો");
    if (a > due) return setErr(`બાકી રકમ ${fmt(due)} કરતાં વધુ ન હોઈ શકે`);
    onSave({ ...c, amount: (Number(c.amount) || 0) + a, mode, payments: [...(c.payments || []), { amount: a, date, mode }] });
  };
  return (
    <Modal title="ભોજન પાસ – પૈસા મળ્યા" onClose={onClose}>
      <p style={{ marginTop: 0 }}><b>{c.flat ? `${c.flat} · ` : ""}{c.name}</b><br /><span style={{ color: "var(--muted)", fontSize: 14 }}>{passText(c)}</span></p>
      <div className="mini">
        <div><small>કુલ</small><b>{fmt(passTotalOf(c))}</b></div>
        <div><small>મળ્યા</small><b style={{ color: "var(--leaf)" }}>{fmt(c.amount)}</b></div>
        <div><small>બાકી</small><b style={{ color: "var(--kumkum)" }}>{fmt(due)}</b></div>
      </div>
      <Field label="હવે મળેલ રકમ (₹)" error={err}>
        <input className="inp" type="number" min="0" value={amt} onChange={(e) => setAmt(e.target.value)} autoFocus />
      </Field>
      <div className="grid2">
        <Field label="તારીખ"><input className="inp" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="ચુકવણી રીત"><select className="inp" value={mode} onChange={(e) => setMode(e.target.value)}>{MODES.map((m) => <option key={m}>{m}</option>)}</select></Field>
      </div>
      {c.payments?.length > 0 && (
        <div className="hint" style={{ marginBottom: 8 }}>પહેલાંની ચુકવણી: {c.payments.map((p) => `${fmtDate(p.date)} ${fmt(p.amount)} (${p.mode})`).join(" · ")}</div>
      )}
      <div className="actions"><button className="btn sec" onClick={onClose}>રદ કરો</button><button className="btn" onClick={save}><CheckCircle2 size={16} />પેમેન્ટ સાચવો</button></div>
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

function Report({ data, fest, festMap, sortedFests, paidFor, sponsoredBy }) {
  const f = fest === "all" ? null : festMap[fest];
  const exps = data.expenses.filter((e) => !f || e.festivalId === f.id).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const cols = data.collections.filter((c) => !f || c.festivalId === f.id);
  const spent = exps.reduce((s, e) => s + e.amount, 0);
  const collected = cols.reduce((s, c) => s + c.amount, 0);
  const members = [...data.members].sort((a, b) => a.order - b.order);
  const memberIds = new Set(members.map((m) => m.id));
  const others = cols.filter((c) => !isInKind(c) && (incType(c) !== MEMBER_FUND || !c.memberId || !memberIds.has(c.memberId))).sort(byDate);
  const kinds = cols.filter(isInKind).sort(byDate);
  const fundTotal = cols.filter((c) => !others.includes(c)).reduce((s, c) => s + c.amount, 0);
  return (
    <div style={{ width: 794, padding: 36, background: "#fff", color: "#14303A", fontFamily: "'Hind Vadodara',sans-serif", fontSize: 13, lineHeight: 1.5 }}>
      <div style={{ borderBottom: "4px solid #E9A21B", paddingBottom: 10, marginBottom: 14 }}>
        <div style={{ fontFamily: "'Baloo Bhai 2'", fontSize: 30, fontWeight: 800, lineHeight: 1.1 }}>કર્મભૂમિ સોસાયટી, પાટણ</div>
        <div style={{ fontSize: 17 }}>{f ? `${f.name} ${f.year} : આવક અને ખર્ચનો હિસાબ` : "બધા તહેવારોનો હિસાબ"}</div>
        <div style={{ fontSize: 12, color: "#5D7178" }}>રિપોર્ટ તારીખ: {fmtDate(today())}</div>
      </div>
      <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: 16, fontSize: 15 }}>
        <tbody>
          <tr><td style={td}>કુલ આવક</td><td style={{ ...tdR, fontWeight: 700, color: "#2F7D4F" }}>{fmt(collected)}</td>
            <td style={td}>કુલ ખર્ચ</td><td style={{ ...tdR, fontWeight: 700, color: "#B42A2A" }}>{fmt(spent)}</td>
            <td style={td}>બાકી સિલક</td><td style={{ ...tdR, fontWeight: 700 }}>{fmt(collected - spent)}</td></tr>
        </tbody>
      </table>

      {!f && (
        <>
          <div style={{ fontFamily: "'Baloo Bhai 2'", fontSize: 19, fontWeight: 700, margin: "6px 0" }}>તહેવાર મુજબ</div>
          <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: 16 }}>
            <thead><tr><th style={th}>તહેવાર</th><th style={th}>બજેટ</th><th style={th}>આવક</th><th style={th}>ખર્ચ</th><th style={th}>સિલક</th></tr></thead>
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
                const sp = !p && sponsoredBy(f.id, m.id);
                return <tr key={m.id}><td style={td}>{i + 1}</td><td style={td}>{m.house}</td><td style={td}>{m.name}</td>
                  <td style={{ ...tdR, color: p || sp ? "#14303A" : "#B42A2A" }}>{p ? fmt(p) : sp ? "સ્પોન્સર" : "બાકી"}</td></tr>;
              })}
              <tr><td style={{ ...td, fontWeight: 700 }} colSpan={3}>કુલ સભ્ય ફાળો</td><td style={{ ...tdR, fontWeight: 700 }}>{fmt(fundTotal)}</td></tr>
            </tbody>
          </table>
          {(() => {
            const pc = passCounts(cols);
            if (!pc.full && !pc.half) return null;
            return (
              <>
                <div style={{ fontFamily: "'Baloo Bhai 2'", fontSize: 19, fontWeight: 700, margin: "6px 0" }}>ભોજન પાસ સારાંશ</div>
                <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: 16 }}>
                  <thead><tr><th style={th}>કોના માટે</th><th style={th}>ફુલ પાસ</th><th style={th}>હાફ પાસ</th><th style={th}>મળેલ રકમ</th><th style={th}>બાકી</th></tr></thead>
                  <tbody>
                    {["society", "outside"].map((k) => <tr key={k}><td style={td}>{PASS_FOR[k]}</td><td style={tdR}>{pc[k].full}</td><td style={tdR}>{pc[k].half}</td><td style={tdR}>{fmt(pc[k].amount)}</td><td style={{ ...tdR, color: pc[k].due ? "#B42A2A" : undefined }}>{fmt(pc[k].due)}</td></tr>)}
                    <tr><td style={{ ...td, fontWeight: 700 }}>કુલ</td><td style={{ ...tdR, fontWeight: 700 }}>{pc.full}</td><td style={{ ...tdR, fontWeight: 700 }}>{pc.half}</td><td style={{ ...tdR, fontWeight: 700 }}>{fmt(pc.amount)}</td><td style={{ ...tdR, fontWeight: 700, color: pc.due ? "#B42A2A" : undefined }}>{fmt(pc.due)}</td></tr>
                  </tbody>
                </table>
              </>
            );
          })()}
          {others.length > 0 && (
            <>
              <div style={{ fontFamily: "'Baloo Bhai 2'", fontSize: 19, fontWeight: 700, margin: "6px 0" }}>અન્ય આવક</div>
              <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: 16 }}>
                <thead><tr><th style={{ ...th, width: 36 }}>ક્ર.</th><th style={{ ...th, width: 90 }}>તારીખ</th><th style={th}>પ્રકાર</th><th style={th}>નામ / વિગત</th><th style={{ ...th, width: 110 }}>રકમ</th></tr></thead>
                <tbody>
                  {others.map((c, i) => <tr key={c.id}><td style={td}>{i + 1}</td><td style={td}>{fmtDate(c.date)}</td><td style={td}>{incType(c)}</td><td style={td}>{c.name}{c.flat ? ` (${c.flat})` : ""}{noteOf(c) ? ` - ${noteOf(c)}` : ""}</td><td style={tdR}>{fmt(c.amount)}</td></tr>)}
                  <tr><td style={{ ...td, fontWeight: 700 }} colSpan={4}>કુલ અન્ય આવક</td><td style={{ ...tdR, fontWeight: 700 }}>{fmt(collected - fundTotal)}</td></tr>
                </tbody>
              </table>
            </>
          )}
          {kinds.length > 0 && (
            <>
              <div style={{ fontFamily: "'Baloo Bhai 2'", fontSize: 19, fontWeight: 700, margin: "6px 0" }}>વસ્તુ રૂપે સ્પોન્સર / દાન <span style={{ fontSize: 12, fontWeight: 400 }}>(રોકડ હિસાબમાં ગણ્યું નથી)</span></div>
              <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: 16 }}>
                <thead><tr><th style={{ ...th, width: 36 }}>ક્ર.</th><th style={th}>કોના તરફથી</th><th style={th}>વસ્તુ</th><th style={{ ...th, width: 60 }}>સંખ્યા</th><th style={{ ...th, width: 110 }}>અંદાજિત કિંમત</th></tr></thead>
                <tbody>
                  {kinds.map((c, i) => <tr key={c.id}><td style={td}>{i + 1}</td><td style={td}>{c.name}{c.flat ? ` (${c.flat})` : ""} · {incType(c)}</td><td style={td}>{c.item}{c.note ? ` - ${c.note}` : ""}</td><td style={tdR}>{c.itemQty || 1}</td><td style={tdR}>{c.estValue ? fmt(c.estValue) : "-"}</td></tr>)}
                </tbody>
              </table>
            </>
          )}
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
  const [rates, setRates] = useState({ sFull: "", sHalf: "", oFull: "", oHalf: "", ...(initial?.passRates || {}) });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setRate = (k) => (e) => setRates({ ...rates, [k]: e.target.value });
  const presets = ["નવરાત્રી", "દિવાળી", "ગણેશ ચતુર્થી", "ઉત્તરાયણ", "જન્માષ્ટમી", "હોળી", "સ્વાતંત્ર્ય દિન", "પ્રજાસત્તાક દિન", "રામ નવમી", "નવું વર્ષ"];
  const save = () => {
    if (!f.name.trim()) return setErr({ name: "તહેવારનું નામ લખો" });
    const passRates = Object.fromEntries(Object.entries(rates).map(([k, v]) => [k, Number(v) || 0]));
    onSave({ ...f, year: Number(f.year), budget: Number(f.budget) || 0, passRates, id: f.id || uid() });
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
      <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px 2px", marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 6, display: "flex", gap: 6, alignItems: "center" }}><UtensilsCrossed size={16} />ભોજન પાસના દર (એક પાસનો ભાવ)</div>
        <div className="grid2">
          <Field label="સોસાયટી સભ્ય – ફુલ પાસ"><input className="inp" type="number" min="0" value={rates.sFull} onChange={setRate("sFull")} /></Field>
          <Field label="સોસાયટી સભ્ય – હાફ પાસ"><input className="inp" type="number" min="0" value={rates.sHalf} onChange={setRate("sHalf")} /></Field>
          <Field label="બહારના – ફુલ પાસ"><input className="inp" type="number" min="0" value={rates.oFull} onChange={setRate("oFull")} /></Field>
          <Field label="બહારના – હાફ પાસ"><input className="inp" type="number" min="0" value={rates.oHalf} onChange={setRate("oHalf")} /></Field>
        </div>
        <div className="hint" style={{ marginBottom: 8 }}>પાસ વેચતી વખતે દર હાથથી બદલી પણ શકાશે.</div>
      </div>
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

const saveBlob = (blob, name) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
};

// One Excel file with summary, combined ledger, income, expenses and house-wise fund
async function buildExcel(data, festId) {
  const { default: ExcelJS } = await import("exceljs");
  const fests = [...data.festivals].sort(byDate);
  const festMap = Object.fromEntries(fests.map((f) => [f.id, f]));
  const one = festId !== "all" ? festMap[festId] : null;
  const inFest = (x) => !one || x.festivalId === one.id;
  const allInc = data.collections.filter(inFest).sort(byDate);
  const inc = allInc.filter((c) => !isInKind(c)); // cash income only
  const kinds = allInc.filter(isInKind);
  const exp = data.expenses.filter(inFest).sort(byDate);
  const fname = (id) => (festMap[id] ? `${festMap[id].name} ${festMap[id].year}` : "");
  const toDate = (d) => (d ? new Date(d + "T00:00:00") : null);
  const sum = (arr) => arr.reduce((s, x) => s + x.amount, 0);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Karmbhumi Society";
  wb.created = new Date();
  const FONT = "Nirmala UI";
  const RUPEE = '[>=10000000]"₹"##\\,##\\,##\\,##0;[>=100000]"₹"##\\,##\\,##0;"₹"#,##0';
  const HEAD = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F5E6B" } };
  const TOT = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDF1D6" } };
  const title = one ? `${one.name} ${one.year}` : "બધા તહેવાર";

  const sheet = (name, cols, rows, { totals = [], note } = {}) => {
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 3 }] });
    ws.columns = cols.map((c) => ({ key: c.key, width: c.width || 14 }));
    ws.mergeCells(1, 1, 1, cols.length);
    ws.getCell(1, 1).value = `કર્મભૂમિ સોસાયટી, પાટણ – ${title}`;
    ws.getCell(1, 1).font = { name: FONT, size: 14, bold: true, color: { argb: "FF14303A" } };
    ws.mergeCells(2, 1, 2, cols.length);
    ws.getCell(2, 1).value = note || `${name} · રિપોર્ટ તારીખ ${new Date().toLocaleDateString("en-IN")}`;
    ws.getCell(2, 1).font = { name: FONT, size: 10, color: { argb: "FF5D7178" } };
    const head = ws.getRow(3);
    cols.forEach((c, i) => {
      const cell = head.getCell(i + 1);
      cell.value = c.header;
      cell.font = { name: FONT, bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = HEAD;
      cell.alignment = { vertical: "middle", horizontal: c.money ? "right" : "left" };
    });
    head.height = 22;
    rows.forEach((r) => {
      const row = ws.addRow(r);
      row.font = { name: FONT };
      if (r.__style === "total") row.eachCell((cell) => { cell.fill = TOT; cell.font = { name: FONT, bold: true }; });
      if (r.__style === "pending") row.getCell(cols.findIndex((c) => c.key === "amount") + 1).font = { name: FONT, color: { argb: "FFB42A2A" } };
    });
    cols.forEach((c, i) => {
      const col = ws.getColumn(i + 1);
      if (c.money) col.numFmt = RUPEE;
      if (c.date) col.numFmt = "dd-mm-yyyy";
    });
    if (rows.length && !rows.some((r) => r.__style === "total")) {
      ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3 + rows.length, column: cols.length } };
    }
    if (totals.length && rows.length) {
      const last = 3 + rows.length;
      const row = ws.addRow({ [cols[0].key]: "કુલ" });
      totals.forEach((key) => {
        const idx = cols.findIndex((c) => c.key === key) + 1;
        const letter = ws.getColumn(idx).letter;
        row.getCell(idx).value = { formula: `SUBTOTAL(9,${letter}4:${letter}${last})`, result: rows.reduce((s, r) => s + (Number(r[key]) || 0), 0) };
      });
      row.eachCell({ includeEmpty: true }, (cell) => { cell.fill = TOT; cell.font = { name: FONT, bold: true }; });
    }
    ws.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    return ws;
  };

  // 0. Full statement: every income with name, every expense with name, grouped with subtotals
  {
    const ws = wb.addWorksheet("પૂરો હિસાબ", { views: [{ state: "frozen", ySplit: 2 }] });
    const keys = one ? ["no", "date", "name", "sub", "by", "mode", "note", "amount"] : ["no", "date", "fest", "name", "sub", "by", "mode", "note", "amount"];
    const widths = { no: 6, date: 12, fest: 18, name: 34, sub: 22, by: 18, mode: 13, note: 26, amount: 14 };
    ws.columns = keys.map((k) => ({ key: k, width: widths[k] }));
    const N = keys.length;
    const amtCol = N;
    const amtLetter = ws.getColumn(amtCol).letter;
    const thin = { style: "thin", color: { argb: "FFC9D6D3" } };
    const border = { top: thin, left: thin, bottom: thin, right: thin };
    const fill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
    const styleRow = (row, { bold, color, bg, size } = {}) => {
      for (let i = 1; i <= N; i++) {
        const c = row.getCell(i);
        c.font = { name: FONT, bold: !!bold, size: size || 11, color: color ? { argb: color } : undefined };
        if (bg) c.fill = fill(bg);
        c.border = border;
        c.alignment = { vertical: "top", wrapText: true, horizontal: i === amtCol ? "right" : "left" };
      }
    };
    const mergedRow = (text, amount, opts) => {
      const row = ws.addRow([]);
      row.getCell(1).value = text;
      ws.mergeCells(row.number, 1, row.number, N - 1);
      if (amount !== undefined) row.getCell(amtCol).value = amount;
      styleRow(row, opts);
      return row;
    };

    ws.mergeCells(1, 1, 1, N);
    ws.getCell(1, 1).value = `કર્મભૂમિ સોસાયટી, પાટણ – ${title} : આવક અને ખર્ચનો પૂરો હિસાબ`;
    ws.getCell(1, 1).font = { name: FONT, size: 15, bold: true, color: { argb: "FF14303A" } };
    ws.getRow(1).height = 26;
    ws.mergeCells(2, 1, 2, N);
    ws.getCell(2, 1).value = `રિપોર્ટ તારીખ: ${new Date().toLocaleDateString("en-IN")}  ·  આવક ${inc.length} એન્ટ્રી  ·  ખર્ચ ${exp.length} એન્ટ્રી`;
    ws.getCell(2, 1).font = { name: FONT, size: 10, color: { argb: "FF5D7178" } };

    const section = ({ label, color, light, headers, groups, toRow, totalLabel, amountOf = (x) => x.amount }) => {
      ws.addRow([]);
      mergedRow(label, "", { bold: true, color: "FFFFFFFF", bg: color, size: 13 });
      const h = ws.addRow(keys.map((k) => headers[k] ?? ""));
      styleRow(h, { bold: true, bg: light });
      if (!groups.length) {
        mergedRow("કોઈ એન્ટ્રી નથી", 0, {});
        return { ref: null, value: 0 };
      }
      const subRefs = [];
      let n = 0, total = 0;
      groups.forEach((g) => {
        mergedRow(`${g.t}  (${g.items.length})`, undefined, { bold: true, bg: "FFF3F6F5" });
        const first = ws.rowCount + 1;
        g.items.forEach((x) => {
          n += 1;
          const row = ws.addRow({ ...toRow(x), no: n });
          styleRow(row);
          row.getCell("date").numFmt = "dd-mm-yyyy";
          row.getCell(amtCol).numFmt = RUPEE;
        });
        const last = ws.rowCount;
        const v = g.items.reduce((a, x) => a + (Number(amountOf(x)) || 0), 0);
        total += v;
        const sr = mergedRow(`${g.t} – કુલ`, { formula: `SUM(${amtLetter}${first}:${amtLetter}${last})`, result: v }, { bold: true });
        sr.getCell(amtCol).numFmt = RUPEE;
        sr.getCell(1).alignment = { horizontal: "right" };
        subRefs.push(`${amtLetter}${sr.number}`);
      });
      const tr = mergedRow(totalLabel, { formula: subRefs.join("+"), result: total }, { bold: true, bg: light, size: 12 });
      tr.getCell(amtCol).numFmt = RUPEE;
      tr.getCell(1).alignment = { horizontal: "right" };
      return { ref: `${amtLetter}${tr.number}`, value: total };
    };

    const incRes = section({
      label: "આવક (જમા) – નામ સાથે પૂરી યાદી",
      color: "FF2F7D4F", light: "FFE3F1E8",
      headers: { no: "ક્ર.", date: "તારીખ", fest: "તહેવાર", name: "નામ", sub: "ઘર નં. / સરનામું", by: "", mode: "ચુકવણી રીત", note: "નોંધ", amount: "રકમ" },
      groups: INCOME_TYPES.map((t) => ({ t, items: inc.filter((c) => incType(c) === t) })).filter((g) => g.items.length),
      toRow: (c) => ({ date: toDate(c.date), fest: fname(c.festivalId), name: c.name || "-", sub: c.flat || c.phone || "", by: "", mode: c.mode, note: noteOf(c), amount: c.amount }),
      totalLabel: "કુલ આવક",
    });
    const expRes = section({
      label: "ખર્ચ (ઉધાર) – વિગત અને નામ સાથે પૂરી યાદી",
      color: "FFB42A2A", light: "FFFBE9E9",
      headers: { no: "ક્ર.", date: "તારીખ", fest: "તહેવાર", name: "ખર્ચની વિગત", sub: "કોને ચૂકવ્યા (વેપારી / વ્યક્તિ)", by: "કોણે ચૂકવ્યા", mode: "ચુકવણી રીત", note: "નોંધ", amount: "રકમ" },
      groups: CATEGORIES.map((t) => ({ t, items: exp.filter((e) => e.category === t) })).filter((g) => g.items.length),
      toRow: (e) => ({ date: toDate(e.date), fest: fname(e.festivalId), name: e.title, sub: e.vendor || "-", by: e.paidBy || "-", mode: e.mode, note: e.note || "", amount: e.amount }),
      totalLabel: "કુલ ખર્ચ",
    });

    ws.addRow([]);
    const bal = incRes.value - expRes.value;
    const finals = [
      ["કુલ આવક", incRes.ref ? { formula: incRes.ref, result: incRes.value } : 0, "FFE3F1E8"],
      ["કુલ ખર્ચ", expRes.ref ? { formula: expRes.ref, result: expRes.value } : 0, "FFFBE9E9"],
      [bal < 0 ? "બાકી સિલક (ખર્ચ વધુ)" : "બાકી સિલક", { formula: `${incRes.ref || 0}-${expRes.ref || 0}`, result: bal }, "FFFDF1D6"],
    ];
    finals.forEach(([label, val, bg]) => {
      const r = mergedRow(label, val, { bold: true, bg, size: 13 });
      r.getCell(1).alignment = { horizontal: "right" };
      r.getCell(amtCol).numFmt = RUPEE;
      if (label.startsWith("બાકી") && bal < 0) r.getCell(amtCol).font = { name: FONT, bold: true, size: 13, color: { argb: "FFB42A2A" } };
    });
    const passDueTotal = inc.reduce((a, c) => a + passDue(c), 0);
    if (passDueTotal) {
      const r = mergedRow("ભોજન પાસના બાકી પૈસા – હજુ આવવાના (ઉપરની આવક / સિલકમાં નથી)", passDueTotal, { bold: true, color: "FFB42A2A" });
      r.getCell(1).alignment = { horizontal: "right" };
      r.getCell(amtCol).numFmt = RUPEE;
    }

    if (kinds.length) {
      section({
        label: "વસ્તુ રૂપે સ્પોન્સર / દાન – રોકડ આવક કે સિલકમાં ગણ્યું નથી",
        color: "FF8A5A00", light: "FFFDF1D6",
        headers: { no: "ક્ર.", date: "તારીખ", fest: "તહેવાર", name: "વસ્તુ", sub: "કોના તરફથી", by: "સંખ્યા", mode: "", note: "નોંધ", amount: "અંદાજિત કિંમત" },
        groups: IN_KIND_TYPES.map((t) => ({ t, items: kinds.filter((c) => incType(c) === t) })).filter((g) => g.items.length),
        toRow: (c) => ({ date: toDate(c.date), fest: fname(c.festivalId), name: c.item, sub: `${c.name}${c.flat ? ` (${c.flat})` : ""}`, by: c.itemQty || 1, mode: "", note: c.note || "", amount: Number(c.estValue) || null }),
        amountOf: (c) => c.estValue,
        totalLabel: "અંદાજિત કુલ કિંમત (ફક્ત માહિતી માટે)",
      });
    }
    ws.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:2" };
  }

  // 1. Summary
  const sumRows = (one ? [one] : fests).map((f) => {
    const i = sum(data.collections.filter((c) => c.festivalId === f.id));
    const e = sum(data.expenses.filter((c) => c.festivalId === f.id));
    return { fest: `${f.name} ${f.year}`, date: toDate(f.date), budget: f.budget || 0, income: i, expense: e, balance: i - e };
  });
  const ws1 = sheet("સારાંશ", [
    { key: "fest", header: "તહેવાર", width: 26 },
    { key: "date", header: "તારીખ", width: 13, date: true },
    { key: "budget", header: "બજેટ", width: 14, money: true },
    { key: "income", header: "કુલ આવક", width: 14, money: true },
    { key: "expense", header: "કુલ ખર્ચ", width: 14, money: true },
    { key: "balance", header: "સિલક", width: 14, money: true },
  ], sumRows, { totals: ["budget", "income", "expense", "balance"] });

  // income-type and expense-category breakdown below the summary
  const addBreakdown = (label, groups) => {
    ws1.addRow([]);
    const h = ws1.addRow([label, "", "", "રકમ"]);
    h.eachCell((c) => { c.fill = HEAD; c.font = { name: FONT, bold: true, color: { argb: "FFFFFFFF" } }; });
    groups.forEach(([k, v]) => { const r = ws1.addRow([k, "", "", v]); r.font = { name: FONT }; });
  };
  addBreakdown("આવક – પ્રકાર મુજબ", INCOME_TYPES.map((t) => [t, sum(inc.filter((c) => incType(c) === t))]).filter(([, v]) => v));
  addBreakdown("ખર્ચ – પ્રકાર મુજબ", CATEGORIES.map((t) => [t, sum(exp.filter((c) => c.category === t))]).filter(([, v]) => v));

  // 2. Combined ledger (income + expense together, running balance)
  const ledger = [
    ...inc.map((c) => ({ d: c.date, o: 0, row: { date: toDate(c.date), fest: fname(c.festivalId), kind: "આવક", label: incType(c), name: c.name, party: c.flat ? `ઘર ${c.flat}` : "", house: "", mode: c.mode, income: c.amount, expense: null, note: noteOf(c) } })),
    ...exp.map((e) => ({ d: e.date, o: 1, row: { date: toDate(e.date), fest: fname(e.festivalId), kind: "ખર્ચ", label: e.category, name: e.title, party: e.vendor || "", house: e.paidBy || "", mode: e.mode, income: null, expense: e.amount, note: e.note || "" } })),
  ].sort((a, b) => (a.d || "").localeCompare(b.d || "") || a.o - b.o);
  let bal = 0;
  const ledgerRows = ledger.map(({ row }) => { bal += (row.income || 0) - (row.expense || 0); return { ...row, balance: bal }; });
  const ws2 = sheet("આવક-ખર્ચ સાથે", [
    { key: "date", header: "તારીખ", width: 12, date: true },
    ...(one ? [] : [{ key: "fest", header: "તહેવાર", width: 20 }]),
    { key: "kind", header: "આવક / ખર્ચ", width: 11 },
    { key: "label", header: "પ્રકાર", width: 18 },
    { key: "name", header: "આવક: આપનારનું નામ / ખર્ચ: વિગત", width: 34 },
    { key: "party", header: "ઘર નં. / કોને ચૂકવ્યા", width: 22 },
    { key: "house", header: "કોણે ચૂકવ્યા", width: 16 },
    { key: "mode", header: "ચુકવણી રીત", width: 13 },
    { key: "income", header: "આવક", width: 13, money: true },
    { key: "expense", header: "ખર્ચ", width: 13, money: true },
    { key: "balance", header: "સિલક", width: 13, money: true },
    { key: "note", header: "નોંધ", width: 26 },
  ], ledgerRows, { totals: ["income", "expense"], note: "બધી આવક અને ખર્ચ તારીખ મુજબ, ચાલુ સિલક સાથે" });
  ws2.eachRow((row, n) => {
    if (n < 4) return;
    const k = row.getCell("kind").value;
    if (k === "આવક") row.getCell("kind").font = { name: FONT, bold: true, color: { argb: "FF2F7D4F" } };
    if (k === "ખર્ચ") row.getCell("kind").font = { name: FONT, bold: true, color: { argb: "FFB42A2A" } };
  });

  // 3. Income detail
  sheet("આવક", [
    { key: "date", header: "તારીખ", width: 12, date: true },
    ...(one ? [] : [{ key: "fest", header: "તહેવાર", width: 20 }]),
    { key: "type", header: "આવકનો પ્રકાર", width: 18 },
    { key: "house", header: "ઘર નં.", width: 10 },
    { key: "name", header: "આપનારનું નામ", width: 36 },
    { key: "mode", header: "ચુકવણી રીત", width: 13 },
    { key: "amount", header: "રકમ", width: 13, money: true },
    { key: "note", header: "નોંધ", width: 28 },
  ], inc.map((c) => ({ date: toDate(c.date), fest: fname(c.festivalId), type: incType(c), house: c.flat || "", name: c.name, mode: c.mode, amount: c.amount, note: noteOf(c) })), { totals: ["amount"] });

  // Items given instead of cash
  if (kinds.length) {
    sheet("વસ્તુ રૂપે", [
      { key: "date", header: "તારીખ", width: 12, date: true },
      ...(one ? [] : [{ key: "fest", header: "તહેવાર", width: 20 }]),
      { key: "type", header: "પ્રકાર", width: 12 },
      { key: "name", header: "કોના તરફથી", width: 32 },
      { key: "house", header: "ઘર નં.", width: 10 },
      { key: "item", header: "વસ્તુ", width: 30 },
      { key: "qty", header: "સંખ્યા", width: 9 },
      { key: "est", header: "અંદાજિત કિંમત", width: 15, money: true },
      { key: "note", header: "નોંધ", width: 26 },
    ], kinds.map((c) => ({ date: toDate(c.date), fest: fname(c.festivalId), type: incType(c), name: c.name, house: c.flat || "", item: c.item, qty: c.itemQty || 1, est: Number(c.estValue) || null, note: c.note || "" })),
    { totals: ["qty", "est"], note: "વસ્તુ રૂપે મળેલ સ્પોન્સર / દાન – રોકડ આવક કે સિલકમાં ગણ્યું નથી" });
  }

  // Meal passes
  const passes = inc.filter((c) => incType(c) === PASS_TYPE);
  if (passes.length) {
    const pc = passCounts(passes);
    sheet("ભોજન પાસ", [
      { key: "date", header: "તારીખ", width: 12, date: true },
      ...(one ? [] : [{ key: "fest", header: "તહેવાર", width: 20 }]),
      { key: "for", header: "કોના માટે", width: 15 },
      { key: "name", header: "નામ", width: 32 },
      { key: "house", header: "ઘર નં. / મોબાઇલ", width: 16 },
      { key: "guest", header: "કોના મહેમાન", width: 26 },
      { key: "fullQty", header: "ફુલ પાસ", width: 10 },
      { key: "rateFull", header: "ફુલ દર", width: 11, money: true },
      { key: "halfQty", header: "હાફ પાસ", width: 10 },
      { key: "rateHalf", header: "હાફ દર", width: 11, money: true },
      { key: "total", header: "કુલ રકમ", width: 13, money: true },
      { key: "amount", header: "મળેલ રકમ", width: 13, money: true },
      { key: "due", header: "બાકી", width: 12, money: true },
      { key: "status", header: "પેમેન્ટ", width: 12 },
      { key: "passNo", header: "પાસ નં.", width: 12 },
      { key: "mode", header: "ચુકવણી રીત", width: 13 },
      { key: "note", header: "નોંધ", width: 22 },
    ], passes.map((c) => ({
      date: toDate(c.date), fest: fname(c.festivalId), for: PASS_FOR[c.passFor] || "", name: c.name,
      house: c.flat || c.phone || "", guest: c.guestLabel || "",
      fullQty: c.fullQty || 0, rateFull: c.fullQty ? c.rateFull : null, halfQty: c.halfQty || 0, rateHalf: c.halfQty ? c.rateHalf : null,
      total: passTotalOf(c), amount: c.amount, due: passDue(c) || null,
      status: !passDue(c) ? "પૂરું" : c.amount ? "થોડું બાકી" : "બાકી",
      passNo: c.passNo || "", mode: c.amount ? c.mode : "", note: c.note || "",
    })), {
      totals: ["fullQty", "halfQty", "total", "amount", "due"],
      note: `સોસાયટી: ફુલ ${pc.society.full}, હાફ ${pc.society.half}  ·  બહારના: ફુલ ${pc.outside.full}, હાફ ${pc.outside.half}  ·  કુલ ${pc.full + pc.half} પાસ  ·  બાકી પેમેન્ટ ${fmt(pc.due)} (${pc.dueCount} એન્ટ્રી)`,
    });
  }

  if (wb.getWorksheet("ભોજન પાસ")) {
    const wsP = wb.getWorksheet("ભોજન પાસ");
    wsP.eachRow((row, n) => {
      if (n < 4) return;
      const st = row.getCell("status").value;
      if (st === "બાકી" || st === "થોડું બાકી") {
        row.getCell("status").font = { name: FONT, bold: true, color: { argb: "FFB42A2A" } };
        row.getCell("due").font = { name: FONT, bold: true, color: { argb: "FFB42A2A" } };
      }
    });
  }

  // 4. Expense detail
  sheet("ખર્ચ", [
    { key: "date", header: "તારીખ", width: 12, date: true },
    ...(one ? [] : [{ key: "fest", header: "તહેવાર", width: 20 }]),
    { key: "category", header: "ખર્ચનો પ્રકાર", width: 18 },
    { key: "title", header: "ખર્ચની વિગત", width: 34 },
    { key: "vendor", header: "કોને ચૂકવ્યા (વેપારી / વ્યક્તિ)", width: 26 },
    { key: "paidBy", header: "કોણે ચૂકવ્યા", width: 16 },
    { key: "mode", header: "ચુકવણી રીત", width: 13 },
    { key: "amount", header: "રકમ", width: 13, money: true },
    { key: "note", header: "નોંધ", width: 26 },
  ], exp.map((e) => ({ date: toDate(e.date), fest: fname(e.festivalId), category: e.category, title: e.title, vendor: e.vendor || "", paidBy: e.paidBy || "", mode: e.mode, amount: e.amount, note: e.note || "" })), { totals: ["amount"] });

  // 5. House-wise member fund (single festival only)
  if (one) {
    const members = [...data.members].sort((a, b) => a.order - b.order);
    const rows = members.map((m, i) => {
      const paid = sum(inc.filter((c) => c.memberId === m.id && incType(c) === MEMBER_FUND));
      const sponsor = allInc.some((c) => c.memberId === m.id && incType(c) === SPONSOR);
      return paid || sponsor
        ? { no: i + 1, house: m.house, name: m.name, amount: paid || null, status: paid ? "મળ્યો" : "સ્પોન્સર" }
        : { no: i + 1, house: m.house, name: m.name, amount: null, status: "બાકી", __style: "pending" };
    });
    const ws5 = sheet("ઘર મુજબ ફાળો", [
      { key: "no", header: "ક્ર.", width: 6 },
      { key: "house", header: "ઘર નં.", width: 10 },
      { key: "name", header: "સભ્યનું નામ", width: 42 },
      { key: "amount", header: "ફાળો", width: 13, money: true },
      { key: "status", header: "સ્થિતિ", width: 10 },
    ], rows, { totals: ["amount"], note: `ફાળો આપનાર / સ્પોન્સર ઘર: ${rows.filter((r) => r.status !== "બાકી").length} / ${rows.length}` });
    ws5.eachRow((row, n) => { if (n > 3 && row.getCell("status").value === "બાકી") row.getCell("status").font = { name: FONT, bold: true, color: { argb: "FFB42A2A" } }; });
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

// Detailed view of one festival: every income with name and every expense with label
function FestivalView({ f, data, members, covered, busy, onExcel, onPdf, onClose }) {
  const allInc = data.collections.filter((c) => c.festivalId === f.id).sort(byDate);
  const inc = allInc.filter((c) => !isInKind(c));
  const kinds = allInc.filter(isInKind);
  const exp = data.expenses.filter((e) => e.festivalId === f.id).sort(byDate);
  const tIn = inc.reduce((s, c) => s + c.amount, 0);
  const tEx = exp.reduce((s, e) => s + e.amount, 0);
  const incGroups = INCOME_TYPES.map((t) => ({ t, items: inc.filter((c) => incType(c) === t) })).filter((g) => g.items.length);
  const expGroups = CATEGORIES.map((t) => ({ t, items: exp.filter((e) => e.category === t) })).filter((g) => g.items.length);
  const pending = members.filter((m) => !covered(f.id, m.id));
  const pc = passCounts(inc);
  const sub = (items) => fmt(items.reduce((s, x) => s + x.amount, 0));
  return (
    <Modal wide title={`${f.name} ${f.year}`} onClose={onClose}>
      <div className="mini">
        <div><small>કુલ આવક</small><b style={{ color: "var(--leaf)" }}>{fmt(tIn)}</b></div>
        <div><small>કુલ ખર્ચ</small><b style={{ color: "var(--kumkum)" }}>{fmt(tEx)}</b></div>
        <div><small>બાકી સિલક</small><b style={{ color: tIn - tEx < 0 ? "var(--kumkum)" : undefined }}>{fmt(tIn - tEx)}</b></div>
        <div><small>બજેટ</small><b>{fmt(f.budget)}</b></div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <button className="btn" disabled={busy} onClick={onExcel}><FileSpreadsheet size={16} />{busy ? "બની રહી છે…" : "Excel ડાઉનલોડ"}</button>
        <button className="btn sec" onClick={onPdf}><FileText size={16} />PDF / WhatsApp</button>
        {f.date && <span style={{ alignSelf: "center", color: "var(--muted)", fontSize: 14 }}>તારીખ: {fmtDate(f.date)}{f.note && ` · ${f.note}`}</span>}
      </div>

      <div className="sec-h"><span>આવક ({inc.length})</span><span style={{ color: "var(--leaf)" }}>{fmt(tIn)}</span></div>
      {inc.length === 0 ? <p style={{ color: "var(--muted)" }}>હજુ કોઈ આવક નોંધાઈ નથી.</p> : (
        <div className="vt-wrap"><table className="vt">
          <thead><tr><th>તારીખ</th><th>ઘર નં.</th><th>નામ</th><th>ચુકવણી</th><th>નોંધ</th><th className="r">રકમ</th></tr></thead>
          <tbody>
            {incGroups.map((g) => (
              <FragmentRows key={g.t}>
                <tr className="grp"><td colSpan={5}>{g.t} ({g.items.length}){g.t === PASS_TYPE && <span style={{ fontWeight: 400, fontSize: 13, color: "var(--muted)" }}> – વિગત નીચે "ભોજન પાસ" વિભાગમાં</span>}</td><td className="r">{sub(g.items)}</td></tr>
                {g.t !== PASS_TYPE && g.items.map((c) => <tr key={c.id}><td>{fmtDate(c.date)}</td><td>{c.flat || "-"}</td><td>{c.name}</td><td>{c.mode}</td><td>{noteOf(c)}</td><td className="r">{fmt(c.amount)}</td></tr>)}
              </FragmentRows>
            ))}
            <tr className="tot"><td colSpan={5}>કુલ આવક</td><td className="r">{fmt(tIn)}</td></tr>
          </tbody>
        </table></div>
      )}

      {(pc.full > 0 || pc.half > 0) && (
        <>
          <div className="sec-h"><span>ભોજન પાસ</span><span>{pc.full} ફુલ + {pc.half} હાફ</span></div>
          <div className="mini">
            <div><small>સોસાયટી – ફુલ / હાફ</small><b>{pc.society.full} / {pc.society.half}</b></div>
            <div><small>બહારના – ફુલ / હાફ</small><b>{pc.outside.full} / {pc.outside.half}</b></div>
            <div><small>કુલ પાસ</small><b>{pc.full + pc.half}</b></div>
            <div><small>પાસની આવક (મળેલ)</small><b style={{ color: "var(--leaf)" }}>{fmt(pc.amount)}</b></div>
            {pc.due > 0 && <div><small>પાસના બાકી પૈસા</small><b style={{ color: "var(--kumkum)" }}>{fmt(pc.due)}</b></div>}
          </div>
          {pc.due > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
              {allInc.filter((c) => passDue(c) > 0).map((c) => <span key={c.id} className="tag" style={{ background: "#FBE9E9", color: "var(--kumkum)", fontSize: 13 }}>{c.flat ? `${c.flat} · ` : ""}{c.name} · બાકી {fmt(passDue(c))}</span>)}
            </div>
          )}
        </>
      )}

      {kinds.length > 0 && (
        <>
          <div className="sec-h"><span>વસ્તુ રૂપે સ્પોન્સર / દાન ({kinds.length})</span><span style={{ fontSize: 13, fontWeight: 400, color: "var(--muted)" }}>રોકડ હિસાબમાં ગણ્યું નથી</span></div>
          <div className="vt-wrap"><table className="vt">
            <thead><tr><th>તારીખ</th><th>કોના તરફથી</th><th>પ્રકાર</th><th>વસ્તુ</th><th className="r">સંખ્યા</th><th className="r">અંદાજિત કિંમત</th></tr></thead>
            <tbody>
              {kinds.map((c) => <tr key={c.id}><td>{fmtDate(c.date)}</td><td>{c.name}{c.flat ? ` (${c.flat})` : ""}</td><td>{incType(c)}</td><td>{c.item}{c.note && <div style={{ fontSize: 12, color: "var(--muted)" }}>{c.note}</div>}</td><td className="r">{c.itemQty || 1}</td><td className="r">{c.estValue ? fmt(c.estValue) : "-"}</td></tr>)}
            </tbody>
          </table></div>
        </>
      )}

      <div className="sec-h"><span>ખર્ચ ({exp.length})</span><span style={{ color: "var(--kumkum)" }}>{fmt(tEx)}</span></div>
      {exp.length === 0 ? <p style={{ color: "var(--muted)" }}>હજુ કોઈ ખર્ચ નોંધાયો નથી.</p> : (
        <div className="vt-wrap"><table className="vt">
          <thead><tr><th>તારીખ</th><th>વિગત</th><th>વેપારી</th><th>ચૂકવનાર</th><th>ચુકવણી</th><th className="r">રકમ</th></tr></thead>
          <tbody>
            {expGroups.map((g) => (
              <FragmentRows key={g.t}>
                <tr className="grp"><td colSpan={5}>{g.t} ({g.items.length})</td><td className="r">{sub(g.items)}</td></tr>
                {g.items.map((e) => <tr key={e.id}><td>{fmtDate(e.date)}</td><td>{e.title}{e.note && <div style={{ fontSize: 12, color: "var(--muted)" }}>{e.note}</div>}</td><td>{e.vendor || "-"}</td><td>{e.paidBy || "-"}</td><td>{e.mode}</td><td className="r">{fmt(e.amount)}</td></tr>)}
              </FragmentRows>
            ))}
            <tr className="tot"><td colSpan={5}>કુલ ખર્ચ</td><td className="r">{fmt(tEx)}</td></tr>
          </tbody>
        </table></div>
      )}

      <div className="sec-h"><span>સભ્ય ફાળો બાકી</span><span>{pending.length} / {members.length} ઘર</span></div>
      {pending.length === 0 ? <p style={{ color: "var(--leaf)" }}>બધા ઘરનો ફાળો આવી ગયો છે.</p> : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {pending.map((m) => <span key={m.id} className="tag" style={{ background: "#FBE9E9", color: "var(--kumkum)", fontSize: 13 }} title={m.name}>{m.house} · {m.name}</span>)}
        </div>
      )}
    </Modal>
  );
}
const FragmentRows = ({ children }) => <>{children}</>;


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
  const paidFor = (festId, memberId) => data.collections.filter((c) => c.festivalId === festId && c.memberId === memberId && incType(c) === MEMBER_FUND).reduce((s, c) => s + c.amount, 0);
  const inFest = (x) => fest === "all" || x.festivalId === fest;

  const exps = data.expenses.filter(inFest);
  const cols = data.collections.filter(inFest);
  const spent = exps.reduce((s, x) => s + x.amount, 0);
  const collected = cols.reduce((s, x) => s + x.amount, 0);
  const budget = fest === "all" ? data.festivals.reduce((s, f) => s + (f.budget || 0), 0) : festMap[fest]?.budget || 0;

  const sponsoredBy = (festId, memberId) => data.collections.some((c) => c.festivalId === festId && c.memberId === memberId && incType(c) === SPONSOR);
  const covered = (festId, memberId) => paidFor(festId, memberId) > 0 || sponsoredBy(festId, memberId);
  const pending = fest === "all" ? [] : sortedMembers.filter((m) => !covered(fest, m.id));
  const festTitle = fest === "all" ? "બધા તહેવાર" : `${festMap[fest]?.name} ${festMap[fest]?.year}`;

  const summary = [
    "*કર્મભૂમિ સોસાયટી, પાટણ*",
    `*${festTitle} : હિસાબ*`,
    "",
    `કુલ આવક: ${fmt(collected)}`,
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

  const [incFilter, setIncFilter] = useState("all");
  const [passFilter, setPassFilter] = useState("all");
  const [passPay, setPassPay] = useState("all");
  const downloadExcel = async (festId = fest) => {
    setBusy(true);
    try {
      const f = festMap[festId];
      const name = f ? `Karmbhumi-${f.year}-${festId}` : "Karmbhumi-Hisab";
      saveBlob(await buildExcel(data, festId), `${name}-${today()}.xlsx`);
      setToast("Excel ડાઉનલોડ થઈ ગઈ");
    } catch (e) {
      console.error(e);
      setToast("Excel બની શકી નહીં, ફરી પ્રયાસ કરો");
    }
    setBusy(false);
  };
  const reminderLink = (c) => {
    const m = data.members.find((x) => x.id === c.memberId);
    const digits = String(m?.phone || c.phone || "").replace(/\D/g, "");
    const num = digits.length === 10 ? "91" + digits : digits;
    const f = festMap[c.festivalId];
    const text = [
      "*કર્મભૂમિ સોસાયટી, પાટણ*",
      "*ભોજન પાસ – બાકી રકમની યાદી*",
      "",
      `નામ: ${c.name}${c.flat ? ` (ઘર ${c.flat})` : ""}`,
      f ? `તહેવાર: ${f.name} ${f.year}` : null,
      `પાસ: ${[c.fullQty ? `ફુલ ${c.fullQty}` : null, c.halfQty ? `હાફ ${c.halfQty}` : null].filter(Boolean).join(" + ")}${c.passNo ? ` (પાસ નં. ${c.passNo})` : ""}`,
      `કુલ રકમ: ${fmt(passTotalOf(c))}`,
      c.amount ? `મળેલ: ${fmt(c.amount)}` : null,
      `*બાકી રકમ: ${fmt(passDue(c))}*`,
      "",
      "કૃપા કરીને બાકી રકમ જમા કરાવશો. આભાર 🙏",
    ].filter((x) => x !== null).join("\n");
    return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
  };
  const receiptLink = (c) => {
    const m = data.members.find((x) => x.id === c.memberId);
    const digits = String(m?.phone || c.phone || "").replace(/\D/g, "");
    const num = digits.length === 10 ? "91" + digits : digits;
    const text = [
      "*કર્મભૂમિ સોસાયટી, પાટણ*",
      "*આવકની પહોંચ*",
      "",
      `નામ: ${c.name}${c.flat ? ` (ઘર ${c.flat})` : ""}`,
      `તહેવાર: ${festMap[c.festivalId] ? `${festMap[c.festivalId].name} ${festMap[c.festivalId].year}` : ""}`,
      `પ્રકાર: ${incType(c)}`,
      passText(c) ? `પાસ: ${passText(c)}` : null,
      isInKind(c) ? kindText(c) : `રકમ: ${fmt(c.amount)}`,
      isInKind(c) ? `તારીખ: ${fmtDate(c.date)}` : `તારીખ: ${fmtDate(c.date)} · ${c.mode}`,
      c.note ? `નોંધ: ${c.note}` : null,
      "",
      "આપના સહયોગ બદલ આભાર 🙏",
    ].filter((x) => x !== null).join("\n");
    return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
  };
  const incByType = INCOME_TYPES.map((t) => ({ c: t, v: cols.filter((c) => incType(c) === t).reduce((s, c) => s + c.amount, 0) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);

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
  const passEntries = cols.filter((c) => incType(c) === PASS_TYPE);
  const passTotal = passEntries.reduce((s, c) => s + c.amount, 0);
  const colList = cols.filter((c) => incType(c) !== PASS_TYPE && (incFilter === "all" || incType(c) === incFilter) && match(c, ["name", "flat", "note"])).sort((a, b) => (b.date || "").localeCompare(a.date || ""));

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
    { id: "col", label: "આવક", icon: HandCoins },
    { id: "passes", label: "ભોજન પાસ", icon: UtensilsCrossed },
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
            <button className="ghost" disabled={busy} onClick={() => downloadExcel()}><FileSpreadsheet size={15} />Excel</button>
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
              <div className="stat" style={{ "--c": "var(--leaf)" }}><div className="lbl"><HandCoins size={15} />કુલ આવક</div><div className="num">{fmt(collected)}</div><div className="s" style={{ fontSize: 13, color: "var(--muted)" }}>{cols.length} એન્ટ્રી</div></div>
              <div className="stat" style={{ "--c": "var(--kumkum)" }}><div className="lbl"><Wallet size={15} />કુલ ખર્ચ</div><div className="num">{fmt(spent)}</div><div style={{ fontSize: 13, color: "var(--muted)" }}>{exps.length} એન્ટ્રી</div></div>
              <div className="stat" style={{ "--c": collected - spent >= 0 ? "var(--peacock)" : "var(--kumkum)" }}><div className="lbl"><Scale size={15} />બાકી સિલક</div><div className="num" style={{ color: collected - spent < 0 ? "var(--kumkum)" : undefined }}>{fmt(collected - spent)}</div><div style={{ fontSize: 13, color: "var(--muted)" }}>{collected - spent < 0 ? "આવક કરતાં ખર્ચ વધુ છે" : "આવક − ખર્ચ"}</div></div>
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
                <h3>સભ્ય ફાળો બાકી: {pending.length} ઘર</h3>
                <div className="bar" style={{ marginBottom: 10 }}><i style={{ width: `${sortedMembers.length ? ((sortedMembers.length - pending.length) / sortedMembers.length) * 100 : 0}%`, background: "var(--leaf)" }} /></div>
                {pending.length === 0 ? <div className="s">બધા ઘરનો ફાળો આવી ગયો છે.</div> :
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {pending.map((m) => <button key={m.id} className="chip" style={{ fontSize: 13 }} title={m.name} onClick={() => isAdmin && setModal({ type: "col", preset: m })}>{m.house}</button>)}
                  </div>}
                {pending.length > 0 && isAdmin && <div className="s" style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>ઘર નં. પર દબાવીને સીધો ફાળો નોંધો.</div>}
              </div>
            )}

            {fest !== "all" && passCounts(cols).due > 0 && (
              <div className="panel">
                <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}><UtensilsCrossed size={18} />ભોજન પાસ – બાકી પેમેન્ટ: <span style={{ color: "var(--kumkum)" }}>{fmt(passCounts(cols).due)}</span></h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {cols.filter((c) => passDue(c) > 0).map((c) => (
                    <button key={c.id} className="chip" style={{ fontSize: 13 }} onClick={() => isAdmin && setModal({ type: "passpay", id: c.id })}>
                      {c.flat || c.name} · <b style={{ color: "var(--kumkum)" }}>{fmt(passDue(c))}</b>
                    </button>
                  ))}
                </div>
                {isAdmin && <div className="s" style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>નામ પર દબાવીને પૈસા મળ્યાની નોંધ કરો.</div>}
              </div>
            )}

            {incByType.length > 0 && (
              <div className="panel">
                <h3>પ્રકાર મુજબ આવક</h3>
                {incByType.map((x) => (
                  <div key={x.c} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15 }}><span>{x.c}</span><b>{fmt(x.v)}</b></div>
                    <div className="bar"><i style={{ width: `${(x.v / incByType[0].v) * 100}%`, background: "var(--leaf)" }} /></div>
                  </div>
                ))}
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
                    <div className="row" key={f.id} style={{ cursor: "pointer" }} onClick={() => setModal({ type: "view", id: f.id })}>
                      <div className="grow"><div className="t">{f.name} {f.year}</div><div className="s">આવક {fmt(c)} · ખર્ચ {fmt(s)}</div></div>
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
              <button className="btn sec" disabled={busy} onClick={() => downloadExcel()}><FileSpreadsheet size={16} />Excel</button>
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
              <div className="searchbox"><Search size={16} /><input className="inp" placeholder="નામ કે ઘર નંબર શોધો" value={q} onChange={(e) => setQ(e.target.value)} /></div>
              <select className="inp" style={{ width: "auto" }} value={incFilter} onChange={(e) => setIncFilter(e.target.value)}>
                <option value="all">બધી આવક</option>{INCOME_TYPES.filter((t) => t !== PASS_TYPE).map((t) => <option key={t}>{t}</option>)}
              </select>
              <button className="btn sec" disabled={busy} onClick={() => downloadExcel()}><FileSpreadsheet size={16} />Excel</button>
              <button className="btn" onClick={() => noFests ? needFest() : setModal({ type: "col" })}><Plus size={16} />આવક ઉમેરો</button>
            </div>
            <div className="panel" style={{ marginTop: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><b>{colList.length} એન્ટ્રી</b><b style={{ color: "var(--leaf)" }}>{fmt(colList.reduce((s, c) => s + c.amount, 0))}</b></div>
              {passEntries.length > 0 && incFilter === "all" && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", background: "var(--bg)", borderRadius: 8, padding: "8px 12px", margin: "4px 0 8px", fontSize: 14 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}><UtensilsCrossed size={15} />ભોજન પાસની આવક <b>{fmt(passTotal)}</b> ({passEntries.length} એન્ટ્રી) કુલ આવકમાં ગણાય છે, પણ અહીં યાદીમાં નથી.{passEntries.some((c) => passDue(c)) && <span className="due"> બાકી પેમેન્ટ {fmt(passEntries.reduce((a, c) => a + passDue(c), 0))}</span>}</span>
                  <button className="linkbtn" style={{ fontSize: 14 }} onClick={() => { setTab("passes"); setQ(""); }}>ભોજન પાસ ટૅબમાં જુઓ →</button>
                </div>
              )}
              {colList.length === 0 ? <div className="empty">{q || incFilter !== "all" ? "શોધ મુજબ કોઈ આવક મળી નહીં." : "હજુ કોઈ આવક નોંધાઈ નથી. ઉપર \"આવક ઉમેરો\" દબાવો."}</div> :
                colList.map((c) => (
                  <div className="row" key={c.id}>
                    <div className="grow">
                      <div className="t">{c.flat && <span className="tag">{c.flat}</span>}{c.name}</div>
                      <div className="s"><span className="tag" style={incType(c) === MEMBER_FUND ? undefined : { background: "#FDF1D6", color: "#8A5A00" }}>{incType(c)}</span></div>
                      <div className="s">{fest === "all" && `${festMap[c.festivalId]?.name || ""} · `}{fmtDate(c.date)}{!isInKind(c) && ` · ${c.mode}`}{noteOf(c) && ` · ${noteOf(c)}`}</div>
                    </div>
                    {isInKind(c)
                      ? <div className="amt" style={{ color: "#8A5A00", display: "flex", alignItems: "center", gap: 4 }} title="રોકડ હિસાબમાં ગણ્યું નથી"><Gift size={16} />વસ્તુ</div>
                      : <div className="amt" style={{ color: "var(--leaf)" }}>{fmt(c.amount)}</div>}
                    <a className="icon" aria-label="WhatsApp પહોંચ" title="WhatsApp પર પહોંચ મોકલો" href={receiptLink(c)} target="_blank" rel="noopener noreferrer"><MessageCircle size={15} /></a>
                    <button className="icon" aria-label="સુધારો" onClick={() => setModal({ type: incType(c) === PASS_TYPE ? "pass" : "col", item: c })}><Pencil size={15} /></button>
                    <button className="icon del" aria-label="કાઢી નાખો" onClick={() => setModal({ type: "del", key: "collections", id: c.id, text: `${c.name || c.flat} ની ${isInKind(c) ? kindText(c) : fmt(c.amount)} આવક (${incType(c)}) કાઢી નાખવામાં આવશે.`, msg: "આવક કાઢી નાખી" })}><Trash2 size={15} /></button>
                  </div>
                ))}
            </div>
          </>
        )}

        {loaded && tab === "passes" && (() => {
          const all = cols.filter((c) => incType(c) === PASS_TYPE);
          const list = all
            .filter((c) => (passFilter === "all" || c.passFor === passFilter)
              && (passPay === "all" || (passPay === "due" ? passDue(c) > 0 : passDue(c) === 0))
              && match(c, ["name", "flat", "phone", "note", "guestLabel", "passNo"]))
            .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
          const pc = passCounts(all);
          const cf = fest !== "all" ? festMap[fest] : null;
          const r = cf?.passRates || {};
          return (
            <>
              {cf ? (
                <div className="panel" style={{ marginTop: 0, marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <h3 style={{ margin: 0 }}>{cf.name} {cf.year} – પાસના દર</h3>
                    <button className="btn sec adm" style={{ padding: "6px 12px" }} onClick={() => setModal({ type: "fest", item: cf })}><Pencil size={14} />દર બદલો</button>
                  </div>
                  <div className="mini" style={{ margin: "10px 0 0" }}>
                    <div><small>સોસાયટી – ફુલ</small><b>{fmt(r.sFull)}</b></div>
                    <div><small>સોસાયટી – હાફ</small><b>{fmt(r.sHalf)}</b></div>
                    <div><small>બહારના – ફુલ</small><b>{fmt(r.oFull)}</b></div>
                    <div><small>બહારના – હાફ</small><b>{fmt(r.oHalf)}</b></div>
                  </div>
                </div>
              ) : (
                <div className="panel" style={{ marginTop: 0, marginBottom: 14, color: "var(--muted)" }}>પાસના દર જોવા કે બદલવા માટે ઉપરથી તહેવાર પસંદ કરો. નીચે બધા તહેવારના પાસ દેખાય છે.</div>
              )}

              <div className="stats" style={{ marginBottom: 14 }}>
                <div className="stat" style={{ "--c": "var(--peacock)" }}><div className="lbl">સોસાયટી સભ્ય</div><div className="num">{pc.society.full} ફુલ · {pc.society.half} હાફ</div><div style={{ fontSize: 13, color: "var(--muted)" }}>મળ્યા {fmt(pc.society.amount)}{pc.society.due > 0 && <span className="due"> · બાકી {fmt(pc.society.due)}</span>}</div></div>
                <div className="stat" style={{ "--c": "var(--marigold)" }}><div className="lbl">બહારના</div><div className="num">{pc.outside.full} ફુલ · {pc.outside.half} હાફ</div><div style={{ fontSize: 13, color: "var(--muted)" }}>મળ્યા {fmt(pc.outside.amount)}{pc.outside.due > 0 && <span className="due"> · બાકી {fmt(pc.outside.due)}</span>}</div></div>
                <div className="stat" style={{ "--c": "var(--leaf)" }}><div className="lbl">કુલ પાસ (રસોઈ માટે)</div><div className="num">{pc.full + pc.half}</div><div style={{ fontSize: 13, color: "var(--muted)" }}>{pc.full} ફુલ + {pc.half} હાફ · મળ્યા {fmt(pc.amount)}</div></div>
                <div className="stat" style={{ "--c": "var(--kumkum)", cursor: "pointer" }} onClick={() => setPassPay("due")}><div className="lbl"><BellRing size={15} />બાકી પેમેન્ટ</div><div className="num" style={{ color: pc.due ? "var(--kumkum)" : undefined }}>{fmt(pc.due)}</div><div style={{ fontSize: 13, color: "var(--muted)" }}>{pc.dueCount} એન્ટ્રી · કુલ વેચાણ {fmt(pc.total)}</div></div>
              </div>

              <div className="toolbar">
                <div className="searchbox"><Search size={16} /><input className="inp" placeholder="નામ, ઘર નં. કે મોબાઇલ શોધો" value={q} onChange={(e) => setQ(e.target.value)} /></div>
                <select className="inp" style={{ width: "auto" }} value={passFilter} onChange={(e) => setPassFilter(e.target.value)}>
                  <option value="all">બધા</option>{Object.entries(PASS_FOR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select className="inp" style={{ width: "auto" }} value={passPay} onChange={(e) => setPassPay(e.target.value)}>
                  <option value="all">બધા પેમેન્ટ</option>
                  <option value="due">પેમેન્ટ બાકી</option>
                  <option value="paid">પૂરું ચૂકવેલ</option>
                </select>
                <button className="btn sec" disabled={busy} onClick={() => downloadExcel()}><FileSpreadsheet size={16} />Excel</button>
                <button className="btn" onClick={() => noFests ? needFest() : setModal({ type: "pass" })}><Plus size={16} />પાસ આપો</button>
              </div>
              <div className="panel" style={{ marginTop: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <b>{list.length} એન્ટ્રી · {list.reduce((a, c) => a + (c.fullQty || 0), 0)} ફુલ + {list.reduce((a, c) => a + (c.halfQty || 0), 0)} હાફ</b>
                  <span><b style={{ color: "var(--leaf)" }}>{fmt(list.reduce((a, c) => a + c.amount, 0))}</b>{list.some((c) => passDue(c)) && <span className="due"> · બાકી {fmt(list.reduce((a, c) => a + passDue(c), 0))}</span>}</span>
                </div>
                {list.length === 0 ? <div className="empty">{q || passFilter !== "all" || passPay !== "all" ? "શોધ મુજબ કોઈ પાસ મળ્યો નહીં." : "હજુ કોઈ ભોજન પાસ આપ્યો નથી. ઉપર \"પાસ આપો\" દબાવો."}</div> :
                  list.map((c) => (
                    <div className="row" key={c.id}>
                      <div className="grow">
                        <div className="t">{c.flat && <span className="tag">{c.flat}</span>}{c.name}</div>
                        <div className="s">
                          <span className="tag" style={c.passFor === "outside" ? { background: "#FDF1D6", color: "#8A5A00" } : undefined}>{PASS_FOR[c.passFor]}</span>
                          {c.fullQty ? `ફુલ ${c.fullQty} × ${fmt(c.rateFull)}` : ""}{c.fullQty && c.halfQty ? " + " : ""}{c.halfQty ? `હાફ ${c.halfQty} × ${fmt(c.rateHalf)}` : ""}
                        </div>
                        <div className="s">{fest === "all" && `${festMap[c.festivalId]?.name || ""} · `}{fmtDate(c.date)}{c.amount > 0 ? ` · ${c.mode}` : ""}{c.passNo && ` · પાસ નં. ${c.passNo}`}{c.guestLabel && ` · મહેમાન: ${c.guestLabel}`}{c.phone && c.passFor === "outside" && ` · ${c.phone}`}{c.note && ` · ${c.note}`}</div>
                      </div>
                      <div className="amtcol">
                        <div className="amt" style={{ color: c.amount ? "var(--leaf)" : "var(--muted)" }}>{passDue(c) ? `${fmt(c.amount)} / ${fmt(passTotalOf(c))}` : fmt(c.amount)}</div>
                        {passDue(c) > 0 && <div className="due">બાકી {fmt(passDue(c))}</div>}
                      </div>
                      {passDue(c) > 0 && <button className="btn sec" style={{ padding: "6px 10px", fontSize: 14, color: "var(--leaf)" }} onClick={() => setModal({ type: "passpay", id: c.id })}><CheckCircle2 size={14} />પૈસા મળ્યા</button>}
                      {passDue(c) > 0
                        ? <a className="icon" aria-label="WhatsApp યાદ" title="બાકી રકમ માટે WhatsApp યાદ મોકલો" style={{ color: "var(--kumkum)" }} href={reminderLink(c)} target="_blank" rel="noopener noreferrer"><BellRing size={15} /></a>
                        : <a className="icon" aria-label="WhatsApp પહોંચ" title="WhatsApp પર પહોંચ મોકલો" href={receiptLink(c)} target="_blank" rel="noopener noreferrer"><MessageCircle size={15} /></a>}
                      <button className="icon" aria-label="સુધારો" onClick={() => setModal({ type: "pass", item: c })}><Pencil size={15} /></button>
                      <button className="icon del" aria-label="કાઢી નાખો" onClick={() => setModal({ type: "del", key: "collections", id: c.id, text: `${c.name} નો ${fmt(passTotalOf(c))} નો ભોજન પાસ કાઢી નાખવામાં આવશે.`, msg: "પાસ કાઢી નાખ્યો" })}><Trash2 size={15} /></button>
                    </div>
                  ))}
              </div>
            </>
          );
        })()}

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
                    {fest !== "all" && (p ? <div className="amt" style={{ color: "var(--leaf)" }}>{fmt(p)}</div> : sponsoredBy(fest, m.id) ? <span className="tag" style={{ background: "#FDF1D6", color: "#8A5A00", fontSize: 13 }}>સ્પોન્સર</span> :
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
                  const inc = data.collections.filter((e) => e.festivalId === f.id).reduce((a, e) => a + e.amount, 0);
                  const d = f.date ? new Date(f.date) : null;
                  return (
                    <div className="fest-card" key={f.id}>
                      <div className="fest-date">{d ? <><b>{d.getDate()}</b><small>{d.toLocaleDateString("gu-IN", { month: "short" })}</small></> : <CalendarDays size={22} style={{ margin: "8px auto" }} />}</div>
                      <div className="grow" style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ margin: 0, fontSize: 20 }}>{f.name} {f.year}</h3>
                        <div className="s" style={{ fontSize: 13, color: "var(--muted)" }}>આવક {fmt(inc)} · ખર્ચ {fmt(s)} · સિલક {fmt(inc - s)} · બજેટ {fmt(f.budget)}{f.note && ` · ${f.note}`}</div>
                        {f.budget > 0 && <div className="bar" style={{ marginTop: 6, maxWidth: 320 }}><i style={{ width: `${Math.min(100, (s / f.budget) * 100)}%`, background: s > f.budget ? "var(--kumkum)" : "var(--marigold)" }} /></div>}
                      </div>
                      <button className="btn sec" style={{ padding: "6px 12px" }} onClick={() => setModal({ type: "view", id: f.id })}><Eye size={15} />જુઓ</button>
                      <button className="icon" aria-label="સુધારો" onClick={() => setModal({ type: "fest", item: f })}><Pencil size={15} /></button>
                      <button className="icon del" aria-label="કાઢી નાખો" onClick={() => setModal({ type: "del", key: "festivals", id: f.id, text: `"${f.name} ${f.year}" અને તેની બધી આવક તથા ખર્ચની એન્ટ્રી કાઢી નાખવામાં આવશે. આ પાછું નહીં આવે.`, msg: "તહેવાર કાઢી નાખ્યો" })}><Trash2 size={15} /></button>
                    </div>
                  );
                })}
            </div>
          </>
        )}
      </main>

      {modal?.type === "exp" && <ExpenseForm initial={modal.item} festivals={sortedFests} defaultFest={fest !== "all" ? fest : undefined} onClose={() => setModal(null)} onSave={(x) => upsert("expenses", x, modal.item ? "ખર્ચ સુધાર્યો" : "ખર્ચ ઉમેર્યો")} />}
      {modal?.type === "col" && <CollectionForm initial={modal.item || (modal.preset && { type: MEMBER_FUND, festivalId: fest !== "all" ? fest : sortedFests[0]?.id, memberId: modal.preset.id, flat: modal.preset.house, name: modal.preset.name, amount: "", date: today(), mode: MODES[0], note: "" })} isEdit={!!modal.item} festivals={sortedFests} members={sortedMembers} collections={data.collections} defaultFest={fest !== "all" ? fest : undefined} onClose={() => setModal(null)} onSave={(x) => upsert("collections", x, modal.item ? "આવક સુધારી" : "આવક ઉમેરી")} />}
      {modal?.type === "pass" && <PassForm initial={modal.item} isEdit={!!modal.item} festivals={sortedFests} festMap={festMap} members={sortedMembers} defaultFest={fest !== "all" ? fest : undefined} onClose={() => setModal(null)} onSave={(x) => upsert("collections", x, modal.item ? "પાસ સુધાર્યો" : "પાસ સાચવ્યો")} />}
      {modal?.type === "passpay" && data.collections.find((c) => c.id === modal.id) && (
        <PassPayModal c={data.collections.find((c) => c.id === modal.id)} onClose={() => setModal(null)} onSave={(x) => upsert("collections", x, "પેમેન્ટ નોંધાયું")} />
      )}
      {modal?.type === "fest" && <FestivalForm initial={modal.item} onClose={() => setModal(null)} onSave={(x) => upsert("festivals", x, modal.item ? "તહેવાર સુધાર્યો" : "તહેવાર ઉમેર્યો")} />}
      {modal?.type === "member" && <MemberForm initial={modal.item} onClose={() => setModal(null)} onSave={(x) => upsert("members", x, modal.item ? "સભ્ય સુધાર્યા" : "સભ્ય ઉમેર્યા")} />}
      {modal?.type === "share" && <ShareModal phone={phone} setPhone={setPhone} summary={summary} busy={busy} canShareFiles={canShareFiles} onDownload={downloadPdf} onShare={sharePdf} onClose={() => setModal(null)} />}
      {modal?.type === "share" && (
        <div style={{ position: "fixed", left: -10000, top: 0 }} aria-hidden="true">
          <div ref={reportRef}><Report data={data} fest={fest} festMap={festMap} sortedFests={sortedFests} paidFor={paidFor} sponsoredBy={sponsoredBy} /></div>
        </div>
      )}
      {modal?.type === "view" && festMap[modal.id] && (
        <FestivalView f={festMap[modal.id]} data={data} members={sortedMembers} covered={covered} busy={busy}
          onExcel={() => downloadExcel(modal.id)}
          onPdf={() => { setFest(modal.id); setModal({ type: "share" }); }}
          onClose={() => setModal(null)} />
      )}
      {modal?.type === "pin" && <PinModal hasPin={!!pinHash} isAdmin={isAdmin} onCreate={createPin} onUnlock={unlock} onLogout={logout} onClose={() => setModal(null)} />}
      {modal?.type === "del" && <Confirm text={modal.text} onClose={() => setModal(null)} onYes={() => remove(modal.key, modal.id, modal.msg)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
