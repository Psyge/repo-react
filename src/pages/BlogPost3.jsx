import Header from "../components/Header";
import useTranslation from "../hooks/useTranslation";

export default function BlogPost3() {
  const { t } = useTranslation();

  return (
    <div>
      <Header />

      <main className="container blog-post">
        <h1>{t("blog.post3.title")}</h1>

        <p>{t("blog.post3.excerpt")}</p>

        <h2>Best months</h2>
        <p>
          The Northern Lights season in Lapland runs from late August to early April.
          The best months are typically September–October and February–March.
        </p>

        <h2>Best hours</h2>
        <p>
          The most active time is usually between 9 PM and 2 AM,
          when geomagnetic activity peaks and the sky is darkest.
        </p>

        <h2>Weather matters</h2>
        <p>
          Even strong aurora activity is useless if the sky is cloudy.
          Always combine aurora forecast with cloud cover data.
        </p>

        <h2>Moon phase</h2>
        <p>
          A bright full moon can reduce visibility of faint auroras,
          but strong displays are still clearly visible.
        </p>
      </main>
    </div>
  );
}