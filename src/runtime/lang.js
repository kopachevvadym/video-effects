// Language shared by the canvas effects (texts drawn into the video).
// The React UI switches it via setRuntimeLang().

export const runtimeLang = { current: "uk" };

const TEXTS = {
  boop: { uk: "БІП!", en: "BOOP!" },
  sorrow: { uk: "жаль…", en: "sigh…" },
  surprise: { uk: "!!", en: "!!" },
};

export const setRuntimeLang = (lang) => {
  runtimeLang.current = lang;
};

export const tr = (key) => TEXTS[key]?.[runtimeLang.current] ?? TEXTS[key]?.en ?? key;
