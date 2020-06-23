import { forkJoin } from 'rxjs'
import { map, switchMap } from 'rxjs/operators'
import { Injectable } from '@angular/core'
import { ActivatedRouteSnapshot, Resolve } from '@angular/router'
import { InstanceService } from '@app/shared/shared-instance'
import { About } from '@shared/models/server'

export type ResolverData = { about: About, languages: string[], categories: string[] }

@Injectable()
export class AboutInstanceResolver implements Resolve<any> {

  constructor (private instanceService: InstanceService) {}

  resolve (route: ActivatedRouteSnapshot) {
    return this.instanceService.getAbout()
               .pipe(
                 switchMap(about => {
                   return forkJoin([
                     this.instanceService.buildTranslatedLanguages(about),
                     this.instanceService.buildTranslatedCategories(about)
                   ]).pipe(map(([ languages, categories ]) => ({ about, languages, categories })))
                 })
               )
  }
}
