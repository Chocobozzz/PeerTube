import * as io from 'socket.io-client'

function getUserNotificationSocket (serverUrl: string, accessToken: string) {
  return io(serverUrl + '/user-notifications', {
    query: { accessToken }
  })
}

// ---------------------------------------------------------------------------

export {
  getUserNotificationSocket
}
