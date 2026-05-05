import { Link } from "react-router-dom";
import { setLang } from "../utils/i18n";
export default function Header() {
  return (
    <header className="header">
      <div className="header-inner">
        <div className="brand">RepoTracker</div>

        <nav>
          <Link to="/">Home</Link>
          <Link to="/map">Map</Link>
          <Link to="/blog">Articles</Link>
          <Link to="/faq">FAQ</Link>
        </nav>

        <div className="lang-switcher">
          <button onClick={() => setLang("en")}>EN</button>
<button onClick={() => setLang("fi")}>FI</button>
        </div>
      </div>
    </header>
  );
}