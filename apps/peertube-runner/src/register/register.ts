import { IPCClient } from '../shared/ipc/index.js'

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
  runnerName: string
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

export async function listJobs (options: {
  includePayload: boolean
}) {
  const client = new IPCClient()
  await client.run()

  await client.askListJobs(options)

  client.stop()
}
