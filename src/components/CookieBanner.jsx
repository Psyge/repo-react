import { useEffect, useState } from "react";
import useTranslation from "../hooks/useTranslation";
import {
  getConsent,
  setConsent,
  applyStoredConsent,
  onCookieSettingsOpen,
} from "../utils/consent";

export default function CookieBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!getConsent()) setVisible(true);
    else applyStoredConsent();

    // Footerin "Evästeasetukset" avaa bannerin uudelleen
    return onCookieSettingsOpen(() => setVisible(true));
  }, []);

  function acceptCookies() {
    setConsent("accepted");
    setVisible(false);
  }

  function declineCookies() {
    setConsent("declined");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-labelledby="cookie-banner-title">
      <h3 id="cookie-banner-title">{t("cookie.title")}</h3>

      <p>{t("cookie.text")}</p>

      <div className="cookie-links">
        <a href="/privacy">{t("footer.privacy")}</a>
        <a href="/terms">{t("footer.terms")}</a>
      </div>

      <div className="cookie-actions">
        <button
          className="cookie-btn cookie-btn-primary"
          onClick={acceptCookies}
        >
          {t("cookie.accept")}
        </button>

        <button
          className="cookie-btn cookie-btn-secondary"
          onClick={declineCookies}
        >
          {t("cookie.decline")}
        </button>
      </div>
    </div>
  );
}
