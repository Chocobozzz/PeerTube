import { RegisterServerOptions, Video, MVideo } from '../dist/index.js'
import { RegisterClientOptions } from '../dist/client/index.js'

function register1 ({ registerHook, getRouter }: RegisterServerOptions) {
  registerHook({
    target: 'action:application.listening',
    handler: () => console.log('hello')
  })

  const router = getRouter()

  router.get('/ping', (req, res) => {
    console.log(req.rawBody)
    res.status(200).json({ message: 'pong' })
  })
}

function register2 ({ registerHook, peertubeHelpers }: RegisterClientOptions) {
  registerHook({
    target: 'action:admin-plugin-settings.init',
    handler: ({ npmName }: { npmName: string }) => {
      let video: MVideo

      if ('peertube-plugin-transcription' !== npmName) {
        return
      }
    }
  })

  registerHook({
    target: 'action:video-watch.video.loaded',
    handler: ({ video }: { video: Video }) => {
      fetch(`${peertubeHelpers.getBaseRouterRoute()}/videos/${video.uuid}/captions`, {
        method: 'PUT',
        headers: peertubeHelpers.getAuthHeader()
      })
        .then(res => res.json())
        .then(data => console.log('Hi %s.', data))
    }
  })
}
