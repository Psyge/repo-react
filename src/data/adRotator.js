/* ========================================================================
   adRotator — mainosten/kumppanibannerien rotaatiolista.

   Jokainen alkio: { html, lang }
     html: valmis HTML-merkkijono (affiliate-koodi tai oma banneri)
     lang: "fi" | "en" | "all"
       "all" = näytetään kielestä riippumatta (esim. affiliate-banneri
               jossa ei ole omaa tekstiä, pelkkä mainostajan kuva/logo)
       "fi"  = näytetään VAIN kun sivun kieli on suomi
       "en"  = näytetään VAIN kun sivun kieli on englanti

   AdRotator-komponentti suodattaa listan aktiivisen kielen mukaan ennen
   rotaatiota — lisää/poista rivejä täältä, ei tarvitse koskea komponenttiin.
======================================================================= */

const adRotator = [
  // --- Affiliate-mainokset (TradeTracker ym.) — kopioitu sellaisenaan
  //     vanhasta versiosta. Kuvat ovat mainostajan omia, emme hallitse
  //     niiden kieltä — merkitty "all", ellet tiedä että jokin näistä
  //     on selkeästi kielikohtainen (vaihda silloin "fi"/"en"). ---
  {
    html: '<a href="https://tc.tradetracker.net/?c=2883&m=1421995&a=504001&r=&u=" target="_blank" rel="sponsored nofollow"><img src="https://ti.tradetracker.net/?c=2883&m=1421995&a=504001&r=&t=html" width="728" height="90" border="0" alt="" /></a>',
    lang: "all",
  },
  {
    html: '<a href="https://www.anrdoezrs.net/click-101584868-15877142" target="_top" rel="sponsored nofollow"><img src="https://www.tqlkg.com/image-101584868-15877142" alt="Advertisement" /></a>',
    lang: "all",
  },
  {
    html: '<a href="https://tc.tradetracker.net/?c=20048&m=1591382&a=504001&r=&u=" target="_blank" rel="sponsored nofollow"><img src="https://ti.tradetracker.net/?c=20048&m=1591382&a=504001&r=&t=html" width="728" height="90" border="0" alt="" /></a>',
    lang: "all",
  },

  // --- Kaverin oma iOS-appi — bannerissa suomenkielinen teksti
  //     ("Lopeta arvailu"), joten näytetään vain suomenkielisillä.
  //     Jos saat kaverilta myös englanninkielisen kuvaversion, lisää se
  //     omana rivinään lang: "en" -merkinnällä. ---
  {
    html: '<a href="https://apps.apple.com/fi/app/rahora-budget/id6763693217" target="_blank" rel="noopener noreferrer"><img src="/images/rahora.png" width="728" height="90" alt="Lopeta arvailu — budjetointiappi" /></a>',
    lang: "fi",
  },
   {
    html: '<a href="https://apps.apple.com/fi/app/rahora-budget/id6763693217" target="_blank" rel="noopener noreferrer"><img src="/images/rahoraen.png" width="728" height="90" alt="Stop Guessing — Budgeting App" /></a>',
    lang: "en",
  },
];

export default adRotator;