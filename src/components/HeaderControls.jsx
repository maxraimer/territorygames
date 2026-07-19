import { useTranslation } from "react-i18next";
import { FiSun, FiMoon } from "react-icons/fi";
import { GB, UA, RU, ES, FR, PL, DE } from "country-flag-icons/react/3x2";
import useTheme, { LIGHT_THEME } from "../hooks/useTheme";
import { SUPPORTED_LANGUAGES, changeLanguage } from "../i18n";

const FLAGS = { en: GB, uk: UA, ru: RU, es: ES, fr: FR, pl: PL, de: DE };

export default function HeaderControls() {
  const { t, i18n } = useTranslation();
  const [theme, toggleTheme] = useTheme();
  const CurrentFlag = FLAGS[i18n.language] ?? FLAGS.uk;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="btn btn-ghost btn-sm btn-square"
        onClick={toggleTheme}
        title={theme === LIGHT_THEME ? t("common.themeDark") : t("common.themeLight")}
        aria-label={theme === LIGHT_THEME ? t("common.themeDark") : t("common.themeLight")}
      >
        {theme === LIGHT_THEME ? <FiMoon className="h-4 w-4" /> : <FiSun className="h-4 w-4" />}
      </button>

      <div className="dropdown dropdown-end">
        <button
          type="button"
          tabIndex={0}
          className="btn btn-ghost btn-sm gap-1.5"
          title={t("common.language")}
          aria-label={t("common.language")}
        >
          <CurrentFlag className="h-3.5 w-5 rounded-sm" />
        </button>
        <ul className="dropdown-content menu z-10 mt-1 w-44 rounded-box bg-base-100 p-1 shadow-lg">
          {SUPPORTED_LANGUAGES.map((lng) => {
            const Flag = FLAGS[lng];
            return (
              <li key={lng}>
                <button
                  type="button"
                  className={lng === i18n.language ? "active" : ""}
                  onClick={() => {
                    changeLanguage(lng);
                    document.activeElement?.blur();
                  }}
                >
                  <Flag className="h-3.5 w-5 shrink-0 rounded-sm" />
                  {t(`common.languages.${lng}`)}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
