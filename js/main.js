(function () {
  "use strict";

  var BIRTH = new Date(2007, 10, 22, 0, 0, 0, 0);
  var LIFE_END = new Date(2087, 10, 22, 0, 0, 0, 0);
  var MS_PER_DAY = 24 * 60 * 60 * 1000;
  var TOTAL_DAYS = Math.floor((LIFE_END - BIRTH) / MS_PER_DAY);

  var QUOTES = [
    { text: "The unexamined life is not worth living.", author: "Socrates" },
    { text: "He who has a why to live can bear almost any how.", author: "Friedrich Nietzsche" },
    { text: "We suffer more often in imagination than in reality.", author: "Seneca" },
    { text: "It is not that we have a short time to live, but that we waste a lot of it.", author: "Seneca" },
    { text: "Man is condemned to be free.", author: "Jean-Paul Sartre" },
    { text: "The only thing I know is that I know nothing.", author: "Socrates" },
    { text: "Imagination is more important than knowledge.", author: "Albert Einstein" },
    { text: "What does not kill me makes me stronger.", author: "Friedrich Nietzsche" },
    { text: "I think, therefore I am.", author: "René Descartes" },
    { text: "Not all those who wander are lost.", author: "J.R.R. Tolkien" },
    { text: "The journey of a thousand miles begins with one step.", author: "Lao Tzu" },
    { text: "To live is the rarest thing in the world. Most people exist, that is all.", author: "Oscar Wilde" },
    { text: "Happiness is not an ideal of reason but of imagination.", author: "Immanuel Kant" },
    { text: "Stay hungry, stay foolish.", author: "Steve Jobs" },
    { text: "Be the change you wish to see in the world.", author: "Mahatma Gandhi" },
  ];

  var elMonths = document.getElementById("months");
  var elDays = document.getElementById("days");
  var elMinutes = document.getElementById("minutes");
  var elSeconds = document.getElementById("seconds");
  var yearFill = document.getElementById("year-fill");
  var dayFill = document.getElementById("day-fill");
  var yearLabel = document.getElementById("year-label");
  var dayLabel = document.getElementById("day-label");
  var quoteTextEl = document.getElementById("quote-text");
  var quoteAuthorEl = document.getElementById("quote-author");
  var authorCursorEl = document.querySelector(".author-cursor");
  var balanceEl = document.getElementById("balance-value");

  function randomBalance() {
    var n;
    do {
      n = Math.floor(Math.random() * 996) + 5;
    } while (balanceEl && parseInt(balanceEl.textContent, 10) === n);
    return n;
  }

  function startBalanceLoop() {
    if (!balanceEl) return;

    setInterval(function () {
      balanceEl.textContent = randomBalance();
    }, 4000);
  }

  function pad(n) {
    return String(n);
  }

  function diffParts(from, to) {
    var months =
      (to.getFullYear() - from.getFullYear()) * 12 +
      (to.getMonth() - from.getMonth());
    if (to.getDate() < from.getDate()) months -= 1;

    var afterMonths = new Date(from.getTime());
    afterMonths.setMonth(afterMonths.getMonth() + months);

    var remainMs = to - afterMonths;
    var days = Math.floor(remainMs / MS_PER_DAY);
    remainMs -= days * MS_PER_DAY;
    var minutes = Math.floor(remainMs / (60 * 1000));
    remainMs -= minutes * 60 * 1000;
    var seconds = Math.floor(remainMs / 1000);

    return { months: months, days: days, minutes: minutes, seconds: seconds };
  }

  function lifeProgress(now) {
    var totalMs = LIFE_END - BIRTH;
    var elapsedMs = Math.max(0, Math.min(now - BIRTH, totalMs));
    var pct = (elapsedMs / totalMs) * 100;
    var daysElapsed = Math.max(0, Math.min(Math.floor(elapsedMs / MS_PER_DAY), TOTAL_DAYS));
    return { pct: pct, daysElapsed: daysElapsed };
  }

  function tick() {
    if (!elMonths) return;

    var now = new Date();
    var parts = diffParts(BIRTH, now);
    var life = lifeProgress(now);

    elMonths.textContent = pad(parts.months);
    elDays.textContent = pad(parts.days);
    elMinutes.textContent = pad(parts.minutes);
    elSeconds.textContent = pad(parts.seconds);

    if (yearFill) yearFill.style.width = life.pct.toFixed(1) + "%";
    if (dayFill) dayFill.style.width = ((life.daysElapsed / TOTAL_DAYS) * 100).toFixed(1) + "%";
    if (yearLabel) yearLabel.textContent = "Year: " + Math.round(life.pct) + "%";
    if (dayLabel) dayLabel.textContent = "Day: " + life.daysElapsed + " / " + TOTAL_DAYS;
  }

  function shuffle(arr) {
    var copy = arr.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function startQuotes() {
    if (!quoteTextEl || !quoteAuthorEl) return;

    var order = shuffle(QUOTES);
    var index = 0;
    var phase = "type-quote";
    var charIndex = 0;
    var currentQuote = order[0];
    var authorFull = "";
    var pauseUntil = 0;

    function nextQuote() {
      index += 1;
      if (index >= order.length) {
        order = shuffle(QUOTES);
        index = 0;
      }
      currentQuote = order[index];
      authorFull = "— " + currentQuote.author;
      charIndex = 0;
      phase = "type-quote";
      quoteAuthorEl.textContent = "";
      quoteTextEl.textContent = "";
      if (authorCursorEl) authorCursorEl.classList.remove("active");
    }

    authorFull = "— " + currentQuote.author;

    function stepQuotes() {
      var now = Date.now();
      if (now < pauseUntil) {
        requestAnimationFrame(stepQuotes);
        return;
      }

      if (phase === "type-quote") {
        if (charIndex < currentQuote.text.length) {
          quoteTextEl.textContent += currentQuote.text.charAt(charIndex);
          charIndex += 1;
          pauseUntil = now + 35 + Math.random() * 25;
        } else {
          phase = "type-author";
          charIndex = 0;
          if (authorCursorEl) authorCursorEl.classList.add("active");
        }
      } else if (phase === "type-author") {
        if (charIndex < authorFull.length) {
          quoteAuthorEl.textContent += authorFull.charAt(charIndex);
          charIndex += 1;
          pauseUntil = now + 30 + Math.random() * 20;
        } else {
          phase = "pause";
          if (authorCursorEl) authorCursorEl.classList.remove("active");
          pauseUntil = now + 2800;
        }
      } else if (phase === "pause") {
        phase = "delete-author";
        charIndex = quoteAuthorEl.textContent.length;
        if (authorCursorEl) authorCursorEl.classList.add("active");
      } else if (phase === "delete-author") {
        if (quoteAuthorEl.textContent.length > 0) {
          quoteAuthorEl.textContent = quoteAuthorEl.textContent.slice(0, -1);
          pauseUntil = now + 14 + Math.random() * 10;
        } else {
          phase = "delete-quote";
          if (authorCursorEl) authorCursorEl.classList.remove("active");
        }
      } else if (phase === "delete-quote") {
        if (quoteTextEl.textContent.length > 0) {
          quoteTextEl.textContent = quoteTextEl.textContent.slice(0, -1);
          pauseUntil = now + 14 + Math.random() * 10;
        } else {
          nextQuote();
          pauseUntil = now + 400;
        }
      }

      requestAnimationFrame(stepQuotes);
    }

    quoteTextEl.textContent = "";
    quoteAuthorEl.textContent = "";
    requestAnimationFrame(stepQuotes);
  }

  tick();
  setInterval(tick, 1000);
  startQuotes();
  startBalanceLoop();
})();
