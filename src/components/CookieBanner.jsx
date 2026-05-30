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
    <div
      style={{
        position: "fixed",
        bottom: 20,
        left: 20,
        right: 20,
        maxWidth: 520,
        margin: "0 auto",
        background: "#111",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 14,
        padding: 20,
        zIndex: 99999,
        color: "white",
        boxShadow: "0 10px 40px rgba(0,0,0,0.4)",
      }}
    >
      <h3 style={{ marginTop: 0 }}>
        Cookies & Privacy
      </h3>

      <p
        style={{
          opacity: 0.85,
          lineHeight: 1.5,
        }}
      >
        RepoTracker uses analytics cookies to improve the
        service and optional advertising cookies for
        personalized ads.
      </p>

      <div
  style={{
    marginTop: 12,
    display: "flex",
    gap: 12,
  }}
>
  <a href="/privacy">Privacy Policy</a>
  <a href="/terms">Terms</a>
</div>
        <button
          onClick={acceptCookies}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Accept
        </button>

        <button
          onClick={declineCookies}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "transparent",
            color: "white",
            cursor: "pointer",
          }}
        >
          Decline
        </button>
      </div>
    
  );
}