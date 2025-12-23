import { IPCClient } from '../shared/ipc/index.js'

export async function gracefulShutdown () {
  const client = new IPCClient()
  await client.run()

  await client.askGracefulShutdown()

  client.stop()
}
