"use strict";
/* Cooler Bot — the game's host. Sits by the wheel, cheers while it spins and laughs at every result.
 * app3d.js calls window.CoolerBot.spin() and window.CoolerBot.laugh(item). */
(() => {
  const SPIN = ["វិលៗៗ! 🎡", "អ្នកណាត្រូវហ្នឹង? 😏", "ចាំមើល... 👀", "ឆាប់ៗ! ⚡"];
  const LAUGH = ["ហាហាហា 😂", "ហ៊ឺៗ ត្រូវហើយ! 🤣", "ហាហា! សប្បាយណាស់ 🥳", "ឡូយហើយ! 😆", "ហាហា ចប់ហើយបង 😂"];
  const TAP = ["ហិហិ 😄", "លេងទៀតទៅ! 🎉", "Cooler Bot នៅនេះ 😎", "SPIN ទៅបង! 🎡"];
  const pick = a => a[Math.floor(Math.random() * a.length)];

  const box = document.createElement("div");
  box.className = "cbot";
  box.innerHTML =
    '<div class="cbot-say" role="status" aria-live="polite"></div>' +
    '<button class="cbot-face" type="button" aria-label="Cooler Bot"><span class="cbot-in">' +
    '<img src="/assets/coolerbot-head.webp" alt="" draggable="false">' +
    '<span class="ln l"></span><span class="ln r"></span><span class="ray a"></span><span class="ray b"></span>' +
    '<span class="gl a"></span><span class="gl b"></span><span class="gl c"></span></span></button>' +
    '<div class="cbot-ha" aria-hidden="true"></div>';
  document.body.appendChild(box);
  const say = box.querySelector(".cbot-say"), ha = box.querySelector(".cbot-ha");
  let sayT, modeT;

  function talk(text, ms) {
    say.textContent = text; say.classList.add("on");
    clearTimeout(sayT); sayT = setTimeout(() => say.classList.remove("on"), ms || 2200);
  }
  function mode(m, ms) {
    box.classList.remove("spin", "laugh", "giggle"); void box.offsetWidth;
    if (m) box.classList.add(m);
    clearTimeout(modeT); if (ms) modeT = setTimeout(() => box.classList.remove(m), ms);
  }
  function haha(count) {
    for (let i = 0; i < count; i++) {
      const s = document.createElement("span");
      s.textContent = i % 3 === 2 ? "😂" : "ហា";
      s.style.left = (10 + Math.random() * 70) + "%";
      s.style.animationDelay = (i * 0.16) + "s";
      s.style.fontSize = (16 + Math.random() * 10) + "px";
      ha.appendChild(s);
      setTimeout(() => s.remove(), 1800 + i * 160);
    }
  }

  window.CoolerBot = {
    spin() { mode("spin"); talk(pick(SPIN), 1800); },
    laugh(item) {
      mode("laugh", 2600); haha(7);
      const t = item && item.title ? `ហាហា! ${item.title} 😂` : pick(LAUGH);
      talk(Math.random() < 0.5 ? t : pick(LAUGH), 2800);
    },
  };
  box.querySelector(".cbot-face").addEventListener("click", () => { mode("giggle", 900); haha(3); talk(pick(TAP), 1600); });
  setTimeout(() => { if (!box.classList.contains("spin")) talk("សួស្តី! ខ្ញុំ Cooler Bot 😎 SPIN ទៅ!", 2600); }, 1500);
})();
