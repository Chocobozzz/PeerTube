import * as request from 'supertest'

import { ServerInfo } from '../server/servers'
import { getClient } from '../server/clients'

type Client = { id: string, secret: string }
type User = { username: string, password: string }
type Server = { url: string, client: Client, user: User }

function login (url: string, client: Client, user: User, expectedStatus = 200) {
  const path = '/api/v1/users/token'

  const body = {
    client_id: client.id,
    client_secret: client.secret,
    username: user.username,
    password: user.password,
    response_type: 'code',
    grant_type: 'password',
    scope: 'upload'
  }

  return request(url)
          .post(path)
          .type('form')
          .send(body)
          .expect(expectedStatus)
}

async function serverLogin (server: Server) {
  const res = await login(server.url, server.client, server.user, 200)

  return res.body.access_token as string
}

async function userLogin (server: Server, user: User, expectedStatus = 200) {
  const res = await login(server.url, server.client, user, expectedStatus)

  return res.body.access_token as string
}

async function getAccessToken (url: string, username: string, password: string) {
  const resClient = await getClient(url)
  const client = {
    id: resClient.body.client_id,
    secret: resClient.body.client_secret
  }

  const user = { username, password }

  try {
    const res = await login(url, client, user)
    return res.body.access_token
  } catch (err) {
    throw new Error('Cannot authenticate. Please check your username/password.')
  }
}

function setAccessTokensToServers (servers: ServerInfo[]) {
  const tasks: Promise<any>[] = []

  for (const server of servers) {
    const p = serverLogin(server).then(t => { server.accessToken = t })
    tasks.push(p)
  }

  return Promise.all(tasks)
}

// ---------------------------------------------------------------------------

export {
  login,
  serverLogin,
  userLogin,
  getAccessToken,
  setAccessTokensToServers,
  Server,
  Client,
  User
}
