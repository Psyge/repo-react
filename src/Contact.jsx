import { useEffect, useRef, useState } from "react";
import useTranslation from "./hooks/useTranslation";
import Header from "./components/Header";
import SEO from "./components/SEO";

import { Link } from "react-router-dom";

const BASE = "https://report.masto84.workers.dev";

export default function Contact() {
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef(null);
  const widgetId = useRef(null);

  // Lataa Turnstile-skripti
  useEffect(() => {
  // Tarkista onko skripti jo ladattu
  if (document.getElementById("cf-turnstile-script")) {
    // Skripti jo olemassa, vain renderöi widget
    return;
  }
  const script = document.createElement("script");
  script.id = "cf-turnstile-script";
  script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
  script.async = true;
  document.head.appendChild(script);
}, []);

  // Renderöi widget kun skripti latautunut
  useEffect(() => {
  const render = () => {
    if (!turnstileRef.current || !window.turnstile) return;
    if (widgetId.current != null) return;
    widgetId.current = window.turnstile.render(turnstileRef.current, {
      sitekey: "YOUR_SITE_KEY",
      callback: (token) => setTurnstileToken(token),
      "expired-callback": () => setTurnstileToken(""),
    });
  };
  const interval = setInterval(() => {
    if (window.turnstile) { render(); clearInterval(interval); }
  }, 200);

  return () => {
    clearInterval(interval);
    // Poista widget kun komponentti unmountataan
    if (widgetId.current != null && window.turnstile) {
      window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    }
  };
}, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!turnstileToken) {
      setStatus("captcha");
      return;
    }
    setStatus("sending");
    try {
      const res = await fetch(`${BASE}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, turnstileToken }),
      });
      if (res.ok) {
        setStatus("ok");
        setForm({ name: "", email: "", message: "" });
        // Reset captcha
        if (widgetId.current != null) window.turnstile.reset(widgetId.current);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  return (
  <div className="contact-page">
    <SEO
  title="Contact | RepoTracker"
  description="Contact RepoTracker for support, feedback and business inquiries."
  canonical="https://repotracker.fi/contact"
/>
    <Header />

    <div className="contact-wrap">
      <h2>{t("contact.title") || "Contact us"}</h2>

      <p>
        {t("contact.sub") ||
          "Have a question or feedback? We'll get back to you."}
      </p>

      {status === "ok" ? (
        <div className="contact-success">
          ✅ {t("contact.success") ||
            "Message sent! We'll be in touch soon."}
        </div>
      ) : (
        <form className="contact-form" onSubmit={handleSubmit}>
          <div className="contact-field">
            <label>{t("contact.name") || "Name"}</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  name: e.target.value,
                }))
              }
              required
              maxLength={100}
            />
          </div>

          <div className="contact-field">
            <label>{t("contact.email") || "Email"}</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  email: e.target.value,
                }))
              }
              required
              maxLength={200}
            />
          </div>

          <div className="contact-field">
            <label>{t("contact.message") || "Message"}</label>
            <textarea
              value={form.message}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  message: e.target.value,
                }))
              }
              required
              maxLength={2000}
              rows={5}
            />
          </div>

          <div
            ref={turnstileRef}
            style={{ margin: "12px 0" }}
          />

          {status === "captcha" && (
            <div className="contact-error">
              ⚠️ {t("contact.captcha") ||
                "Please complete the captcha first."}
            </div>
          )}

          {status === "error" && (
            <div className="contact-error">
              ❌ {t("contact.error") ||
                "Something went wrong, please try again."}
            </div>
          )}

          <button
            type="submit"
            className="contact-submit"
            disabled={
              status === "sending" ||
              !turnstileToken
            }
          >
            {status === "sending"
              ? t("contact.sending") ||
                "Sending..."
              : t("contact.send") ||
                "Send message"}
          </button>
        </form>
      )}

      <div className="contact-privacy">
        <p>
          {t("contact.privacy") ||
            "Information submitted through this form is used solely for responding to your inquiry and is not shared with third parties."}
        </p>

        <p>
          <Link to="/privacy">
            {t("contact.privacyLink") ||
              "Privacy Policy"}
          </Link>
          {" • "}
          <Link to="/terms">
            {t("contact.termsLink") ||
              "Terms of Service"}
          </Link>
        </p>
      </div>
    </div>

    <footer className="footer">
  <p>© RepoTracker</p>

  <Link to="/privacy">
    {t("footer.privacy")}
  </Link>

  {" - "}

  <Link to="/terms">
    {t("privacy.q.terms")}
  </Link>

  {" - "}

  <Link to="/contact">
    {t("footer.contact") || "Contact"}
  </Link>
</footer>
  </div>
);
}