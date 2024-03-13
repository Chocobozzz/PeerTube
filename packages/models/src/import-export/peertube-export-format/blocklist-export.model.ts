export interface BlocklistExportJSON {
  instances: {
    host: string
  }[]

  actors: {
    handle: string
  }[]
}
