/* Home Lab TV dashboard: reads the read-only feed on the Pi and draws it for a 1920x1080 TV.
   Written for the TV's older browser engine (Tizen 5.5, about Chrome 69): no ?. or ??. */
(function () {
  'use strict';

  var KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, BACK: 10009, ESC: 27, RED: 403 };
  var panels = Array.prototype.slice.call(document.querySelectorAll('.panel'));
  var byId = {};
  panels.forEach(function (el) { byId[el.dataset.id] = el; });

  var focused = 0;
  var zoomed = null;
  var lastOk = 0;
  var lastState = null;
  var cameraStarted = false;

  /* ------------------------------ helpers ------------------------------ */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pct(used, total) { return total ? Math.round((used / total) * 100) : 0; }
  function num(n) { return n == null ? '–' : Number(n).toLocaleString('sv-SE'); }
  function bytes(b) {
    if (b == null) return '–';
    var u = ['B', 'kB', 'MB', 'GB', 'TB'];
    var i = 0;
    while (b >= 1000 && i < u.length - 1) { b /= 1000; i++; }
    return (b >= 100 || i === 0 ? Math.round(b) : b.toFixed(1)) + ' ' + u[i];
  }
  function rate(b) { return bytes(b) + '/s'; }
  function uptime(sec) {
    if (!sec) return '–';
    var d = Math.floor(sec / 86400);
    var h = Math.floor((sec % 86400) / 3600);
    return d ? d + ' d ' + h + ' h' : h + ' h ' + Math.floor((sec % 3600) / 60) + ' min';
  }
  function level(p, warn, bad) { return p >= bad ? 'bad' : p >= warn ? 'warn' : 'ok'; }
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function hhmm(t) { var d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function localDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  function spark(values, cls, max) {
    var v = (values || []).filter(function (x) { return x != null; });
    if (v.length < 2) return '';
    var top = max || Math.max.apply(null, v) || 1;
    var pts = v.map(function (x, i) {
      return (i / (v.length - 1)) * 100 + ',' + (30 - Math.min(x / top, 1) * 28 - 1);
    }).join(' ');
    return '<svg class="spark ' + (cls || '') + '" viewBox="0 0 100 30" preserveAspectRatio="none">' +
      '<polyline points="' + pts + '" vector-effect="non-scaling-stroke"/></svg>';
  }

  function bar(label, value, p, lvl) {
    return '<div class="bar-row"><span class="bar-label">' + esc(label) + '</span>' +
      '<span class="bar"><i class="' + lvl + '" style="width:' + Math.min(p, 100) + '%"></i></span>' +
      '<span class="bar-value">' + value + '</span></div>';
  }

  function head(title, statusCls, extra) {
    return '<h2><span class="dot ' + statusCls + '"></span>' + esc(title) + (extra ? '<small>' + extra + '</small>' : '') + '</h2>';
  }

  /* ----------------------------- renderers ----------------------------- */

  var titles = {
    pi: 'Raspberry Pi 5', nas: 'NAS', pihole: 'Pi-hole', tasks: 'Tasks', camera: 'Hall camera',
    website: 'Website & services', network: 'Network', weather: 'Weather'
  };

  function host(d) {
    var memP = pct(d.mem.used, d.mem.total);
    var cpu = Math.round(d.cpu.load);
    var h = d.history || {};
    var out = '<div class="host-top">' +
      '<div class="big ' + level(cpu, 70, 90) + '">' + cpu + '<span>% CPU</span></div>' +
      (d.cpu.temp != null ? '<div class="big ' + level(d.cpu.temp, 65, 80) + '">' + Math.round(d.cpu.temp) + '<span>°C</span></div>' : '') +
      '</div>' + spark(h.cpu, 'cpu', 100) +
      bar('Memory', memP + ' %', memP, level(memP, 80, 92));
    (d.disks || []).filter(function (x) { return x.mount !== '/boot/firmware'; }).forEach(function (x) {
      var p = pct(x.used, x.total);
      out += bar(x.mount, bytes(x.total - x.used) + ' free', p, level(p, 80, 92));
    });
    out += '<div class="meta"><span>↓ ' + rate(d.net && d.net.rx) + '</span><span>↑ ' + rate(d.net && d.net.tx) + '</span>' +
      '<span>Up ' + uptime(d.uptime) + '</span></div>';
    if (d.containers && d.containers.length) {
      var down = d.containers.filter(function (c) { return c.state !== 'running'; });
      out += '<div class="meta">' + (down.length
        ? '<span class="bad-text">' + down.length + ' container(s) stopped: ' + esc(down.map(function (c) { return c.name; }).join(', ')) + '</span>'
        : '<span>' + d.containers.length + ' containers running</span>') + '</div>';
    }
    return out;
  }

  function pihole(d) {
    var hist = d.history || [];
    var max = Math.max.apply(null, hist.map(function (x) { return x.total; }).concat([1]));
    var bars = hist.map(function (x) {
      return '<span class="col" style="height:' + (x.total / max) * 100 + '%"><i style="height:' +
        (x.total ? (x.blocked / x.total) * 100 : 0) + '%"></i></span>';
    }).join('');
    var top = (d.topBlocked || []).slice(0, zoomed === 'pihole' ? 10 : 3).map(function (x) {
      return '<li><span>' + esc(x.domain) + '</span><b>' + num(x.count) + '</b></li>';
    }).join('');
    return '<div class="host-top">' +
      '<div class="big ' + (d.blocking ? 'ok' : 'bad') + '">' + Math.round(d.percent) + '<span>% blocked</span></div>' +
      '<div class="stack"><div><b>' + num(d.total) + '</b> queries today</div><div><b>' + num(d.blocked) + '</b> blocked</div>' +
      '<div><b>' + num(d.clients) + '</b> clients</div></div></div>' +
      (d.blocking ? '' : '<div class="bad-text">Blocking is OFF</div>') +
      '<div class="cols">' + bars + '</div>' +
      '<ul class="toplist">' + top + '</ul>';
  }

  function tasks(d) {
    var today = localDate(new Date());
    var list = (d.tasks || []).filter(function (t) { return !t.done; });
    list.sort(function (a, b) {
      if (!a.due !== !b.due) return a.due ? -1 : 1;
      return (a.due || '').localeCompare(b.due || '');
    });
    var limit = zoomed === 'tasks' ? 30 : 6;
    var items = list.slice(0, limit).map(function (t) {
      var cls = t.due && t.due < today ? 'overdue' : t.due === today ? 'today' : '';
      var due = t.due ? (t.due === today ? 'Today' : t.due < today ? 'Late ' + t.due.slice(5) : t.due.slice(5)) : '';
      return '<li class="' + cls + '"><span class="task-text">' + (t.priority ? '★ ' : '') + esc(t.text) +
        '</span><span class="task-due">' + due + (t.repeats ? ' ↻' : '') + '</span></li>';
    }).join('');
    var more = list.length > limit ? '<div class="meta"><span>+ ' + (list.length - limit) + ' more (OK to see all)</span></div>' : '';
    return '<ul class="tasks">' + (items || '<li class="empty">Nothing to do</li>') + '</ul>' + more;
  }

  function camera(d, el) {
    var body = el.querySelector('.body');
    if (!cameraStarted || !body.querySelector('img')) {
      cameraStarted = true;
      body.innerHTML = '<img class="cam" alt="Hall camera">';
      var img = body.querySelector('img');
      img.onerror = function () { setTimeout(function () { img.src = FEED_URL + '/api/camera/camera/stream?t=' + Date.now(); }, 5000); };
      img.src = FEED_URL + '/api/camera/camera/stream?t=' + Date.now();
    }
    return null; // keeps the running stream
  }

  function sites(d) {
    return '<ul class="rows">' + (d.sites || []).map(function (s) {
      return '<li><span class="dot ' + (s.ok ? 'ok' : 'bad') + '"></span><span class="name">' + esc(s.name) + '</span>' +
        '<span class="val">' + (s.ok ? s.ms + ' ms' : esc(s.error || ('HTTP ' + s.status))) + '</span></li>';
    }).join('') + '</ul>';
  }

  function network(d) {
    return '<ul class="rows">' + (d.devices || []).map(function (x) {
      return '<li><span class="dot ' + (x.up ? 'ok' : 'bad') + '"></span><span class="name">' + esc(x.name) + '</span>' +
        '<span class="val">' + (x.up ? (x.ms < 1 ? '<1' : Math.round(x.ms)) + ' ms' : 'down') + '</span></li>';
    }).join('') + '</ul>';
  }

  function weather(d) {
    var c = d.current || {};
    var now = Date.now();
    var hours = (d.hourly || []).filter(function (h) { return h.t >= now - 3600e3; }).slice(0, zoomed === 'weather' ? 12 : 6);
    var days = (d.daily || []).slice(1, zoomed === 'weather' ? 7 : 4);
    var dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return '<div class="wx-now">' + Icons.weather(c.code, c.isDay) +
      '<div><div class="big">' + Math.round(c.temp) + '<span>°C</span></div>' +
      '<div class="wx-desc">' + Icons.describe(c.code) + ' · feels ' + Math.round(c.feels) + '° · wind ' + Math.round(c.wind) + ' m/s</div>' +
      (d.sunrise ? '<div class="wx-desc">Sun ' + hhmm(d.sunrise) + ' – ' + hhmm(d.sunset) + '</div>' : '') + '</div></div>' +
      '<div class="wx-hours">' + hours.map(function (h) {
        return '<div><span>' + hhmm(h.t) + '</span>' + Icons.weather(h.code) + '<b>' + Math.round(h.temp) + '°</b>' +
          (h.pop ? '<small>' + h.pop + '%</small>' : '<small>&nbsp;</small>') + '</div>';
      }).join('') + '</div>' +
      '<div class="wx-days">' + days.map(function (x) {
        var dn = dayNames[new Date(x.date + 'T12:00:00').getDay()];
        return '<div><span>' + dn + '</span>' + Icons.weather(x.code) + '<b>' + Math.round(x.max) + '°</b><small>' + Math.round(x.min) + '°</small></div>';
      }).join('') + '</div>';
  }

  var renderers = { pi: host, nas: host, pihole: pihole, tasks: tasks, camera: camera, website: sites, network: network, weather: weather };

  /* ------------------------------- drawing ------------------------------- */

  panels.forEach(function (el) {
    el.innerHTML = head(titles[el.dataset.id], 'pending') + '<div class="body"><div class="loading">Loading…</div></div>';
  });

  function panelProblem(id, s) {
    if (!s || s.status === 'error') return true;
    var d = s.data || {};
    if (id === 'website') return (d.sites || []).some(function (x) { return !x.ok; });
    if (id === 'network') return (d.devices || []).some(function (x) { return !x.up; });
    if (id === 'pihole') return d.blocking === false;
    if (id === 'camera') return d.online === false;
    return false;
  }

  function draw(state) {
    lastState = state;
    var problems = [];
    panels.forEach(function (el) {
      var id = el.dataset.id;
      var s = state.panels[id];
      var bad = panelProblem(id, s);
      if (bad) problems.push(titles[id]);
      var h2 = el.querySelector('h2');
      var sub = id === 'pi' || id === 'nas' ? (s && s.data ? esc(s.data.model || s.data.hostname || '') : '') : '';
      h2.outerHTML = head(titles[id], s && s.status === 'ok' ? (bad ? 'warn' : 'ok') : 'bad', sub);
      var body = el.querySelector('.body');
      if (!s || s.status !== 'ok' || !s.data) {
        if (id === 'camera') cameraStarted = false;
        body.innerHTML = '<div class="error">' + esc((s && s.error) || 'No data yet') + '</div>';
        return;
      }
      try {
        var html = renderers[id](s.data, el);
        if (html !== null) body.innerHTML = html;
      } catch (e) {
        body.innerHTML = '<div class="error">Can’t show this: ' + esc(e.message) + '</div>';
      }
    });
    var sum = document.getElementById('summary');
    sum.className = 'summary ' + (problems.length ? 'warn' : 'ok');
    sum.textContent = problems.length ? 'Check: ' + problems.join(', ') : 'All systems OK';
  }

  function poll() {
    return fetchState().then(function () { setTimeout(poll, POLL_SECONDS * 1000); });
  }

  function fetchState() {
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 8000);
    return fetch(FEED_URL + '/api/state', { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) {
        if (!r.ok) throw new Error('Feed answered HTTP ' + r.status);
        return r.json();
      })
      .then(function (state) {
        lastOk = Date.now();
        draw(state);
      })
      .catch(function (e) {
        var sum = document.getElementById('summary');
        sum.className = 'summary bad';
        sum.textContent = 'Can’t reach the Pi feed (' + (e.name === 'AbortError' ? 'timeout' : e.message) + ')';
      })
      .then(function () { clearTimeout(timer); });
  }

  function tick() {
    var now = new Date();
    document.getElementById('clock').textContent = pad(now.getHours()) + ':' + pad(now.getMinutes());
    document.getElementById('date').textContent = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    var up = document.getElementById('updated');
    if (lastOk) {
      var ago = Math.round((Date.now() - lastOk) / 1000);
      up.textContent = ago < 15 ? 'Live' : 'Last update ' + ago + ' s ago';
      up.className = 'updated ' + (ago < 15 ? 'ok' : 'warn');
    }
  }

  /* ------------------------------ remote keys ------------------------------ */

  function setFocus(i) {
    focused = (i + panels.length) % panels.length;
    panels.forEach(function (el, n) { el.classList.toggle('focused', n === focused); });
  }

  function move(dx, dy) {
    var cols = 4;
    var r = Math.floor(focused / cols);
    var c = focused % cols;
    c = (c + dx + cols) % cols;
    r = (r + dy + 2) % 2;
    setFocus(r * cols + c);
  }

  function setZoom(id) {
    zoomed = id;
    document.body.classList.toggle('zoom', !!id);
    panels.forEach(function (el) { el.classList.toggle('zoomed', el.dataset.id === id); });
    if (lastState) draw(lastState);
  }

  function exitApp() {
    try { tizen.application.getCurrentApplication().exit(); } catch (e) { /* not on a TV */ }
  }

  document.addEventListener('keydown', function (e) {
    switch (e.keyCode) {
      case KEY.LEFT: if (!zoomed) move(-1, 0); break;
      case KEY.RIGHT: if (!zoomed) move(1, 0); break;
      case KEY.UP: if (!zoomed) move(0, -1); break;
      case KEY.DOWN: if (!zoomed) move(0, 1); break;
      case KEY.ENTER: setZoom(zoomed ? null : panels[focused].dataset.id); break;
      case KEY.BACK:
      case KEY.ESC:
        if (zoomed) setZoom(null); else exitApp();
        break;
      case KEY.RED:
        cameraStarted = false;
        fetchState();
        break;
      default: return;
    }
    e.preventDefault();
  });

  /* -------------------------------- start -------------------------------- */

  try {
    tizen.tvinputdevice.registerKey('ColorF0Red');
  } catch (e) { /* not on a TV */ }
  try {
    // Keep the TV's screen saver away while the dashboard is open.
    webapis.appcommon.setScreenSaver(webapis.appcommon.AppCommonScreenSaverState.SCREEN_SAVER_OFF);
  } catch (e) { /* not on a TV */ }

  setFocus(0);
  tick();
  setInterval(tick, 1000);
  poll();
})();
