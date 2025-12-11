const path = require('path');

module.exports = {
  // Output build into `build/` directory so Vercel can find routes-manifest.json
  distDir: 'build',

  turbopack: {
    // Ensure Turbopack's inferred root is the frontend folder
    root: path.resolve(__dirname)
  }
};
