import { useTranslation } from "react-i18next";
import { GRID_MAX } from "../game/constants";

export function Toggle({ label, hint, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-base-content/50">{hint}</span>}
      </span>
      <input
        type="checkbox"
        className="toggle toggle-primary mt-0.5 shrink-0"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

/**
 * Board-size sliders + rule toggles, shared by every mode's config screen
 * (hot-seat SetupScreen, BotSetupScreen, online CreateLobbyScreen) so the
 * ~80 lines of board/rule JSX exist exactly once.
 */
export default function GameConfigFields({
  gameType,
  cols,
  rows,
  onColsChange,
  onRowsChange,
  gridMin,
  playerCount,
  autoWin,
  onAutoWinChange,
  allowRotation,
  onAllowRotationChange,
  doublesExtraTurn,
  onDoublesExtraTurnChange,
  smartAssist,
  onSmartAssistChange,
  autoFillEnclosed,
  onAutoFillEnclosedChange,
}) {
  const { t } = useTranslation();
  const supportsAutoFillEnclosed = gameType === "tetromino" || gameType === "hex";

  return (
    <>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="flex justify-between text-sm font-medium">
            <span>{t("setup.boardWidth")}</span>
            <span className="font-mono">{cols}</span>
          </span>
          <input
            type="range"
            min={gridMin}
            max={GRID_MAX}
            value={cols}
            onChange={(e) => onColsChange(Number(e.target.value))}
            className="range range-primary range-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="flex justify-between text-sm font-medium">
            <span>{t("setup.boardHeight")}</span>
            <span className="font-mono">{rows}</span>
          </span>
          <input
            type="range"
            min={gridMin}
            max={GRID_MAX}
            value={rows}
            onChange={(e) => onRowsChange(Number(e.target.value))}
            className="range range-primary range-sm"
          />
        </label>
        <p className="text-xs text-base-content/50">{t("setup.boardMinHint", { count: playerCount, size: gridMin })}</p>
      </div>

      <div className="flex flex-col gap-3 border-t border-base-300 pt-4">
        <Toggle
          label={t("setup.toggles.autoWin.label")}
          hint={t("setup.toggles.autoWin.hint")}
          checked={autoWin}
          onChange={onAutoWinChange}
        />
        <Toggle
          label={t("setup.toggles.allowRotation.label")}
          hint={t(`setup.copy.${gameType}.rotationHint`)}
          checked={allowRotation}
          onChange={onAllowRotationChange}
        />
        {gameType === "dice" && onDoublesExtraTurnChange && (
          <Toggle
            label={t("setup.toggles.doublesExtraTurn.label")}
            hint={t("setup.toggles.doublesExtraTurn.hint")}
            checked={doublesExtraTurn}
            onChange={onDoublesExtraTurnChange}
          />
        )}
        <Toggle
          label={t(`setup.copy.${gameType}.smartLabel`)}
          hint={t(`setup.copy.${gameType}.smartHint`)}
          checked={smartAssist}
          onChange={onSmartAssistChange}
        />
        {supportsAutoFillEnclosed && (
          <Toggle
            label={t("setup.toggles.autoFillEnclosed.label")}
            hint={t(`setup.toggles.autoFillEnclosed.hint${gameType === "hex" ? "Hex" : "Tetromino"}`)}
            checked={autoFillEnclosed}
            onChange={onAutoFillEnclosedChange}
          />
        )}
      </div>
    </>
  );
}
