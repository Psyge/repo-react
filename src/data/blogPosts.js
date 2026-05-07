import { useParams, Link } from "react-router-dom";

const posts = {
  photography: {
    title: "How to Photograph Aurora",
    content: `
Use tripod and long exposure.
ISO 800–3200 works best.
Avoid city lights.
`,
  },

  forecast: {
    title: "How Aurora Forecast Works",
    content: `
KP index measures geomagnetic activity.
Negative Bz improves aurora visibility.
Solar wind speed matters.
`,
  },

  timing: {
    title: "Best Time To See Aurora",
    content: `
Best viewing hours are usually 22:00–02:00.
Dark sky and clear weather are important.
`,
  },
};

export default function BlogPost() {
  const { slug } = useParams();

  const post = posts[slug];

  if (!post) {
    return (
      <div className="container">
        <h1>Article not found</h1>
        <Link to="/">Back</Link>
      </div>
    );
  }

  return (
    <div className="container blog-post-page">
      <Link to="/">← Back</Link>

      <h1>{post.title}</h1>

      <div className="blog-content">
        {post.content}
      </div>
    </div>
  );
}