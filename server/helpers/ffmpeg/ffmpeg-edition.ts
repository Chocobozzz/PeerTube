import { FilterSpecification } from 'fluent-ffmpeg'
import { VIDEO_FILTERS } from '@server/initializers/constants'
import { AvailableEncoders } from '@shared/models'
import { logger, loggerTagsFactory } from '../logger'
import { getFFmpeg, runCommand } from './ffmpeg-commons'
import { presetVOD } from './ffmpeg-presets'
import { ffprobePromise, getVideoStreamDimensionsInfo, getVideoStreamDuration, getVideoStreamFPS, hasAudioStream } from './ffprobe-utils'

const lTags = loggerTagsFactory('ffmpeg')

async function cutVideo (options: {
  inputPath: string
  outputPath: string
  start?: number
  end?: number

  availableEncoders: AvailableEncoders
  profile: string
}) {
  const { inputPath, outputPath, availableEncoders, profile } = options

  logger.debug('Will cut the video.', { options, ...lTags() })

  const mainProbe = await ffprobePromise(inputPath)
  const fps = await getVideoStreamFPS(inputPath, mainProbe)
  const { resolution } = await getVideoStreamDimensionsInfo(inputPath, mainProbe)

  let command = getFFmpeg(inputPath, 'vod')
    .output(outputPath)

  command = await presetVOD({
    command,
    input: inputPath,
    availableEncoders,
    profile,
    resolution,
    fps,
    canCopyAudio: false,
    canCopyVideo: false
  })

  if (options.start) {
    command.outputOption('-ss ' + options.start)
  }

  if (options.end) {
    command.outputOption('-to ' + options.end)
  }

  await runCommand({ command })
}

async function addWatermark (options: {
  inputPath: string
  watermarkPath: string
  outputPath: string

  availableEncoders: AvailableEncoders
  profile: string
}) {
  const { watermarkPath, inputPath, outputPath, availableEncoders, profile } = options

  logger.debug('Will add watermark to the video.', { options, ...lTags() })

  const videoProbe = await ffprobePromise(inputPath)
  const fps = await getVideoStreamFPS(inputPath, videoProbe)
  const { resolution } = await getVideoStreamDimensionsInfo(inputPath, videoProbe)

  let command = getFFmpeg(inputPath, 'vod')
    .output(outputPath)
  command.input(watermarkPath)

  command = await presetVOD({
    command,
    input: inputPath,
    availableEncoders,
    profile,
    resolution,
    fps,
    canCopyAudio: true,
    canCopyVideo: false
  })

  const complexFilter: FilterSpecification[] = [
    // Scale watermark
    {
      inputs: [ '[1]', '[0]' ],
      filter: 'scale2ref',
      options: {
        w: 'oh*mdar',
        h: `ih*${VIDEO_FILTERS.WATERMARK.SIZE_RATIO}`
      },
      outputs: [ '[watermark]', '[video]' ]
    },

    {
      inputs: [ '[video]', '[watermark]' ],
      filter: 'overlay',
      options: {
        x: `main_w - overlay_w - (main_h * ${VIDEO_FILTERS.WATERMARK.HORIZONTAL_MARGIN_RATIO})`,
        y: `main_h * ${VIDEO_FILTERS.WATERMARK.VERTICAL_MARGIN_RATIO}`
      }
    }
  ]

  command.complexFilter(complexFilter)

  await runCommand({ command })
}

async function addIntroOutro (options: {
  inputPath: string
  introOutroPath: string
  outputPath: string
  type: 'intro' | 'outro'

  availableEncoders: AvailableEncoders
  profile: string
}) {
  const { introOutroPath, inputPath, outputPath, availableEncoders, profile, type } = options

  logger.debug('Will add intro/outro to the video.', { options, ...lTags() })

  const mainProbe = await ffprobePromise(inputPath)
  const fps = await getVideoStreamFPS(inputPath, mainProbe)
  const { resolution } = await getVideoStreamDimensionsInfo(inputPath, mainProbe)
  const mainHasAudio = await hasAudioStream(inputPath, mainProbe)

  const introOutroProbe = await ffprobePromise(introOutroPath)
  const introOutroHasAudio = await hasAudioStream(introOutroPath, introOutroProbe)

  let command = getFFmpeg(inputPath, 'vod')
    .output(outputPath)

  command.input(introOutroPath)

  if (!introOutroHasAudio && mainHasAudio) {
    const duration = await getVideoStreamDuration(introOutroPath, introOutroProbe)

    command.input('anullsrc')
    command.withInputFormat('lavfi')
    command.withInputOption('-t ' + duration)
  }

  command = await presetVOD({
    command,
    input: inputPath,
    availableEncoders,
    profile,
    resolution,
    fps,
    canCopyAudio: false,
    canCopyVideo: false
  })

  // Add black background to correctly scale intro/outro with padding
  const complexFilter: FilterSpecification[] = [
    {
      inputs: [ '1', '0' ],
      filter: 'scale2ref',
      options: {
        w: 'iw',
        h: `ih`
      },
      outputs: [ 'intro-outro', 'main' ]
    },
    {
      inputs: [ 'intro-outro', 'main' ],
      filter: 'scale2ref',
      options: {
        w: 'iw',
        h: `ih`
      },
      outputs: [ 'to-scale', 'main' ]
    },
    {
      inputs: 'to-scale',
      filter: 'drawbox',
      options: {
        t: 'fill'
      },
      outputs: [ 'to-scale-bg' ]
    },
    {
      inputs: [ '1', 'to-scale-bg' ],
      filter: 'scale2ref',
      options: {
        w: 'iw',
        h: 'ih',
        force_original_aspect_ratio: 'decrease',
        flags: 'spline'
      },
      outputs: [ 'to-scale', 'to-scale-bg' ]
    },
    {
      inputs: [ 'to-scale-bg', 'to-scale' ],
      filter: 'overlay',
      options: {
        x: '(main_w - overlay_w)/2',
        y: '(main_h - overlay_h)/2'
      },
      outputs: 'intro-outro-resized'
    }
  ]

  const concatFilter = {
    inputs: [],
    filter: 'concat',
    options: {
      n: 2,
      v: 1,
      unsafe: 1
    },
    outputs: [ 'v' ]
  }

  const introOutroFilterInputs = [ 'intro-outro-resized' ]
  const mainFilterInputs = [ 'main' ]

  if (mainHasAudio) {
    mainFilterInputs.push('0:a')

    if (introOutroHasAudio) {
      introOutroFilterInputs.push('1:a')
    } else {
      // Silent input
      introOutroFilterInputs.push('2:a')
    }
  }

  if (type === 'intro') {
    concatFilter.inputs = [ ...introOutroFilterInputs, ...mainFilterInputs ]
  } else {
    concatFilter.inputs = [ ...mainFilterInputs, ...introOutroFilterInputs ]
  }

  if (mainHasAudio) {
    concatFilter.options['a'] = 1
    concatFilter.outputs.push('a')

    command.outputOption('-map [a]')
  }

  command.outputOption('-map [v]')

  complexFilter.push(concatFilter)
  command.complexFilter(complexFilter)

  await runCommand({ command })
}

// ---------------------------------------------------------------------------

export {
  cutVideo,
  addIntroOutro,
  addWatermark
}
