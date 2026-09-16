// CRA 5's bundled ESLint stack is not compatible with the current Jest
// plugin versions resolved by this project. Keep the production build
// deterministic; the focused source checks run through test:prerender.
process.env.DISABLE_ESLINT_PLUGIN = "true";
require("react-scripts/scripts/build");
