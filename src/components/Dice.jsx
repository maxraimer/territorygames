import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const PIP_LAYOUT = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function Pips({ value }) {
  const active = new Set(PIP_LAYOUT[value] ?? []);
  return (
    <div className="grid h-full w-full grid-cols-3 grid-rows-3 gap-0.5 p-2.5">
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} className="flex items-center justify-center">
          {active.has(i) && <span className="block h-2 w-2 rounded-full bg-neutral sm:h-2.5 sm:w-2.5" />}
        </div>
      ))}
    </div>
  );
}

/**
 * A physical-looking die. While `rolling`, it cycles a random face on its
 * own clock (purely cosmetic) and shakes; when `rolling` turns false it
 * snaps to the real `value` with a landing bounce.
 */
export default function Dice({ value, rolling }) {
  const { t } = useTranslation();
  const [displayValue, setDisplayValue] = useState(value ?? 1);

  useEffect(() => {
    if (!rolling) {
      if (value != null) setDisplayValue(value);
      return;
    }
    const interval = setInterval(() => {
      setDisplayValue(1 + Math.floor(Math.random() * 6));
    }, 90);
    return () => clearInterval(interval);
  }, [rolling, value]);

  return (
    <div
      key={rolling ? "rolling" : `landed-${value}`}
      className={
        "h-14 w-14 rounded-xl border border-base-300 bg-white shadow-md sm:h-16 sm:w-16 " +
        (rolling ? "animate-dice-roll" : "animate-dice-land")
      }
      role="img"
      aria-label={t("common.diceAriaLabel", { value: displayValue })}
    >
      <Pips value={displayValue} />
    </div>
  );
}
