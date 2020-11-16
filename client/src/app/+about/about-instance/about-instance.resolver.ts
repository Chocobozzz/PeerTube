import { forkJoin } from 'rxjs'
import { map, switchMap } from 'rxjs/operators'
import { Injectable } from '@angular/core'
import { ActivatedRouteSnapshot, Resolve } from '@angular/router'
import { ServerService } from '@app/core'
import { InstanceService } from '@app/shared/shared-instance'
import { About, ServerConfig } from '@shared/models/server'

export type ResolverData = { about: About, languages: string[], categories: string[], serverConfig: ServerConfig }

@Injectable()
export class AboutInstanceResolver implements Resolve<any> {

  constructor (
    private instanceService: InstanceService,
    private serverService: ServerService
  ) {}

  resolve (route: ActivatedRouteSnapshot) {
    return this.instanceService.getAbout()
               .pipe(
                 switchMap(about => {
                   return forkJoin([
                     this.instanceService.buildTranslatedLanguages(about),
                     this.instanceService.buildTranslatedCategories(about),
                     this.serverService.getConfig()
                   ]).pipe(map(([ languages, categories, serverConfig ]) => ({ about, languages, categories, serverConfig })))
                 })
               )
  }
}
