/* global JSZip, saveAs */
const $ = (id) => document.getElementById(id);

let templateText = "";
let templateName = "";
let articleRawText = "";
let uploadedImages = [];

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
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `<div class="k">${escapeHtml(it.k)}</div><div class="v">${it.v}</div>`;
    wrap.appendChild(div);
  }
}
function lines(text){
  return text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
}

// Parse artikel blocks using markers:
// -###-  (start marker on its own line)
// ...
// -$$$-  (end marker on its own line)
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
function filenameFromLink(url){
  try{
    const u = new URL(url);
    const path = u.pathname.split("/").filter(Boolean);
    let base = path[path.length-1] || "artikel.html";
    if(!base.toLowerCase().endsWith(".html")) base += ".html";
    base = base.replace(/[\\/:*?"<>|]+/g, "-");
    return base;
  }catch{
    return "artikel.html";
  }
}

function safeFilename(name){
  return String(name || "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 180) || "file";
}

function imageNameFromUrl(url, fallbackExt){
  // Use last path segment from URL as desired output name.
  // If URL has no extension, use uploaded file extension.
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

// Integrity masking helpers
function maskTemplateWithTokens(text, phTitle, phLink, phImg, phArticle, phRelated, useRelated){
  return text.split(phTitle).join("__PH_TITLE__")
             .split(phLink).join("__PH_LINK__")
             .split(phImg).join("__PH_IMG__")
             .split(phArticle).join("__PH_ARTICLE__")
             .split(useRelated ? phRelated : "__NO_RELATED__").join("__PH_RELATED__");
}
function maskOutputToTokens(text, title, link, img, article, relatedHtml, useRelated){
  return text.split(title).join("__PH_TITLE__")
             .split(link).join("__PH_LINK__")
             .split(img).join("__PH_IMG__")
             .split(article).join("__PH_ARTICLE__")
             .split(useRelated ? relatedHtml : "__NO_RELATED__").join("__PH_RELATED__");
}

async function loadTemplate(file){
  templateText = await file.text();
  templateName = file.name || "template.html";
  $("tplMeta").textContent = `${templateName} • ${templateText.length.toLocaleString()} karakter`;
  setStatus("ok", "Template dimuat. Silakan isi data.");
  report([{k:"Template loaded", v:`<code>${escapeHtml(templateName)}</code>`}]);
}

$("templateFile").addEventListener("change", async (e)=>{
  const f = e.target.files?.[0];
  if(!f) return;
  await loadTemplate(f);
});

// drag & drop
const tplDz = $("tplDropzone");
tplDz.addEventListener("dragover", (e)=>{ e.preventDefault(); tplDz.style.borderColor="rgba(59,130,246,.75)"; });
tplDz.addEventListener("dragleave", ()=>{ tplDz.style.borderColor="rgba(255,255,255,.22)"; });
tplDz.addEventListener("drop", async (e)=>{
  e.preventDefault();
  tplDz.style.borderColor="rgba(255,255,255,.22)";
  const f = e.dataTransfer?.files?.[0];
  if(f) await loadTemplate(f);
});

$("btnReset").addEventListener("click", ()=>{
  templateText = ""; templateName = "";
  articleRawText = "";
  $("templateFile").value = "";
  $("tplMeta").textContent = "Belum dimuat";
  $("titles").value = "";
  $("links").value = "";
  $("images").value = "";
  $("articles").value = "";
  $("articleFile").value = "";
  $("imageFiles").value = "";
  uploadedImages = [];
  $("zipName").value = "artikel-output.zip";
  $("phTitle").value = "*JUDUL*";
  $("phLink").value = "*LINK*";
  $("phImg").value = "*GAMBAR*";
  $("phArticle").value = "*ARTIKEL*";
  $("chkStrict").checked = true;
  $("chkNameFromLink").checked = true;
  $("chkAutoRefresh").checked = true;
  $("chkFolderFromLink").checked = false;
  $("chkRelated").checked = false;
  $("chkAppendRelated").checked = true;
  $("phRelated").value = "*RELATED*";
  $("relatedCount").value = 5;
  setStatus("idle", "Reset selesai.");
  report([]);
});

$("btnLoadSample").addEventListener("click", ()=>{
  $("titles").value = ["Judul Contoh 1","Judul Contoh 2"].join("\n");
  $("links").value  = ["https://example.com/fyp/contoh-1.html","https://example.com/fyp/contoh-2.html"].join("\n");
  $("images").value = ["https://example.com/img/1.webp","https://example.com/img/2.webp"].join("\n");
  $("articles").value = [
    "-###-\n<p>Ini contoh artikel panjang 1. Anda bisa menulis HTML lengkap di sini.</p>\n-$$$-",
    "-###-\n<p>Ini contoh artikel panjang 2. Pastikan marker <strong>-###-</strong> dan <strong>-$$$-</strong> ada di baris sendiri.</p>\n-$$$-"
  ].join("\n");
  setStatus("warn", "Contoh data terisi. Ganti dengan data asli.");
  report([{k:"Sample", v:"Data contoh sudah diisi."}]);
});

// load artikel.txt (optional)
$("articleFile").addEventListener("change", async (e)=>{
  const f = e.target.files?.[0];
  if(!f) return;
  articleRawText = await f.text();
  $("articles").value = articleRawText;
  setStatus("ok", `Artikel dimuat dari file: ${f.name}`);
  report([{k:"Artikel loaded", v:`<code>${escapeHtml(f.name)}</code> • ${articleRawText.length.toLocaleString()} karakter`}]);
});

// load images (optional)
$("imageFiles").addEventListener("change", (e)=>{
  uploadedImages = Array.from(e.target.files || []);
  if(uploadedImages.length){
    setStatus("ok", `Gambar dipilih: ${uploadedImages.length} file`);
    report([{k:"Images selected", v:`${uploadedImages.length} file (akan di-rename mengikuti daftar GAMBAR)`}]);
  }
});

function validateBasics(){
  if(!templateText){
    setStatus("bad", "ERROR: Template belum di-upload.");
    return { ok:false };
  }
  const phTitle = $("phTitle").value;
  const phLink  = $("phLink").value;
  const phImg   = $("phImg").value;
  const phArticle = $("phArticle").value;
  const phRelated = $("phRelated") ? $("phRelated").value : "";
  if(!phTitle || !phLink || !phImg || !phArticle){
    setStatus("bad", "ERROR: Placeholder tidak boleh kosong.");
    return { ok:false };
  }
  const missing = [];
  if(!templateText.includes(phTitle)) missing.push(phTitle);
  if(!templateText.includes(phLink))  missing.push(phLink);
  if(!templateText.includes(phImg))   missing.push(phImg);
  if(!templateText.includes(phArticle)) missing.push(phArticle);
  // related is optional: only validate if user enables related AND intends to use placeholder
  const relatedEnabled = $("chkRelated")?.checked;
  const useRelatedPlaceholder = Boolean(relatedEnabled && phRelated && templateText.includes(phRelated));
  if(relatedEnabled && phRelated && !useRelatedPlaceholder && !$("chkAppendRelated")?.checked){
    setStatus("bad", `ERROR: Related aktif, tapi placeholder Related tidak ditemukan di template dan Append Related dimatikan.`);
    report([{k:"Related", v:`Aktif, namun <code>${escapeHtml(phRelated)}</code> tidak ada di template. Nyalakan <b>Append related</b> atau masukkan placeholder ke template.`}]);
    return { ok:false };
  }
  if(missing.length){
    setStatus("bad", `ERROR: Placeholder tidak ditemukan di template: ${missing.join(", ")}`);
    report([{k:"Placeholder missing", v:`<code>${escapeHtml(missing.join(", "))}</code>`}]);
    return { ok:false };
  }

  const arrTitle = lines($("titles").value);
  const arrLink  = lines($("links").value);
  const arrImg   = lines($("images").value);
  const arrArticle = parseArticleBlocks($("articles").value);
  const n = Math.max(arrTitle.length, arrLink.length, arrImg.length);

  if(uploadedImages.length && uploadedImages.length !== n){
    setStatus("bad", `ERROR: Jumlah file gambar yang di-upload tidak sama. Upload=${uploadedImages.length}, Baris=${n}.`);
    report([{k:"Upload gambar", v:`Upload=<code>${uploadedImages.length}</code>, Baris=<code>${n}</code>. Samakan jumlahnya agar rename sesuai daftar GAMBAR.`}]);
    return { ok:false };
  }

  if(n === 0){
    setStatus("bad", "ERROR: Data kosong. Isi minimal 1 baris.");
    return { ok:false };
  }
  if(arrTitle.length !== n || arrLink.length !== n || arrImg.length !== n){
    setStatus("bad", `ERROR: Jumlah baris tidak sama. Judul=${arrTitle.length}, Link=${arrLink.length}, Gambar=${arrImg.length}`);
    report([{k:"Jumlah baris", v:`Judul=<code>${arrTitle.length}</code>, Link=<code>${arrLink.length}</code>, Gambar=<code>${arrImg.length}</code>`}]);
    return { ok:false };
  }

  if(arrArticle.length !== n){
    setStatus("bad", `ERROR: Jumlah blok ARTIKEL tidak sama. Artikel=${arrArticle.length}, Baris=${n}. Pastikan format marker -###- ... -$$$- benar.`);
    report([
      {k:"Artikel blocks", v:`Artikel=<code>${arrArticle.length}</code>, Baris=<code>${n}</code>`},
      {k:"Format", v:`Gunakan marker pembuka <code>-###-</code> dan penutup <code>-$$$-</code> (di baris sendiri).`}
    ]);
    return { ok:false };
  }

  return { ok:true, phTitle, phLink, phImg, phArticle, phRelated, relatedEnabled, useRelatedPlaceholder, arrTitle, arrLink, arrImg, arrArticle, n };
}

function firstFolderFromLink(url){
  try{
    const u = new URL(url);
    const seg = u.pathname.split("/").filter(Boolean)[0] || "";
    return safeFilename(seg);
  }catch{
    return "";
  }
}

function buildRelatedHtml(i, arrTitle, arrLink, count){
  const n = arrTitle.length;
  const k = Math.max(0, Math.min(Number(count)||0, n-1));
  if(k === 0) return "";
  const items = [];
  // deterministic pick: take next k items circularly
  let j = (i+1) % n;
  while(items.length < k){
    if(j !== i){
      items.push({t: arrTitle[j], l: arrLink[j]});
    }
    j = (j+1) % n;
  }
  const li = items.map(it => `<li><a href="${escapeHtml(it.l)}">${escapeHtml(it.t)}</a></li>`).join("");
  return `<div class="related"><h3>Artikel Terkait</h3><ul>${li}</ul></div>`;
}

function buildOutputs(payload){
  const { phTitle, phLink, phImg, phArticle, phRelated, relatedEnabled, useRelatedPlaceholder, arrTitle, arrLink, arrImg, arrArticle, n } = payload;
  const strict = $("chkStrict").checked;
  const nameFromLink = $("chkNameFromLink").checked;
  const folderFromLink = $("chkFolderFromLink")?.checked;
  const relatedCount = $("relatedCount")?.value;
  const appendRelated = $("chkAppendRelated")?.checked;

  const templateMasked = maskTemplateWithTokens(templateText, phTitle, phLink, phImg, phArticle, phRelated, useRelatedPlaceholder);
  const outputs = [];
  const integrityErrors = [];
  const nameSet = new Set();

  for(let i=0;i<n;i++){
    const title = arrTitle[i], link = arrLink[i], img = arrImg[i], article = arrArticle[i];

    const relatedHtml = relatedEnabled ? buildRelatedHtml(i, arrTitle, arrLink, relatedCount) : "";
    const articleFinal = (relatedEnabled && appendRelated && !useRelatedPlaceholder && relatedHtml)
      ? `${article}\n${relatedHtml}`
      : article;

    let out = templateText
      .split(phTitle).join(title)
      .split(phLink).join(link)
      .split(phImg).join(img)
      .split(phArticle).join(articleFinal);

    if(useRelatedPlaceholder){
      out = out.split(phRelated).join(relatedHtml);
    }

    if(strict){
      const outMasked = maskOutputToTokens(out, title, link, img, articleFinal, relatedHtml, useRelatedPlaceholder);
      if(outMasked !== templateMasked){
        integrityErrors.push({i:i+1, reason:"Integrity mismatch (ada perubahan selain placeholder)"});
      }
    }

    let fname = "artikel.html";
    if(nameFromLink) fname = filenameFromLink(link);
    // de-dup
    if(nameSet.has(fname)){
      const base = fname.replace(/\.html$/i,"");
      fname = `${base}-${i+1}.html`;
    }
    nameSet.add(fname);

    const folder = folderFromLink ? firstFolderFromLink(link) : "";
    outputs.push({ fname, out, folder, title, link, img });
  }

  return { outputs, integrityErrors };
}

$("btnGenerate").addEventListener("click", async ()=>{
  try{
    // prevent double click
    $("btnGenerate").disabled = true;
    const v = validateBasics();
    if(!v.ok){
      $("btnGenerate").disabled = false;
      return;
    }

    const { outputs, integrityErrors } = buildOutputs(v);

    if(integrityErrors.length){
      setStatus("bad", `ERROR: Integrity check gagal pada ${integrityErrors.length} file. ZIP dibatalkan.`);
      report([
        {k:"Integrity check", v:`Gagal pada: <code>${integrityErrors.map(e=>`#${e.i}`).join(", ")}</code>`},
        {k:"Saran", v:`Gunakan placeholder yang lebih unik (mis. <code>{{JUDUL}}</code>) dan pastikan template hanya berisi placeholder itu.`}
      ]);
      $("btnGenerate").disabled = false;
      return;
    }

    let zipName = $("zipName").value.trim() || "artikel-output.zip";
    if(!zipName.toLowerCase().endsWith(".zip")) zipName += ".zip";

    const zip = new JSZip();
    for(const f of outputs){
      if(f.folder){
        zip.folder(f.folder).file(f.fname, f.out);
      }else{
        zip.file(f.fname, f.out);
      }
    }

    // Add manifest + report
    const manifestRows = ["no,folder,filename,title,link,image"].concat(
      outputs.map((f, idx)=>[
        idx+1,
        (f.folder||""),
        f.fname,
        `"${String(f.title).replace(/"/g,'""')}"`,
        f.link,
        f.img
      ].join(","))
    ).join("\n");
    zip.file("manifest.csv", manifestRows);
    zip.file("report.json", JSON.stringify({
      generated_at: new Date().toISOString(),
      count: outputs.length,
      options: {
        strict: $("chkStrict").checked,
        name_from_link: $("chkNameFromLink").checked,
        folder_from_link: $("chkFolderFromLink")?.checked,
        related_enabled: $("chkRelated")?.checked,
        related_count: Number($("relatedCount")?.value || 0) || 0,
        related_placeholder_used: Boolean(v.useRelatedPlaceholder),
        append_related: $("chkAppendRelated")?.checked
      }
    }, null, 2));

    // Optional: add images into ZIP and rename based on daftar GAMBAR
    const imgFiles = uploadedImages || [];
    if(imgFiles.length){
      const imgFolder = zip.folder("images");
      const desired = v.arrImg; // already trimmed & filtered

      if(imgFiles.length !== desired.length){
        setStatus("warn", `Peringatan: jumlah gambar di-upload (${imgFiles.length}) tidak sama dengan jumlah baris GAMBAR (${desired.length}). Yang diproses = ${Math.min(imgFiles.length, desired.length)}.`);
      }

      const m = Math.min(imgFiles.length, desired.length);
      const used = new Set();
      for(let i=0;i<m;i++){
        const file = imgFiles[i];
        const ext = (()=>{
          const m2 = (file.name || "").match(/\.[a-z0-9]{2,5}$/i);
          return m2 ? m2[0].toLowerCase() : "";
        })();
        let outName = imageNameFromUrl(desired[i], ext);
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

    setStatus("ok", `Sukses: ${outputs.length} file dibuat. Menyiapkan ZIP...`);
    report([
      {k:"Output", v:`${outputs.length} file HTML`},
      {k:"ZIP", v:`<code>${escapeHtml(zipName)}</code>`},
      {k:"Nama file", v:`${$("chkNameFromLink").checked ? "Mengikuti LINK" : "Default artikel.html (dedup otomatis)"}`},
      {k:"Folder", v:`${$("chkFolderFromLink")?.checked ? "Dari segmen LINK" : "Flat"}`},
      {k:"Related", v:`${$("chkRelated")?.checked ? `Aktif (${Number($("relatedCount")?.value||0)||0}/artikel)` : "Nonaktif"}`}
    ]);

    const blob = await zip.generateAsync({type:"blob"});
    saveAs(blob, zipName);

    // Auto refresh to avoid accidental duplicate generation
    if($("chkAutoRefresh").checked){
      setStatus("ok", "ZIP terunduh. Auto refresh aktif — halaman akan dimuat ulang.");
      setTimeout(()=>{
        try{ location.reload(); }catch{ $("btnGenerate").disabled = false; }
      }, 900);
    }else{
      $("btnGenerate").disabled = false;
    }
  }catch(err){
    setStatus("bad", `ERROR: ${err?.message || String(err)}`);
    report([{k:"Exception", v:`<code>${escapeHtml(err?.stack || String(err))}</code>`}]);
    $("btnGenerate").disabled = false;
  }
});

$("btnPreview").addEventListener("click", ()=>{
  const v = validateBasics();
  if(!v.ok) return;

  const { outputs, integrityErrors } = buildOutputs(v);
  if($("chkStrict").checked && integrityErrors.length){
    setStatus("bad", `ERROR: Integrity check gagal pada ${integrityErrors.length} file. Preview dibatalkan.`);
    report([{k:"Integrity check", v:`Gagal pada: <code>${integrityErrors.map(e=>`#${e.i}`).join(", ")}</code>`}]);
    return;
  }

  const first = outputs[0];
  const blob = new Blob([first.out], {type:"text/html"});
  const url = URL.createObjectURL(blob);

  $("previewName").textContent = first.fname;
  $("previewFrame").src = url;

  const modal = $("modal");
  modal.showModal();
});

$("btnClose").addEventListener("click", ()=>{
  const modal = $("modal");
  const iframe = $("previewFrame");
  try{
    // revoke object URL
    const src = iframe.src;
    iframe.src = "about:blank";
    if(src.startsWith("blob:")) URL.revokeObjectURL(src);
  }catch{}
  modal.close();
});

// initial
setStatus("idle", "Upload template untuk memulai.");
report([
  {k:"Catatan", v:"Gunakan placeholder unik agar aman (mis. <code>{{JUDUL}}</code>, <code>{{LINK}}</code>, <code>{{GAMBAR}}</code>, <code>{{ARTIKEL}}</code>)."}
]);
