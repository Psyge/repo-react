import { useParams, Link } from "react-router-dom";
import Header from "./components/Header";
import blogPosts from "./data/blogPosts";

export default function BlogPost() {
  const { slug } = useParams();

  const post = blogPosts[slug];

  if (!post) {
    return (
      <div>
        <Header />

        <main className="container">
          <h1>Article not found</h1>

          <Link to="/">
            Back home
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div>
      <Header />

      <main className="container article">
        <div className="article-back">
          <Link to="/">
            ← Back
          </Link>
        </div>

        <h1>{post.title}</h1>

        <p>{post.excerpt}</p>

        <div className="article-content">
          {post.content.split("\n").map((p, i) => {
            if (!p.trim()) return null;

            return (
              <p key={i}>
                {p}
              </p>
            );
          })}
        </div>
      </main>
    </div>
  );
}