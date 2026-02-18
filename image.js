(() => {
  const getEl = (id) => document.getElementById(id);

  const setStatus = (type, msg) => {
    const el = getEl("imgStatus");
    if(!el) return;
    el.className = `status ${type}`;
    el.textContent = msg;
  };

  const ensureTrailingSlash = (url) => {
    const u = String(url || "").trim();
    if(!u) return "";
    return u.endsWith("/") ? u : u + "/";
  };

  // ---------- Text helpers ----------
  const lines = (text) => String(text || "")
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean);

  const slugify = (s) => (s || "")
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

  // Cut slug to 50 chars, but try not to cut the last word.
  const smartSlug = (title, limit = 50, tolerance = 12) => {
    const full = slugify(title);
    if(!full) return "artikel";
    if(full.length <= limit) return full;

    let cut = full.lastIndexOf("-", limit);
    if(cut < 10) cut = limit;

    // If next dash is very close, extend a bit to keep the last word.
    const nextDash = full.indexOf("-", limit);
    if(nextDash !== -1 && nextDash - limit <= tolerance){
      cut = nextDash;
    }

    const out = full.slice(0, cut).replace(/-+$/g, "");
    return out || full.slice(0, limit);
  };

  const joinUrl = (base, path) => {
    const b = ensureTrailingSlash(base);
    const p = String(path || "").trim();
    if(!b) return p;
    if(!p) return b;
    return b + (p.startsWith("/") ? p.slice(1) : p);
  };

  // Stopwords (Indonesian) + fillers commonly found in titles.
  const STOPWORDS = new Set([
    "yang","dan","di","ke","dari","pada","dalam","untuk","dengan","oleh","sebagai","atau",
    "ini","itu","para","lebih","cara","ketika","saat","jadi","menjadi","kembali","mulai",
    "tak","lagi","bukan","hanya","juga","agar","karena","hingga","disebut","dinilai","berbasis",
    "awal","tahun","pemain","komunitas","temuan","ungkapan","mengungkap","alasan","respons","ritme",
    "sebuah","tentang","dari","pada","dalam","antara","serta","dengan","tanpa","baru","terbaru",
  ]);

  const normalizeTokens = (text) => (text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\bmahjongw\s+ays\b/g, "mahjongways")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

  // ===== Anchor keyword logic (Dominan + Aksi/Fungsi + Konteks Pengguna) =====
  // 1) Dominan: MahjongWays / RTP Live / Super Scatter
  // 2) Aksi/Fungsi: Strategi / Bonus / Pola / Data
  // 3) Konteks: Pemula / Pemain / Modal / Waktu

  const hasPhrase = (tokens, phraseTokens) => {
    if(!phraseTokens.length) return false;
    for(let i=0; i<=tokens.length - phraseTokens.length; i++){
      let ok = true;
      for(let j=0; j<phraseTokens.length; j++){
        if(tokens[i+j] !== phraseTokens[j]){ ok = false; break; }
      }
      if(ok) return true;
    }
    return false;
  };

  const detectDominant = (tokens) => {
    const hasMW = tokens.includes("mahjongways");
    const hasRtpLive = hasPhrase(tokens, ["rtp","live"]) || (tokens.includes("rtp") && tokens.includes("live"));
    const hasSuperScatter = hasPhrase(tokens, ["super","scatter"]) || (tokens.includes("super") && tokens.includes("scatter"));

    if(hasMW) return "MahjongWays";
    if(hasRtpLive) return "RTP Live";
    if(hasSuperScatter) return "Super Scatter";
    return "";
  };

  const ACTION_MAP = [
    { out: "Strategi", keys: ["strategi","teknik","panduan","taktik","cara"] },
    { out: "Bonus", keys: ["bonus","member","new","freespin","free","spin"] },
    { out: "Pola", keys: ["pola","ritme","naik","turun","betting","taruhan","spin"] },
    { out: "Data", keys: ["data","analisis","statistik","temuan","laporan","evaluasi"] },
  ];

  const CONTEXT_MAP = [
    { out: "Pemula", keys: ["pemula","newbie","baru"] },
    { out: "Pemain", keys: ["pemain","komunitas","member","player"] },
    { out: "Modal", keys: ["modal","saldo","budget","bankroll"] },
    { out: "Waktu", keys: ["waktu","jam","periode","awal","tahun","hari","minggu","bulan"] },
  ];

  const pickFirstMatch = (tokens, maps) => {
    for(const t of tokens){
      for(const m of maps){
        if(m.keys.includes(t)) return m.out;
      }
    }
    return "";
  };

  const computeGlobalDefaults = (titles) => {
    const dom = { "MahjongWays": 0, "RTP Live": 0, "Super Scatter": 0 };
    const act = new Map();
    const ctx = new Map();

    const add = (map, key) => map.set(key, (map.get(key) || 0) + 1);

    for(const title of titles){
      const tokens = normalizeTokens(title);

      const d = detectDominant(tokens);
      if(d) dom[d] += 1;

      const a = pickFirstMatch(tokens, ACTION_MAP);
      if(a) add(act, a);

      const c = pickFirstMatch(tokens, CONTEXT_MAP);
      if(c) add(ctx, c);
    }

    const pickTop = (objOrMap, order) => {
      if(objOrMap instanceof Map){
        const ranked = [...objOrMap.entries()].sort((a,b) => (b[1]-a[1]) || a[0].localeCompare(b[0]));
        return ranked[0]?.[0] || "";
      }
      // object
      let best = "";
      let bestN = -1;
      for(const k of order){
        const n = objOrMap[k] || 0;
        if(n > bestN){ bestN = n; best = k; }
      }
      return best;
    };

    const domDefault = pickTop(dom, ["MahjongWays","RTP Live","Super Scatter"]);
    const actDefault = pickTop(act);
    const ctxDefault = pickTop(ctx);

    return {
      domDefault: domDefault || "MahjongWays",
      actDefault: actDefault || "Strategi",
      ctxDefault: ctxDefault || "Pemain",
    };
  };

  // ---------- Smarter anchor-text (3 keywords) ----------
  // Goal: generate *varied* 3-keyword anchor text from the title,
  // not repetitive defaults like "MahjongWays Strategi Pemain".
  const GENERIC_WORDS = new Set([
    // very common / non-informative
    "kasino","online","di","pada","untuk","sebagai","dan","yang","dengan","dari","ke","dalam","atau","agar","tanpa",
    // content-format words
    "strategi","panduan","analisis","kajian","studi","framework","metode","pendekatan","evaluasi","ringkasan","rangkuman",
    "pilar","teknik","tutorial","dasar","lengkap","membedah","membahas","mengulas","menyoroti","tinjauan","sintesis",
    // audience words
    "pemain","player","pemula","pro","profesional","master","member","baru","harian","konsisten","kemenangan",
    // filler
    "cara","bagaimana","mengapa","kapan","mana","lebih","mudah","tepat","aman","optimal","maksimal","terukur","efektif",
  ]);

  const toTitleCase = (s) => s
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.length <= 2 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

  // Phrase rules: ordered by importance. Add new phrases here to keep anchor text rich.
  const PHRASE_RULES = [
    { re: /snowball\s+profit/i, out: "Snowball Profit" },
    { re: /bola\s+salju/i, out: "Bola Salju" },
    { re: /reinvestasi/i, out: "Reinvestasi" },
    { re: /take\s+profit/i, out: "Take Profit" },
    { re: /profit\s+beruntun/i, out: "Profit Beruntun" },
    { re: /over\s*[-]?\s*scaling/i, out: "Over-Scaling" },
    { re: /manajemen\s+risiko/i, out: "Manajemen Risiko" },
    { re: /evaluasi\s+konsistensi/i, out: "Evaluasi Konsistensi" },
    { re: /stabilitas\s+jangka\s+menengah/i, out: "Stabilitas Jangka Menengah" },
    { re: /jangka\s+menengah/i, out: "Jangka Menengah" },
    { re: /sesi/i, out: "Sesi" },
  ];

  const extractKeywordsFromTitle = (title) => {
    const raw = (title || "").trim();
    const picked = [];

    // 1) Keep brand/game if present (helps internal linking relevance)
    if(/mahjongways/i.test(raw)) picked.push("MahjongWays");

    // 2) Prefer meaningful phrases (Snowball Profit, Take Profit, etc.)
    for(const rule of PHRASE_RULES){
      if(picked.length >= 3) break;
      if(rule.re.test(raw) && !picked.includes(rule.out)) picked.push(rule.out);
    }

    // 3) Fill remaining slots with best tokens (non-generic)
    if(picked.length < 3){
      const tokens = raw
        .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
        .replace(/\s+/g, " ")
        .split(" ")
        .map(t => t.trim())
        .filter(Boolean);

      const scored = [];
      for(const t of tokens){
        const tl = t.toLowerCase();
        if(GENERIC_WORDS.has(tl)) continue;
        if(tl === "mahjongways") continue;
        if(t.length <= 2) continue;
        if(/^\d+$/.test(tl)) continue;
        if(picked.some(p => p.toLowerCase() === tl)) continue;

        let score = Math.min(12, t.length);
        if(["profit","reinvestasi","parsial","konsistensi","stabilitas","menggulung","fondasi"].includes(tl)) score += 6;
        if(["snowball","bola","salju"].includes(tl)) score += 8;
        scored.push({ t, score });
      }
      scored.sort((a,b) => b.score - a.score);
      for(const s of scored){
        if(picked.length >= 3) break;
        picked.push(toTitleCase(s.t));
      }
    }

    // 4) Hard fallback to defaults if still short
    while(picked.length < 3){
      const fb = [defaults.domDefault, defaults.actDefault, defaults.ctxDefault];
      for(const f of fb){
        if(picked.length >= 3) break;
        if(!picked.includes(f)) picked.push(f);
      }
      break;
    }

    // Ensure exactly 3 tokens, unique
    const uniq = [];
    for(const p of picked){
      if(!p) continue;
      if(!uniq.some(u => u.toLowerCase() === String(p).toLowerCase())) uniq.push(String(p));
      if(uniq.length >= 3) break;
    }
    return uniq.slice(0,3);
  };

  const buildAnchorKeywords = (title, defaults) => {
    const kws = extractKeywordsFromTitle(title);
    return kws.join(" ");
  };

  const copyText = (el) => {
    const v = el.value || "";
    if(navigator.clipboard && typeof navigator.clipboard.writeText === "function"){
      return navigator.clipboard.writeText(v);
    }
    el.focus();
    el.select();
    document.execCommand("copy");
    return Promise.resolve();
  };

  // ---------- Persist inputs (auto-save) ----------
  const KEY_DOMAIN = "runa_img_domain";
  const KEY_BASE = "runa_img_base";
  const KEY_EXT = "runa_img_ext";

  const KEY_LINK_DOMAIN = "runa_link_domain";
  const KEY_LINK_TITLES = "runa_link_titles";

  const loadSaved = () => {
    const d = localStorage.getItem(KEY_DOMAIN);
    const b = localStorage.getItem(KEY_BASE);
    const e = localStorage.getItem(KEY_EXT);
    if(d && getEl("imgDomain")) getEl("imgDomain").value = d;
    if(b && getEl("imgBaseName")) getEl("imgBaseName").value = b;
    if(e && getEl("imgExt")) getEl("imgExt").value = e;

    const ld = localStorage.getItem(KEY_LINK_DOMAIN);
    const lt = localStorage.getItem(KEY_LINK_TITLES);
    if(ld && getEl("linkDomain")) getEl("linkDomain").value = ld;
    if(lt && getEl("linkTitles")) getEl("linkTitles").value = lt;
  };

  const saveNow = () => {
    if(getEl("imgDomain")) localStorage.setItem(KEY_DOMAIN, getEl("imgDomain").value || "");
    if(getEl("imgBaseName")) localStorage.setItem(KEY_BASE, getEl("imgBaseName").value || "");
    if(getEl("imgExt")) localStorage.setItem(KEY_EXT, getEl("imgExt").value || "");

    if(getEl("linkDomain")) localStorage.setItem(KEY_LINK_DOMAIN, getEl("linkDomain").value || "");
    if(getEl("linkTitles")) localStorage.setItem(KEY_LINK_TITLES, getEl("linkTitles").value || "");
  };

  for(const id of ["imgDomain","imgBaseName","imgExt"]){
    const el = getEl(id);
    if(el) el.addEventListener("input", saveNow);
  }

  for(const id of ["linkDomain","linkTitles"]){
    const el = getEl(id);
    if(el) el.addEventListener("input", saveNow);
  }

  // ---------- Link + Anchor from titles ----------
  const setLinkStatus = (type, msg) => {
    const el = getEl("linkStatus");
    if(!el) return;
    el.className = `status ${type}`;
    el.textContent = msg;
  };

  const setKwHint = (defaults) => {
    const el = getEl("kwHint");
    if(!el) return;
    if(!defaults){ el.textContent = ""; return; }
    el.innerHTML = `Default keyword (fallback) dari daftar judul: <strong>${defaults.domDefault}</strong> &nbsp;•&nbsp; <strong>${defaults.actDefault}</strong> &nbsp;•&nbsp; <strong>${defaults.ctxDefault}</strong>`;
  };

  const generateLinksAndAnchors = (mode = "links") => {
    const domainRaw = getEl("linkDomain")?.value;
    const domain = ensureTrailingSlash(domainRaw);
    const titles = lines(getEl("linkTitles")?.value);

    if(!domain){
      setLinkStatus("bad", "ERROR: Domain kosong.");
      return;
    }
    if(!titles.length){
      setLinkStatus("bad", "ERROR: Daftar judul kosong.");
      return;
    }

    saveNow();

    const defaults = computeGlobalDefaults(titles);
    setKwHint(defaults);

    const links = titles.map(t => joinUrl(domain, smartSlug(t, 50, 12) + ".html"));
    if(getEl("outLinks")) getEl("outLinks").value = links.join("\n");

    const anchors = links.map((link, i) => {
      const kw = buildAnchorKeywords(titles[i], defaults);
      return `<a href="${link}">${kw}</a>`;
    });
    if(getEl("outAnchors")) getEl("outAnchors").value = anchors.join("\n");

    if(mode === "links"){
      setLinkStatus("ok", `Sukses: ${links.length} link dibuat.`);
    } else {
      setLinkStatus("ok", `Sukses: ${anchors.length} anchor dibuat (format <a href=...>).`);
    }
  };

  getEl("btnGenLinks")?.addEventListener("click", () => generateLinksAndAnchors("links"));
  getEl("btnGenAnchors")?.addEventListener("click", () => generateLinksAndAnchors("anchors"));

  getEl("btnResetLinks")?.addEventListener("click", () => {
    if(getEl("linkDomain")) getEl("linkDomain").value = "";
    if(getEl("linkTitles")) getEl("linkTitles").value = "";
    if(getEl("outLinks")) getEl("outLinks").value = "";
    if(getEl("outAnchors")) getEl("outAnchors").value = "";
    localStorage.removeItem(KEY_LINK_DOMAIN);
    localStorage.removeItem(KEY_LINK_TITLES);
    setKwHint(null);
    setLinkStatus("idle", "Reset selesai.");
  });

  getEl("btnCopyLinks")?.addEventListener("click", async () => {
    if(!getEl("outLinks")) return;
    await copyText(getEl("outLinks"));
    setLinkStatus("ok", "Daftar link dicopy.");
  });

  getEl("btnCopyAnchors")?.addEventListener("click", async () => {
    if(!getEl("outAnchors")) return;
    await copyText(getEl("outAnchors"));
    setLinkStatus("ok", "Daftar anchor dicopy.");
  });

  const generate = () => {
    const domain = ensureTrailingSlash(getEl("imgDomain")?.value);
    const base = String(getEl("imgBaseName")?.value || "").trim();
    const ext = String(getEl("imgExt")?.value || "").trim();

    if(!domain || !base || !ext){
      setStatus("bad", "ERROR: Semua box wajib diisi (domain, nama file, format)." );
      return;
    }

    saveNow();

    const out = [];
    for(let i=1; i<=10; i++){
      out.push(`${domain}${base}${i}${ext}`);
    }
    if(getEl("out")) getEl("out").value = out.join("\n");
    setStatus("ok", "Sukses: 10 link dibuat. Klik Copy Hasil.");
  };

  getEl("btnGenerate")?.addEventListener("click", generate);

  getEl("btnReset")?.addEventListener("click", () => {
    if(getEl("imgDomain")) getEl("imgDomain").value = "";
    if(getEl("imgBaseName")) getEl("imgBaseName").value = "";
    if(getEl("imgExt")) getEl("imgExt").value = "";
    if(getEl("out")) getEl("out").value = "";
    localStorage.removeItem(KEY_DOMAIN);
    localStorage.removeItem(KEY_BASE);
    localStorage.removeItem(KEY_EXT);
    setStatus("idle", "Reset selesai.");
  });

  getEl("btnCopy")?.addEventListener("click", async () => {
    if(!getEl("out")) return;
    await copyText(getEl("out"));
    setStatus("ok", "Hasil dicopy.");
  });

  loadSaved();
  setStatus("idle", "Isi 3 box → klik Generate.");
  if(getEl("linkStatus")) setLinkStatus("idle", "Isi domain + judul → generate.");
})();
