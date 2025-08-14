// Create a custom DevTools panel
chrome.devtools.panels.create(
  "Network Console",
  "",
  "panel.html",
  function (panel) {
    // Panel created
  }
);


