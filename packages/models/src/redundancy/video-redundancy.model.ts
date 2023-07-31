export interface VideoRedundancy {
  id: number
  name: string
  url: string
  uuid: string

  redundancies: {
    files: FileRedundancyInformation[]

    streamingPlaylists: StreamingPlaylistRedundancyInformation[]
  }
}

interface RedundancyInformation {
  id: number
  fileUrl: string
  strategy: string

  createdAt: Date | string
  updatedAt: Date | string

  expiresOn: Date | string

  size: number
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface FileRedundancyInformation extends RedundancyInformation {

}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface StreamingPlaylistRedundancyInformation extends RedundancyInformation {

}
