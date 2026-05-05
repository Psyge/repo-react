import { useState, useRef } from "react";

export default function useSearch() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const requestIdRef = useRef(0);

  const search = async (query) => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    const requestId = ++requestIdRef.current;

    setLoading(true);

    try {
      const params = new URLSearchParams({
        q: query,
        format: "json",
        limit: "5",
        addressdetails: "1",
      });

      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?${params}`
      );

      const data = await res.json();

      // 🔥 ignore old responses
      if (requestId !== requestIdRef.current) return;

      setResults(
        data.map((d) => ({
          name: d.display_name,
          lat: parseFloat(d.lat),
          lon: parseFloat(d.lon),
        }))
      );
    } catch (e) {
      console.error(e);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  };

  return {
    results,
    search,
    loading,
    setResults,
  };
}