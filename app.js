/* global JSZip, saveAs */
const $ = (id) => document.getElementById(id);

let templates = []; // [{name,text}]
let uploadedImages = [];
let csvRows = [];   // normalized rows from CSV (optional)

function setStatus(type, msg){
  const el = $("status");
  el.className = `status ${type}`;
  el.textContent = msg;
}
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, (m)=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
}
function report(items){
  const wrap = $("report");
  wrap.innerHTML = "";
  for(const it of items){
    const k = document.createElement("div");
    k.className="k"; k.textContent = it.k;
    const v = document.createElement("div");
    v.className="v"; v.innerHTML = it.v;
    wrap.appendChild(k); wrap.appendChild(v);
  }
}
function lines(text){
  return String(text||"").split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
}

// --- Article blocks: -###- ... -$$$-
function parseArticleBlocks(text){
  const s = String(text || "");
  const re = /-###-\s*([\s\S]*?)\s*-\$\$\$-/g;
  const out = [];
  let m;
  while((m = re.exec(s))){
    const block = (m[1] ?? "").trim();
    if(block) out.push(block);
  }
  return out;
}

// --- Filename helpers
function safeFilename(name){
  return String(name || "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 180) || "file";
}
function filenameFromLink(url){
  try{
    const u = new URL(url);
    const path = u.pathname.split("/").filter(Boolean);
    let base = path[path.length-1] || "artikel.html";
    if(!base.toLowerCase().endsWith(".html")) base += ".html";
    return safeFilename(base);
  }catch{
    return "artikel.html";
  }
}
function firstDirFromLink(url){
  try{
    const u = new URL(url);
    const path = u.pathname.split("/").filter(Boolean);
    return path.length >= 2 ? safeFilename(path[0]) : "";
  }catch{ return ""; }
}
function imageNameFromUrl(url, fallbackExt){
  try{
    const u = new URL(url);
    let base = u.pathname.split("/").filter(Boolean).pop() || "image";
    base = decodeURIComponent(base);
    const hasExt = /\.[a-z0-9]{2,5}$/i.test(base);
    if(!hasExt && fallbackExt) base += fallbackExt;
    return safeFilename(base);
  }catch{
    return safeFilename("image" + (fallbackExt || ""));
  }
}

// --- Integrity masking helpers
function maskTemplateWithTokens(text, phTitle, phLink, phImg, phArticle, phRelated){
  return text.split(phTitle).join("__PH_TITLE__")
             .split(phLink).join("__PH_LINK__")
             .split(phImg).join("__PH_IMG__")
             .split(phArticle).join("__PH_ARTICLE__")
             .split(phRelated).join("__PH_RELATED__");
}
function maskOutputToTokens(text, title, link, img, article, related){
  return text.split(title).join("__PH_TITLE__")
             .split(link).join("__PH_LINK__")
             .split(img).join("__PH_IMG__")
             .split(article).join("__PH_ARTICLE__")
             .split(related).join("__PH_RELATED__");
}

// --- Seeded random
function xmur3(str){
  let h = 1779033703 ^ str.length;
  for(let i=0;i<str.length;i++){
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function(){
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= (h >>> 16)) >>> 0;
  };
}
function mulberry32(a){
  return function(){
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seededRng(seedStr){
  const seed = xmur3(seedStr)();
  return mulberry32(seed);
}
function pickRelated(i, items, count, rng){
  const idx = [];
  for(let k=0;k<items.length;k++) if(k!==i) idx.push(k);
  // shuffle
  for(let a=idx.length-1;a>0;a--){
    const b = Math.floor(rng()*(a+1));
    [idx[a], idx[b]] = [idx[b], idx[a]];
  }
  return idx.slice(0, Math.max(0, Math.min(count, idx.length)));
}
function renderRelated(heading, format, picks, items){
  if(!picks.length) return "";
  const h = heading ? `<h2>${escapeHtml(heading)}</h2>` : "";
  if(format === "p"){
    const bits = picks.map(j=>{
      const t = escapeHtml(items[j].title || `Artikel ${j+1}`);
      const l = escapeHtml(items[j].link || "#");
      return `<a href="${l}">${t}</a>`;
    });
    return `${h}<p>${bits.join(" &bull; ")}</p>`;
  }
  // ul
  const lis = picks.map(j=>{
    const t = escapeHtml(items[j].title || `Artikel ${j+1}`);
    const l = escapeHtml(items[j].link || "#");
    return `<li><a href="${l}">${t}</a></li>`;
  }).join("");
  return `${h}<ul>${lis}</ul>`;
}

// --- CSV import (simple RFC-ish parser)
function parseCSV(text){
  const s = String(text||"");
  const rows = [];
  let cur = [], cell = "", inQ = false;
  for(let i=0;i<s.length;i++){
    const ch = s[i];
    if(inQ){
      if(ch === '"'){
        if(s[i+1] === '"'){ cell += '"'; i++; }
        else inQ = false;
      }else cell += ch;
    }else{
      if(ch === '"') inQ = true;
      else if(ch === ','){ cur.push(cell); cell=""; }
      else if(ch === '\n'){
        cur.push(cell); rows.push(cur); cur=[]; cell="";
      }else if(ch === '\r'){ /* ignore */ }
      else cell += ch;
    }
  }
  cur.push(cell); rows.push(cur);
  // trim empty last
  while(rows.length && rows[rows.length-1].every(c=>String(c).trim()==="")) rows.pop();
  return rows;
}
function normalizeCsvRows(table){
  if(!table.length) return [];
  const header = table[0].map(h=>String(h||"").trim().toLowerCase());
  const idx = (name)=> header.indexOf(name);
  const iTitle = idx("title"), iLink = idx("link"), iImage = idx("image"), iArticle = idx("article");
  if(iTitle<0 || iLink<0 || iImage<0 || iArticle<0) throw new Error("CSV wajib punya header: title, link, image, article");
  const iFolder = idx("folder");
  const iSlug = idx("slug");
  const iTags = idx("tags");

  const out = [];
  for(let r=1;r<table.length;r++){
    const row = table[r];
    const title = String(row[iTitle] ?? "").trim();
    const link = String(row[iLink] ?? "").trim();
    const image = String(row[iImage] ?? "").trim();
    const article = String(row[iArticle] ?? "").trim();
    if(!title && !link && !image && !article) continue;
    out.push({
      title, link, image, article,
      folder: iFolder>=0 ? String(row[iFolder] ?? "").trim() : "",
      slug: iSlug>=0 ? String(row[iSlug] ?? "").trim() : "",
      tags: iTags>=0 ? String(row[iTags] ?? "").trim() : ""
    });
  }
  return out;
}

// --- Templates
async function loadTemplates(fileList){
  templates = [];
  for(const f of Array.from(fileList || [])){
    const text = await f.text();
    templates.push({name: f.name || "template.html", text});
  }
  if(!templates.length){
    $("tplMeta").textContent = "Belum dimuat";
    setStatus("bad", "ERROR: Template belum di-upload.");
    return;
  }
  $("tplMeta").textContent = `${templates.length} template • ${templates.map(t=>t.name).join(", ")}`;
  setStatus("ok", "Template dimuat. Silakan isi data / import CSV.");
  report([{k:"Template", v:`<code>${escapeHtml(templates.length)}</code> file` }]);
}
$("templateFiles").addEventListener("change", async (e)=>{
  await loadTemplates(e.target.files);
});

// --- Artikel.txt load (manual)
$("articleFile").addEventListener("change", async (e)=>{
  const f = e.target.files?.[0];
  if(!f) return;
  const txt = await f.text();
  $("articles").value = txt;
  setStatus("ok", `Artikel dimuat dari file: ${f.name}`);
});

// --- Image upload
$("imageFiles").addEventListener("change", (e)=>{
  uploadedImages = Array.from(e.target.files || []);
  if(uploadedImages.length){
    setStatus("ok", `Gambar dipilih: ${uploadedImages.length} file`);
  }
});

// --- Tabs
function setTab(name){
  for(const el of document.querySelectorAll(".tab")){
    el.classList.toggle("active", el.dataset.tab === name);
  }
  $("tab-manual").classList.toggle("hidden", name !== "manual");
  $("tab-csv").classList.toggle("hidden", name !== "csv");
  $("tab-advanced").classList.toggle("hidden", name !== "advanced");
}
document.querySelectorAll(".tab").forEach(t=>{
  t.addEventListener("click", ()=> setTab(t.dataset.tab));
});

// --- CSV import handler
$("csvFile").addEventListener("change", async (e)=>{
  const f = e.target.files?.[0];
  if(!f) return;
  const txt = await f.text();
  const table = parseCSV(txt);
  let rows;
  try{
    rows = normalizeCsvRows(table);
  }catch(err){
    setStatus("bad", `ERROR: ${err.message || err}`);
    return;
  }
  csvRows = rows;

  // preview 10 lines
  const preview = rows.slice(0,10).map((r,i)=>`${i+1}. ${r.title} | ${r.link} | ${r.image} | folder=${r.folder || "-"} | slug=${r.slug || "-"}`).join("\n");
  $("csvPreview").value = preview || "(kosong)";

  setStatus("ok", `CSV loaded: ${rows.length} baris`);
  report([{k:"CSV", v:`<code>${rows.length}</code> baris siap generate` }]);
});

// --- Sample / reset
$("btnLoadSample").addEventListener("click", ()=>{
  $("titles").value = ["Judul Contoh 1","Judul Contoh 2"].join("\n");
  $("links").value  = ["https://example.com/fase-stabil/contoh-1.html","https://example.com/fase-fluktuatif/contoh-2.html"].join("\n");
  $("images").value = ["https://example.com/img/1.webp","https://example.com/img/2.webp"].join("\n");
  $("articles").value = [
    "-###-\n<p>Ini contoh artikel panjang 1. Anda bisa menulis HTML lengkap di sini.</p>\n-$$$-",
    "-###-\n<p>Ini contoh artikel panjang 2. Pastikan marker <strong>-###-</strong> dan <strong>-$$$-</strong> ada di baris sendiri.</p>\n-$$$-"
  ].join("\n");
  setStatus("warn", "Contoh data terisi. Ganti dengan data asli.");
});

$("btnReset").addEventListener("click", ()=>{
  templates = []; csvRows = []; uploadedImages = [];
  $("templateFiles").value = "";
  $("tplMeta").textContent = "Belum dimuat";
  $("titles").value = ""; $("links").value = ""; $("images").value = ""; $("articles").value = "";
  $("articleFile").value = ""; $("imageFiles").value = ""; $("csvFile").value = ""; $("csvPreview").value = "";
  $("zipName").value = "artikel-output.zip";
  $("phTitle").value = "*JUDUL*";
  $("phLink").value = "*LINK*";
  $("phImg").value = "*GAMBAR*";
  $("phArticle").value = "*ARTIKEL*";
  $("phRelated").value = "*RELATED*";
  $("relatedMode").value = "off";
  $("relatedCount").value = "5";
  $("relatedFormat").value = "ul";
  $("relatedHeading").value = "Bacaan Terkait";
  $("templateMode").value = "single";
  $("folderMode").value = "flat";
  $("chkStrict").checked = true;
  $("chkNameFromLink").checked = true;
  $("chkAutoRefresh").checked = true;
  setStatus("idle", "Reset selesai.");
  report([]);
});

// --- Build dataset
function buildItems(){
  if(csvRows.length){
    // CSV rows already contain full article without markers — we will use as-is
    return csvRows.map(r=>({ ...r }));
  }
  const arrTitle = lines($("titles").value);
  const arrLink  = lines($("links").value);
  const arrImg   = lines($("images").value);
  const arrArticle = parseArticleBlocks($("articles").value);
  const n = Math.max(arrTitle.length, arrLink.length, arrImg.length);

  if(n === 0) throw new Error("Data kosong. Isi minimal 1 baris atau import CSV.");
  if(arrTitle.length !== n || arrLink.length !== n || arrImg.length !== n){
    throw new Error(`Jumlah baris tidak sama. Judul=${arrTitle.length}, Link=${arrLink.length}, Gambar=${arrImg.length}`);
  }
  if(arrArticle.length !== n){
    throw new Error(`Jumlah blok ARTIKEL tidak sama. Artikel=${arrArticle.length}, Baris=${n}. Pastikan marker -###- ... -$$$- benar.`);
  }
  return Array.from({length:n}).map((_,i)=>({
    title: arrTitle[i], link: arrLink[i], image: arrImg[i], article: arrArticle[i],
    folder: "", slug: "", tags: ""
  }));
}

function validateTemplatesAndPlaceholders(items){
  if(!templates.length) throw new Error("Template belum di-upload.");
  const phTitle = $("phTitle").value;
  const phLink  = $("phLink").value;
  const phImg   = $("phImg").value;
  const phArticle = $("phArticle").value;
  const phRelated = $("phRelated").value;

  if(!phTitle || !phLink || !phImg || !phArticle) throw new Error("Placeholder tidak boleh kosong.");

  // validate across all templates
  const missing = [];
  for(const t of templates){
    if(!t.text.includes(phTitle)) missing.push(`${t.name}: ${phTitle}`);
    if(!t.text.includes(phLink))  missing.push(`${t.name}: ${phLink}`);
    if(!t.text.includes(phImg))   missing.push(`${t.name}: ${phImg}`);
    if(!t.text.includes(phArticle)) missing.push(`${t.name}: ${phArticle}`);
  }
  if(missing.length) throw new Error(`Placeholder wajib tidak ditemukan: ${missing.join(" | ")}`);

  // images upload count check (optional)
  if(uploadedImages.length && uploadedImages.length !== items.length){
    throw new Error(`Jumlah file gambar yang di-upload tidak sama. Upload=${uploadedImages.length}, Baris=${items.length}.`);
  }

  return { phTitle, phLink, phImg, phArticle, phRelated };
}

function chooseTemplate(i, rng){
  const mode = $("templateMode").value;
  if(mode === "single" || templates.length === 1) return templates[0];
  if(mode === "rotate") return templates[i % templates.length];
  // random
  const j = Math.floor(rng() * templates.length);
  return templates[j];
}

function buildOutput(items){
  const strict = $("chkStrict").checked;
  const nameFromLink = $("chkNameFromLink").checked;
  const folderMode = $("folderMode").value;

  const relatedMode = $("relatedMode").value;
  const relatedCount = Math.max(0, parseInt($("relatedCount").value || "0", 10) || 0);
  const relatedFormat = $("relatedFormat").value;
  const relatedHeading = ($("relatedHeading").value || "").trim();

  const zipName = ($("zipName").value || "artikel-output.zip").trim();
  const rng = seededRng(zipName + "::runa-pro");

  const { phTitle, phLink, phImg, phArticle, phRelated } = validateTemplatesAndPlaceholders(items);

  const nameSet = new Set();
  const outputs = [];
  const integrityErrors = [];

  for(let i=0;i<items.length;i++){
    const it = items[i];
    const tpl = chooseTemplate(i, rng);

    const picks = (relatedMode !== "off" && relatedCount>0) ? pickRelated(i, items, relatedCount, rng) : [];
    const relatedHtml = (relatedMode !== "off") ? renderRelated(relatedHeading, relatedFormat, picks, items) : "";

    // article may be appended
    let article = it.article || "";
    if(relatedMode === "append" && relatedHtml){
      article = `${article}\n${relatedHtml}`;
    }

    let out = tpl.text
      .split(phTitle).join(it.title || "")
      .split(phLink).join(it.link || "")
      .split(phImg).join(it.image || "")
      .split(phArticle).join(article);

    if(relatedMode === "placeholder"){
      if(tpl.text.includes(phRelated)){
        out = out.split(phRelated).join(relatedHtml);
      }else if(relatedHtml){
        // fallback: append to article if placeholder absent
        out = out.split(phArticle).join(`${article}\n${relatedHtml}`);
      }
    }else{
      // if off/append: remove placeholder if exists
      if(tpl.text.includes(phRelated)) out = out.split(phRelated).join("");
    }

    // strict integrity check
    if(strict){
      const templateMasked = maskTemplateWithTokens(tpl.text, phTitle, phLink, phImg, phArticle, phRelated);
      const outMasked = maskOutputToTokens(out, it.title||"", it.link||"", it.image||"", article, relatedHtml);
      if(outMasked !== templateMasked){
        integrityErrors.push({i:i+1, file:"(pending)", reason:`Integrity mismatch pada template ${tpl.name}`});
      }
    }

    // filename
    let fname = "artikel.html";
    if(it.slug) fname = safeFilename(it.slug) + (String(it.slug).toLowerCase().endsWith(".html") ? "" : ".html");
    else if(nameFromLink) fname = filenameFromLink(it.link || "");
    else fname = "artikel.html";

    if(nameSet.has(fname)){
      const base = fname.replace(/\.html$/i,"");
      fname = `${base}-${i+1}.html`;
    }
    nameSet.add(fname);

    // folder
    let folder = "";
    if(folderMode === "csv") folder = safeFilename(it.folder || "");
    else if(folderMode === "linkpath") folder = firstDirFromLink(it.link || "");
    if(folder) folder = folder.replace(/^\/+|\/+$/g,"");

    const path = folder ? `${folder}/${fname}` : fname;
    outputs.push({ path, fname, folder, template: tpl.name, title: it.title, link: it.link, image: it.image, out });
  }

  // fill file names in integrity errors
  for(const e of integrityErrors){
    const o = outputs[e.i-1];
    if(o) e.file = o.path;
  }

  return { outputs, integrityErrors };
}

// --- Preview / Generate
$("btnPreview").addEventListener("click", ()=>{
  try{
    const items = buildItems();
    const { outputs, integrityErrors } = buildOutput(items);
    if($("chkStrict").checked && integrityErrors.length){
      setStatus("bad", `ERROR: Integrity check gagal pada ${integrityErrors.length} file. Preview dibatalkan.`);
      report([{k:"Integrity", v:`Gagal pada: <code>${integrityErrors.map(e=>escapeHtml(e.file)).join(", ")}</code>`}]);
      return;
    }
    const first = outputs[0];
    const blob = new Blob([first.out], {type:"text/html"});
    const url = URL.createObjectURL(blob);
    $("previewName").textContent = first.path;
    $("previewFrame").src = url;
    $("modal").showModal();
  }catch(err){
    setStatus("bad", `ERROR: ${err?.message || String(err)}`);
  }
});

$("btnClose").addEventListener("click", ()=>{
  try{
    const iframe = $("previewFrame");
    const src = iframe.src;
    iframe.src = "about:blank";
    if(src.startsWith("blob:")) URL.revokeObjectURL(src);
  }catch{}
  $("modal").close();
});

function toCsvRow(fields){
  const esc = (v)=>{
    const s = String(v ?? "");
    if(/[",\n\r]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
    return s;
  };
  return fields.map(esc).join(",");
}

$("btnGenerate").addEventListener("click", async ()=>{
  try{
    $("btnGenerate").disabled = true;

    const items = buildItems();
    const { outputs, integrityErrors } = buildOutput(items);

    if($("chkStrict").checked && integrityErrors.length){
      setStatus("bad", `ERROR: Integrity check gagal pada ${integrityErrors.length} file. ZIP dibatalkan.`);
      report([{k:"Integrity", v:`Gagal pada: <code>${integrityErrors.map(e=>escapeHtml(e.file)).join(", ")}</code>`}]);
      $("btnGenerate").disabled = false;
      return;
    }

    let zipName = ($("zipName").value || "artikel-output.zip").trim();
    if(!zipName.toLowerCase().endsWith(".zip")) zipName += ".zip";

    const zip = new JSZip();

    // add html outputs (with folder)
    for(const f of outputs){
      zip.file(f.path, f.out);
    }

    // add images folder
    if(uploadedImages.length){
      const imgFolder = zip.folder("images");
      const used = new Set();
      for(let i=0;i<uploadedImages.length;i++){
        const file = uploadedImages[i];
        const ext = (()=>{
          const m2 = (file.name || "").match(/\.[a-z0-9]{2,5}$/i);
          return m2 ? m2[0].toLowerCase() : "";
        })();
        const desiredUrl = outputs[i]?.image || "";
        let outName = imageNameFromUrl(desiredUrl, ext);
        if(!/\.[a-z0-9]{2,5}$/i.test(outName) && ext) outName += ext;
        if(used.has(outName)){
          const base = outName.replace(/\.[a-z0-9]{2,5}$/i, "");
          const eext = (outName.match(/\.[a-z0-9]{2,5}$/i) || [""])[0];
          outName = `${base}-${i+1}${eext}`;
        }
        used.add(outName);
        imgFolder.file(outName, file);
      }
    }

    // manifest.csv
    const manifest = [
      toCsvRow(["path","title","link","image","template","folder"])
    ].concat(outputs.map(o=>toCsvRow([o.path,o.title,o.link,o.image,o.template,o.folder])));
    zip.file("manifest.csv", manifest.join("\n"));

    // report.json
    const now = new Date().toISOString();
    const rep = {
      generated_at: now,
      count: outputs.length,
      templates: templates.map(t=>t.name),
      options: {
        templateMode: $("templateMode").value,
        folderMode: $("folderMode").value,
        strict: $("chkStrict").checked,
        nameFromLink: $("chkNameFromLink").checked,
        relatedMode: $("relatedMode").value,
        relatedCount: parseInt($("relatedCount").value||"0",10)||0,
        relatedFormat: $("relatedFormat").value,
        relatedHeading: $("relatedHeading").value || ""
      }
    };
    zip.file("report.json", JSON.stringify(rep, null, 2));

    setStatus("ok", `Sukses: ${outputs.length} file dibuat. Menyiapkan ZIP...`);
    report([
      {k:"Output", v:`<code>${outputs.length}</code> file HTML`},
      {k:"ZIP", v:`<code>${escapeHtml(zipName)}</code>`},
      {k:"Template", v:`Mode=<code>${escapeHtml($("templateMode").value)}</code> • Total=<code>${templates.length}</code>`},
      {k:"Folder", v:`Mode=<code>${escapeHtml($("folderMode").value)}</code>`},
      {k:"Related", v:`Mode=<code>${escapeHtml($("relatedMode").value)}</code> • Count=<code>${escapeHtml($("relatedCount").value)}</code>`}
    ]);

    const blob = await zip.generateAsync({type:"blob"});
    saveAs(blob, zipName);

    if($("chkAutoRefresh").checked){
      setStatus("ok", "ZIP terunduh. Auto refresh aktif — halaman akan dimuat ulang.");
      setTimeout(()=>{ try{ location.reload(); }catch{ $("btnGenerate").disabled = false; } }, 900);
    }else{
      $("btnGenerate").disabled = false;
    }
  }catch(err){
    setStatus("bad", `ERROR: ${err?.message || String(err)}`);
    report([{k:"Exception", v:`<code>${escapeHtml(err?.stack || String(err))}</code>`}]);
    $("btnGenerate").disabled = false;
  }
});

// initial
setStatus("idle", "Upload template untuk memulai.");
report([
  {k:"Tips", v:"Gunakan placeholder unik (mis. <code>{{JUDUL}}</code>, <code>{{LINK}}</code>, <code>{{GAMBAR}}</code>, <code>{{ARTIKEL}}</code>, <code>{{RELATED}}</code>) untuk menghindari bentrok."}
]);
