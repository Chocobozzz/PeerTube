export interface VideoStudioCreateEdition {
  tasks: VideoStudioTask[]
}

export type VideoStudioTask =
  VideoStudioTaskCut |
  VideoStudioTaskIntro |
  VideoStudioTaskOutro |
  VideoStudioTaskWatermark

export interface VideoStudioTaskCut {
  name: 'cut'

  options: {
    start?: number
    end?: number
  }
}

export interface VideoStudioTaskIntro {
  name: 'add-intro'

  options: {
    file: Blob | string
  }
}

export interface VideoStudioTaskOutro {
  name: 'add-outro'

  options: {
    file: Blob | string
  }
}

export interface VideoStudioTaskWatermark {
  name: 'add-watermark'

  options: {
    file: Blob | string
  }
}

// ---------------------------------------------------------------------------

export function isVideoStudioTaskIntro (v: VideoStudioTask): v is VideoStudioTaskIntro {
  return v.name === 'add-intro'
}

export function isVideoStudioTaskOutro (v: VideoStudioTask): v is VideoStudioTaskOutro {
  return v.name === 'add-outro'
}

export function isVideoStudioTaskWatermark (v: VideoStudioTask): v is VideoStudioTaskWatermark {
  return v.name === 'add-watermark'
}

export function hasVideoStudioTaskFile (v: VideoStudioTask): v is VideoStudioTaskIntro | VideoStudioTaskOutro | VideoStudioTaskWatermark {
  return isVideoStudioTaskIntro(v) || isVideoStudioTaskOutro(v) || isVideoStudioTaskWatermark(v)
}
