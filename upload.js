/* Video upload system (Long video + Short) — ব্রাউজারের IndexedDB তে সেভ হয়, কোনো সার্ভার লাগে না */
(function () {
  var SCRIPT = document.currentScript && document.currentScript.src;
  var ROOT = SCRIPT ? SCRIPT.replace(/upload\.js.*$/, '') : '';
  var SHORT_MAX_SEC = 60, SHORT_MAX_MB = 200, LONG_MAX_MB = 500;
  var CATEGORIES = ['Education', 'Islamic', 'Family', 'Entertainment', 'Technology', 'Other'];

  /* ================= Storage (IndexedDB) ================= */
  var dbp = null;
  function openDB() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      var r = indexedDB.open('yt_uploads', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('videos', { keyPath: 'id' }); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    return dbp;
  }
  function run(mode, fn) {
    return openDB().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction('videos', mode), st = tx.objectStore('videos'), out = fn(st);
        tx.oncomplete = function () { res(out && out.result); };
        tx.onerror = tx.onabort = function () { rej(tx.error); };
      });
    });
  }
  function changed() { try { window.dispatchEvent(new CustomEvent('yt-uploads-changed')); } catch (e) {} }

  function fmtDuration(s) {
    s = Math.max(0, Math.round(s || 0));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(sec).padStart(2, '0');
  }
  function fmtSize(b) { return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }
  function timeAgo(ts) {
    var d = (Date.now() - ts) / 1000;
    if (d < 60) return 'Just now';
    if (d < 3600) return Math.floor(d / 60) + ' min ago';
    if (d < 86400) return Math.floor(d / 3600) + ' hours ago';
    if (d < 2592000) return Math.floor(d / 86400) + ' days ago';
    return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function authorName() {
    try { var u = JSON.parse(localStorage.getItem('yt_user')); if (u && u.name) return u.name; } catch (e) {}
    return 'You';
  }

  window.YTStore = {
    add: function (rec) { return run('readwrite', function (s) { return s.put(rec); }).then(function () { changed(); }); },
    get: function (id) { return run('readonly', function (s) { return s.get(id); }); },
    getAll: function () {
      return run('readonly', function (s) { return s.getAll(); }).then(function (l) {
        return (l || []).sort(function (a, b) { return b.createdAt - a.createdAt; });
      });
    },
    remove: function (id) { return run('readwrite', function (s) { return s.delete(id); }).then(function () { changed(); }); },
    fmtDuration: fmtDuration, fmtSize: fmtSize, timeAgo: timeAgo, root: ROOT
  };

  /* ================= UI ================= */
  function el(html) { var t = document.createElement('div'); t.innerHTML = html.trim(); return t.firstChild; }
  function $(id) { return document.getElementById(id); }

  function build() {
    /* radios (সবার আগে, যাতে CSS ~ সিলেক্টর কাজ করে) */
    var radios = ['none', 'menu', 'long', 'short'].map(function (k) {
      var i = document.createElement('input');
      i.type = 'radio'; i.name = 'yt-create'; i.id = 'ui-' + k; i.className = 'ui-radio';
      if (k === 'none') i.checked = true;
      return i;
    });
    for (var r = radios.length - 1; r >= 0; r--) document.body.insertBefore(radios[r], document.body.firstChild);

    var menuHTML =
      '<div class="create-menu">' +
      '<label for="ui-long" class="create-item long"><span class="ci-icon"><i class="fa-solid fa-film"></i></span><span><b>Upload video</b><small>Long video — any length</small></span></label>' +
      '<label for="ui-short" class="create-item short"><span class="ci-icon"><i class="fa-solid fa-bolt"></i></span><span><b>Upload Short</b><small>Vertical video up to ' + SHORT_MAX_SEC + ' seconds</small></span></label>' +
      '</div>';

    /* Create বাটন -> label (CSS দিয়ে মেনু খোলে) */
    var targets = document.querySelectorAll('[data-create]');
    if (!targets.length) {
      var hr = document.querySelector('.header-right');
      if (hr) {
        var b = document.createElement('button');
        b.className = 'create-btn up-create-default'; b.setAttribute('data-create', '');
        b.innerHTML = '<i class="fa-solid fa-plus"></i> Create';
        hr.insertBefore(b, hr.firstChild); targets = [b];
      }
    }
    Array.prototype.forEach.call(targets, function (t) {
      var wrap = document.createElement('div'); wrap.className = 'create-wrap';
      var lab = document.createElement('label');
      lab.htmlFor = 'ui-menu'; lab.className = t.className; lab.innerHTML = t.innerHTML;
      lab.tabIndex = 0; lab.setAttribute('role', 'button'); lab.setAttribute('aria-label', 'Create');
      lab.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); lab.click(); } });
      wrap.appendChild(lab); wrap.appendChild(el(menuHTML));
      t.parentNode.replaceChild(wrap, t);
    });

    document.body.appendChild(el('<label for="ui-none" class="create-backdrop"></label>'));
    var isWatch = !!document.getElementById('videoPlayer');
    if (!isWatch) document.body.appendChild(el('<label for="ui-menu" class="create-fab" aria-label="Create"><i class="fa-solid fa-plus"></i></label>'));
    document.body.appendChild(el(
      '<div class="create-sheet"><div class="sheet-grip"></div><div class="sheet-title">Create</div>' +
      '<label for="ui-long" class="create-item long"><span class="ci-icon"><i class="fa-solid fa-film"></i></span><span><b>Upload video</b><small>Long video — any length</small></span></label>' +
      '<label for="ui-short" class="create-item short"><span class="ci-icon"><i class="fa-solid fa-bolt"></i></span><span><b>Upload Short</b><small>Vertical video up to ' + SHORT_MAX_SEC + ' seconds</small></span></label>' +
      '</div>'));

    var cats = CATEGORIES.map(function (c) { return '<option>' + c + '</option>'; }).join('');
    document.body.appendChild(el(
      '<div class="up-modal" role="dialog" aria-modal="true"><label for="ui-none" class="up-backdrop"></label>' +
      '<div class="up-card" id="upCard" data-state="pick">' +
      '<div class="up-head"><h2><i class="fa-solid fa-cloud-arrow-up"></i><span><span class="t-long">Upload video</span><span class="t-short">Upload Short</span></span></h2>' +
      '<label for="ui-none" class="up-close" aria-label="Close"><i class="fa-solid fa-xmark"></i></label></div>' +
      '<div class="up-body">' +

      '<div class="up-step up-step-pick">' +
        '<input type="file" id="upFile" accept="video/*" hidden>' +
        '<label for="upFile" class="up-drop" id="upDrop">' +
          '<div class="up-drop-icon"><i class="fa-solid fa-cloud-arrow-up"></i></div>' +
          '<div class="up-drop-title">Drag and drop a video file to upload</div>' +
          '<div class="up-drop-sub t-long">MP4, WebM or MOV · up to ' + LONG_MAX_MB + ' MB</div>' +
          '<div class="up-drop-sub t-short">Vertical video · up to ' + SHORT_MAX_SEC + ' seconds · up to ' + SHORT_MAX_MB + ' MB</div>' +
          '<span class="up-btn primary"><i class="fa-solid fa-folder-open"></i> Select file</span>' +
        '</label>' +
        '<div class="up-error" id="upError"></div>' +
        '<div class="up-note"><i class="fa-solid fa-circle-info"></i> ভিডিও এই ব্রাউজারেই সেভ হয় (কোনো সার্ভার নেই)।</div>' +
      '</div>' +

      '<div class="up-step up-step-details">' +
        '<div class="up-details">' +
          '<div class="up-form">' +
            '<label class="up-field">Title (required)<span class="up-counter" id="upTitleCount">0/100</span><input type="text" id="upTitle" maxlength="100" placeholder="Add a title that describes your video"></label>' +
            '<label class="up-field">Description<span class="up-counter" id="upDescCount">0/2000</span><textarea id="upDesc" rows="5" maxlength="2000" placeholder="Tell viewers about your video"></textarea></label>' +
            '<label class="up-field">Category<select id="upCat">' + cats + '</select></label>' +
            '<div class="up-error" id="upError2"></div>' +
          '</div>' +
          '<div class="up-preview">' +
            '<div class="up-preview-box"><video id="upPrev" controls muted playsinline></video></div>' +
            '<div class="up-file-info" id="upInfo"></div>' +
            '<div class="up-thumb-label">Thumbnail</div><div class="up-thumbs" id="upThumbs"></div>' +
          '</div>' +
        '</div>' +
        '<div class="up-actions"><button type="button" class="up-btn" id="upBack"><i class="fa-solid fa-arrow-left"></i> Change file</button>' +
        '<button type="button" class="up-btn primary" id="upPublish"><i class="fa-solid fa-upload"></i> Publish</button></div>' +
      '</div>' +

      '<div class="up-step up-step-progress"><div class="up-center">' +
        '<div class="up-spinner-icon"><i class="fa-solid fa-gear fa-spin"></i></div>' +
        '<h3>Publishing…</h3><p id="upProgText">Saving your video</p>' +
        '<div class="up-bar"><div id="upBar"></div></div><div class="up-pct" id="upPct">0%</div>' +
      '</div></div>' +

      '<div class="up-step up-step-done"><div class="up-center">' +
        '<div class="up-done-icon"><i class="fa-solid fa-check"></i></div>' +
        '<h3>Published!</h3><p id="upDoneText"></p>' +
        '<div class="up-done-actions"><a class="up-btn primary" id="upView" href="#"><i class="fa-solid fa-play"></i> Watch now</a>' +
        '<button type="button" class="up-btn" id="upAnother"><i class="fa-solid fa-plus"></i> Upload another</button>' +
        '<label for="ui-none" class="up-btn">Done</label></div>' +
      '</div></div>' +

      '</div></div></div>'));

    wire();
  }

  /* ================= Upload logic ================= */
  var card, state = 'pick', cur = null; /* cur = {file, duration, w, h, url, thumbs[], thumbIdx} */
  function kind() { return $('ui-short').checked ? 'short' : 'long'; }
  function setState(s) { state = s; card.setAttribute('data-state', s); }
  function showErr(id, msg) { var e = $(id); e.textContent = msg || ''; e.classList.toggle('show', !!msg); }
  function resetAll() {
    if (cur && cur.url) URL.revokeObjectURL(cur.url);
    cur = null; $('upFile').value = ''; $('upPrev').removeAttribute('src'); $('upPrev').load();
    $('upTitle').value = ''; $('upDesc').value = ''; $('upTitleCount').textContent = '0/100'; $('upDescCount').textContent = '0/2000';
    showErr('upError', ''); showErr('upError2', ''); setState('pick');
  }

  function seek(v, t) {
    return new Promise(function (res) {
      var done = function () { v.removeEventListener('seeked', done); clearTimeout(to); res(); };
      var to = setTimeout(done, 3000);
      v.addEventListener('seeked', done); v.currentTime = t;
    });
  }
  function loadMeta(v, url) {
    return new Promise(function (res, rej) {
      v.onloadedmetadata = function () { res(); };
      v.onerror = function () { rej(new Error('format')); };
      v.src = url;
    });
  }
  async function frames(v) {
    var d = v.duration, vw = v.videoWidth || 640, vh = v.videoHeight || 360, max = 400;
    var sc = Math.min(1, max / Math.max(vw, vh)), w = Math.round(vw * sc), h = Math.round(vh * sc);
    var c = document.createElement('canvas'); c.width = w; c.height = h; var ctx = c.getContext('2d'), out = [];
    var times = [0.1, 0.5, 0.85].map(function (p) { return Math.min(Math.max(d * p, 0.05), Math.max(d - 0.1, 0.05)); });
    for (var i = 0; i < times.length; i++) {
      await seek(v, times[i]); ctx.drawImage(v, 0, 0, w, h); out.push(c.toDataURL('image/jpeg', 0.72));
    }
    await seek(v, 0); return out;
  }

  async function handleFile(file) {
    showErr('upError', '');
    if (!file) return;
    var k = kind();
    if (!/^video\//.test(file.type) && !/\.(mp4|webm|mov|mkv|m4v|ogv)$/i.test(file.name)) return showErr('upError', 'এটি একটি ভিডিও ফাইল নয়। MP4, WebM বা MOV ফাইল দিন।');
    var maxMB = k === 'short' ? SHORT_MAX_MB : LONG_MAX_MB;
    if (file.size > maxMB * 1048576) return showErr('upError', 'ফাইলটি অনেক বড় (' + fmtSize(file.size) + ')। সর্বোচ্চ ' + maxMB + ' MB।');

    var v = $('upPrev'), url = URL.createObjectURL(file);
    try {
      await loadMeta(v, url);
      if (!isFinite(v.duration)) { v.currentTime = 1e101; await new Promise(function (r) { v.addEventListener('timeupdate', r, { once: true }); }); v.currentTime = 0; }
    } catch (e) { URL.revokeObjectURL(url); return showErr('upError', 'এই ভিডিও ফরম্যাট ব্রাউজারে চালানো যাচ্ছে না। MP4 (H.264) বা WebM ব্যবহার করুন।'); }
    if (k === 'short' && v.duration > SHORT_MAX_SEC + 0.5) {
      URL.revokeObjectURL(url);
      return showErr('upError', 'Short ভিডিও সর্বোচ্চ ' + SHORT_MAX_SEC + ' সেকেন্ডের হতে পারে। আপনার ভিডিও ' + fmtDuration(v.duration) + '। লম্বা ভিডিও হলে "Upload video" ব্যবহার করুন।');
    }
    cur = { file: file, url: url, duration: v.duration, w: v.videoWidth, h: v.videoHeight, thumbs: [], thumbIdx: 0 };
    $('upTitle').value = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 100);
    $('upTitleCount').textContent = $('upTitle').value.length + '/100';
    var tips = (k === 'short' && v.videoWidth > v.videoHeight) ? '<br><span style="color:#f59e0b">Tip: Shorts vertical (9:16) হলে সবচেয়ে ভালো দেখায়।</span>' : '';
    $('upInfo').innerHTML = '<b>' + file.name.replace(/</g, '&lt;') + '</b><br>' + fmtSize(file.size) + ' · ' + fmtDuration(v.duration) + ' · ' + v.videoWidth + '×' + v.videoHeight + tips;
    card.classList.toggle('is-short', k === 'short');
    $('upThumbs').innerHTML = ''; setState('details');
    try {
      cur.thumbs = await frames(v);
      $('upThumbs').innerHTML = cur.thumbs.map(function (t, i) { return '<button type="button" data-i="' + i + '" class="' + (i === 0 ? 'sel' : '') + '"><img src="' + t + '" alt=""></button>'; }).join('');
    } catch (e) { cur.thumbs = ['']; }
  }

  async function publish() {
    if (!cur) return;
    var title = $('upTitle').value.trim();
    if (!title) { $('upTitle').classList.add('invalid'); $('upTitle').focus(); return showErr('upError2', 'টাইটেল দিতে হবে।'); }
    showErr('upError2', '');
    var k = kind(), id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    var rec = {
      id: id, kind: k, title: title, description: $('upDesc').value.trim(), category: $('upCat').value, author: authorName(),
      file: cur.file, mime: cur.file.type, size: cur.file.size, duration: cur.duration, width: cur.w, height: cur.h,
      thumb: cur.thumbs[cur.thumbIdx] || cur.thumbs[0] || '', createdAt: Date.now()
    };
    setState('progress');
    var pct = 0, bar = $('upBar'), label = $('upPct'), txt = $('upProgText');
    var timer = setInterval(function () {
      pct = Math.min(90, pct + 6 + Math.random() * 8); bar.style.width = pct + '%'; label.textContent = Math.round(pct) + '%';
      txt.textContent = pct < 40 ? 'Saving your video' : pct < 75 ? 'Processing thumbnail' : 'Almost done';
    }, 140);
    try {
      try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
      await Promise.all([window.YTStore.add(rec), new Promise(function (r) { setTimeout(r, 1300); })]);
    } catch (e) {
      clearInterval(timer); setState('details');
      return showErr('upError2', 'ভিডিও সেভ করা যায়নি। ব্রাউজারের স্টোরেজ ভরে গেছে কিনা দেখুন (' + (e && e.name || 'error') + ')।');
    }
    clearInterval(timer); bar.style.width = '100%'; label.textContent = '100%';
    await new Promise(function (r) { setTimeout(r, 350); });
    $('upDoneText').textContent = (k === 'short' ? 'আপনার Short' : 'আপনার ভিডিও') + ' প্রকাশিত হয়েছে এবং হোম পেজে "Your uploads" এ দেখা যাবে।';
    var view = $('upView');
    view.href = k === 'short' ? ROOT + '#short-' + id : ROOT + 'watch/?u=' + id;
    view.innerHTML = '<i class="fa-solid fa-play"></i> ' + (k === 'short' ? 'Watch Short' : 'Watch video');
    setState('done');
  }

  function wire() {
    card = $('upCard');
    var file = $('upFile'), drop = $('upDrop');
    file.addEventListener('change', function () { handleFile(file.files[0]); });
    ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('drag'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('drag'); }); });
    drop.addEventListener('drop', function (e) { var f = e.dataTransfer && e.dataTransfer.files[0]; if (f) handleFile(f); });
    $('upTitle').addEventListener('input', function (e) { e.target.classList.remove('invalid'); $('upTitleCount').textContent = e.target.value.length + '/100'; });
    $('upDesc').addEventListener('input', function (e) { $('upDescCount').textContent = e.target.value.length + '/2000'; });
    $('upThumbs').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || !cur) return;
      cur.thumbIdx = +b.dataset.i;
      Array.prototype.forEach.call($('upThumbs').children, function (x) { x.classList.toggle('sel', x === b); });
    });
    $('upBack').addEventListener('click', resetAll);
    $('upAnother').addEventListener('click', resetAll);
    $('upPublish').addEventListener('click', publish);
    $('upView').addEventListener('click', function () { $('ui-none').checked = true; });

    /* মোড বদলালে / খোলার সময় */
    ['ui-long', 'ui-short'].forEach(function (id) {
      $(id).addEventListener('change', function () {
        if (!$(id).checked) return;
        if (state === 'done') resetAll();
        if (state === 'details' && cur) {
          var k = kind();
          if (k === 'short' && cur.duration > SHORT_MAX_SEC + 0.5) { resetAll(); showErr('upError', 'এই ভিডিও ' + fmtDuration(cur.duration) + ' লম্বা — Short এর সীমা ' + SHORT_MAX_SEC + ' সেকেন্ড।'); }
          card.classList.toggle('is-short', k === 'short');
        }
      });
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') $('ui-none').checked = true; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
