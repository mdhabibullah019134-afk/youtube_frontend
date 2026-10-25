/* Watch history (ব্রাউজারের localStorage এ সেভ থাকে) */
window.YTHistory = (function () {
  var KEY = 'yt_history', MAX = 100;
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function save(l) { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch (e) {} }
  return {
    get: load,
    add: function (e) {
      var l = load().filter(function (x) { return x.id !== e.id; });
      e.watchedAt = Date.now(); l.unshift(e); save(l.slice(0, MAX));
    },
    update: function (id, patch) {
      var l = load(); l.forEach(function (x) { if (x.id === id) for (var k in patch) x[k] = patch[k]; }); save(l);
    },
    remove: function (id) { save(load().filter(function (x) { return x.id !== id; })); },
    clear: function () { save([]); }
  };
})();
