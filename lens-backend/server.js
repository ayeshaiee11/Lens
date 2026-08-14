// Local development entry point only. On Vercel, api/index.js exports
// the same Express app directly as a serverless function — this file
// (and app.listen) is never used in production.
const app = require('./src/app');

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`LENS backend listening on http://localhost:${PORT}`);
});
