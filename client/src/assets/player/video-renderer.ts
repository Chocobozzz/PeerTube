// Thanks: https://github.com/feross/render-media
// TODO: use render-media once https://github.com/feross/render-media/issues/32 is fixed

import { extname } from 'path'
import * as MediaElementWrapper from 'mediasource'
import * as videostream from 'videostream'

const VIDEOSTREAM_EXTS = [
  '.m4a',
  '.m4v',
  '.mp4'
]

type RenderMediaOptions = {
  controls: boolean
  autoplay: boolean
}

function renderVideo (
  file,
  elem: HTMLVideoElement,
  opts: RenderMediaOptions,
  callback: (err: Error, renderer: any) => void
) {
  validateFile(file)

  return renderMedia(file, elem, opts, callback)
}

function renderMedia (file, elem: HTMLVideoElement, opts: RenderMediaOptions, callback: (err: Error, renderer: any) => void) {
  const extension = extname(file.name).toLowerCase()
  let preparedElem = undefined
  let currentTime = 0
  let renderer

  if (VIDEOSTREAM_EXTS.indexOf(extension) >= 0) {
    renderer = useVideostream()
  } else {
    renderer = useMediaSource()
  }

  function useVideostream () {
    prepareElem()
    preparedElem.addEventListener('error', fallbackToMediaSource)
    preparedElem.addEventListener('loadstart', onLoadStart)
    return videostream(file, preparedElem)
  }

  function useMediaSource () {
    prepareElem()
    preparedElem.addEventListener('error', callback)
    preparedElem.addEventListener('loadstart', onLoadStart)

    const wrapper = new MediaElementWrapper(preparedElem)
    const writable = wrapper.createWriteStream(getCodec(file.name))
    file.createReadStream().pipe(writable)

    if (currentTime) preparedElem.currentTime = currentTime

    return wrapper
  }

  function fallbackToMediaSource () {
    preparedElem.removeEventListener('error', fallbackToMediaSource)

    useMediaSource()
  }

  function prepareElem () {
    if (preparedElem === undefined) {
      preparedElem = elem

      preparedElem.addEventListener('progress', function () {
        currentTime = elem.currentTime
      })
    }
  }

  function onLoadStart () {
    preparedElem.removeEventListener('loadstart', onLoadStart)
    if (opts.autoplay) preparedElem.play()

    callback(null, renderer)
  }
}

function validateFile (file) {
  if (file == null) {
    throw new Error('file cannot be null or undefined')
  }
  if (typeof file.name !== 'string') {
    throw new Error('missing or invalid file.name property')
  }
  if (typeof file.createReadStream !== 'function') {
    throw new Error('missing or invalid file.createReadStream property')
  }
}

function getCodec (name: string) {
  const ext = extname(name).toLowerCase()
  return {
    '.m4a': 'audio/mp4; codecs="mp4a.40.5"',
    '.m4v': 'video/mp4; codecs="avc1.640029, mp4a.40.5"',
    '.mkv': 'video/webm; codecs="avc1.640029, mp4a.40.5"',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4; codecs="avc1.640029, mp4a.40.5"',
    '.webm': 'video/webm; codecs="opus, vorbis, vp8"'
  }[ext]
}

export {
  renderVideo
}
