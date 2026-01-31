module.exports = {
  proxy: "http://localhost:3000",
  files: [
    "**/*.css",
    "**/*.js",
    "**/*.html"
  ],
  open: true,
  notify: false
};
