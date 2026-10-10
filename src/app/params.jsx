// Editors for node parameters, generated from the node definition's schema.
import { useI18n } from "./i18n.jsx";
import { useVars } from "./core.js";

export function ParamField({ param, value, onChange, obsScenes = [], idPrefix = "" }) {
  const { L, t } = useI18n();
  const vars = useVars();
  const id = `p-${idPrefix}-${param.key}`;
  let input;

  switch (param.type) {
    case "select":
      input = (
        <select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
          {param.options.map((o) => (
            <option key={o.value} value={o.value}>
              {L(o.label)}
            </option>
          ))}
        </select>
      );
      break;
    case "number":
      input = (
        <div className="num-field">
          <input
            type="range"
            min={param.min}
            max={param.max}
            step={param.step}
            value={value ?? param.default}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          <input
            id={id}
            type="number"
            min={param.min}
            max={param.max}
            step={param.step}
            value={value ?? param.default}
            onChange={(e) => e.target.value !== "" && onChange(Number(e.target.value))}
          />
        </div>
      );
      break;
    case "bool":
      input = <input id={id} type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />;
      break;
    case "hue": {
      const auto = value == null;
      input = (
        <div className="hue-field">
          <label className="inline">
            <input type="checkbox" checked={auto} onChange={(e) => onChange(e.target.checked ? null : 200)} /> {t("auto")}
          </label>
          {!auto && (
            <>
              <input type="range" min={0} max={360} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} className="hue-slider" />
              <span className="swatch" style={{ background: `hsl(${value} 100% 60%)` }} />
            </>
          )}
        </div>
      );
      break;
    }
    case "var":
      input = (
        <>
          <input id={id} list="var-names" value={value ?? ""} onChange={(e) => onChange(e.target.value.trim())} />
          <datalist id="var-names">
            {Object.keys(vars).map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </>
      );
      break;
    case "obsScene":
      input = (
        <>
          <input id={id} list="obs-scenes" value={value ?? ""} placeholder="—" onChange={(e) => onChange(e.target.value)} />
          <datalist id="obs-scenes">
            {obsScenes.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </>
      );
      break;
    default:
      input = <input id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
  }

  return (
    <div className="param">
      <label htmlFor={id}>{L(param.label)}</label>
      {input}
    </div>
  );
}

/** Short human summary of a node's params for the node body. */
export function paramSummary(def, params, L, N = (x) => x) {
  return (def.params ?? [])
    .filter((p) => ["select", "var", "text"].includes(p.type) && p.key !== "name" || (def.category === "state" && p.key === "name"))
    .slice(0, 2)
    .map((p) => {
      const v = params?.[p.key] ?? p.default;
      if (p.type === "select") return L(p.options.find((o) => o.value === v)?.label);
      return N(String(v ?? ""));
    })
    .filter(Boolean)
    .join(" · ");
}
