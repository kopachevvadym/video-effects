import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { setRuntimeLang } from "../runtime/lang.js";
import { localizeName } from "../graph/names.js";

const DICT = {
  uk: {
    appTitle: "Gesture Flow",
    palette: "Вузли",
    search: "Пошук…",
    inspector: "Налаштування вузла",
    noSelection: "Вибери вузол, щоб налаштувати його",
    hold: "Утримувати, кадрів",
    grace: "Допуск втрат, кадрів",
    holdHint: "~30 кадрів = 1 секунда",
    delete: "Видалити",
    duplicate: "Дублювати",
    test: "Тест",
    settings: "Налаштування",
    swapHands: "Поміняти ліву й праву руку",
    smoothing: "Згладжування рук",
    showPoints: "Показати точки рук і обличчя",
    showGaze: "Приціл погляду",
    calibrate: "Калібрувати (нейтральне обличчя, погляд у центр)",
    states: "Стани",
    addState: "+ стан",
    obs: "OBS",
    program: "Вікно для OBS",
    exportJson: "Експорт",
    importJson: "Імпорт",
    reset: "Скинути",
    resetConfirm: "Повернути стандартний граф? Поточні зміни зникнуть.",
    fitView: "Показати все",
    onAir: "В ЕФІРІ",
    makeActive: "Зробити активною",
    fullscreen: "На весь екран",
    record: "Запис",
    stop: "Стоп",
    hotkey: "Клавіша",
    auto: "авто",
    // status
    st_starting: "Запуск…",
    st_camera: "Запит доступу до камери…",
    st_cameraError: "Камера недоступна",
    st_models: "Завантаження моделей рук і обличчя…",
    st_ready: "Готово",
    st_noFace: "Руки готові, модель обличчя не завантажилась",
    st_modelError: "Не вдалося завантажити моделі (потрібен інтернет)",
    // obs
    obsTitle: "OBS: віртуальна камера",
    obsHost: "Адреса",
    obsPort: "Порт",
    obsPassword: "Пароль",
    obsConnect: "Підключити",
    obsDisconnect: "Відключити",
    obs_disconnected: "не підключено",
    obs_connecting: "підключення…",
    obs_connected: "підключено",
    obs_error: "помилка",
    obsAuthError: "неправильний пароль",
    obsUnreachable: "OBS не відповідає — увімкни WebSocket-сервер в OBS",
    obsStartVcam: "Увімкнути віртуальну камеру",
    obsStopVcam: "Вимкнути віртуальну камеру",
    obsVcamOn: "Віртуальна камера працює",
    obsBrowserUrl: "Джерело «Браузер» для OBS (рекомендовано):",
    copy: "Копіювати",
    obsFeedOn: "OBS отримує відео",
    obsFeedOff: "OBS ще не підключений до цієї адреси",
    obsSteps:
      "Найпростіше: в OBS додай джерело «Браузер» з адресою вище, 1280×720 — і все.\n\nКерування OBS (необов'язково):\n1. В OBS: Інструменти → Налаштування WebSocket-сервера → увімкнути, скопіювати пароль.\n2. Тут: «Вікно для OBS» — відкриється чисте вікно активної камери.\n3. В OBS: додай джерело «Захоплення вікна» → «Gesture Effects — Program».\n4. Натисни «Увімкнути віртуальну камеру» і вибери «OBS Virtual Camera» у Zoom / Meet / Telegram.\n5. Щоб перемикання камер (Alt+1…9) перемикало й сцени OBS, вкажи сцену у вузлі камери.",
    dropHint: "Перетягни вузол із панелі ліворуч",
    webmcpHint: "ШІ-агенти в браузері можуть читати й змінювати граф через WebMCP",
    lightTheme: "Світла тема",
    claudeBridge: "Дозволити керування з Claude (MCP)",
    exitFullscreen: "Вийти з повного екрана",
    preview: "Перегляд камери",
    previewHint: "Клацни на камеру, щоб бачити її тут",
    camera: "Камера",
    switchOn: "УВІМК",
    switchOff: "ВИМК",
    menu: "Меню",
    standby: "Ця вкладка не транслює в OBS — транслювати звідси",
    standbyHint: "Відкрито кілька вкладок редактора; в OBS іде відео з іншої. Натисни, щоб транслювати з цієї.",
    activeCamera: "Активна камера (в ефірі)",
    add: "Додати",
    importError: "Не вдалося імпортувати файл",
    claudeHint: "Claude підключений через MCP-сервер і може змінювати граф",
    darkTheme: "Темна тема",
    edgeHint: "Сірі зв'язки — сигнали жестів, червоні — відео в камеру",
  },
  en: {
    appTitle: "Gesture Flow",
    palette: "Nodes",
    search: "Search…",
    inspector: "Node settings",
    noSelection: "Select a node to configure it",
    hold: "Hold, frames",
    grace: "Dropout tolerance, frames",
    holdHint: "~30 frames = 1 second",
    delete: "Delete",
    duplicate: "Duplicate",
    test: "Test",
    settings: "Settings",
    swapHands: "Swap left and right hand",
    smoothing: "Hand smoothing",
    showPoints: "Show hand and face points",
    showGaze: "Gaze crosshair",
    calibrate: "Calibrate (neutral face, look at center)",
    states: "States",
    addState: "+ state",
    obs: "OBS",
    program: "Window for OBS",
    exportJson: "Export",
    importJson: "Import",
    reset: "Reset",
    resetConfirm: "Restore the default graph? Current changes will be lost.",
    fitView: "Fit view",
    onAir: "ON AIR",
    makeActive: "Make active",
    fullscreen: "Fullscreen",
    record: "Record",
    stop: "Stop",
    hotkey: "Hotkey",
    auto: "auto",
    st_starting: "Starting…",
    st_camera: "Requesting camera access…",
    st_cameraError: "Camera unavailable",
    st_models: "Loading hand and face models…",
    st_ready: "Ready",
    st_noFace: "Hands ready, face model failed to load",
    st_modelError: "Could not load models (internet required)",
    obsTitle: "OBS: virtual camera",
    obsHost: "Host",
    obsPort: "Port",
    obsPassword: "Password",
    obsConnect: "Connect",
    obsDisconnect: "Disconnect",
    obs_disconnected: "not connected",
    obs_connecting: "connecting…",
    obs_connected: "connected",
    obs_error: "error",
    obsAuthError: "wrong password",
    obsUnreachable: "OBS is not responding — enable the WebSocket server in OBS",
    obsStartVcam: "Start virtual camera",
    obsStopVcam: "Stop virtual camera",
    obsVcamOn: "Virtual camera is running",
    obsBrowserUrl: "Browser Source for OBS (recommended):",
    copy: "Copy",
    obsFeedOn: "OBS is receiving video",
    obsFeedOff: "OBS is not connected to this address yet",
    obsSteps:
      "Simplest: in OBS add a “Browser” source with the address above, 1280×720 — done.\n\nControlling OBS (optional):\n1. In OBS: Tools → WebSocket Server Settings → enable, copy the password.\n2. Here: “Window for OBS” opens a clean window with the active camera.\n3. In OBS: add a “Window Capture” source → “Gesture Effects — Program”.\n4. Click “Start virtual camera” and pick “OBS Virtual Camera” in Zoom / Meet / Telegram.\n5. To make camera switching (Alt+1…9) switch OBS scenes too, set the scene in the camera node.",
    dropHint: "Drag a node from the left panel",
    webmcpHint: "AI agents in the browser can read and edit the graph via WebMCP",
    lightTheme: "Light theme",
    claudeBridge: "Allow control from Claude (MCP)",
    exitFullscreen: "Exit fullscreen",
    preview: "Camera preview",
    previewHint: "Click a camera to preview it here",
    camera: "Camera",
    switchOn: "ON",
    switchOff: "OFF",
    menu: "Menu",
    standby: "This tab is not streaming to OBS — stream from here",
    standbyHint: "Several editor tabs are open; OBS gets video from another one. Click to stream from this tab.",
    activeCamera: "Active camera (on air)",
    add: "Add",
    importError: "Could not import the file",
    claudeHint: "Claude is connected through the MCP server and can edit the graph",
    darkTheme: "Dark theme",
    edgeHint: "Grey links are gesture signals, red links are video into a camera",
  },
};

const LangContext = createContext(null);

// English is the primary language; Ukrainian is chosen with the flag button.
const LANG_KEY = "gesture-flow-lang-v2";
const initialLang = () => {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "uk" || saved === "en") return saved;
  } catch {}
  return "en";
};

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(initialLang);
  useEffect(() => {
    setRuntimeLang(lang);
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {}
  }, [lang]);
  const value = useMemo(
    () => ({
      lang,
      setLang,
      t: (key) => DICT[lang][key] ?? DICT.en[key] ?? key,
      /** Picks the current language from { uk, en } (strings pass through). */
      L: (v) => (v == null ? "" : typeof v === "string" ? v : v[lang] ?? v.en ?? ""),
      /** Built-in names (default cameras / switches) in the current language. */
      N: (name) => localizeName(name, lang),
    }),
    [lang],
  );
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export const useI18n = () => useContext(LangContext);

/** Flag button: shows the current language, click switches to the other one. */
export function LangFlag() {
  const { lang, setLang } = useI18n();
  const next = lang === "uk" ? "en" : "uk";
  return (
    <button
      className="flag-btn"
      title={lang === "uk" ? "Switch to English" : "Перемкнути на українську"}
      aria-label={lang === "uk" ? "Switch to English" : "Перемкнути на українську"}
      onClick={() => setLang(next)}
    >
      {lang === "uk" ? <FlagUA /> : <FlagGB />}
    </button>
  );
}

const FlagUA = () => (
  <svg viewBox="0 0 30 20" width="26" height="17" aria-hidden="true">
    <rect width="30" height="10" fill="#0057B7" />
    <rect y="10" width="30" height="10" fill="#FFD700" />
  </svg>
);

const FlagGB = () => (
  <svg viewBox="0 0 60 30" width="26" height="17" aria-hidden="true">
    <clipPath id="gb-c">
      <path d="M0,0 v30 h60 v-30 z" />
    </clipPath>
    <clipPath id="gb-t">
      <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
    </clipPath>
    <g clipPath="url(#gb-c)">
      <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#gb-t)" stroke="#C8102E" strokeWidth="4" />
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
    </g>
  </svg>
);
