import autocannon, { printResult } from 'autocannon'
import { program } from 'commander'
import { writeJson } from 'fs-extra/esm'
import { Video, VideoPrivacy } from '@peertube/peertube-models'
import {
  createMultipleServers,
  doubleFollow,
  killallServers,
  PeerTubeServer,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'

let servers: PeerTubeServer[]
// First server
let server: PeerTubeServer
let video: Video
let threadId: number

program
  .option('-o, --outfile [outfile]', 'Outfile')
  .option('--grep [string]', 'Filter tests you want to execute')
  .description('Run API REST benchmark')
  .parse(process.argv)

const options = program.opts()

const outfile = options.outfile

run()
  .catch(err => console.error(err))
  .finally(() => {
    if (servers) return killallServers(servers)
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

function buildJSONHeader () {
  return {
    'Content-Type': 'application/json'
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
        return status === 200 && body.startsWith('{"@context":')
      }
    },
    {
      title: 'AP - video',
      path: '/videos/watch/' + video.uuid,
      headers: buildAPHeader(),
      expecter: (body, status) => {
        return status === 200 && body.startsWith('{"@context":')
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
        return status === 200 && body.startsWith('{"client":')
      }
    },
    {
      title: 'API - views with token',
      method: 'PUT',
      headers: {
        ...buildAuthorizationHeader(),
        ...buildJSONHeader()
      },
      body: JSON.stringify({ currentTime: 2 }),
      path: '/api/v1/videos/' + video.uuid + '/views',
      expecter: (body, status) => {
        return status === 204
      }
    },
    {
      title: 'API - views without token',
      method: 'POST',
      headers: buildJSONHeader(),
      body: JSON.stringify({ currentTime: 2 }),
      path: '/api/v1/videos/' + video.uuid + '/views',
      expecter: (body, status) => {
        return status === 204
      }
    }
  ].filter(t => {
    if (!options.grep) return true

    return t.title.includes(options.grep)
  })

  const finalResult: any[] = []

  for (const test of tests) {
    console.log('Running against %s.', test.path)
    const testResult = await runBenchmark(test)

    Object.assign(testResult, { title: test.title, path: test.path })
    finalResult.push(testResult)

    console.log(printResult(testResult))
  }

  if (outfile) await writeJson(outfile, finalResult)
}

function runBenchmark (options: {
  path: string
  method?: string
  body?: string
  headers?: { [ id: string ]: string }
  expecter: Function
}) {
  const { method = 'GET', path, body, expecter, headers } = options

  return new Promise((res, rej) => {
    autocannon({
      url: server.url + path,
      method,
      body,
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
  servers = await createMultipleServers(3, {
    rates_limit: {
      api: {
        max: 5_000_000
      },
      login: {
        max: 5_000_000
      },
      signup: {
        max: 5_000_000
      },
      ask_send_email: {
        max: 5_000_000
      },
      receive_client_log: {
        max: 5_000_000
      },
      plugins: {
        max: 5_000_000
      },
      well_known: {
        max: 5_000_000
      },
      feeds: {
        max: 5_000_000
      },
      activity_pub: {
        max: 5_000_000
      },
      client: {
        max: 5_000_000
      }
    }
  }, { nodeArgs: [ '--inspect' ] })
  server = servers[0]

  await setAccessTokensToServers(servers)
  await doubleFollow(servers[0], servers[1])
  await doubleFollow(servers[0], servers[2])

  const attributes = {
    name: 'my super video',
    category: 2,
    nsfw: true,
    licence: 6,
    language: 'fr',
    privacy: VideoPrivacy.PUBLIC,
    support: 'please give me a coffee',
    description: 'my super description\n'.repeat(10) + ' * list1\n * list 2\n * list 3',
    tags: [ 'tag1', 'tag2', 'tag3' ]
  }

  for (let i = 0; i < 10; i++) {
    await server.videos.upload({ attributes: { ...attributes, name: 'my super video ' + i } })
  }

  const { data } = await server.videos.list()
  video = data.find(v => v.name === 'my super video 1')

  for (let i = 0; i < 10; i++) {
    const text = 'my super first comment'
    const created = await server.comments.createThread({ videoId: video.id, text })
    threadId = created.id

    const text1 = 'my super answer to thread 1'
    const child = await server.comments.addReply({ videoId: video.id, toCommentId: threadId, text: text1 })

    const text2 = 'my super answer to answer of thread 1'
    await server.comments.addReply({ videoId: video.id, toCommentId: child.id, text: text2 })

    const text3 = 'my second answer to thread 1'
    await server.comments.addReply({ videoId: video.id, toCommentId: threadId, text: text3 })
  }

  for (const caption of [ 'ar', 'fr', 'en', 'zh' ]) {
    await server.captions.add({
      language: caption,
      videoId: video.id,
      fixture: 'subtitle-good2.vtt'
    })
  }
}
