import { ActorImageType } from '@peertube/peertube-models'
import { MActor, MActorDefaultBanner, MActorImage } from '@server/types/models/index.js'
import { createReadStream } from 'fs'
import { extname, join } from 'path'
import { AbstractUserExporter, ExportResult } from './abstract-user-exporter.js'

export abstract class ActorExporter<T> extends AbstractUserExporter<T> {
  protected exportActorJSON (actor: MActorDefaultBanner) {
    return {
      url: actor.url,

      name: actor.preferredUsername,

      avatars: actor.hasImage(ActorImageType.AVATAR)
        ? this.exportActorImageJSON(actor.Avatars)
        : [],

      banners: actor.hasImage(ActorImageType.BANNER)
        ? this.exportActorImageJSON(actor.Banners)
        : []
    }
  }

  protected exportActorImageJSON (images: MActorImage[]) {
    return images.map(i => ({
      width: i.width,
      height: i.height,
      url: i.getLocalFileUrl(),
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString()
    }))
  }

  // ---------------------------------------------------------------------------

  protected exportActorFiles (actor: MActorDefaultBanner) {
    const staticFiles: ExportResult<any>['staticFiles'] = []
    const relativePathsFromJSON = {
      avatar: null as string,
      banner: null as string
    }

    const toProcess = [
      {
        archivePathBuilder: (filename: string) => this.getBannerPath(actor, filename),
        type: ActorImageType.BANNER
      },
      {
        archivePathBuilder: (filename: string) => this.getAvatarPath(actor, filename),
        type: ActorImageType.AVATAR
      }
    ]

    for (const { archivePathBuilder, type } of toProcess) {
      if (!actor.hasImage(type)) continue

      const image = actor.getMaxQualityImage(type)

      staticFiles.push({
        archivePath: archivePathBuilder(image.filename),
        readStreamFactory: () => Promise.resolve(createReadStream(image.getFSPath()))
      })

      const relativePath = join(this.relativeStaticDirPath, archivePathBuilder(image.filename))

      if (type === ActorImageType.AVATAR) relativePathsFromJSON.avatar = relativePath
      else if (type === ActorImageType.BANNER) relativePathsFromJSON.banner = relativePath
    }

    return { staticFiles, relativePathsFromJSON }
  }

  protected getAvatarPath (actor: MActor, filename: string) {
    return join('avatars', actor.preferredUsername + extname(filename))
  }

  protected getBannerPath (actor: MActor, filename: string) {
    return join('banners', actor.preferredUsername + extname(filename))
  }
}
