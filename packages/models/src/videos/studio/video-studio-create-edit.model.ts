export interface VideoStudioCreateEdition {
  tasks: VideoStudioTask[]
}

export type VideoStudioTask =
  | VideoStudioTaskCut
  | VideoStudioTaskIntro
  | VideoStudioTaskOutro
  | VideoStudioTaskWatermark
  | VideoStudioTaskRemoveSegments

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

export interface VideoStudioTaskRemoveSegments {
  name: 'remove-segments'

  options: {
    segments: {
      start: number
      end: number
    }[]
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

export function isVideoStudioTaskRemoveSegments (v: VideoStudioTask): v is VideoStudioTaskRemoveSegments {
  return v.name === 'remove-segments'
}
