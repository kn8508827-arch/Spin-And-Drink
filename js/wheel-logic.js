/* Cooler Drink — wheel rules shared by the 3D page and the Node tests. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.WheelLogic = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Short labels on purpose: the wheel shows emoji + a few words, details stay in the result card.
  const DEFAULT_OPTIONS = [
    { id: "unfaithful", emoji: "🥃", title: "អត់ស្មោះ", desc: "ផឹក ២ កែវ", color: "#1d7bff" },
    { id: "faithful", emoji: "🛡️", title: "ស្មោះ", desc: "រួចខ្លួន មិនបាច់ផឹក", color: "#ffb21e" },
    { id: "command", emoji: "👉", title: "បញ្ជាមិត្ត", desc: "ជ្រើសមិត្តម្នាក់ឲ្យធ្វើអ្វីមួយ", color: "#00d1ff" },
    { id: "drink", emoji: "🍷", title: "ផឹក ១ កែវ", desc: "ផឹក ១ កែវ", color: "#7c4dff" },
    { id: "luck", emoji: "🍺", title: "ផឹក ១ កែវ", desc: "ផឹក ១ កែវ", color: "#00c48c" },
    { id: "sing", emoji: "🎤", title: "ច្រៀង", desc: "ច្រៀងមួយបទ", color: "#ff7a1a" },
    { id: "dance", emoji: "💸", title: "អោយលុយគេ", desc: "អោយលុយមិត្តម្នាក់", color: "#ff3d7f" },
    { id: "dance-two-minutes", emoji: "💃", title: "រាំ ២ នាទី", desc: "រាំ ២ នាទី 💃🕺", color: "#b04dff" },
    { id: "again", emoji: "🎁", title: "បង្វិលទៀត", desc: "បង្វិលម្ដងទៀត", color: "#2ee6c5" },
    { id: "money", emoji: "💰", title: "បានលុយ", desc: "ឈ្នះប្រាក់រង្វាន់", color: "#ffd23f" },
  ];
  const REMOVED_IDS = new Set(["water", "truth", "friend"]);
  const MAX_OPTIONS = 24;

  function isColor(v) { return typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v); }

  /** Clean a saved or edited list; falls back to the defaults when nothing valid is left. */
  function normalize(list) {
    if (!Array.isArray(list) || !list.length || list.length > MAX_OPTIONS) return DEFAULT_OPTIONS.map(o => ({ ...o }));
    const seen = new Set(), out = [];
    for (const item of list) {
      if (!item || typeof item !== "object") continue;
      const id = typeof item.id === "string" ? item.id : "";
      const title = typeof item.title === "string" ? item.title.trim().slice(0, 24) : "";
      if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(id) || REMOVED_IDS.has(id) || seen.has(id) || !title) continue;
      seen.add(id);
      const def = DEFAULT_OPTIONS.find(o => o.id === id);
      out.push({
        id, title,
        emoji: typeof item.emoji === "string" && item.emoji.trim() ? Array.from(item.emoji.trim()).slice(0, 4).join("") : "✨",
        desc: typeof item.desc === "string" ? item.desc.slice(0, 80) : title,
        color: isColor(item.color) ? item.color : (def ? def.color : "#7c4dff"),
      });
    }
    return out.length ? out : DEFAULT_OPTIONS.map(o => ({ ...o }));
  }

  /** Items shown on the wheel: the money slice only when a prize pool exists. */
  function visible(options, poolRiel) {
    const list = options.filter(o => o.id !== "money" || poolRiel > 0);
    return list.length ? list : options.slice(0, 1);
  }

  /**
   * Final wheel angle (radians, clockwise rotation of the wheel) so that the middle of slice
   * `index` stops under the pointer at the top. Always spins forward at least `turns` turns.
   */
  function targetAngle(current, index, count, turns, jitter = 0) {
    const slice = (Math.PI * 2) / count;
    const want = -(index + 0.5) * slice + jitter * slice * 0.35; // slice centre at angle 0 (pointer)
    const full = Math.PI * 2;
    let target = want;
    while (target < current + turns * full) target += full;
    return target;
  }

  /** Which slice is under the pointer for a wheel rotation. */
  function indexAt(rotation, count) {
    const slice = (Math.PI * 2) / count;
    const a = ((-rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    return Math.floor(a / slice) % count;
  }

  /** Smooth stop: fast start, long gentle ending with a tiny settle. */
  function ease(t) {
    if (t >= 1) return 1;
    const base = 1 - Math.pow(1 - t, 4);
    return base + Math.sin(t * Math.PI) * 0.012 * (1 - t);
  }

  function pickLocal(ids, rand = Math.random) {
    return ids[Math.min(ids.length - 1, Math.floor(rand() * ids.length))];
  }

  return { DEFAULT_OPTIONS, REMOVED_IDS, MAX_OPTIONS, normalize, visible, targetAngle, indexAt, ease, pickLocal };
});
