module.exports = {
  run: [{
    // Removes the cloned repository and its node_modules.
    // The Camoufox browser binary lives in a shared OS cache outside this
    // folder and is intentionally left in place (see README.md).
    method: "fs.rm",
    params: {
      path: "app"
    }
  }]
}
