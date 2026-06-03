(function () {
  const BIRTH = new Date(2007, 10, 22, 0, 0, 0, 0);
  const LIFE_END = new Date(2087, 10, 22, 0, 0, 0, 0);
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const TOTAL_DAYS = Math.floor((LIFE_END - BIRTH) / MS_PER_DAY);

  const QUOTES = [
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

  const elMonths = document.getElementById("months");
  const elDays = document.getElementById("days");
  const elMinutes = document.getElementById("minutes");
  const elSeconds = document.getElementById("seconds");
  const yearFill = document.getElementById("year-fill");
  const dayFill = document.getElementById("day-fill");
  const yearLabel = document.getElementById("year-label");
  const dayLabel = document.getElementById("day-label");
  const quoteText = document.getElementById("quote-text");
  const quoteAuthor = document.getElementById("quote-author");

  function pad(n) {
    return String(n);
  }

  function diffParts(from, to) {
    let months =
      (to.getFullYear() - from.getFullYear()) * 12 +
      (to.getMonth() - from.getMonth());
    if (to.getDate() < from.getDate()) months -= 1;

    const afterMonths = new Date(from);
    afterMonths.setMonth(afterMonths.getMonth() + months);

    let remainMs = to - afterMonths;
    const days = Math.floor(remainMs / (24 * 60 * 60 * 1000));
    remainMs -= days * 24 * 60 * 60 * 1000;
    const minutes = Math.floor(remainMs / (60 * 1000));
    remainMs -= minutes * 60 * 1000;
    const seconds = Math.floor(remainMs / 1000);

    return { months, days, minutes, seconds };
  }

  function lifeProgress(now) {
    const totalMs = LIFE_END - BIRTH;
    const elapsedMs = Math.max(0, Math.min(now - BIRTH, totalMs));
    const pct = (elapsedMs / totalMs) * 100;
    const daysElapsed = Math.max(0, Math.min(Math.floor(elapsedMs / MS_PER_DAY), TOTAL_DAYS));

    return { pct, daysElapsed };
  }

  function tick() {
    const now = new Date();
    const parts = diffParts(BIRTH, now);
    const life = lifeProgress(now);

    elMonths.textContent = pad(parts.months);
    elDays.textContent = pad(parts.days);
    elMinutes.textContent = pad(parts.minutes);
    elSeconds.textContent = pad(parts.seconds);

    yearFill.style.width = life.pct.toFixed(1) + "%";
    dayFill.style.width = ((life.daysElapsed / TOTAL_DAYS) * 100).toFixed(1) + "%";
    yearLabel.textContent = "Year: " + Math.round(life.pct) + "%";
    dayLabel.textContent = "Day: " + life.daysElapsed + " / " + TOTAL_DAYS;
  }

  function wait(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function shuffle(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  async function typeQuote(quote) {
    quoteAuthor.textContent = "";
    quoteText.textContent = "";

    for (let i = 0; i < quote.text.length; i++) {
      quoteText.textContent += quote.text[i];
      await wait(38 + Math.random() * 22);
    }

    await wait(400);
    quoteAuthor.textContent = "— " + quote.author;
    await wait(3200);
  }

  async function deleteQuote(quote) {
    quoteAuthor.textContent = "";
    let current = quote.text;

    while (current.length > 0) {
      current = current.slice(0, -1);
      quoteText.textContent = current;
      await wait(18 + Math.random() * 12);
    }

    await wait(500);
  }

  async function runQuotes() {
    let order = shuffle(QUOTES);
    let index = 0;

    while (true) {
      if (index >= order.length) {
        order = shuffle(QUOTES);
        index = 0;
      }

      const quote = order[index];
      index += 1;
      await typeQuote(quote);
      await deleteQuote(quote);
    }
  }

  tick();
  setInterval(tick, 1000);
  runQuotes();
})();
