export interface About {
  instance: {
    name: string
    shortDescription: string
    description: string
    terms: string

    DMCA: string
    hardwareInformation: string

    creationReason: string
    moderationInformation: string
    administrator: string
    maintenanceLifetime: string
    businessModel: string

    languages: string[]
    categories: number[]
  }
}
