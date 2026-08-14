// Vercel serverless entry point. Anything under /api is auto-detected as
// a serverless function; exporting the Express app directly lets Vercel
// route every request straight into it (Express handles its own internal
// routing for /api/auth, /api/investigations, etc. — see src/app.js).
module.exports = require('../src/app');
