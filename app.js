(function () {
  "use strict";

  var tg = window.Telegram && window.Telegram.WebApp;
  if (tg) {
    tg.expand();
    tg.ready();
    tg.setHeaderColor && tg.setHeaderColor("#060708");
    tg.setBackgroundColor && tg.setBackgroundColor("#060708");
    if (tg.colorScheme) {
      document.body.classList.toggle("light", tg.colorScheme === "light");
    }
  }

  var initData = tg ? tg.initData : "";

  var API_BASE = window.APP_CONFIG && window.APP_CONFIG.API_BASE
    ? window.APP_CONFIG.API_BASE.replace(/\/$/, "")
    : "";

  var RARITY_LABELS = {
    common: "Обычный",
    rare: "Редкий",
    epic: "Эпический",
    legendary: "Легендарный"
  };

  function fmtDate(value) {
    if (!value) return "—";
    var d = new Date(value);
    if (isNaN(d.getTime())) return "—";
    function p(n) { return n < 10 ? "0" + n : "" + n; }
    return p(d.getDate()) + "." + p(d.getMonth() + 1) + "." + d.getFullYear();
  }

  function rarityLabel(key) {
    return RARITY_LABELS[key] || "Обычный";
  }

  function showError(message) {
    var banner = document.getElementById("error-banner");
    banner.textContent = message;
    banner.classList.remove("hidden");
  }

  function hideError() {
    document.getElementById("error-banner").classList.add("hidden");
  }

  function api(path, attempt) {
    attempt = attempt || 0;
    return fetch(API_BASE + path, {
      headers: {
        "X-Telegram-Init-Data": initData,
        "ngrok-skip-browser-warning": "true",
        "Bypass-Tunnel-Reminder": "true"
      }
    }).then(function (resp) {
      if (resp.status >= 500 && attempt < 3) {
        return new Promise(function (r) { setTimeout(r, 600 * (attempt + 1)); })
          .then(function () { return api(path, attempt + 1); });
      }
      if (!resp.ok) {
        return resp.json().then(function (data) {
          var msg = (data && data.detail) || ("Ошибка " + resp.status);
          throw new Error(msg);
        });
      }
      return resp.json();
    }, function (netErr) {
      if (attempt < 3) {
        return new Promise(function (r) { setTimeout(r, 600 * (attempt + 1)); })
          .then(function () { return api(path, attempt + 1); });
      }
      throw netErr;
    });
  }

  function renderProfile(p) {
    document.getElementById("p-htg").textContent = p.htg_id || "—";
    document.getElementById("p-tg").textContent = p.telegram_id || "—";
    document.getElementById("p-number").textContent = p.current_number || "—";
    document.getElementById("p-stars").textContent = p.balance_htg_stars;
    document.getElementById("p-count").textContent = p.numbers_count;
    document.getElementById("p-created").textContent = fmtDate(p.created_at);
    document.getElementById("htgBadge").textContent = p.htg_id || "—";
  }

  function renderCurrentNumber(n) {
    document.getElementById("n-rarity").textContent = rarityLabel(n.rarity);
    document.getElementById("n-phone").textContent = n.phone_number;
    document.getElementById("n-assigned").textContent = fmtDate(n.assigned_at);
    document.getElementById("n-score").textContent = n.rarity_score;
    var rarityEl = document.getElementById("n-rarity");
    var color = n.rarity === "legendary" ? "#f0c9a8"
      : n.rarity === "epic" ? "#c9a3f0"
      : n.rarity === "rare" ? "#9ec5e8"
      : "#aab2bf";
    rarityEl.style.color = color;
    rarityEl.style.backgroundColor = color + "1f";
    rarityEl.style.border = "1px solid " + color + "55";
    rarityEl.style.borderRadius = "999px";
    rarityEl.style.padding = "5px 14px";
  }

  function renderHistory(items) {
    var list = document.getElementById("history-list");
    if (!items || !items.length) {
      list.innerHTML = '<div class="empty-note">История пуста — получите первый номер!</div>';
      return;
    }
    list.innerHTML = items.map(function (it) {
      var status = it.status === "active"
        ? '<span class="tag active">Активен</span>'
        : '<span class="tag released">Освобождён</span>';
      return (
        '<div class="hist-item">' +
          '<div><div class="ph">' + rarityLabel(it.rarity) + " · " + it.phone_number + "</div>" +
          '<div class="meta">Получен: ' + fmtDate(it.assigned_at) +
          (it.released_at ? " · Освобождён: " + fmtDate(it.released_at) : "") +
          "</div></div>" + status +
        "</div>"
      );
    }).join("");
  }

  function renderStars(s) {
    document.getElementById("s-balance").textContent = s.balance;
    var list = document.getElementById("stars-list");
    if (!s.transactions || !s.transactions.length) {
      list.innerHTML = '<div class="empty-note">Операций пока нет</div>';
      return;
    }
    list.innerHTML = s.transactions.map(function (tx) {
      return (
        '<div class="tx-item"><span>' + fmtDate(tx.created_at) + " · " + tx.type + "</span>" +
        '<span class="plus">+' + tx.htg_stars_amount + "</span></div>"
      );
    }).join("");
  }

  function loadAll() {
    hideError();
    api("/api/user/profile")
      .then(renderProfile)
      .then(function () {
        return api("/api/user/number").then(renderCurrentNumber, function (e) {
          document.getElementById("n-phone").textContent = "Нет номера";
          document.getElementById("n-rarity").textContent = "";
          document.getElementById("n-assigned").textContent = "—";
          document.getElementById("n-score").textContent = "—";
        });
      })
      .then(function () { return api("/api/user/numbers").then(renderHistory, function () {}); })
      .then(function () { return api("/api/user/stars").then(renderStars, function () {}); })
      .catch(function (err) { showError(err.message); });
  }

  var tabs = document.querySelectorAll(".tab");
  var panels = document.querySelectorAll(".tab-panel");

  function switchTab(name) {
    tabs.forEach(function (t) { t.classList.toggle("active", t.dataset.tab === name); });
    panels.forEach(function (p) { p.classList.toggle("active", p.id === "panel-" + name); });
  }

  tabs.forEach(function (t) {
    t.addEventListener("click", function () {
      switchTab(t.dataset.tab);
      if (t.dataset.tab === "profile") loadAll();
    });
  });

  // Snow
  var canvas = document.getElementById("snow");
  if (canvas) {
    var ctx = canvas.getContext("2d");
    var W = 0, H = 0, flakes = [];
    function size() {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W; canvas.height = H;
    }
    function makeFlake() {
      return {
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.6 + 0.6,
        s: Math.random() * 0.75 + 0.25,
        drift: Math.random() * 0.35 - 0.175,
        o: Math.random() * 0.3 + 0.14
      };
    }
    function draw(t) {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < flakes.length; i++) {
        var f = flakes[i];
        f.y += f.s;
        f.x += f.drift + Math.sin((f.y + i) * 0.012) * 0.2;
        if (f.y > H + 4) { f.y = -4; f.x = Math.random() * W; }
        if (f.x > W + 4) f.x = -4;
        if (f.x < -4) f.x = W + 4;
        ctx.globalAlpha = f.o;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      requestAnimationFrame(draw);
    }
    window.addEventListener("resize", function () {
      size();
      flakes = [];
      var n = Math.round(Math.min(170, (W * H) / 16000));
      for (var i = 0; i < n; i++) flakes.push(makeFlake());
    });
    size();
    var n = Math.round(Math.min(170, (W * H) / 16000));
    for (var j = 0; j < n; j++) flakes.push(makeFlake());
    requestAnimationFrame(draw);
  }

  loadAll();
})();