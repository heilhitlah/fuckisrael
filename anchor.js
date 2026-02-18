const $ = (id) => document.getElementById(id);

function setStatus(type, msg){
  const el = $("tStatus");
  if(!el) return;
  el.className = `status ${type}`;
  el.textContent = msg;
}

function logDebug(message){
  const logEl = $("debugLog");
  if(!logEl) return;
  const current = logEl.value ? `${logEl.value}\n` : "";
  logEl.value = `${current}${message}`;
  logEl.scrollTop = logEl.scrollHeight;
}

function lines(text){
  return String(text || "")
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean);
}

function slugify(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\bmahjongw\s+ays\b/g, "mahjongways")
    .replace(/&/g, " dan ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function smartSlug(title, limit = 50, tolerance = 12) {
  const full = slugify(title);
  if (!full) return "artikel";
  if (full.length <= limit) return full;

  let cut = full.lastIndexOf("-", limit);
  if (cut < 15) cut = limit;

  const nextDash = full.indexOf("-", limit);
  if (nextDash !== -1 && nextDash - limit <= tolerance) {
    cut = nextDash;
  }

  const out = full.slice(0, cut).replace(/-+$/g, "");
  return out || full.slice(0, limit);
}

function joinUrl(base, path){
  const b = String(base || "").trim();
  const p = String(path || "").trim();
  if(!b) return p;
  if(!p) return b;
  const b2 = b.endsWith("/") ? b : b + "/";
  return b2 + (p.startsWith("/") ? p.slice(1) : p);
}

function copyText(el){
  const v = el.value || "";
  if(navigator.clipboard && typeof navigator.clipboard.writeText === "function"){
    return navigator.clipboard.writeText(v);
  }
  el.focus();
  el.select();
  document.execCommand("copy");
  return Promise.resolve();
}

const PRIORITY_KEYWORDS = [
  "mahjongways","kasino","online","rtp","scatter","server","bonus","pola","jam","login"
];

function normalizeText(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\bmahjongw\s+ays\b/g, "mahjongways")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(s){
  return normalizeText(s).split(" ").filter(Boolean);
}

const STOPWORDS_LOCAL = new Set([
  "yang","dan","di","ke","dari","pada","dalam","untuk","dengan","oleh","sebagai","atau",
  "ini","itu","para","lebih","cara","ketika","angka","memaknai","menjadi","bagian",
  "awal","tahun","pemain","mulai","membantu","menandai","digunakan","membuka","akses"
]);

const TOKEN_BOOST = {
  mahjongways: 140,
  pgsoft: 100,
  rtp: 95,
  live: 35,
  kasino: 85,
  online: 70,
  ai: 110,
  prediktif: 120,
  analitik: 110,
  lanjutan: 90,
  machine: 100,
  learning: 100,
  big: 90,
  data: 100,
  dashboard: 100,
  real: 80,
  time: 80,
  teknologi: 70,
  bonus: 70,
  scatter: 80,
  hitam: 75,
  server: 70,
  thailand: 75,
  pola: 55,
  menang: 45,
  kemenangan: 40,
  strategi: 35,
  teknik: 35,
  panduan: 40,
  pemula: 40,
  cuan: 45,
  betting: 30,
  taruhan: 30,
  2026: 25,
};

function extractAdaptiveKeywords(title, count = 3) {
  // NOTE (vFinal): Versi ini dibuat agar anchor text lebih adaptif terhadap judul yang unik/orisinil.
  // Kunci utamanya: kita tidak "mengandalkan kamus frasa" sempit, tapi mengekstrak kata paling informatif
  // dari judul + memperkuatnya dengan statistik satu-batch (IDF) dari daftar judul yang sedang diproses.
  // Hasil: 3 kata (atau 3 token) yang lebih variatif: [Topik] [Fitur/Parameter] [Tujuan/Outcome].
  // Menghasilkan 3 keyword utama yang adaptif (tidak monoton seperti "mahjongways kasino online")
  // Prinsip: ambil 1 kata inti (topik), 1 kata pemicu/parameter (mis. scatter/rtp/server/bet), 1 kata hasil/tujuan (maxwin/profit/modal/dll)
  // Output: array string panjang = count

  const STOPWORDS2 = new Set([
    "yang","dan","di","ke","dari","untuk","pada","dengan","tanpa","agar","sebagai","dalam","oleh","atau",
    "ini","itu","terhadap","guna","demi","lebih","paling","secara","khas","khusus","versi","sisi","cara",
    "mengenai","tentang","atas","bagi","para","sebuah","hingga","kapan","bagaimana","mengapa","apa",
    "pemula","pemain","member","pro","profesional","master","legenda","kasino","online" // sengaja: "online" stopword
  ]);

  const GENERIC = new Set([
    "analisis","kajian","studi","pembahasan","mengulas","membedah","menyoroti","evaluasi","pendekatan",
    "framework","rangkuman","panduan","strategi","metode","teknik","tinjauan","penjelasan","sistematis",
    "objektif","teknis","profesional","rasional","terukur","adaptif","praktis"
  ]);

  // Kata yang biasanya bernilai informasi tinggi di niche MahjongWays
  const PRIORITY = new Map([
    ["mahjongways", 8],
    ["scatter", 10], ["hitam", 10], ["full", 7], ["super", 6], ["golden", 6],
    ["rtp", 9], ["live", 4], ["volatilitas", 8], ["rng", 8],
    ["server", 9], ["thailand", 6], ["vietnam", 6], ["kamboja", 6], ["srilanka", 6],
    ["jam", 7], ["reset", 8], ["peak", 6], ["hour", 6], ["time", 5], ["window", 5],
    ["bet", 9], ["betting", 8], ["modal", 9], ["saldo", 8], ["drawdown", 9],
    ["stop", 7], ["loss", 8], ["take", 7], ["profit", 8],
    ["bonus", 8], ["cashback", 8], ["rebate", 8], ["withdraw", 8], ["wagering", 8], ["rollover", 8],
    ["maxwin", 10], ["maximal", 6], ["win", 6], ["x100", 7], ["x1000", 9]
  ]);

  const txt = (title || "").toString().trim();
  if (!txt) return ["mahjongways", "scatter", "hitam"].slice(0, count);

  // Normalisasi
  const normalized = txt
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\(\)/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")   // buang tanda baca kecuali dash
    .replace(/\s+/g, " ")
    .trim();

  // Tangkap multiplier seperti 5x, x1000, 4x, 10 menit, dll
  const mult = [];
  for (const m of normalized.matchAll(/\b(\d{1,4}x|x\d{1,4})\b/g)) mult.push(m[1]);
  for (const m of normalized.matchAll(/\b(\d{1,3})\s*menit\b/g)) mult.push(`${m[1]}menit`);
  for (const m of normalized.matchAll(/\b(\d{1,4})\s*spin\b/g)) mult.push(`${m[1]}spin`);

  const rawTokens = normalized
    .split(/\s+/)
    .filter(Boolean);

  // Token kandidat (hapus stopword, tapi biarkan "mahjongways")
  const tokens = rawTokens.filter(t => {
    if (t === "mahjongways") return true;
    if (STOPWORDS2.has(t)) return false;
    if (t.length < 3) return false;
    return true;
  });

  // Scoring token
  const scores = new Map();
  const seen = new Set();

  function addScore(tok, s) {
    if (!tok) return;
    scores.set(tok, (scores.get(tok) || 0) + s);
  }

  tokens.forEach((t, idx) => {
    if (seen.has(t)) {
      addScore(t, 1); // repetisi sedikit menambah bobot
      return;
    }
    seen.add(t);

    // basis: posisi awal lebih penting
    const posBoost = Math.max(0, 6 - idx); // 6..0
    addScore(t, 2 + posBoost);

    // panjang kata (lebih spesifik biasanya lebih panjang)
    addScore(t, Math.min(6, Math.max(0, t.length - 4)));

    // prioritas niche
    if (PRIORITY.has(t)) addScore(t, PRIORITY.get(t));

    // penalti kata generik
    if (GENERIC.has(t)) addScore(t, -6);

    // angka/multiplier
    if (/^(\d{1,4}x|x\d{1,4}|\d{1,4}spin|\d{1,3}menit)$/.test(t)) addScore(t, 7);
  });

  // Tambahkan multiplier yang terdeteksi (kalau tidak ada sebagai token utama)
  mult.forEach(m => addScore(m, 8));

  // Kandidat bigram penting: "scatter hitam", "rtp live", "jam reset", "server vietnam"
  const bigrams = [];
  for (let i = 0; i < rawTokens.length - 1; i++) {
    const a = rawTokens[i], b = rawTokens[i + 1];
    if (STOPWORDS2.has(a) || STOPWORDS2.has(b)) continue;
    const bg = `${a} ${b}`;
    // bigram prioritas
    if (
      bg === "scatter hitam" ||
      bg === "rtp live" ||
      bg === "jam reset" ||
      bg.startsWith("server ")
    ) {
      bigrams.push(bg);
    }
  }

  // Seleksi 3 keyword: aturan anti-monoton
  // 1) Usahakan selalu memasukkan "mahjongways" jika ada di judul
  const picks = [];

  function pickToken(filterFn) {
    const sorted = [...scores.entries()]
      .filter(([t, s]) => s > 0 && filterFn(t, s))
      .sort((a, b) => b[1] - a[1]);

    for (const [t] of sorted) {
      // hindari duplikasi semantik sederhana (mis. maxwin vs maximal) dan kata generik
      if (picks.includes(t)) continue;
      if (GENERIC.has(t)) continue;
      picks.push(t);
      break;
    }
  }

  // Slot 1: mahjongways (jika ada), kalau tidak ambil top token non-generic
  if (normalized.includes("mahjongways")) picks.push("mahjongways");

  // Slot 2: pemicu/parameter utama (scatter/rtp/server/bet/jam/bonus/rng/volatilitas)
  pickToken(t => ["scatter","hitam","rtp","server","bet","betting","jam","reset","bonus","cashback","rebate","wagering","rollover","rng","volatilitas","drawdown","withdraw","maxwin"].includes(t) || /^(\d{1,4}x|x\d{1,4})$/.test(t));

  // Slot 3: hasil/tujuan (maxwin/profit/modal/withdraw/roi/drawdown/stoploss/takeprofit)
  pickToken(t => ["maxwin","profit","modal","saldo","withdraw","roi","drawdown","stop","loss","take","win","maximal"].includes(t) || /^(\d{1,4}spin|\d{1,3}menit)$/.test(t));

  // Isi sisa slot dengan token skor tertinggi (non-generic, bukan stopword)
  while (picks.length < count) {
    pickToken(() => true);
    if (picks.length === 0) break;
    // jika tidak bertambah (karena filter), hentikan
    if (picks.length >= count) break;
    const before = picks.length;
    if (before === picks.length) break;
  }

  // Jika masih kurang, gunakan bigram yang relevan (dibersihkan jadi 2 kata tapi sebagai satu keyword string)
  if (picks.length < count && bigrams.length) {
    for (const bg of bigrams) {
      if (picks.includes(bg)) continue;
      picks.push(bg);
      if (picks.length >= count) break;
    }
  }

  // Final fallback
  const fallback = ["mahjongways", "scatter", "hitam"];
  while (picks.length < count) {
    const v = fallback[picks.length] || fallback[fallback.length - 1];
    if (!picks.includes(v)) picks.push(v);
    else picks.push(v + "1");
  }

  return picks.slice(0, count);
}

// ===== vFinal: Corpus-aware keywording (TF-IDF ringan per batch judul) =====
function buildCorpusStats(titles){
  const docs = (titles || []).map(t => tokenize(t));
  const df = new Map();
  const N = Math.max(1, docs.length);

  for(const toks of docs){
    const uniq = new Set(toks.filter(t => !STOPWORDS_LOCAL.has(t) && t.length >= 3));
    for(const t of uniq){
      df.set(t, (df.get(t) || 0) + 1);
    }
  }

  // idf smoothing: log((N+1)/(df+1)) + 1
  const idf = new Map();
  for(const [t, d] of df.entries()){
    idf.set(t, Math.log((N + 1) / (d + 1)) + 1);
  }

  return { N, df, idf };
}

function normalizeSpecialTokenCase(tok){
  const t = String(tok || "").trim();
  if(!t) return t;
  const up = t.toUpperCase();
  if(t.toLowerCase() === "mahjongways") return "MahjongWays";
  if(["RTP","ROI","EV","RNG","AI"].includes(up)) return up;
  if(t.toLowerCase() === "pgsoft") return "PGSoft";
  // x1000 / 5x / x100
  if(/^x\d{1,4}$/i.test(t)) return t.toLowerCase();
  if(/^\d{1,4}x$/i.test(t)) return t.toLowerCase();
  return t;
}

function titleCaseToken(tok){
  const t = normalizeSpecialTokenCase(tok);
  // biarkan token yang sudah uppercase (RTP, ROI, dll)
  if(t === t.toUpperCase() && /[A-Z]/.test(t)) return t;
  // token multi-kata ("take profit") atau token dengan dash ("take-profit")
  return t
    .split(/[\s-]+/)
    .filter(Boolean)
    .map(w => {
      const w2 = normalizeSpecialTokenCase(w);
      if(w2 === w2.toUpperCase() && /[A-Z]/.test(w2)) return w2;
      return w2.charAt(0).toUpperCase() + w2.slice(1);
    })
    .join(" ");
}

// ---- vFinal2: Natural 3-word anchor keywords (phrase-aware, anti-verb, anti-weird) ----
// Tujuan:
// - Anchor text 3 kata yang natural dibaca.
// - Hindari kata kerja/prefix verbal (mem-, meng-, mener-, ber-, ter-, di-).
// - Prioritaskan frasa benda (noun-ish) dan kolokasi 2 kata ("bola salju", "take profit", dll).
// - Hindari duplikasi ("salju salju") dan kata generik ("analisis", "pendekatan", "strategi" dll)

const GENERIC_TERMS = new Set([
  "analisis","kajian","studi","tinjauan","evaluasi","pembahasan","panduan","cara","bagaimana",
  "mengapa","ringkasan","rangkuman","framework","kerangka","pendekatan","strategi","teknik",
  "membaca","memahami","mengurai","membedah","mengukur","mengoptimalkan","mengidentifikasi",
  "membangun","menerapkan","menjaga","menentukan","mengelola","menghindari","memetakan",
  "menuju","pada","dalam","untuk","dengan","sebagai","agar","demi","saat","ketika","versi",
]);

// Kata target (niche) yang sering menjadi "inti" judul.
const CORE_TERMS = new Set([
  "mahjongways","pgsoft","scatter","hitam","maxwin","maximal","win","rtp","roi","ev","rng",
  "profit","modal","saldo","withdraw","cashback","rebate","bonus","wagering","rollover",
  "snowball","compounding","reinvestasi","volatilitas","risiko","drawdown","stop","loss","take",
  "spin","turbo","slow","server","latency","delay","jam","reset","peak",
]);

// Kolokasi umum yang ingin dipertahankan agar anchor text terasa natural.
// (Ini bukan "kamus frasa" untuk semua judul, hanya daftar kecil untuk mencegah hasil aneh.)
const SPECIAL_BIGRAMS = new Set([
  "bola salju",
  "take profit",
  "stop loss",
  "manajemen risiko",
  "profit beruntun",
  "rtp live",
  "jam reset",
  "peak hour",
  "bet kecil",
  "bet besar",
  "scatter hitam",
  "full scatter",
]);

function isLikelyVerbId(tok){
  const t = String(tok || "").toLowerCase();
  if(!t || t.length < 4) return false;
  // prefiks verbal umum Indonesia
  if(/^(me|mem|men|meng|meny|di|ber|ter)/.test(t)) return true;
  // sufiks verbal umum
  if(/(kan|i)$/.test(t) && t.length >= 6) return true;
  return false;
}

function buildCandidatesWordsAndBigrams(title, corpus){
  const words = tokenize(title).filter(w => w.length >= 3);
  const idf = (corpus && corpus.idf) ? corpus.idf : new Map();

  const wordScore = (w) => {
    if(STOPWORDS_LOCAL.has(w)) return -10;
    if(GENERIC_TERMS.has(w)) return -3;
    if(isLikelyVerbId(w)) return -2.5;
    const base = idf.get(w) || 1;
    const coreBoost = CORE_TERMS.has(w) ? 1.0 : 0;
    const lenBoost = Math.min(0.6, Math.max(0, (w.length - 4) * 0.08));
    return base + coreBoost + lenBoost;
  };

  const unigram = words
    .map(w => ({ type:"uni", words:[w], score: wordScore(w) }))
    .filter(x => x.score > 0);

  const bigram = [];
  for(let i=0;i<words.length-1;i++){
    const a = words[i], b = words[i+1];
    if(a === b) continue; // anti duplikasi: "salju salju"
    if(STOPWORDS_LOCAL.has(a) || STOPWORDS_LOCAL.has(b)) continue;
    if(GENERIC_TERMS.has(a) || GENERIC_TERMS.has(b)) continue;
    if(isLikelyVerbId(a) || isLikelyVerbId(b)) continue;
    // Hindari bigram terlalu template
    if((a === "mahjongways" && b === "kasino") || (a === "kasino" && b === "online")) continue;
    const phrase = `${a} ${b}`;
    const specialBoost = SPECIAL_BIGRAMS.has(phrase) ? 1.6 : 0;
    const score = (wordScore(a) + wordScore(b)) + 0.9 + specialBoost; // bonus frasa
    bigram.push({ type:"bi", words:[a,b], score });
  }

  const seen = new Set();
  const all = [...bigram, ...unigram].filter(c => {
    const key = c.words.join(" ");
    if(seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  all.sort((x,y) => y.score - x.score);
  return { words, candidates: all };
}

function extractNatural3Words(title, corpus){
  const { candidates } = buildCandidatesWordsAndBigrams(title, corpus);
  const toks = tokenize(title);
  const hasBrand = toks.includes("mahjongways");
  const titleStartsWithBrand = (toks[0] || "") === "mahjongways";

  // Heuristik natural: jika judul diawali kata kerja aksi, taruh di depan.
  // Contoh: "Menerapkan Sistem ... MahjongWays" => "Menerapkan MahjongWays Compounding".
  const ACTION_VERBS = new Set([
    "menerapkan","membangun","mengoptimalkan","mengidentifikasi","menyusun","menentukan",
    "menghitung","membaca","membedah","mengurai","memetakan","mengelola","menghindari",
    "menilai","menguji","memahami","mengenali","menganalisis","membandingkan","menjaga",
    "menata","mengatur","mengintegrasikan","mengunci","menggulung"
  ]);
  const action = (toks[0] && ACTION_VERBS.has(toks[0])) ? toks[0] : null;

  const chosen = [];
  const used = new Set();

  // Jangan memaksa brand di depan sejak awal.
  // Brand akan disisipkan belakangan, lalu diurutkan agar lebih natural.

  const pushWord = (w) => {
    if(!w) return;
    if(used.has(w)) return;
    if(action && w === action) return;
    if(STOPWORDS_LOCAL.has(w) || GENERIC_TERMS.has(w) || isLikelyVerbId(w)) return;
    chosen.push(w);
    used.add(w);
  };

  for(const cand of candidates){
    if(cand.words.includes("mahjongways")) continue;
    for(const w of cand.words) pushWord(w);
    if(chosen.length >= 3) break;
  }

  if(chosen.length < 3){
    for(const w of toks){
      if(CORE_TERMS.has(w)) pushWord(w);
      if(chosen.length >= 3) break;
    }
  }

  // Fallback supaya selalu lengkap 3 token
  const fallback = ["mahjongways","profit","strategi","panduan"];
  for(const w of fallback){
    if(chosen.length >= 3) break;
    pushWord(w);
  }

  // Susun agar natural:
  // - Jika action ada & brand ada: [action, topik, brand]
  // - Jika action ada & brand tidak ada: [action, topik1, topik2]
  // - Jika action tidak ada: topik dulu, brand menyusul sesuai urutan natural
  let finalTokens;
  if(action){
    const pool = chosen.filter(w => w !== "mahjongways" && w !== action);
    if(hasBrand){
      // Versi natural: aksi + topik + brand (lebih enak dibaca),
      // kecuali jika topiknya generik/pendek → brand ditaruh di tengah.
      const topic = pool[0] || "strategi";
      if(GENERIC_TERMS.has(topic) || topic.length <= 4){
        finalTokens = [action, "mahjongways", topic];
      }else{
        finalTokens = [action, topic, "mahjongways"];
      }
    }else{
      finalTokens = [action, pool[0] || "strategi", pool[1] || "panduan"];
    }
  }else{
    finalTokens = chosen.slice(0,3);
  }

  // Pastikan brand selalu ikut (kalau ada di judul)
  if(hasBrand && !finalTokens.includes("mahjongways")){
    if(finalTokens.length < 3) finalTokens.push("mahjongways");
    else finalTokens[2] = "mahjongways";
  }

  // Re-order agar urutan lebih natural untuk backlink.
  // Prinsip:
  // - Jika judul dimulai "MahjongWays" → brand boleh di depan.
  // - Jika action ada → brand biasanya paling enak di akhir.
  // - Jika tidak action & tidak diawali brand → brand prefer di akhir.
  (function reorderIfNeeded(){
    const t0 = (toks[0] || "").toLowerCase();
    const hasMW = finalTokens.includes("mahjongways");
    if(!hasMW) return;
    if(titleStartsWithBrand) return;

    const others = finalTokens.filter(x => x !== "mahjongways");
    if(others.length < 2) return;

    const okSpecific = (w) => {
      if(!w) return false;
      const ww = String(w).toLowerCase();
      if(GENERIC_TERMS.has(ww)) return false;
      if(isLikelyVerbId(ww)) return false;
      return ww.length >= 5 || CORE_TERMS.has(ww);
    };

    // 1) Jika action ada, paksa brand di akhir
    if(action){
      const pool = finalTokens.filter(x => x !== "mahjongways");
      if(pool.length >= 2) finalTokens = [pool[0], pool[1], "mahjongways"].slice(0,3);
      return;
    }

    // 2) Jika tidak action, taruh brand di akhir kalau 2 token lain cukup spesifik
    if(okSpecific(others[0]) && okSpecific(others[1])){
      finalTokens = [others[0], others[1], "mahjongways"];
    }
  })();

  // Hilangkan duplikasi kata (contoh: "bola salju salju")
  const uniq = [];
  for(const w of finalTokens){
    if(!w) continue;
    const norm = w.replace(/-/g, " ").trim();
    if(uniq.some(u => u.replace(/-/g, " ").trim() === norm)) continue;
    uniq.push(w);
  }
  for(const w of fallback){
    if(uniq.length >= 3) break;
    if(!uniq.includes(w)) uniq.push(w);
  }

  return uniq.slice(0,3);
}

function extractAdaptiveKeywordsFinal(title, corpus, count = 3){
  // 1) Mulai dari extractor lama untuk menjaga kompatibilitas niche MahjongWays.
  // 2) Lalu re-rank dengan bobot IDF per batch agar kata unik muncul lebih sering.
  const raw = tokenize(title);
  if(!raw.length) return ["MahjongWays","Scatter","Hitam"].slice(0, count);

  const STOP = new Set(["yang","dan","di","ke","dari","untuk","pada","dengan","tanpa","agar","sebagai","dalam","oleh","atau","ini","itu","terhadap","guna","demi","lebih","paling","secara","khas","khusus","versi","sisi","cara","mengenai","tentang","atas","bagi","para","sebuah","hingga","kapan","bagaimana","mengapa","apa"]);
  const GENERIC = new Set(["analisis","kajian","studi","pembahasan","mengulas","membedah","menyoroti","evaluasi","pendekatan","framework","rangkuman","panduan","strategi","metode","teknik","tinjauan","penjelasan","sistematis","objektif","teknis","profesional","rasional","terukur","adaptif","praktis"]);

  // Deteksi frasa penting → jadikan token gabungan (mengurangi hasil yang generik)
  const phraseTokens = [];
  const joined = raw.join(" ");
  const phraseRules = [
    { re: /\btake\s+profit\b/g, tok: "take-profit" },
    { re: /\bstop\s+loss\b/g, tok: "stop-loss" },
    { re: /\brtp\s+live\b/g, tok: "rtp-live" },
    { re: /\bscatter\s+hitam\b/g, tok: "scatter-hitam" },
    { re: /\bjam\s+reset\b/g, tok: "jam-reset" },
  ];
  for(const r of phraseRules){
    if(r.re.test(joined)) phraseTokens.push(r.tok);
  }

  const tokens = raw
    .filter(t => !STOP.has(t) && t.length >= 3)
    .map(t => t.toLowerCase());

  const tf = new Map();
  for(const t of tokens){
    if(GENERIC.has(t)) continue;
    tf.set(t, (tf.get(t) || 0) + 1);
  }
  for(const pt of phraseTokens){
    tf.set(pt, (tf.get(pt) || 0) + 2);
  }

  const idf = corpus?.idf || new Map();

  // Skor: tf * idf + boost posisi awal + boost kata niche
  const scores = new Map();
  const nicheBoost = {
    mahjongways: 2.8,
    pgsoft: 2.2,
    scatter: 2.0,
    hitam: 1.9,
    server: 1.8,
    rtp: 1.8,
    bonus: 1.6,
    profit: 1.6,
    modal: 1.6,
    volatilitas: 1.6,
    rng: 1.6,
    snowball: 2.0,
    reinvestasi: 2.0,
    bertahap: 1.4,
  };

  const add = (k, v) => scores.set(k, (scores.get(k) || 0) + v);

  tokens.forEach((t, idx) => {
    if(GENERIC.has(t)) return;
    const baseTf = tf.get(t) || 1;
    const baseIdf = idf.get(t) || 1.0;
    const posBoost = Math.max(0, 6 - idx) * 0.25; // judul awal lebih penting
    const nb = nicheBoost[t] || 1.0;
    add(t, baseTf * baseIdf * nb + posBoost);
  });

  for(const [pt, f] of tf.entries()){
    if(!pt.includes("-")) continue;
    const baseIdf = idf.get(pt) || 1.2;
    add(pt, f * baseIdf * 1.6);
  }

  // Wajib: jika ada mahjongways, jadikan salah satu keyword.
  const picks = [];
  if(tokens.includes("mahjongways")) picks.push("mahjongways");

  const sorted = [...scores.entries()]
    .filter(([t, s]) => s > 0 && !GENERIC.has(t))
    .sort((a, b) => b[1] - a[1]);

  const isTooSimilar = (a, b) => {
    if(!a || !b) return false;
    if(a === b) return true;
    // simple similarity: share same root prefix >= 6
    const aa = a.replace(/-/g, "");
    const bb = b.replace(/-/g, "");
    const pre = Math.min(aa.length, bb.length, 10);
    let same = 0;
    for(let i=0;i<pre;i++) if(aa[i]===bb[i]) same++; else break;
    return same >= 6;
  };

  for(const [t] of sorted){
    if(picks.length >= count) break;
    if(picks.some(p => isTooSimilar(p, t))) continue;
    if(STOPWORDS_LOCAL.has(t)) continue;
    picks.push(t);
  }

  // Fallback jika masih kurang
  const fb = ["mahjongways","scatter","hitam"];
  while(picks.length < count){
    const v = fb[picks.length] || fb[fb.length-1];
    if(!picks.includes(v)) picks.push(v); else picks.push(v + "1");
  }

  // Format output: 3 token, masing-masing dibuat enak dibaca.
  return picks.slice(0, count).map(t => titleCaseToken(t));
}

function makeAnchor(title, baseUrl, suffix, slugLimit, corpus){
  const limit = Number(slugLimit) || 50;
  const slug = smartSlug(title, limit, 12);
  const url = joinUrl(baseUrl, slug + (suffix || ""));
  // vFinal2: selalu 3 kata yang lebih natural dibaca (anti-verb/anti-generic + dukung frasa 2 kata).
  const keywords = extractNatural3Words(title, corpus).map(titleCaseToken).join(" ") || "Artikel";
  return { url, anchor: `<a href="${url}">${keywords}</a>` };
}

function extractLinksFromAnchors(anchorLines){
  const out = [];
  const re = /href\s*=\s*["']([^"']+)["']/i;
  for(const a of anchorLines){
    const m = re.exec(a);
    if(m && m[1]) out.push(m[1].trim());
  }
  return out;
}

function generateAnchors(){
  const titleEl = $("tTitles");
  const baseUrlEl = $("baseUrl");
  const outAnchorEl = $("outAnchor");

  if(!titleEl || !baseUrlEl || !outAnchorEl){
    setStatus("bad", "ERROR: Form anchor tidak lengkap.");
    return;
  }

  const titles = lines(titleEl.value);
  if(!titles.length){
    setStatus("bad", "ERROR: Daftar judul kosong.");
    logDebug("ERROR: Daftar judul kosong.");
    return;
  }

  try{
    const baseUrl = baseUrlEl.value.trim();
    const suffix = $("suffix")?.value;
    const slugLimit = $("slugLimit")?.value;

    if(!baseUrl){
      setStatus("bad", "ERROR: Domain / Base URL kosong.");
      return;
    }

    const corpus = buildCorpusStats(titles);
    const anchors = titles.map(t => makeAnchor(t, baseUrl, suffix, slugLimit, corpus).anchor);
    outAnchorEl.value = anchors.join("\n");
    setStatus("ok", `Sukses: ${titles.length} anchor dibuat. Klik 'Ambil Link dari Anchor' untuk daftar URL.`);
  }catch(err){
    setStatus("bad", `ERROR: ${err?.message || "Gagal generate anchor."}`);
  }
}

function extractLinks(){
  const outAnchorEl = $("outAnchor");
  if(!outAnchorEl){
    setStatus("bad", "ERROR: Output anchor tidak ditemukan.");
    return;
  }
  const anchorList = lines(outAnchorEl.value);
  if(!anchorList.length){
    setStatus("bad", "ERROR: Output anchor masih kosong.");
    logDebug("ERROR: Output anchor masih kosong.");
    return;
  }
}

$("btnMakeAnchor")?.addEventListener("click", generateAnchors);
$("btnExtractLink")?.addEventListener("click", extractLinks);

$("btnClear")?.addEventListener("click", ()=>{
  if($("tTitles")) $("tTitles").value = "";
  if($("outAnchor")) $("outAnchor").value = "";
  if($("outLinks")) $("outLinks").value = "";
  setStatus("idle", "Reset selesai.");
});

$("copyAnchor")?.addEventListener("click", async ()=>{
  if(!$("outAnchor")) return;
  await copyText($("outAnchor"));
  setStatus("ok", "Anchor text dicopy.");
});

$("copyLinks")?.addEventListener("click", async ()=>{
  if(!$("outLinks")) return;
  await copyText($("outLinks"));
  setStatus("ok", "Link dicopy.");
});

setStatus("idle", "Tempel daftar judul → Generate Anchor Text → Ambil Link dari Anchor.");
logDebug("Log siap.");
