module.exports = {
  proxy: "http://localhost:3000",
  files: [
    "**/*.css",
    "**/*.js",
    "**/*.html",
    "**/*.php"
  ],
  open: true,
  notify: false
};
