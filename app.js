(function () {
  "use strict";

  var tg = window.Telegram && window.Telegram.WebApp;
  if (tg) {
    tg.expand();
    tg.ready();
    tg.setHeaderColor && tg.setHeaderColor("#0f1115");
    tg.setBackgroundColor && tg.setBackgroundColor("#0f1115");
  }

  var initData = tg ? tg.initData : "";

  // Конфиг раскладывается на хостинге статики (config.js).
  // API_BASE - адрес HTTP-туннеля к нашему backend (HTTPS).
  // Пустая строка = тот же origin (локальная разработка).
  var API_BASE = window.APP_CONFIG && window.APP_CONFIG.API_BASE
    ? window.APP_CONFIG.API_BASE.replace(/\/$/, "")
    : "";

  var RARITY_LABELS = {
    common: "🟢 Обычный",
    rare: "🔵 Редкий",
    epic: "🟣 Эпический",
    legendary: "🟡 Легендарный"
  };

  function fmtDate(value) {
    if (!value) return "—";
    var d = new Date(value);
    if (isNaN(d.getTime())) return "—";
    function p(n) { return n < 10 ? "0" + n : "" + n; }
    return p(d.getDate()) + "." + p(d.getMonth() + 1) + "." + d.getFullYear();
  }

  function rarityLabel(key) {
    return RARITY_LABELS[key] || "🟢 Обычный";
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
    rarityEl.style.color = n.rarity === "legendary" ? "#ffd54a"
      : n.rarity === "epic" ? "#c084fc"
      : n.rarity === "rare" ? "#5b9dff"
      : "var(--muted)";
  }

  function renderHistory(items) {
    var list = document.getElementById("history-list");
    if (!items || !items.length) {
      list.innerHTML = '<div class="card"><p style="margin:0;color:var(--muted)">История пуста</p></div>';
      return;
    }
    list.innerHTML = items.map(function (it) {
      var status = it.status === "active"
        ? '<span class="tag active">Активен</span>'
        : '<span class="tag released">Освобождён</span>';
      return (
        '<div class="hist-item">' +
          '<div><div class="ph">' + rarityLabel(it.rarity) + " " + it.phone_number + "</div>" +
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
      list.innerHTML = '<div class="card"><p style="margin:0;color:var(--muted)">Операций пока нет</p></div>';
      return;
    }
    list.innerHTML = s.transactions.map(function (tx) {
      return (
        '<div class="tx-item"><span>' + fmtDate(tx.created_at) + " · " + tx.type + "</span>" +
        '<span class="plus">+' + tx.htg_stars_amount + " ⭐</span></div>"
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
      .catch(function (err) { showError("⚠️ " + err.message); });
  }

  // Вкладки
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

  loadAll();
})();