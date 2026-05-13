import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import places from "../data/places";
import useTranslation from "../hooks/useTranslation";

const BASE = "https://report.masto84.workers.dev";

export default function PlacesSection({ kp }) {
  const [placeData, setPlaceData] = useState({});
  const [randomPlaces, setRandomPlaces] = useState([]);

  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
  const shuffled = [...places]
    .sort(() => 0.5 - Math.random())
    .slice(0, 3);

  setRandomPlaces(shuffled);
}, []);

useEffect(() => {
  if (randomPlaces.length === 0) return;

  const fetchPlaces = async () => {
    try {
      const results = await Promise.all(
        randomPlaces.map(async (place) => {
          try {
            const weatherRes = await fetch(
              `${BASE}/?lat=${place.lat}&lon=${place.lon}`
            );

            if (!weatherRes.ok) {
              throw new Error(`weather ${weatherRes.status}`);
            }

            const weather = await weatherRes.json();

            return {
              id: place.id,
              kp: kp ?? null,
              temp:
                weather.main?.temp != null
                  ? Math.round(weather.main.temp)
                  : null,
              clouds: weather.clouds?.all ?? null,
            };
          } catch (err) {
            console.warn(`[places] ${place.id} failed`, err);

            return {
              id: place.id,
              kp: kp ?? null,
              temp: null,
              clouds: null,
            };
          }
        })
      );

      const mapped = {};

      results.forEach((r) => {
        mapped[r.id] = r;
      });

      setPlaceData(mapped);
    } catch (e) {
      console.error(e);
    }
  };

  fetchPlaces();
}, [kp, randomPlaces]);

  return (
    <section className="container">
      <h2>{t("locations.title")}</h2>
      <p>{t("locations.sub")}</p>

      <div className="places-grid">
        {randomPlaces.map((place) => {
          const data = placeData[place.id];

          return (
            <div
              key={place.id}
              className="place-row"
              onClick={() =>
                navigate(`/map?lat=${place.lat}&lon=${place.lon}`)
              }
            >
              <div className="place-name">{place.name}</div>

              <div className="data-group">
                <div className="data-item">
                  <span className="label">KP</span>
                  <span className="value kp-val kp-mid">
                    {data?.kp ?? "--"}
                  </span>
                </div>

                <div className="data-item">
                  <span className="label">
                    {t("weather.clouds")}
                  </span>

                  <span className="value">
                    {data?.clouds != null
                      ? `${data.clouds}%`
                      : "--"}
                  </span>
                </div>

                <div className="data-item">
                  <span className="label">
                    {t("weather.temp")}
                  </span>

                  <span className="value">
                    {data?.temp != null
                      ? `${data.temp}°`
                      : "--"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}