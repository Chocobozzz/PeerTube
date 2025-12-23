import { exec } from 'child_process'
import { AbstractCommand } from '../shared/index.js'

export class CLICommand extends AbstractCommand {

  static exec (command: string) {
    return new Promise<{ stdout: string, stderr: string }>((res, rej) => {
      exec(command, (err, stdout, stderr) => {
        if (err) return rej(err)

        return res({ stdout, stderr })
      })
    })
  }

  static getNodeConfigEnv (configOverride?: any) {
    return configOverride
      ? `NODE_CONFIG='${JSON.stringify(configOverride)}'`
      : ''
  }

  getEnv (configOverride?: any) {
    return `NODE_ENV=test NODE_APP_INSTANCE=${this.server.internalServerNumber} ${CLICommand.getNodeConfigEnv(configOverride)}`
  }

  async execWithEnv (command: string, configOverride?: any) {
    return CLICommand.exec(`${this.getEnv(configOverride)} ${command}`)
  }
}
