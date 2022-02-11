export interface VideoEditorCreateEdition {
  tasks: VideoEditorTask[]
}

export type VideoEditorTask =
  VideoEditorTaskCut |
  VideoEditorTaskIntro |
  VideoEditorTaskOutro |
  VideoEditorTaskWatermark

export interface VideoEditorTaskCut {
  name: 'cut'

  options: {
    start?: number
    end?: number
  }
}

export interface VideoEditorTaskIntro {
  name: 'add-intro'

  options: {
    file: Blob | string
  }
}

export interface VideoEditorTaskOutro {
  name: 'add-outro'

  options: {
    file: Blob | string
  }
}

export interface VideoEditorTaskWatermark {
  name: 'add-watermark'

  options: {
    file: Blob | string
  }
}
