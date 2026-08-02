module.exports = async (kernel) => {
  // Allocate the next available port so multiple apps never collide.
  // camofox-browser defaults to 9377, which we deliberately do not rely on.
  const PORT = await kernel.port()
  return {
    // daemon: true keeps the shell (and the server process) alive after the
    // run array finishes. Mandatory for launching servers.
    daemon: true,
    run: [
      {
        method: "shell.run",
        params: {
          path: "app",                // Edit this to customize the path to start the shell from
          env: {
            CAMOFOX_PORT: PORT,
            // Upstream defaults to an empty bind host, which makes Express
            // listen on 0.0.0.0. Pin it to loopback.
            CAMOFOX_BIND_HOST: "127.0.0.1",
            // Telemetry is ON upstream and posts to a third party endpoint.
            // Default it OFF here; set CAMOFOX_CRASH_REPORT_ENABLED=true in the
            // ENVIRONMENT file (Configure tab) to opt back in.
            CAMOFOX_CRASH_REPORT_ENABLED: "{{env.CAMOFOX_CRASH_REPORT_ENABLED === 'true' ? 'true' : 'false'}}"
          },                          // Edit this to customize environment variables (see documentation)
          message: [
            "npm start"
          ],
          on: [{
            // The server logs structured JSON only and never prints a URL, so
            // we capture the port out of its "server started" line:
            // {"ts":"...","level":"info","msg":"server started","port":9377,...}
            // A failed browser pre-warm is retried in the background and must
            // not trip Pinokio's default /Error:/ break.
            "event": "/browser pre-warm failed/",
            "break": false
          }, {
            // The regular expression pattern to monitor.
            // The regular expression match object is passed to the next step
            // as `input.event`, so input.event[1] is the captured port.
            "event": "/server started.*?\"port\":(\\d+)/",

            // "done": true will move to the next step while keeping the shell alive.
            // "kill": true will move to the next step after killing the shell.
            "done": true
          }]
        }
      },
      {
        // This step sets the local variable 'url'.
        // This local variable will be used in pinokio.js to display the
        // "Open Web UI" tab when the value is set.
        method: "local.set",
        params: {
          // input.event is the regular expression match object from the
          // previous step; input.event[1] is the captured port number.
          // GET / returns a JSON status blob, so the human facing UI is /docs.
          // The trailing slash avoids express.static's 301 redirect hop.
          url: "http://127.0.0.1:{{input.event[1]}}/docs/"
        }
      }
    ]
  }
}
