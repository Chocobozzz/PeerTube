import { ChildProcess, exec, fork } from 'child_process'
import { join } from 'path'

interface ServerInfo {
  app: ChildProcess,
  url: string
  host: string
  serverNumber: number

  client: {
    id: string,
    secret: string
  }

  user: {
    username: string,
    password: string,
    email?: string
  }

  accessToken?: string

  video?: {
    id: number
    uuid: string
    name: string
    account: {
      name: string
    }
  }

  remoteVideo?: {
    id: number
    uuid: string
  }
}

function flushAndRunMultipleServers (totalServers) {
  let apps = []
  let i = 0

  return new Promise<ServerInfo[]>(res => {
    function anotherServerDone (serverNumber, app) {
      apps[serverNumber - 1] = app
      i++
      if (i === totalServers) {
        return res(apps)
      }
    }

    flushTests()
      .then(() => {
        for (let j = 1; j <= totalServers; j++) {
          // For the virtual buffer
          setTimeout(() => {
            runServer(j).then(app => anotherServerDone(j, app))
          }, 1000 * (j - 1))
        }
      })
  })
}

function flushTests () {
  return new Promise<void>((res, rej) => {
    return exec('npm run clean:server:test', err => {
      if (err) return rej(err)

      return res()
    })
  })
}

function runServer (serverNumber: number, configOverride?: Object) {
  const server: ServerInfo = {
    app: null,
    serverNumber: serverNumber,
    url: `http://localhost:${9000 + serverNumber}`,
    host: `localhost:${9000 + serverNumber}`,
    client: {
      id: null,
      secret: null
    },
    user: {
      username: null,
      password: null
    }
  }

  // These actions are async so we need to be sure that they have both been done
  const serverRunString = {
    'Server listening': false
  }
  const key = 'Database peertube_test' + serverNumber + ' is ready'
  serverRunString[key] = false

  const regexps = {
    client_id: 'Client id: (.+)',
    client_secret: 'Client secret: (.+)',
    user_username: 'Username: (.+)',
    user_password: 'User password: (.+)'
  }

  // Share the environment
  const env = Object.create(process.env)
  env['NODE_ENV'] = 'test'
  env['NODE_APP_INSTANCE'] = serverNumber.toString()

  if (configOverride !== undefined) {
    env['NODE_CONFIG'] = JSON.stringify(configOverride)
  }

  const options = {
    silent: true,
    env: env,
    detached: true
  }

  return new Promise<ServerInfo>(res => {
    server.app = fork(join(__dirname, '..', '..', '..', '..', 'dist', 'server.js'), [], options)
    server.app.stdout.on('data', function onStdout (data) {
      let dontContinue = false

      // Capture things if we want to
      for (const key of Object.keys(regexps)) {
        const regexp = regexps[key]
        const matches = data.toString().match(regexp)
        if (matches !== null) {
          if (key === 'client_id') server.client.id = matches[1]
          else if (key === 'client_secret') server.client.secret = matches[1]
          else if (key === 'user_username') server.user.username = matches[1]
          else if (key === 'user_password') server.user.password = matches[1]
        }
      }

      // Check if all required sentences are here
      for (const key of Object.keys(serverRunString)) {
        if (data.toString().indexOf(key) !== -1) serverRunString[key] = true
        if (serverRunString[key] === false) dontContinue = true
      }

      // If no, there is maybe one thing not already initialized (client/user credentials generation...)
      if (dontContinue === true) return

      server.app.stdout.removeListener('data', onStdout)
      res(server)
    })
  })
}

async function reRunServer (server: ServerInfo) {
  const newServer = await runServer(server.serverNumber)
  server.app = newServer.app

  return server
}

function killallServers (servers: ServerInfo[]) {
  for (const server of servers) {
    process.kill(-server.app.pid)
  }
}

// ---------------------------------------------------------------------------

export {
  ServerInfo,
  flushAndRunMultipleServers,
  flushTests,
  runServer,
  killallServers,
  reRunServer
}
