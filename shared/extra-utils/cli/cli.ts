import { exec } from 'child_process'

import { ServerInfo } from '../server/servers'

function getEnvCli (server?: ServerInfo) {
  return `NODE_ENV=test NODE_APP_INSTANCE=${server.internalServerNumber}`
}

async function execCLI (command: string) {
  return new Promise<string>((res, rej) => {
    exec(command, (err, stdout, stderr) => {
      if (err) return rej(err)

      return res(stdout)
    })
  })
}

// ---------------------------------------------------------------------------

export {
  execCLI,
  getEnvCli
}
