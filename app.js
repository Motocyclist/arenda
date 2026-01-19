(function () {
  "use strict";

  var BASE_RENT = 5000;

  var state = {
    view: "table", // "table" | "cards"
    newestFirst: true,
    recordsRaw: [],
    recordsComputedChrono: [] // chronological with computed fields and running piggy total
  };

  // --- DOM helpers
  function $(id) { return document.getElementById(id); }

  function setText(id, text) {
    var el = $(id);
    if (el) el.textContent = text;
  }

  function setHidden(id, hidden) {
    var el = $(id);
    if (el) el.hidden = !!hidden;
  }

  // --- formatting
  function formatUAH(n) {
    // integer display with thin spaces as thousands separator, plus ₴
    var sign = n < 0 ? "-" : "";
    var abs = Math.abs(n);
    var s = String(abs);

    // group by 3 from end
    var out = "";
    while (s.length > 3) {
      out = "\u202F" + s.slice(-3) + out; // narrow no-break space
      s = s.slice(0, -3);
    }
    out = s + out;

    return sign + out + " ₴";
  }

  function monthLabel(ym) {
    // Expect YYYY-MM. Return "YYYY-MM" (with non-breaking hyphen).
    if (!ym || typeof ym !== "string") return "—";
    return ym.replace("-", "\u2011"); // non-breaking hyphen
  }

  function safeInt(x) {
    var n = Number(x);
    if (!isFinite(n)) return 0;
    return Math.round(n);
  }

  // --- data
  function validateRecords(list) {
    if (!Array.isArray(list)) return "data.json должен содержать массив месяцев.";
    if (list.length === 0) return "data.json пустой: добавь хотя бы один месяц.";

    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      if (!r || typeof r !== "object") return "Запись #" + (i + 1) + " не объект.";
      if (typeof r.month !== "string") return "Запись #" + (i + 1) + ": поле month должно быть строкой 'YYYY-MM'.";
      if (!/^\d{4}-\d{2}$/.test(r.month)) return "Запись #" + (i + 1) + ": month должен быть в формате YYYY-MM.";
      if (r.apt1 === undefined || r.apt2 === undefined) return "Запись #" + (i + 1) + ": нужны поля apt1 и apt2.";
      // numbers can be strings but must be numeric
      var a1 = Number(r.apt1);
      var a2 = Number(r.apt2);
      if (!isFinite(a1) || !isFinite(a2)) return "Запись #" + (i + 1) + ": apt1/apt2 должны быть числами.";
    }

    // Check duplicates
    var seen = {};
    for (var j = 0; j < list.length; j++) {
      var m = list[j].month;
      if (seen[m]) return "Повтор месяца в data.json: " + m;
      seen[m] = true;
    }

    return "";
  }

  function computeChronological(records) {
    // Sort chronological by month string works for YYYY-MM lexicographically
    var sorted = records.slice().sort(function (a, b) {
      return a.month < b.month ? -1 : (a.month > b.month ? 1 : 0);
    });

    var piggy = 0;
    var computed = [];

    for (var i = 0; i < sorted.length; i++) {
      var r = sorted[i];
      var apt1 = safeInt(r.apt1);
      var apt2 = safeInt(r.apt2);
      var total = apt1 + apt2;
      var remainder = BASE_RENT - total;
      piggy = piggy + remainder;

      computed.push({
        month: r.month,
        note: (typeof r.note === "string" ? r.note.trim() : ""),
        apt1: apt1,
        apt2: apt2,
        total: total,
        remainder: remainder,
        piggy: piggy
      });
    }

    return computed;
  }

  function getLatestFromChrono(chrono) {
    if (!chrono || chrono.length === 0) return null;
    return chrono[chrono.length - 1];
  }

  // --- render summary (latest month)
  function renderSummary(latest) {
    if (!latest) {
      setText("latestMonthLabel", "Нет данных");
      setText("latestApt1", "—");
      setText("latestApt2", "—");
      setText("latestTotal", "—");
      setText("latestRemainder", "—");
      setText("latestPiggy", "—");
      setHidden("latestNoteWrap", true);
      return;
    }

    setText("latestMonthLabel", "Месяц: " + monthLabel(latest.month));
    setText("latestApt1", formatUAH(latest.apt1));
    setText("latestApt2", formatUAH(latest.apt2));
    setText("latestTotal", formatUAH(latest.total));
    setText("latestRemainder", formatUAH(latest.remainder));
    setText("latestPiggy", formatUAH(latest.piggy));

    if (latest.note) {
      setText("latestNote", latest.note);
      setHidden("latestNoteWrap", false);
    } else {
      setHidden("latestNoteWrap", true);
    }
  }

  // --- render table & cards
  function getDisplayList() {
    // Use computed chrono list, but display can be newest first or oldest first
    var list = state.recordsComputedChrono.slice();
    if (state.newestFirst) list.reverse();
    return list;
  }

  function td(text, className) {
    var el = document.createElement("td");
    el.textContent = text;
    if (className) el.className = className;
    return el;
  }

  function renderTable() {
    var body = $("ledgerBody");
    if (!body) return;

    var list = getDisplayList();
    body.innerHTML = "";

    if (list.length === 0) {
      var trEmpty = document.createElement("tr");
      var tdEmpty = document.createElement("td");
      tdEmpty.colSpan = 6;
      tdEmpty.textContent = "Нет данных.";
      trEmpty.appendChild(tdEmpty);
      body.appendChild(trEmpty);
      return;
    }

    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      var tr = document.createElement("tr");

      tr.appendChild(td(monthLabel(r.month), ""));
      tr.appendChild(td(formatUAH(r.apt1), "num"));
      tr.appendChild(td(formatUAH(r.apt2), "num"));
      tr.appendChild(td(formatUAH(r.total), "num"));
      tr.appendChild(td(formatUAH(r.remainder), "num" + (r.remainder < 0 ? " neg" : "")));
      tr.appendChild(td(formatUAH(r.piggy), "num"));

      body.appendChild(tr);
    }
  }

  function cardItem(label, value, isNegative) {
    var wrap = document.createElement("div");
    wrap.className = "card__item";

    var l = document.createElement("div");
    l.className = "card__label";
    l.textContent = label;

    var v = document.createElement("div");
    v.className = "card__value" + (isNegative ? " neg" : "");
    v.textContent = value;

    wrap.appendChild(l);
    wrap.appendChild(v);
    return wrap;
  }

  function renderCards() {
    var container = $("cardsContainer");
    if (!container) return;

    var list = getDisplayList();
    container.innerHTML = "";

    if (list.length === 0) {
      var empty = document.createElement("div");
      empty.className = "card";
      empty.textContent = "Нет данных.";
      container.appendChild(empty);
      return;
    }

    for (var i = 0; i < list.length; i++) {
      var r = list[i];

      var card = document.createElement("article");
      card.className = "card";

      var top = document.createElement("div");
      top.className = "card__top";

      var m = document.createElement("div");
      m.className = "card__month";
      m.textContent = monthLabel(r.month);

      var n = document.createElement("div");
      n.className = "card__note";
      n.textContent = r.note ? r.note : "";

      top.appendChild(m);
      if (r.note) top.appendChild(n);

      var grid = document.createElement("div");
      grid.className = "card__grid";

      grid.appendChild(cardItem("Кв.1", formatUAH(r.apt1), false));
      grid.appendChild(cardItem("Кв.2", formatUAH(r.apt2), false));
      grid.appendChild(cardItem("Итого", formatUAH(r.total), false));
      grid.appendChild(cardItem("Остаток", formatUAH(r.remainder), r.remainder < 0));
      grid.appendChild(cardItem("Копилка", formatUAH(r.piggy), false));

      card.appendChild(top);
      card.appendChild(grid);

      container.appendChild(card);
    }
  }

  function applyView() {
    var tableView = $("tableView");
    var cardView = $("cardView");
    var toggleBtn = $("toggleViewBtn");

    if (!tableView || !cardView || !toggleBtn) return;

    if (state.view === "table") {
      tableView.hidden = false;
      cardView.hidden = true;
      toggleBtn.textContent = "Режим: Таблица";
      toggleBtn.setAttribute("aria-pressed", "false");
    } else {
      tableView.hidden = true;
      cardView.hidden = false;
      toggleBtn.textContent = "Режим: Карточки";
      toggleBtn.setAttribute("aria-pressed", "true");
    }
  }

  function applySortLabel() {
    var btn = $("toggleSortBtn");
    if (!btn) return;

    btn.textContent = state.newestFirst ? "Сортировка: новые сверху" : "Сортировка: старые сверху";
    btn.setAttribute("aria-pressed", state.newestFirst ? "true" : "false");
  }

  function renderAll() {
    setText("baseRent", String(BASE_RENT));
    setText("countLabel", "Записей: " + state.recordsComputedChrono.length);

    var latest = getLatestFromChrono(state.recordsComputedChrono);
    renderSummary(latest);

    renderTable();
    renderCards();

    applyView();
    applySortLabel();
  }

  // --- events
  function bindUI() {
    var toggleViewBtn = $("toggleViewBtn");
    var toggleSortBtn = $("toggleSortBtn");

    if (toggleViewBtn) {
      toggleViewBtn.addEventListener("click", function () {
        state.view = (state.view === "table") ? "cards" : "table";
        applyView();
      });
    }

    if (toggleSortBtn) {
      toggleSortBtn.addEventListener("click", function () {
        state.newestFirst = !state.newestFirst;
        applySortLabel();
        renderTable();
        renderCards();
      });
    }
  }

  // --- init
  function showError(msg) {
    var box = $("errorBox");
    if (!box) return;
    box.textContent = msg;
    box.hidden = false;
  }

  function hideError() {
    var box = $("errorBox");
    if (!box) return;
    box.hidden = true;
    box.textContent = "";
  }

  function loadData() {
    hideError();

    // Use relative path so GitHub Pages under subpath works.
    fetch("./data.json", { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("Не удалось загрузить data.json (" + res.status + ").");
        return res.json();
      })
      .then(function (json) {
        var err = validateRecords(json);
        if (err) throw new Error(err);

        state.recordsRaw = json.slice();
        state.recordsComputedChrono = computeChronological(state.recordsRaw);
        renderAll();
      })
      .catch(function (e) {
        showError(
          "Ошибка данных/загрузки: " +
          (e && e.message ? e.message : String(e)) +
          " Проверь, что рядом с index.html лежит data.json и он валидный JSON."
        );

        // keep UI minimal but not broken
        state.recordsRaw = [];
        state.recordsComputedChrono = [];
        renderAll();
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    bindUI();
    loadData();
  });

})();
