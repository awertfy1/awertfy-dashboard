(function () {
  const BIRTH = new Date(2007, 10, 22, 0, 0, 0, 0);
  const LIFE_END = new Date(2087, 10, 22, 0, 0, 0, 0);
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const TOTAL_DAYS = Math.floor((LIFE_END - BIRTH) / MS_PER_DAY);

  const elMonths = document.getElementById("months");
  const elDays = document.getElementById("days");
  const elMinutes = document.getElementById("minutes");
  const elSeconds = document.getElementById("seconds");
  const yearFill = document.getElementById("year-fill");
  const dayFill = document.getElementById("day-fill");
  const yearLabel = document.getElementById("year-label");
  const dayLabel = document.getElementById("day-label");

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

  tick();
  setInterval(tick, 1000);
})();
