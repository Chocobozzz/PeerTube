import { exec } from 'child_process'
import { AbstractCommand } from '../shared/index.js'

export class CLICommand extends AbstractCommand {

  static exec (command: string) {
    return new Promise<string>((res, rej) => {
      exec(command, (err, stdout, _stderr) => {
        if (err) return rej(err)

        return res(stdout)
      })
    })
  }

  getEnv () {
    return `NODE_ENV=test NODE_APP_INSTANCE=${this.server.internalServerNumber}`
  }

  async execWithEnv (command: string, configOverride?: any) {
    const prefix = configOverride
      ? `NODE_CONFIG='${JSON.stringify(configOverride)}'`
      : ''

    return CLICommand.exec(`${prefix} ${this.getEnv()} ${command}`)
  }
}
