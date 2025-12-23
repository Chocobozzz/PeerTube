import { forkJoin, Observable } from 'rxjs'
import { map, switchMap } from 'rxjs/operators'
import { Injectable, inject } from '@angular/core'
import { ServerService } from '@app/core'
import { About, ServerConfig, ServerStats } from '@peertube/peertube-models'
import { AboutHTML, InstanceService } from '@app/shared/shared-main/instance/instance.service'
import { CustomMarkupService } from '@app/shared/shared-custom-markup/custom-markup.service'

export type ResolverData = {
  serverConfig: ServerConfig
  serverStats: ServerStats
  about: About
  languages: string[]
  categories: string[]
  aboutHTML: AboutHTML
  descriptionElement: HTMLDivElement
}

@Injectable()
export class AboutInstanceResolver {
  private instanceService = inject(InstanceService)
  private customMarkupService = inject(CustomMarkupService)
  private serverService = inject(ServerService)

  resolve (): Observable<ResolverData> {
    return forkJoin([
      this.buildInstanceAboutObservable(),
      this.serverService.getServerStats(),
      this.serverService.getConfig()
    ]).pipe(
      map(([
        [ about, languages, categories, aboutHTML, { rootElement } ],
        serverStats,
        serverConfig
      ]) => {
        return {
          serverStats,
          serverConfig,
          about,
          languages,
          categories,
          aboutHTML,
          descriptionElement: rootElement
        }
      })
    )
  }

  private buildInstanceAboutObservable () {
    return this.instanceService.getAbout()
      .pipe(
        switchMap(about => {
          return forkJoin([
            Promise.resolve(about),
            this.instanceService.buildTranslatedLanguages(about),
            this.instanceService.buildTranslatedCategories(about),
            this.instanceService.buildHtml(about),
            this.customMarkupService.buildElement(about.instance.description)
          ])
        })
      )
  }
}
