(function () {
  "use strict";

  /* =========================================================
     Базовая логика (как была): счётчик, цитаты, баланс
     ========================================================= */

  var BIRTH = new Date(2007, 10, 22, 0, 0, 0, 0);
  var MS_PER_DAY = 24 * 60 * 60 * 1000;

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

  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var FINE_POINTER = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  var elMonths = document.getElementById("months");
  var elDays = document.getElementById("days");
  var elMinutes = document.getElementById("minutes");
  var elSeconds = document.getElementById("seconds");
  var quoteTextEl = document.getElementById("quote-text");
  var quoteAuthorEl = document.getElementById("quote-author");
  var quoteCursorEl = document.querySelector(".quote-block > .quote-cursor");
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
    setInterval(function () {
      spinBalance(randomBalance());
    }, 5000);
  }

  function diffParts(from, to) {
    var months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
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

  function setValue(el, value) {
    var str = String(value);
    if (el.textContent === str) return;
    el.textContent = str;
    if (REDUCED) return;
    el.classList.remove("bump");
    el.offsetWidth;
    el.classList.add("bump");
  }

  function tick() {
    if (!elMonths) return;
    var parts = diffParts(BIRTH, new Date());
    setValue(elMonths, parts.months);
    setValue(elDays, parts.days);
    setValue(elMinutes, parts.minutes);
    setValue(elSeconds, parts.seconds);
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
    if (authorCursorEl) authorCursorEl.classList.toggle("active", !!on);
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

  function lockScrollTop() {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    window.scrollTo(0, 0);
  }

  /* =========================================================
     «Партизан»: прелоадер, скролл-эффекты, курсор, магниты
     ========================================================= */

  var body = document.body;
  var ready = false;

  function setReady() {
    if (ready) return;
    ready = true;
    body.classList.remove("is-loading");
    body.classList.add("is-ready");
  }

  function runLoader() {
    var loader = document.getElementById("loader");
    var num = document.getElementById("loader-num");
    if (!loader) return setReady();

    if (REDUCED) {
      loader.style.display = "none";
      return setReady();
    }

    var start = null;
    var DURATION = 1250;

    function frame(t) {
      if (start === null) start = t;
      var p = Math.min(1, (t - start) / DURATION);
      var eased = 1 - Math.pow(1 - p, 3);
      if (num) num.textContent = String(Math.round(eased * 100)).padStart(2, "0");
      if (p < 1) {
        requestAnimationFrame(frame);
      } else {
        setTimeout(function () {
          loader.classList.add("is-done");
          setTimeout(setReady, 180);
          setTimeout(function () {
            loader.style.display = "none";
          }, 1200);
        }, 160);
      }
    }
    requestAnimationFrame(frame);

    // страховка: если вкладка в фоне и rAF не идёт
    setTimeout(function () {
      if (!ready) {
        loader.classList.add("is-done");
        setReady();
      }
    }, 3200);
  }

  /* --- появление при прокрутке --- */
  function initReveal() {
    var items = document.querySelectorAll(".reveal, .section-head");
    if (!("IntersectionObserver" in window) || REDUCED) {
      items.forEach(function (el) { el.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    items.forEach(function (el) { io.observe(el); });
  }

  /* --- скролл: прогресс, топбар, параллакс --- */
  function initScroll() {
    var progress = document.getElementById("progress");
    var topbar = document.getElementById("topbar");
    var hero = document.getElementById("hero");
    var sun = document.getElementById("sun");
    var posterImg = document.getElementById("poster-img");
    var posterWord = document.getElementById("poster-word");
    var poster = posterImg ? posterImg.parentElement : null;
    var lastY = window.scrollY;
    var ticking = false;

    function update() {
      ticking = false;
      var y = window.scrollY;
      var vh = window.innerHeight;
      var docH = document.documentElement.scrollHeight - vh;

      if (progress) progress.style.transform = "scaleX(" + (docH > 0 ? y / docH : 0) + ")";

      if (topbar) {
        var heroH = hero ? hero.offsetHeight : vh;
        topbar.classList.toggle("is-scrolled", y > heroH - 80);
        var hide = y > heroH && y > lastY + 4;
        var show = y < lastY - 4 || y < heroH;
        if (hide) topbar.classList.add("is-hidden");
        else if (show) topbar.classList.remove("is-hidden");
      }
      lastY = y;

      if (REDUCED) return;

      // солнце уходит: уменьшается и поворачивается
      if (sun && hero) {
        var hp = Math.min(1, Math.max(0, y / hero.offsetHeight));
        sun.style.setProperty("--ss", (1 - hp * 0.35).toFixed(3));
        sun.style.setProperty("--sr", (hp * -25).toFixed(2) + "deg");
      }

      // постер: картинка и большое слово
      if (poster) {
        var r = poster.getBoundingClientRect();
        if (r.bottom > 0 && r.top < vh) {
          var p = (vh - r.top) / (vh + r.height); // 0..1
          posterImg.style.setProperty("--poster-y", ((p - 0.5) * r.height * 0.22).toFixed(1) + "px");
          if (posterWord) {
            var travel = Math.max(0, posterWord.offsetWidth - window.innerWidth);
            posterWord.style.setProperty("--word-x", (-(p * (travel + window.innerWidth * 0.25)) + window.innerWidth * 0.12).toFixed(1) + "px");
          }
        }
      }
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
  }

  /* --- мышь: курсор, параллакс солнца, блик --- */
  function initPointer() {
    if (!FINE_POINTER || REDUCED) return;

    var cursor = document.getElementById("cursor");
    var sun = document.getElementById("sun");
    var shine = document.querySelector(".sun-shine");
    var mx = window.innerWidth / 2;
    var my = window.innerHeight / 2;
    var cx = mx;
    var cy = my;
    var sx = 0;
    var sy = 0;

    window.addEventListener("pointermove", function (e) {
      mx = e.clientX;
      my = e.clientY;
      if (cursor) cursor.classList.add("is-visible");
    }, { passive: true });

    document.addEventListener("pointerleave", function () {
      if (cursor) cursor.classList.remove("is-visible");
    });
    window.addEventListener("pointerdown", function () { if (cursor) cursor.classList.add("is-down"); });
    window.addEventListener("pointerup", function () { if (cursor) cursor.classList.remove("is-down"); });

    document.querySelectorAll("a, button").forEach(function (el) {
      el.addEventListener("pointerenter", function () { if (cursor) cursor.classList.add("is-hover"); });
      el.addEventListener("pointerleave", function () { if (cursor) cursor.classList.remove("is-hover"); });
    });

    function loop() {
      cx += (mx - cx) * 0.2;
      cy += (my - cy) * 0.2;
      if (cursor) cursor.style.transform = "translate3d(" + cx.toFixed(1) + "px," + cy.toFixed(1) + "px,0)";

      var nx = mx / window.innerWidth - 0.5;
      var ny = my / window.innerHeight - 0.5;
      sx += (nx * 28 - sx) * 0.06;
      sy += (ny * 22 - sy) * 0.06;
      if (sun) {
        sun.style.setProperty("--px", sx.toFixed(2) + "px");
        sun.style.setProperty("--py", sy.toFixed(2) + "px");
      }
      if (shine) {
        shine.style.setProperty("--mx", (50 - nx * 60).toFixed(1) + "%");
        shine.style.setProperty("--my", (45 - ny * 60).toFixed(1) + "%");
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  /* --- магнитные кнопки --- */
  function initMagnetic() {
    if (!FINE_POINTER || REDUCED) return;
    document.querySelectorAll("[data-magnetic]").forEach(function (el) {
      el.style.transition = "transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)";
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width / 2)) * 0.25;
        var dy = (e.clientY - (r.top + r.height / 2)) * 0.35;
        el.style.transform = "translate(" + dx.toFixed(1) + "px," + dy.toFixed(1) + "px)";
      });
      el.addEventListener("pointerleave", function () {
        el.style.transform = "";
      });
    });
  }

  /* --- «шифровка» текста при наведении/тапе --- */
  var GLYPHS = "АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЫЭЮЯ#%&$@*";

  function scramble(el) {
    var node = el.firstChild;
    if (!node || node.nodeType !== 3) return;
    if (el._scrambling) return;
    var original = el._original || (el._original = node.nodeValue);
    var frame = 0;
    var total = original.length * 2 + 6;
    el._scrambling = true;

    function step() {
      var out = "";
      for (var i = 0; i < original.length; i++) {
        if (original[i] === " " || i < (frame - 6) / 2) out += original[i];
        else out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
      node.nodeValue = out;
      frame++;
      if (frame <= total) {
        setTimeout(step, 28);
      } else {
        node.nodeValue = original;
        el._scrambling = false;
      }
    }
    step();
  }

  function initScramble() {
    if (REDUCED) return;
    document.querySelectorAll("[data-scramble]").forEach(function (el) {
      var trigger = el.closest("a") || el;
      trigger.addEventListener("pointerenter", function (e) {
        if (e.pointerType === "mouse") scramble(el);
      });
      trigger.addEventListener("touchstart", function () { scramble(el); }, { passive: true });
    });
  }

  /* --- скорость бегущей строки от скролла --- */
  function initMarquee() {
    var track = document.querySelector(".marquee-track");
    if (!track || REDUCED) return;
    track.style.animation = "none";
    var last = window.scrollY;
    var boost = 0;
    var dir = 1;
    var x = 0;
    var prev = null;
    window.addEventListener("scroll", function () {
      var y = window.scrollY;
      var d = y - last;
      if (Math.abs(d) > 1) dir = d > 0 ? 1 : -1;
      boost = Math.min(14, boost + Math.abs(d) * 0.04);
      last = y;
    }, { passive: true });

    function loop(t) {
      if (prev === null) prev = t;
      var dt = Math.min(64, t - prev);
      prev = t;
      boost *= 0.94;
      var half = track.scrollWidth / 2;
      x -= dir * (0.06 + boost * 0.05) * dt;
      if (x <= -half) x += half;
      if (x > 0) x -= half;
      track.style.transform = "translate3d(" + x.toFixed(1) + "px,0,0)";
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  function initToTop() {
    var btn = document.getElementById("to-top");
    if (!btn) return;
    btn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: REDUCED ? "auto" : "smooth" });
    });
  }

  function safe(fn) {
    try { fn(); } catch (e) { if (window.console) console.warn(e); }
  }

  /* ---------- запуск ---------- */
  lockScrollTop();
  window.addEventListener("load", function () { window.scrollTo(0, 0); });

  safe(runLoader);
  safe(tick);
  setInterval(function () { safe(tick); }, 1000);
  safe(startQuotes);
  safe(startBalanceLoop);
  safe(initReveal);
  safe(initScroll);
  safe(initPointer);
  safe(initMagnetic);
  safe(initScramble);
  safe(initMarquee);
  safe(initToTop);
})();
