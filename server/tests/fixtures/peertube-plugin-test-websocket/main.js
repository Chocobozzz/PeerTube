const WebSocketServer = require('ws').WebSocketServer

async function register ({
  registerWebSocketRoute
}) {
  const wss = new WebSocketServer({ noServer: true })

  wss.on('connection', function connection(ws) {
    ws.on('message', function message(data) {
      if (data.toString() === 'ping') {
        ws.send('pong')
      }
    })
  })

  registerWebSocketRoute({
    route: '/toto',

    handler: (request, socket, head) => {
      wss.handleUpgrade(request, socket, head, ws => {
        wss.emit('connection', ws, request)
      })
    }
  })
}

async function unregister () {
  return
}

module.exports = {
  register,
  unregister
}

// ###########################################################################
