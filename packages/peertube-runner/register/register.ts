import { IPCClient } from '../shared/ipc'

export async function registerRunner (options: {
  url: string
  registrationToken: string
  runnerName: string
  runnerDescription?: string
}) {
  const client = new IPCClient()
  await client.run()

  await client.askRegister(options)

  client.stop()
}

export async function unregisterRunner (options: {
  url: string
}) {
  const client = new IPCClient()
  await client.run()

  await client.askUnregister(options)

  client.stop()
}

export async function listRegistered () {
  const client = new IPCClient()
  await client.run()

  await client.askListRegistered()

  client.stop()
}
