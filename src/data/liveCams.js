/* ========================================================================
   liveCams — VALINNAINEN kuratoitu lista YouTube-livestriimejä.

   Tämä lista saa olla tyhjä. Jos tässä ei ole yhtään active:true -kameraa,
   LiveCamSpotlight näyttää FMI:n all-sky-kameran (ks. data/fmiCams.js),
   joka ei vaadi ylläpitoa lainkaan.

   Lisää rivi tänne vain jos löydät striimin joka on selvästi parempi kuin
   all-sky-kuva. Muista käydä poistamassa tai merkitsemässä active:false kun
   striimi loppuu — kuollut videoId näkyy käyttäjälle mustana laatikkona,
   kun taas FMI-kamera olisi toiminut.

   videoId = YouTuben osoitteen "v="-parametrin arvo.
======================================================================= */

const liveCams = [
  // { id: "rovaniemi-1", name: "Rovaniemi Sky Cam", videoId: "XXXXXXXXXXX", active: true },
];

export default liveCams;