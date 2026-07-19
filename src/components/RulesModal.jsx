import { useTranslation } from "react-i18next";

export default function RulesModal({ gameType, dialogRef }) {
  const { t } = useTranslation();
  const toggles = t(`rules.${gameType}.toggles`, { returnObjects: true, defaultValue: [] });

  return (
    <dialog ref={dialogRef} className="modal">
      <div className="modal-box max-w-lg">
        <h3 className="text-lg font-bold">{t(`rules.${gameType}.title`)}</h3>

        <div className="mt-3 flex flex-col gap-3 text-sm">
          <p>{t(`rules.${gameType}.objective`)}</p>
          <p>{t(`rules.${gameType}.turn`)}</p>
          <p>{t(`rules.${gameType}.placement`)}</p>
          <p className="text-base-content/70">{t("rules.common.cornerSeeding")}</p>
          <p className="text-base-content/70">{t("rules.common.scoring")}</p>

          {toggles.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-base-300 pt-3">
              {toggles.map((toggle, i) => (
                <p key={i}>
                  <span className="font-semibold">{toggle.title}:</span> {toggle.body}
                </p>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2 border-t border-base-300 pt-3 text-base-content/70">
            <p>{t("rules.common.rotationToggle")}</p>
            <p>{t("rules.common.smartAssistToggle")}</p>
            <p>{t("rules.common.autoWinToggle")}</p>
            <p>{t("rules.common.eliminationNote")}</p>
          </div>
        </div>

        <div className="modal-action">
          <form method="dialog">
            <button className="btn btn-primary btn-sm">{t("common.close")}</button>
          </form>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  );
}
