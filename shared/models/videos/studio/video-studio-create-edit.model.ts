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
