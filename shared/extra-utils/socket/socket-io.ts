import { io } from 'socket.io-client'

function getUserNotificationSocket (serverUrl: string, accessToken: string) {
  return io(serverUrl + '/user-notifications', {
    query: { accessToken }
  })
}

function getLiveNotificationSocket (serverUrl: string) {
  return io(serverUrl + '/live-videos')
}

// ---------------------------------------------------------------------------

export {
  getUserNotificationSocket,
  getLiveNotificationSocket
}
