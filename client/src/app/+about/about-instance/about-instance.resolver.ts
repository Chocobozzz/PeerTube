import { forkJoin, Observable } from 'rxjs'
import { map, switchMap } from 'rxjs/operators'
import { Injectable } from '@angular/core'
import { ServerService } from '@app/core'
import { About, ServerStats } from '@peertube/peertube-models'
import { AboutHTML, InstanceService } from '@app/shared/shared-main/instance/instance.service'
import { CustomMarkupService } from '@app/shared/shared-custom-markup/custom-markup.service'

export type ResolverData = {
  serverStats: ServerStats
  about: About
  languages: string[]
  categories: string[]
  aboutHTML: AboutHTML
  descriptionElement: HTMLDivElement
}

@Injectable()
export class AboutInstanceResolver {

  constructor (
    private instanceService: InstanceService,
    private customMarkupService: CustomMarkupService,
    private serverService: ServerService
  ) {}

  resolve (): Observable<ResolverData> {
    return forkJoin([
      this.buildInstanceAboutObservable(),
      this.buildInstanceStatsObservable()
    ]).pipe(
      map(([
        [ about, languages, categories, aboutHTML, { rootElement } ],
        serverStats
      ]) => {
        return {
          serverStats,
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

  private buildInstanceStatsObservable () {
    return this.serverService.getServerStats()
  }
}
