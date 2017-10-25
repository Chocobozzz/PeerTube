export class VideoEdit {
  category: number
  licence: number
  language: number
  description: string
  name: string
  tags: string[]
  nsfw: boolean
  channel: number
  uuid?: string
  id?: number

  patch (values: Object) {
    Object.keys(values).forEach((key) => {
      this[key] = values[key]
    })
  }

  toJSON () {
    return {
      category: this.category,
      licence: this.licence,
      language: this.language,
      description: this.description,
      name: this.name,
      tags: this.tags,
      nsfw: this.nsfw,
      channel: this.channel
    }
  }
}
