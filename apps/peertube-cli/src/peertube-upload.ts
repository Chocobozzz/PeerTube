import { Command } from '@commander-js/extra-typings'
import { VideoCommentPolicy, VideoPrivacy, VideoPrivacyType } from '@peertube/peertube-models'
import { PeerTubeServer } from '@peertube/peertube-server-commands'
import { access, constants } from 'fs/promises'
import { isAbsolute } from 'path'
import { inspect } from 'util'
import { assignToken, buildServer, getServerCredentials, listOptions } from './shared/index.js'

type UploadOptions = {
  url?: string
  username?: string
  password?: string
  thumbnail?: string
  preview?: string
  file?: string
  videoName?: string
  category?: number
  licence?: number
  language?: string
  tags?: string[]
  nsfw?: true
  videoDescription?: string
  privacy?: VideoPrivacyType
  channelName?: string
  noCommentsEnabled?: true
  support?: string
  noWaitTranscoding?: true
  noDownloadEnabled?: true
}

export function defineUploadProgram () {
  const program = new Command('upload')
    .description('Upload a video on a PeerTube instance')
    .alias('up')

  program
    .option('-u, --url <url>', 'Server url')
    .option('-U, --username <username>', 'Username')
    .option('-p, --password <token>', 'Password')
    .option('-b, --thumbnail <thumbnailPath>', 'Thumbnail path')
    .option('--preview <previewPath>', 'Preview path')
    .option('-f, --file <file>', 'Video absolute file path')
    .option('-n, --video-name <name>', 'Video name')
    .option('-c, --category <category_number>', 'Category number', parseInt)
    .option('-l, --licence <licence_number>', 'Licence number', parseInt)
    .option('-L, --language <language_code>', 'Language ISO 639 code (fr or en...)')
    .option('-t, --tags <tags>', 'Video tags', listOptions)
    .option('-N, --nsfw', 'Video is Not Safe For Work')
    .option('-d, --video-description <description>', 'Video description')
    .option('-P, --privacy <privacy_number>', 'Privacy', v => parseInt(v) as VideoPrivacyType)
    .option('-C, --channel-name <channel_name>', 'Channel name')
    .option('--no-comments-enabled', 'Disable video comments')
    .option('-s, --support <support>', 'Video support text')
    .option('--no-wait-transcoding', 'Do not wait transcoding before publishing the video')
    .option('--no-download-enabled', 'Disable video download')
    .option('-v, --verbose <verbose>', 'Verbosity, from 0/\'error\' to 4/\'debug\'', 'info')
    .action(async options => {
      try {
        const { url, username, password } = await getServerCredentials(options)

        if (!options.videoName || !options.file) {
          if (!options.videoName) console.error('--video-name is required.')
          if (!options.file) console.error('--file is required.')

          process.exit(-1)
        }

        if (isAbsolute(options.file) === false) {
          console.error('File path should be absolute.')
          process.exit(-1)
        }

        await run({ ...options, url, username, password })
      } catch (err) {
        console.error('Cannot upload video: ' + err.message)
        process.exit(-1)
      }
    })

  return program
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function run (options: UploadOptions) {
  const { url, username, password } = options

  const server = buildServer(url)
  await assignToken(server, username, password)

  await access(options.file, constants.F_OK)

  console.log('Uploading %s video...', options.videoName)

  const baseAttributes = await buildVideoAttributesFromCommander(server, options)

  const attributes = {
    ...baseAttributes,

    fixture: options.file,
    thumbnailfile: options.thumbnail,
    previewfile: options.preview
  }

  try {
    await server.videos.upload({ attributes })
    console.log(`Video ${options.videoName} uploaded.`)
    process.exit(0)
  } catch (err) {
    const message = err.message || ''
    if (message.includes('413')) {
      console.error('Aborted: user quota is exceeded or video file is too big for this PeerTube instance.')
    } else {
      console.error(inspect(err))
    }

    process.exit(-1)
  }
}

async function buildVideoAttributesFromCommander (server: PeerTubeServer, options: UploadOptions) {
  const defaultBooleanAttributes = {
    nsfw: false,
    downloadEnabled: true,
    waitTranscoding: true
  }

  const booleanAttributes: { [id in keyof typeof defaultBooleanAttributes]: boolean } | {} = {}

  for (const key of Object.keys(defaultBooleanAttributes)) {
    if (options[key] !== undefined) {
      booleanAttributes[key] = options[key]
    } else {
      booleanAttributes[key] = defaultBooleanAttributes[key]
    }
  }

  const videoAttributes = {
    name: options.videoName,
    category: options.category || undefined,
    licence: options.licence || undefined,
    language: options.language || undefined,
    privacy: options.privacy || VideoPrivacy.PUBLIC,
    support: options.support || undefined,
    description: options.videoDescription || undefined,
    tags: options.tags || undefined,

    commentsPolicy: options.noCommentsEnabled !== undefined
      ? options.noCommentsEnabled === true
        ? VideoCommentPolicy.DISABLED
        : VideoCommentPolicy.ENABLED
      : undefined,

    ...booleanAttributes
  }

  if (options.channelName) {
    const videoChannel = await server.channels.get({ channelName: options.channelName })

    Object.assign(videoAttributes, { channelId: videoChannel.id })

    if (!videoAttributes.support && videoChannel.support) {
      Object.assign(videoAttributes, { support: videoChannel.support })
    }
  }

  return videoAttributes
}
