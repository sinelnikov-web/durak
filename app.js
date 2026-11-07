/* Дурак — помощник. Состояние игры, счёт, офлайн. */
(function () {
  "use strict";

  var STORAGE_KEY = "durak-helper:v1";

  var SUITS = [
    { id: "S", glyph: "♠", red: false, name: "пики", gen: "пик" },
    { id: "H", glyph: "♥", red: true, name: "червы", gen: "червей" },
    { id: "D", glyph: "♦", red: true, name: "бубны", gen: "бубён" },
    { id: "C", glyph: "♣", red: false, name: "трефы", gen: "треф" }
  ];

  var RANKS = {
    36: ["6", "7", "8", "9", "10", "В", "Д", "К", "Т"],
    52: ["2", "3", "4", "5", "6", "7", "8", "9", "10", "В", "Д", "К", "Т"]
  };

  var RANK_NAMES = {
    "2": "двойка", "3": "тройка", "4": "четвёрка", "5": "пятёрка",
    "6": "шестёрка", "7": "семёрка", "8": "восьмёрка", "9": "девятка",
    "10": "десятка", "В": "валет", "Д": "дама", "К": "король", "Т": "туз"
  };

  function defaultState() {
    return { v: 1, deck: 36, trump: null, played: [], history: [], guided: false };
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      var s = JSON.parse(raw);
      if (!s || s.v !== 1 || !RANKS[s.deck]) return defaultState();
      if (!Array.isArray(s.played)) s.played = [];
      if (!Array.isArray(s.history)) s.history = [];
      return s;
    } catch (e) {
      return defaultState();
    }
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* приватный режим */ }
  }

  var state = loadState();

  /* ---------- элементы ---------- */

  var el = {
    table: document.getElementById("table"),
    tallyIn: document.getElementById("tallyIn"),
    tallyOut: document.getElementById("tallyOut"),
    trumpSuit: document.getElementById("trumpSuitGlyph"),
    hint: document.getElementById("hint"),
    undo: document.getElementById("undoBtn"),
    newGame: document.getElementById("newGameBtn"),
    deckBtn: document.getElementById("deckBtn"),
    deckBtnSize: document.getElementById("deckBtnSize"),
    deckSheet: document.getElementById("deckSheet"),
    seg36: document.getElementById("seg36"),
    seg52: document.getElementById("seg52"),
    deckApply: document.getElementById("deckApply"),
    deckCancel: document.getElementById("deckCancel"),
    toast: document.getElementById("toast")
  };

  var chipNodes = {}; // id карты -> кнопка
  var suitCountNodes = {}; // масть -> счётчик
  var suitRows = {}; // масть -> строка
  var toastTimer = null;
  var armTimer = null;
  var segChoice = state.deck;

  /* ---------- утилиты ---------- */

  function suitOf(id) {
    for (var i = 0; i < SUITS.length; i++) {
      if (SUITS[i].id === id.charAt(id.length - 1)) return SUITS[i];
    }
    return SUITS[0];
  }

  function rankOf(id) { return id.slice(0, id.length - 1); }

  function cardLabel(id) {
    return RANK_NAMES[rankOf(id)] + " " + suitOf(id).gen;
  }

  function isPlayed(id) { return state.played.indexOf(id) !== -1; }

  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.hidden = true; }, 2200);
  }

  /* ---------- отрисовка ---------- */

  function renderTable() {
    el.table.innerHTML = "";
    chipNodes = {};
    suitCountNodes = {};
    suitRows = {};

    SUITS.forEach(function (suit) {
      var row = document.createElement("div");
      row.className = "suit" + (state.trump === suit.id ? " is-trump" : "");

      var head = document.createElement("button");
      head.type = "button";
      head.className = "suit__head " + (suit.red ? "is-red" : "is-black");
      head.setAttribute("aria-label", "Козырь — " + suit.name);
      head.innerHTML = suit.glyph + '<span class="suit__crown" aria-hidden="true">♕</span>';
      head.addEventListener("click", function () { setTrump(suit.id); });

      var cards = document.createElement("div");
      cards.className = "suit__cards";

      RANKS[state.deck].forEach(function (rank) {
        cards.appendChild(makeChip(rank, suit));
      });

      var count = document.createElement("span");
      count.className = "suit__count";
      count.setAttribute("aria-hidden", "true");

      row.appendChild(head);
      row.appendChild(cards);
      row.appendChild(count);
      el.table.appendChild(row);

      suitRows[suit.id] = row;
      suitCountNodes[suit.id] = count;
    });

    updateAll();
  }

  function makeChip(rank, suit) {
    var id = rank + suit.id;
    var b = document.createElement("button");
    b.type = "button";
    b.className = "chip " + (suit.red ? "is-red" : "is-black") +
      (state.trump === suit.id ? " is-trump" : "") +
      (isPlayed(id) ? " is-played" : "");
    b.dataset.card = id;
    b.setAttribute("aria-pressed", isPlayed(id) ? "true" : "false");
    b.innerHTML = '<span class="chip__rank">' + rank + '</span><span class="chip__suit">' + suit.glyph + "</span>";
    updateChipLabel(b, id);
    b.addEventListener("click", function () { toggleCard(id); });
    chipNodes[id] = b;
    return b;
  }

  function updateChipLabel(b, id) {
    b.setAttribute("aria-label", cardLabel(id) + (isPlayed(id) ? " — сброшена" : " — в игре"));
  }

  function updateAll() {
    // счётчики
    var total = RANKS[state.deck].length * 4;
    var out = state.played.length;
    el.tallyIn.textContent = String(total - out);
    el.tallyOut.textContent = String(out);
    el.deckBtnSize.textContent = String(state.deck);

    // козырь
    if (state.trump) {
      var t = suitOf(state.trump);
      el.trumpSuit.textContent = t.glyph;
      el.trumpSuit.className = "tally__suit " + (t.red ? "is-red" : "is-black");
    } else {
      el.trumpSuit.textContent = "—";
      el.trumpSuit.className = "tally__suit is-empty";
    }

    // по мастям
    SUITS.forEach(function (suit) {
      var left = RANKS[state.deck].filter(function (rank) {
        return !isPlayed(rank + suit.id);
      }).length;
      suitCountNodes[suit.id].textContent = String(left);
      suitRows[suit.id].classList.toggle("is-trump", state.trump === suit.id);
      RANKS[state.deck].forEach(function (rank) {
        var id = rank + suit.id;
        var b = chipNodes[id];
        if (!b) return;
        b.classList.toggle("is-played", isPlayed(id));
        b.classList.toggle("is-trump", state.trump === suit.id);
        b.setAttribute("aria-pressed", isPlayed(id) ? "true" : "false");
        updateChipLabel(b, id);
      });
    });

    el.undo.disabled = state.history.length === 0;
    el.hint.hidden = state.guided || state.played.length > 0;
  }

  /* ---------- действия ---------- */

  function pushHistory(entry) {
    state.history.push(entry);
    if (state.history.length > 200) state.history.shift();
  }

  function toggleCard(id) {
    state.guided = true;
    var i = state.played.indexOf(id);
    if (i === -1) {
      state.played.push(id);
      pushHistory({ t: "card", id: id, played: false });
    } else {
      state.played.splice(i, 1);
      pushHistory({ t: "card", id: id, played: true });
    }
    saveState();
    updateAll();
  }

  function setTrump(suitId) {
    if (state.trump === suitId) return;
    pushHistory({ t: "trump", from: state.trump, to: suitId });
    state.trump = suitId;
    state.guided = true;
    saveState();
    updateAll();
    toast("Козырь — " + suitOf(suitId).name);
  }

  function newGame() {
    pushHistory({ t: "new", snap: JSON.stringify({ deck: state.deck, trump: state.trump, played: state.played }) });
    state.played = [];
    state.trump = null;
    saveState();
    renderTable();
    toast("Новая игра. Выберите козырь");
  }

  function undo() {
    var h = state.history.pop();
    if (!h) return;
    if (h.t === "card") {
      var i = state.played.indexOf(h.id);
      if (h.played && i === -1) state.played.push(h.id);
      if (!h.played && i !== -1) state.played.splice(i, 1);
    } else if (h.t === "trump") {
      state.trump = h.from;
    } else if (h.t === "new" || h.t === "deck") {
      var s = JSON.parse(h.snap);
      state.deck = s.deck;
      state.trump = s.trump;
      state.played = s.played;
      renderTable();
    }
    saveState();
    updateAll();
  }

  /* ---------- кнопка «Новая игра»: подтверждение в два шага ---------- */

  function disarmNewGame() {
    clearTimeout(armTimer);
    el.newGame.classList.remove("btn--danger");
    el.newGame.textContent = "Новая игра";
  }

  el.newGame.addEventListener("click", function () {
    if (el.newGame.classList.contains("btn--danger")) {
      disarmNewGame();
      newGame();
    } else if (state.played.length === 0 && state.trump === null) {
      newGame(); // нечего подтверждать
    } else {
      el.newGame.classList.add("btn--danger");
      el.newGame.textContent = "Сбросить игру?";
      armTimer = setTimeout(disarmNewGame, 3500);
    }
  });

  el.undo.addEventListener("click", function () {
    disarmNewGame();
    undo();
  });

  /* ---------- смена колоды ---------- */

  function openSheet() {
    segChoice = state.deck;
    syncSeg();
    el.deckSheet.hidden = false;
    el.seg36.focus();
  }

  function closeSheet() { el.deckSheet.hidden = true; }

  function syncSeg() {
    el.seg36.setAttribute("aria-checked", String(segChoice === 36));
    el.seg52.setAttribute("aria-checked", String(segChoice === 52));
    el.deckApply.disabled = segChoice === state.deck;
  }

  el.deckBtn.addEventListener("click", openSheet);
  el.deckCancel.addEventListener("click", closeSheet);
  el.deckSheet.addEventListener("click", function (e) {
    if (e.target === el.deckSheet) closeSheet();
  });
  el.seg36.addEventListener("click", function () { segChoice = 36; syncSeg(); });
  el.seg52.addEventListener("click", function () { segChoice = 52; syncSeg(); });

  el.deckApply.addEventListener("click", function () {
    if (segChoice !== state.deck) {
      pushHistory({ t: "deck", snap: JSON.stringify({ deck: state.deck, trump: state.trump, played: state.played }) });
      state.deck = segChoice;
      state.played = [];
      state.trump = null;
      saveState();
      renderTable();
      toast("Колода " + state.deck + " карт. Новая игра");
    }
    closeSheet();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeSheet();
      disarmNewGame();
    }
  });

  /* ---------- сервис-воркер ---------- */

  if ("serviceWorker" in navigator &&
      (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    navigator.serviceWorker.register("./sw.js").catch(function () { /* офлайн настроится позже */ });
  }

  /* ---------- старт ---------- */

  renderTable();
})();
