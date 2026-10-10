// Built-in names (default cameras, switches) shown in the current language.
// Names are stored in English; a name typed in either language is recognised.

const KNOWN = [
  { en: "Hands", uk: "Руки" },
  { en: "Face", uk: "Міміка" },
  { en: "All together", uk: "Все разом" },
  { en: "Mouth", uk: "Рот" },
  { en: "Hat", uk: "Капелюх" },
  { en: "drawing", uk: "малювання" },
  { en: "Motions", uk: "Рухи" },
  { en: "Scenes", uk: "Сцени" },
  { en: "👋 Hi!", uk: "👋 Привіт!" },
  { en: "✓ Yes", uk: "✓ Так" },
  { en: "✗ No", uk: "✗ Ні" },
];

const NUMBERED = /^(Camera|Камера)\s+(\d+)$/;

/** Display a stored name in `lang`. Unknown (user) names are returned unchanged. */
export function localizeName(name, lang) {
  if (!name) return name;
  const k = KNOWN.find((x) => x.en === name || x.uk === name);
  if (k) return k[lang] ?? k.en;
  const m = NUMBERED.exec(name);
  if (m) return `${lang === "uk" ? "Камера" : "Camera"} ${m[2]}`;
  return name;
}

/** Canonical (English) form, for matching names typed in any language. */
export const canonicalName = (name) => localizeName(name, "en");
