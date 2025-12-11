const path = require('path');

module.exports = {
  turbopack: {
    // Ensure Turbopack's inferred root is the frontend folder
    root: path.resolve(__dirname)
  }
};
