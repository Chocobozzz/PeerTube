import { registerTSPaths } from '../server/helpers/register-ts-paths'
registerTSPaths()

import * as autocannon from 'autocannon'
import {
  addVideoCommentReply,
  addVideoCommentThread,
  createVideoCaption,
  flushAndRunServer,
  getVideosList,
  killallServers,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo
} from '@shared/extra-utils'
import { Video, VideoPrivacy } from '@shared/models'
import { writeJson } from 'fs-extra'

let server: ServerInfo
let video: Video
let threadId: number

const outfile = process.argv[2]

run()
  .catch(err => console.error(err))
  .finally(() => {
    if (server) killallServers([ server ])
  })

function buildAuthorizationHeader () {
  return {
    Authorization: 'Bearer ' + server.accessToken
  }
}

function buildAPHeader () {
  return {
    Accept: 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
  }
}

async function run () {
  console.log('Preparing server...')

  await prepare()

  const tests = [
    {
      title: 'AP - account peertube',
      path: '/accounts/peertube',
      headers: buildAPHeader(),
      expecter: (body, status) => {
        return status === 200 && body.startsWith('{"type":')
      }
    },
    {
      title: 'AP - video',
      path: '/videos/watch/' + video.uuid,
      headers: buildAPHeader(),
      expecter: (body, status) => {
        return status === 200 && body.startsWith('{"type":"Video"')
      }
    },
    {
      title: 'Misc - webfinger peertube',
      path: '/.well-known/webfinger?resource=acct:peertube@' + server.host,
      expecter: (body, status) => {
        return status === 200 && body.startsWith('{"subject":')
      }
    },
    {
      title: 'API - unread notifications',
      path: '/api/v1/users/me/notifications?start=0&count=0&unread=true',
      headers: buildAuthorizationHeader(),
      expecter: (_body, status) => {
        return status === 200
      }
    },
    {
      title: 'API - me',
      path: '/api/v1/users/me',
      headers: buildAuthorizationHeader(),
      expecter: (body, status) => {
        return status === 200 && body.startsWith('{"id":')
      }
    },
    {
      title: 'API - videos list',
      path: '/api/v1/videos',
      expecter: (body, status) => {
        return status === 200 && body.startsWith('{"total":10')
      }
    },
    {
      title: 'API - video get',
      path: '/api/v1/videos/' + video.uuid,
      expecter: (body, status) => {
        return status === 200 && body.startsWith('{"id":')
      }
    },
    {
      title: 'API - video captions',
      path: '/api/v1/videos/' + video.uuid + '/captions',
      expecter: (body, status) => {
        return status === 200 && body.startsWith('{"total":4')
      }
    },
    {
      title: 'API - video threads',
      path: '/api/v1/videos/' + video.uuid + '/comment-threads',
      expecter: (body, status) => {
        return status === 200 && body.startsWith('{"total":10')
      }
    },
    {
      title: 'API - video replies',
      path: '/api/v1/videos/' + video.uuid + '/comment-threads/' + threadId,
      expecter: (body, status) => {
        return status === 200 && body.startsWith('{"comment":{')
      }
    },
    {
      title: 'HTML - video watch',
      path: '/videos/watch/' + video.uuid,
      expecter: (body, status) => {
        return status === 200 && body.includes('<title>my super')
      }
    },
    {
      title: 'HTML - video embed',
      path: '/videos/embed/' + video.uuid,
      expecter: (body, status) => {
        return status === 200 && body.includes('embed')
      }
    },
    {
      title: 'HTML - homepage',
      path: '/',
      expecter: (_body, status) => {
        return status === 200
      }
    },
    {
      title: 'API - config',
      path: '/api/v1/config',
      expecter: (body, status) => {
        return status === 200 && body.startsWith('{"instance":')
      }
    }
  ]

  const finalResult: any[] = []

  for (const test of tests) {
    console.log('Running against %s.', test.path)
    const testResult = await runBenchmark(test)

    Object.assign(testResult, { title: test.title, path: test.path })
    finalResult.push(testResult)

    console.log(autocannon.printResult(testResult))
  }

  if (outfile) await writeJson(outfile, finalResult)
}

function runBenchmark (options: {
  path: string
  headers?: { [ id: string ]: string }
  expecter: Function
}) {
  const { path, expecter, headers } = options

  return new Promise((res, rej) => {
    autocannon({
      url: server.url + path,
      connections: 20,
      headers,
      pipelining: 1,
      duration: 10,
      requests: [
        {
          onResponse: (status, body) => {
            if (expecter(body, status) !== true) {
              console.error('Expected result failed.', { body, status })
              throw new Error('Invalid expectation')
            }
          }
        }
      ]
    }, (err, result) => {
      if (err) return rej(err)

      return res(result)
    })
  })
}

async function prepare () {
  server = await flushAndRunServer(1, {
    rates_limit: {
      api: {
        max: 5_000_000
      }
    }
  })
  await setAccessTokensToServers([ server ])

  const videoAttributes = {
    name: 'my super video',
    category: 2,
    nsfw: true,
    licence: 6,
    language: 'fr',
    privacy: VideoPrivacy.PUBLIC,
    support: 'please give me a coffee',
    description: 'my super description'.repeat(10),
    tags: [ 'tag1', 'tag2', 'tag3' ]
  }

  for (let i = 0; i < 10; i++) {
    Object.assign(videoAttributes, { name: 'my super video ' + i })
    await uploadVideo(server.url, server.accessToken, videoAttributes)
  }

  const resVideos = await getVideosList(server.url)
  video = resVideos.body.data.find(v => v.name === 'my super video 1')

  for (let i = 0; i < 10; i++) {
    const text = 'my super first comment'
    const res = await addVideoCommentThread(server.url, server.accessToken, video.id, text)
    threadId = res.body.comment.id

    const text1 = 'my super answer to thread 1'
    const childCommentRes = await addVideoCommentReply(server.url, server.accessToken, video.id, threadId, text1)
    const childCommentId = childCommentRes.body.comment.id

    const text2 = 'my super answer to answer of thread 1'
    await addVideoCommentReply(server.url, server.accessToken, video.id, childCommentId, text2)

    const text3 = 'my second answer to thread 1'
    await addVideoCommentReply(server.url, server.accessToken, video.id, threadId, text3)
  }

  for (const caption of [ 'ar', 'fr', 'en', 'zh' ]) {
    await createVideoCaption({
      url: server.url,
      accessToken: server.accessToken,
      language: caption,
      videoId: video.id,
      fixture: 'subtitle-good2.vtt'
    })
  }

  return { server, video, threadId }
}
