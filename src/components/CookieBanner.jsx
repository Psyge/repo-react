import { useEffect, useState } from "react";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie-consent");

    if (!consent) {
      setVisible(true);
    } else if (consent === "accepted") {
      enableAnalytics();
    }
  }, []);

  function enableAnalytics() {
    if (window.gtag) {
      window.gtag("consent", "update", {
        analytics_storage: "granted",
        ad_storage: "granted",
        ad_user_data: "granted",
        ad_personalization: "granted",
      });
    }
  }

  function acceptCookies() {
    localStorage.setItem("cookie-consent", "accepted");
    enableAnalytics();
    setVisible(false);
  }

  function declineCookies() {
    localStorage.setItem("cookie-consent", "declined");

    if (window.gtag) {
      window.gtag("consent", "update", {
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      });
    }

    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="cookie-banner">
      <h3>Cookies & Privacy</h3>

      <p>
        RepoTracker uses analytics cookies to improve the service and
        optional advertising cookies for personalized ads.
      </p>

      <div className="cookie-links">
        <a href="/privacy">Privacy Policy</a>
        <a href="/terms">Terms</a>
      </div>

      <div className="cookie-actions">
        <button
          className="cookie-btn cookie-btn-primary"
          onClick={acceptCookies}
        >
          Accept
        </button>

        <button
          className="cookie-btn cookie-btn-secondary"
          onClick={declineCookies}
        >
          Decline
        </button>
      </div>
    </div>
  );
}