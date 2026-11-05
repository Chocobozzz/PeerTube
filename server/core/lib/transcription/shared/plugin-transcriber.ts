import { PluginTranscriber, PluginTranscriberVideo } from '@peertube/peertube-models'
import { buildSUUID } from '@peertube/peertube-node-utils'
import { TranscriptFile } from '@peertube/peertube-transcription'
import { isVideoCaptionLanguageValid } from '@server/helpers/custom-validators/video-captions.js'
import { createLogger } from '@server/helpers/logger.js'
import { Hooks } from '@server/lib/plugins/hooks.js'
import { MVideoFull } from '@server/types/models/index.js'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { TranscribeOptions, VideoTranscriber } from './transcriber.js'

const logger = createLogger('transcription')

export async function loadPluginTranscriber (video: MVideoFull): Promise<VideoTranscriber | undefined> {
  // A plugin can provide its own transcriber, for example to use an external or self-hosted ASR service
  const pluginTranscriber = await Hooks.wrapObject<PluginTranscriber | undefined, 'filter:transcription.transcriber.result'>(
    undefined,
    'filter:transcription.transcriber.result',
    { video: buildPluginTranscriberVideo(video) }
  )

  if (!pluginTranscriber) return undefined

  if (!pluginTranscriber.name || typeof pluginTranscriber.transcribe !== 'function') {
    throw new Error('The transcriber provided by a plugin must have a name and a transcribe function')
  }

  return {
    name: pluginTranscriber.name,

    transcribe: options => transcribeWithPlugin(pluginTranscriber, options)
  }
}

// ---------------------------------------------------------------------------

async function transcribeWithPlugin (pluginTranscriber: PluginTranscriber, options: TranscribeOptions) {
  const { name } = pluginTranscriber
  const { mediaFilePath, language, workingDirectory, signal } = options

  logger.info(`Use the transcriber "${name}" provided by a plugin to generate subtitles`)

  const result = await pluginTranscriber.transcribe({ mediaFilePath, language, workingDirectory, signal })
  if (!result) return undefined

  if (!isVideoCaptionLanguageValid(result.language)) {
    throw new Error(`The plugin transcriber "${name}" returned an invalid subtitles language "${result.language}"`)
  }

  if (!result.content || typeof result.content !== 'string') {
    throw new Error(`The plugin transcriber "${name}" did not return the content of the generated subtitles`)
  }

  const path = join(workingDirectory, `${buildSUUID()}.vtt`)
  await writeFile(path, result.content, 'utf8')

  return new TranscriptFile({ path, language: result.language, format: 'vtt' })
}

function buildPluginTranscriberVideo (video: MVideoFull): PluginTranscriberVideo {
  const channel = video.VideoChannel
  const account = channel.Account

  return {
    id: video.id,
    uuid: video.uuid,
    name: video.name,
    language: video.language,
    duration: video.duration,
    privacy: video.privacy,

    channel: {
      id: channel.id,
      name: channel.Actor.preferredUsername,
      displayName: channel.name
    },

    account: {
      id: account.id,
      name: account.Actor.preferredUsername,
      displayName: account.name
    }
  }
}
