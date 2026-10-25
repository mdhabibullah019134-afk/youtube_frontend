/* Google Sign-In (Google Identity Services) — শুধু Client ID লাগে, Client Secret ফ্রন্টএন্ডে ব্যবহার হয় না */
(function () {
  var CLIENT_ID = '941502342566-6l44m3q70sj85efs8p22gvrlk9cu0b2a.apps.googleusercontent.com';
  var KEY = 'yt_user';

  var css = `
  .auth-box{position:relative;display:flex;align-items:center;margin-left:8px}
  .auth-signin-btn{display:flex;align-items:center;gap:8px;padding:6px 14px;border:1px solid #3ea6ff55;border-radius:18px;background:transparent;color:#3ea6ff;font:500 14px Roboto,Arial,sans-serif;cursor:pointer;white-space:nowrap}
  .auth-signin-btn:hover{background:#263850}
  .auth-avatar{width:32px;height:32px;border-radius:50%;object-fit:cover;cursor:pointer}
  .auth-menu{position:absolute;top:44px;right:0;width:280px;background:#282828;color:#f1f1f1;border-radius:12px;box-shadow:0 4px 32px rgba(0,0,0,.6);padding:12px 0;z-index:3000;display:none;font-family:Roboto,Arial,sans-serif}
  .auth-menu.open{display:block}
  .auth-menu-head{display:flex;gap:12px;padding:8px 16px 12px;border-bottom:1px solid #444;align-items:center}
  .auth-menu-head img{width:40px;height:40px;border-radius:50%}
  .auth-menu-name{font-size:15px;font-weight:500}
  .auth-menu-email{font-size:13px;color:#aaa;word-break:break-all}
  .auth-menu-item{display:flex;align-items:center;gap:14px;width:100%;padding:10px 16px;background:none;border:0;color:inherit;font:inherit;font-size:14px;cursor:pointer;text-align:left}
  .auth-menu-item:hover{background:#3f3f3f}
  .auth-modal{position:fixed;inset:0;background:rgba(0,0,0,.7);display:none;align-items:center;justify-content:center;z-index:4000}
  .auth-modal.open{display:flex}
  .auth-modal-card{background:#212121;color:#f1f1f1;border-radius:16px;padding:28px 32px;width:min(92vw,360px);text-align:center;font-family:Roboto,Arial,sans-serif;position:relative}
  .auth-modal-card h2{margin:0 0 6px;font-size:20px}
  .auth-modal-card p{margin:0 0 20px;font-size:14px;color:#aaa}
  .auth-modal-close{position:absolute;top:10px;right:14px;background:none;border:0;color:#aaa;font-size:22px;cursor:pointer}
  .auth-g-slot{display:flex;justify-content:center;min-height:44px}
  .auth-err{margin-top:14px;font-size:13px;color:#ff6b6b}
  `;
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function getUser() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }
  function setUser(u) { try { u ? localStorage.setItem(KEY, JSON.stringify(u)) : localStorage.removeItem(KEY); } catch (e) {} }

  function parseJwt(t) {
    var b = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    var json = decodeURIComponent(atob(b).split('').map(function (c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(json);
  }

  var modal, gReady = false, boxes = [];

  function buildModal() {
    modal = document.createElement('div');
    modal.className = 'auth-modal';
    modal.innerHTML = '<div class="auth-modal-card"><button class="auth-modal-close" aria-label="Close">&times;</button>' +
      '<h2>Sign in</h2><p>Google অ্যাকাউন্ট দিয়ে লগইন করুন</p>' +
      '<div class="auth-g-slot" id="authGSlot"></div><div class="auth-err" id="authErr"></div></div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
    modal.querySelector('.auth-modal-close').onclick = closeModal;
  }
  function openModal() {
    modal.classList.add('open');
    var err = document.getElementById('authErr'); err.textContent = '';
    if (!window.google || !google.accounts) { err.textContent = 'Google সার্ভিস লোড হয়নি। ইন্টারনেট চেক করে আবার চেষ্টা করুন।'; return; }
    if (location.protocol === 'file:') { err.textContent = 'Google লগইন file:// এ চলে না। Live Server বা হোস্টিং ব্যবহার করুন।'; return; }
    var slot = document.getElementById('authGSlot'); slot.innerHTML = '';
    google.accounts.id.renderButton(slot, { theme: 'filled_black', size: 'large', shape: 'pill', text: 'signin_with', width: 280 });
  }
  function closeModal() { modal.classList.remove('open'); }

  function onCredential(resp) {
    try {
      var p = parseJwt(resp.credential);
      setUser({ name: p.name || p.email, email: p.email, picture: p.picture || '', sub: p.sub });
      closeModal(); render();
    } catch (e) { document.getElementById('authErr').textContent = 'লগইন ব্যর্থ হয়েছে, আবার চেষ্টা করুন।'; }
  }

  function signOut() {
    var u = getUser(); setUser(null);
    try { if (window.google && google.accounts) google.accounts.id.disableAutoSelect(); } catch (e) {}
    render();
  }

  function fallbackAvatar(u) {
    return 'https://ui-avatars.com/api/?name=' + encodeURIComponent(u.name || 'User') + '&background=random';
  }

  function render() {
    var u = getUser();
    boxes.forEach(function (box) {
      box.innerHTML = '';
      if (!u) {
        var b = document.createElement('button');
        b.className = 'auth-signin-btn';
        b.innerHTML = '<i class="fa-regular fa-circle-user"></i><span>Sign in</span>';
        b.onclick = openModal;
        box.appendChild(b);
      } else {
        var img = document.createElement('img');
        img.className = 'auth-avatar'; img.alt = u.name; img.referrerPolicy = 'no-referrer';
        img.src = u.picture || fallbackAvatar(u);
        img.onerror = function () { img.onerror = null; img.src = fallbackAvatar(u); };
        var menu = document.createElement('div'); menu.className = 'auth-menu';
        var head = document.createElement('div'); head.className = 'auth-menu-head';
        var mi = document.createElement('img'); mi.referrerPolicy = 'no-referrer'; mi.src = img.src; mi.alt = '';
        var tx = document.createElement('div');
        var n = document.createElement('div'); n.className = 'auth-menu-name'; n.textContent = u.name;
        var em = document.createElement('div'); em.className = 'auth-menu-email'; em.textContent = u.email;
        tx.appendChild(n); tx.appendChild(em); head.appendChild(mi); head.appendChild(tx);
        var so = document.createElement('button'); so.className = 'auth-menu-item';
        so.innerHTML = '<i class="fa-solid fa-arrow-right-from-bracket"></i><span>Sign out</span>';
        so.onclick = signOut;
        menu.appendChild(head); menu.appendChild(so);
        img.onclick = function (e) { e.stopPropagation(); document.querySelectorAll('.auth-menu.open').forEach(function (m) { if (m !== menu) m.classList.remove('open'); }); menu.classList.toggle('open'); };
        box.appendChild(img); box.appendChild(menu);
      }
    });
  }

  function initGoogle() {
    if (gReady || !window.google || !google.accounts) return;
    gReady = true;
    google.accounts.id.initialize({ client_id: CLIENT_ID, callback: onCredential, auto_select: false });
  }

  function init() {
    document.querySelectorAll('img[data-auth-avatar]').forEach(function (av) {
      var box = document.createElement('div'); box.className = 'auth-box';
      av.parentNode.replaceChild(box, av);
      boxes.push(box);
    });
    buildModal(); render();
    document.addEventListener('click', function () { document.querySelectorAll('.auth-menu.open').forEach(function (m) { m.classList.remove('open'); }); });
    var s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.defer = true;
    s.onload = initGoogle; document.head.appendChild(s);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
