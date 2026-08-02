module.exports = {
  run: [
    // Clone the camofox-browser repository into the 'app' folder.
    // We clone from git (instead of installing the npm package) because the
    // interactive API docs UI lives in `docs/`, which is not published in the
    // npm tarball's `files` list.
    {
      method: "shell.run",
      params: {
        message: [
          "git clone https://github.com/jo-inc/camofox-browser app",
        ]
      }
    },
    // Install dependencies.
    // The upstream `postinstall` script runs here and downloads the Camoufox
    // browser binary (~300MB) into the OS cache folder.
    {
      method: "shell.run",
      params: {
        path: "app",                // Edit this to customize the path to start the shell from
        env: {
          NODE_ENV: "production"
        },                          // Edit this to customize environment variables (see documentation)
        message: [
          "npm install --no-audit --no-fund --omit=dev"
        ]
      }
    },
    // Safety net: the upstream postinstall always exits 0, even when the
    // browser binary download fails. This step surfaces such a failure loudly.
    // It is a no-op when the binary is already cached.
    {
      method: "shell.run",
      params: {
        path: "app",
        message: [
          "npx camoufox-js fetch"
        ]
      }
    },
    {
      method: "notify",
      params: {
        html: "Click the 'Start' tab to launch camofox-browser!"
      }
    }
  ]
}
