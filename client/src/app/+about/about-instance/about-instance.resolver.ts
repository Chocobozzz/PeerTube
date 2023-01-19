import { forkJoin } from 'rxjs'
import { map, switchMap } from 'rxjs/operators'
import { Injectable } from '@angular/core'
import { Resolve } from '@angular/router'
import { CustomMarkupService } from '@app/shared/shared-custom-markup'
import { AboutHTML, InstanceService } from '@app/shared/shared-instance'
import { About } from '@shared/models/server'

export type ResolverData = {
  about: About
  languages: string[]
  categories: string[]
  aboutHTML: AboutHTML
  descriptionElement: HTMLDivElement
}

@Injectable()
export class AboutInstanceResolver implements Resolve<any> {

  constructor (
    private instanceService: InstanceService,
    private customMarkupService: CustomMarkupService

  ) {}

  resolve () {
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
                 }),
                 map(([ about, languages, categories, aboutHTML, { rootElement } ]) => {
                   return { about, languages, categories, aboutHTML, descriptionElement: rootElement } as ResolverData
                 })
               )
  }
}
