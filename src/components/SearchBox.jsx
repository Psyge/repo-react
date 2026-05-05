import { useState, useRef, useEffect } from "react";
import useSearch from "../hooks/useSearch";
import useTranslation from "../hooks/useTranslation";

export default function SearchBox({ onSelect }) {
  const [query, setQuery] = useState("");
  const { results, search, loading, setResults } = useSearch();
  const { t } = useTranslation();

  const debounceRef = useRef(null);
  const boxRef = useRef(null);

  // 🔥 debounce input
  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      if (val.trim().length > 1) {
        search(val);
      } else {
        setResults([]);
      }
    }, 300);
  };

  // 🔥 klikkaus ulkopuolelle → sulje lista
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) {
        setResults([]);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [setResults]);

  // 🔥 cleanup debounce
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div className="search-box" ref={boxRef}>
      <input
        type="text"
        placeholder={t("search.placeholder")}
        value={query}
        onChange={handleChange}
      />

      {loading && (
        <div className="search-loading">
          {t("loading")}
        </div>
      )}

      {results.length > 0 && (
        <ul className="search-results">
          {results.map((r, i) => (
            <li
              key={i}
              onClick={() => {
                onSelect(r);
                setQuery(r.name);
                setResults([]);
              }}
            >
              {r.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}