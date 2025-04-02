export interface VideoRedundancy {
  id: number
  name: string
  url: string
  uuid: string

  redundancies: {
    // FIXME: remove in v8
    files: []

    streamingPlaylists: RedundancyInformation[]
  }
}

export interface RedundancyInformation {
  id: number
  fileUrl: string
  strategy: string

  createdAt: Date | string
  updatedAt: Date | string

  expiresOn: Date | string

  size: number
}
