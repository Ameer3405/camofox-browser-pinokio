module.exports = {
  run: [{
    // Update the launcher scripts
    method: "shell.run",
    params: {
      message: "git pull"
    }
  }, {
    // Update the app
    method: "shell.run",
    params: {
      path: "app",
      message: "git pull"
    }
  }, {
    // Re-install dependencies in case they changed
    method: "shell.run",
    params: {
      path: "app",
      env: {
        NODE_ENV: "production"
      },
      message: "npm install --no-audit --no-fund --omit=dev"
    }
  }]
}
