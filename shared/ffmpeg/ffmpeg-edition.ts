import { FilterSpecification } from 'fluent-ffmpeg'
import { FFmpegCommandWrapper, FFmpegCommandWrapperOptions } from './ffmpeg-command-wrapper'
import { presetVOD } from './shared/presets'
import { ffprobePromise, getVideoStreamDimensionsInfo, getVideoStreamDuration, getVideoStreamFPS, hasAudioStream } from './ffprobe'

export class FFmpegEdition {
  private readonly commandWrapper: FFmpegCommandWrapper

  constructor (options: FFmpegCommandWrapperOptions) {
    this.commandWrapper = new FFmpegCommandWrapper(options)
  }

  async cutVideo (options: {
    inputPath: string
    outputPath: string
    start?: number
    end?: number
  }) {
    const { inputPath, outputPath } = options

    const mainProbe = await ffprobePromise(inputPath)
    const fps = await getVideoStreamFPS(inputPath, mainProbe)
    const { resolution } = await getVideoStreamDimensionsInfo(inputPath, mainProbe)

    const command = this.commandWrapper.buildCommand(inputPath)
      .output(outputPath)

    await presetVOD({
      commandWrapper: this.commandWrapper,
      input: inputPath,
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

    await this.commandWrapper.runCommand()
  }

  async addWatermark (options: {
    inputPath: string
    watermarkPath: string
    outputPath: string

    videoFilters: {
      watermarkSizeRatio: number
      horitonzalMarginRatio: number
      verticalMarginRatio: number
    }
  }) {
    const { watermarkPath, inputPath, outputPath, videoFilters } = options

    const videoProbe = await ffprobePromise(inputPath)
    const fps = await getVideoStreamFPS(inputPath, videoProbe)
    const { resolution } = await getVideoStreamDimensionsInfo(inputPath, videoProbe)

    const command = this.commandWrapper.buildCommand(inputPath)
      .output(outputPath)

    command.input(watermarkPath)

    await presetVOD({
      commandWrapper: this.commandWrapper,
      input: inputPath,
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
          h: `ih*${videoFilters.watermarkSizeRatio}`
        },
        outputs: [ '[watermark]', '[video]' ]
      },

      {
        inputs: [ '[video]', '[watermark]' ],
        filter: 'overlay',
        options: {
          x: `main_w - overlay_w - (main_h * ${videoFilters.horitonzalMarginRatio})`,
          y: `main_h * ${videoFilters.verticalMarginRatio}`
        }
      }
    ]

    command.complexFilter(complexFilter)

    await this.commandWrapper.runCommand()
  }

  async addIntroOutro (options: {
    inputPath: string
    introOutroPath: string
    outputPath: string
    type: 'intro' | 'outro'
  }) {
    const { introOutroPath, inputPath, outputPath, type } = options

    const mainProbe = await ffprobePromise(inputPath)
    const fps = await getVideoStreamFPS(inputPath, mainProbe)
    const { resolution } = await getVideoStreamDimensionsInfo(inputPath, mainProbe)
    const mainHasAudio = await hasAudioStream(inputPath, mainProbe)

    const introOutroProbe = await ffprobePromise(introOutroPath)
    const introOutroHasAudio = await hasAudioStream(introOutroPath, introOutroProbe)

    const command = this.commandWrapper.buildCommand(inputPath)
      .output(outputPath)

    command.input(introOutroPath)

    if (!introOutroHasAudio && mainHasAudio) {
      const duration = await getVideoStreamDuration(introOutroPath, introOutroProbe)

      command.input('anullsrc')
      command.withInputFormat('lavfi')
      command.withInputOption('-t ' + duration)
    }

    await presetVOD({
      commandWrapper: this.commandWrapper,
      input: inputPath,
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

    await this.commandWrapper.runCommand()
  }
}
