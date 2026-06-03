(function () {
  "use strict";

  var BIRTH = new Date(2007, 10, 22, 0, 0, 0, 0);
  var LIFE_END = new Date(2087, 10, 22, 0, 0, 0, 0);
  var MS_PER_DAY = 24 * 60 * 60 * 1000;
  var TOTAL_DAYS = Math.floor((LIFE_END - BIRTH) / MS_PER_DAY);
  var ANALYSIS_ANCHOR_YEAR = 2026;
  var ANALYSIS_ANCHOR_VALUE = 36;
  var ANALYSIS_MAX = 100;

  function getAnalysisValue(now) {
    var yearsPassed = now.getFullYear() - ANALYSIS_ANCHOR_YEAR;
    var value = ANALYSIS_ANCHOR_VALUE + yearsPassed;
    return Math.max(0, Math.min(ANALYSIS_MAX, value));
  }

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
  var quoteCursorEl = document.querySelector(".quote-text .quote-cursor");
  var authorCursorEl = document.querySelector(".author-cursor");
  var balanceReel = document.getElementById("balance-reel");

  function getCurrentBalance() {
    if (!balanceReel) return 15;
    var nums = balanceReel.querySelectorAll(".balance-num");
    var last = nums[nums.length - 1];
    return last ? parseInt(last.textContent, 10) : 15;
  }

  function randomBalance() {
    var current = getCurrentBalance();
    var n;
    do {
      n = Math.floor(Math.random() * 996) + 5;
    } while (n === current);
    return n;
  }

  function spinBalance(to) {
    if (!balanceReel) return;

    var incoming = document.createElement("span");
    incoming.className = "balance-num";
    incoming.textContent = to;
    balanceReel.insertBefore(incoming, balanceReel.firstChild);

    balanceReel.classList.remove("is-old");
    balanceReel.classList.add("is-old");
    balanceReel.offsetHeight;
    balanceReel.classList.remove("is-old");

    setTimeout(function () {
      balanceReel.innerHTML = '<span class="balance-num">' + to + "</span>";
    }, 580);
  }

  function startBalanceLoop() {
    if (!balanceReel) return;
    setTimeout(function () {
      spinBalance(randomBalance());
    }, 2000);
    setInterval(function () {
      spinBalance(randomBalance());
    }, 10000);
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
    var daysElapsed = Math.max(0, Math.min(Math.floor(elapsedMs / MS_PER_DAY), TOTAL_DAYS));
    return { daysElapsed: daysElapsed };
  }

  function tick() {
    if (!elMonths) return;

    var now = new Date();
    var parts = diffParts(BIRTH, now);
    var life = lifeProgress(now);
    var analysis = getAnalysisValue(now);

    elMonths.textContent = pad(parts.months);
    elDays.textContent = pad(parts.days);
    elMinutes.textContent = pad(parts.minutes);
    elSeconds.textContent = pad(parts.seconds);

    if (yearFill) yearFill.style.width = analysis + "%";
    if (dayFill) dayFill.style.width = ((life.daysElapsed / TOTAL_DAYS) * 100).toFixed(1) + "%";
    if (yearLabel) yearLabel.textContent = "Analysis " + analysis + "/" + ANALYSIS_MAX;
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

  function setQuoteCursor(on) {
    if (quoteCursorEl) quoteCursorEl.style.visibility = on ? "visible" : "hidden";
  }

  function setAuthorCursor(on) {
    if (authorCursorEl) {
      if (on) authorCursorEl.classList.add("active");
      else authorCursorEl.classList.remove("active");
    }
  }

  function startQuotes() {
    if (!quoteTextEl || !quoteAuthorEl) return;

    var order = shuffle(QUOTES);
    var index = 0;
    var phase = "type-quote";
    var charIndex = 0;
    var currentQuote = order[0];
    var authorFull = "— " + currentQuote.author;

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
      setQuoteCursor(true);
      setAuthorCursor(false);
    }

    function stepQuotes() {
      var delay = 40;

      if (phase === "type-quote") {
        setQuoteCursor(true);
        setAuthorCursor(false);
        if (charIndex < currentQuote.text.length) {
          quoteTextEl.textContent += currentQuote.text.charAt(charIndex);
          charIndex += 1;
          delay = 38 + Math.random() * 22;
        } else {
          phase = "type-author";
          charIndex = 0;
          setQuoteCursor(false);
          setAuthorCursor(true);
          delay = 200;
        }
      } else if (phase === "type-author") {
        setQuoteCursor(false);
        setAuthorCursor(true);
        if (charIndex < authorFull.length) {
          quoteAuthorEl.textContent += authorFull.charAt(charIndex);
          charIndex += 1;
          delay = 32 + Math.random() * 18;
        } else {
          phase = "pause";
          setAuthorCursor(false);
          delay = 2600;
        }
      } else if (phase === "pause") {
        phase = "delete-author";
        setAuthorCursor(true);
        delay = 300;
      } else if (phase === "delete-author") {
        setQuoteCursor(false);
        setAuthorCursor(true);
        if (quoteAuthorEl.textContent.length > 0) {
          quoteAuthorEl.textContent = quoteAuthorEl.textContent.slice(0, -1);
          delay = 16 + Math.random() * 12;
        } else {
          phase = "delete-quote";
          setAuthorCursor(false);
          setQuoteCursor(true);
          delay = 200;
        }
      } else if (phase === "delete-quote") {
        setQuoteCursor(true);
        setAuthorCursor(false);
        if (quoteTextEl.textContent.length > 0) {
          quoteTextEl.textContent = quoteTextEl.textContent.slice(0, -1);
          delay = 16 + Math.random() * 12;
        } else {
          nextQuote();
          delay = 450;
        }
      }

      setTimeout(stepQuotes, delay);
    }

    quoteTextEl.textContent = "";
    quoteAuthorEl.textContent = "";
    setQuoteCursor(true);
    setAuthorCursor(false);
    stepQuotes();
  }

  tick();
  setInterval(tick, 1000);
  startQuotes();
  startBalanceLoop();
})();
