import { splitIntoArray, toBoolean } from '@app/helpers'
import { getAllPrivacies } from '@shared/core-utils'
import { escapeHTML } from '@shared/core-utils/renderer'
import { BooleanBothQuery, NSFWPolicyType, VideoInclude, VideoPrivacy, VideoSortField } from '@shared/models'
import { AttributesOnly } from '@shared/typescript-utils'

type VideoFiltersKeys = {
  [ id in keyof AttributesOnly<VideoFilters> ]: any
}

export type VideoFilterScope = 'local' | 'federated'

export class VideoFilters {
  sort: VideoSortField
  nsfw: BooleanBothQuery

  languageOneOf: string[]
  categoryOneOf: number[]

  scope: VideoFilterScope
  allVideos: boolean

  live: BooleanBothQuery

  search: string

  private defaultValues = new Map<keyof VideoFilters, any>([
    [ 'sort', '-publishedAt' ],
    [ 'nsfw', 'false' ],
    [ 'languageOneOf', undefined ],
    [ 'categoryOneOf', undefined ],
    [ 'scope', 'federated' ],
    [ 'allVideos', false ],
    [ 'live', 'both' ]
  ])

  private activeFilters: { key: string, canRemove: boolean, label: string, value?: string }[] = []
  private defaultNSFWPolicy: NSFWPolicyType

  private onChangeCallbacks: Array<() => void> = []
  private oldFormObjectString: string

  private readonly hiddenFields: string[] = []

  constructor (defaultSort: string, defaultScope: VideoFilterScope, hiddenFields: string[] = []) {
    this.setDefaultSort(defaultSort)
    this.setDefaultScope(defaultScope)

    this.hiddenFields = hiddenFields

    this.reset()
  }

  onChange (cb: () => void) {
    this.onChangeCallbacks.push(cb)
  }

  triggerChange () {
    // Don't run on change if the values did not change
    const currentFormObjectString = JSON.stringify(this.toFormObject())
    if (this.oldFormObjectString && currentFormObjectString === this.oldFormObjectString) return

    this.oldFormObjectString = currentFormObjectString

    for (const cb of this.onChangeCallbacks) {
      cb()
    }
  }

  setDefaultScope (scope: VideoFilterScope) {
    this.defaultValues.set('scope', scope)
  }

  setDefaultSort (sort: string) {
    this.defaultValues.set('sort', sort)
  }

  setNSFWPolicy (nsfwPolicy: NSFWPolicyType) {
    this.updateDefaultNSFW(nsfwPolicy)
  }

  reset (specificKey?: string) {
    for (const [ key, value ] of this.defaultValues) {
      if (specificKey && specificKey !== key) continue

      // FIXME: typings
      this[key as any] = value
    }

    this.buildActiveFilters()
  }

  load (obj: Partial<AttributesOnly<VideoFilters>>) {
    // FIXME: We may use <ng-option> that doesn't escape HTML so prefer to escape things
    // https://github.com/ng-select/ng-select/issues/1363

    const escapeIfNeeded = (value: any) => {
      if (typeof value === 'string') return escapeHTML(value)

      return value
    }

    if (obj.sort !== undefined) this.sort = escapeIfNeeded(obj.sort) as VideoSortField

    if (obj.nsfw !== undefined) this.nsfw = escapeIfNeeded(obj.nsfw) as BooleanBothQuery

    if (obj.languageOneOf !== undefined) this.languageOneOf = splitIntoArray(escapeIfNeeded(obj.languageOneOf))
    if (obj.categoryOneOf !== undefined) this.categoryOneOf = splitIntoArray(escapeIfNeeded(obj.categoryOneOf))

    if (obj.scope !== undefined) this.scope = escapeIfNeeded(obj.scope) as VideoFilterScope
    if (obj.allVideos !== undefined) this.allVideos = toBoolean(obj.allVideos)

    if (obj.live !== undefined) this.live = escapeIfNeeded(obj.live) as BooleanBothQuery

    if (obj.search !== undefined) this.search = escapeIfNeeded(obj.search)

    this.buildActiveFilters()
  }

  buildActiveFilters () {
    this.activeFilters = []

    this.activeFilters.push({
      key: 'nsfw',
      canRemove: false,
      label: $localize`Sensitive content`,
      value: this.getNSFWValue()
    })

    this.activeFilters.push({
      key: 'scope',
      canRemove: false,
      label: $localize`Scope`,
      value: this.scope === 'federated'
        ? $localize`Federated`
        : $localize`Local`
    })

    if (this.languageOneOf && this.languageOneOf.length !== 0) {
      this.activeFilters.push({
        key: 'languageOneOf',
        canRemove: true,
        label: $localize`Languages`,
        value: this.languageOneOf.map(l => l.toUpperCase()).join(', ')
      })
    }

    if (this.categoryOneOf && this.categoryOneOf.length !== 0) {
      this.activeFilters.push({
        key: 'categoryOneOf',
        canRemove: true,
        label: $localize`Categories`,
        value: this.categoryOneOf.join(', ')
      })
    }

    if (this.allVideos) {
      this.activeFilters.push({
        key: 'allVideos',
        canRemove: true,
        label: $localize`All videos`
      })
    }

    if (this.live === 'true') {
      this.activeFilters.push({
        key: 'live',
        canRemove: true,
        label: $localize`Live videos`
      })
    } else if (this.live === 'false') {
      this.activeFilters.push({
        key: 'live',
        canRemove: true,
        label: $localize`VOD videos`
      })
    }

    this.activeFilters = this.activeFilters
                             .filter(a => this.hiddenFields.includes(a.key) === false)
  }

  getActiveFilters () {
    return this.activeFilters
  }

  toFormObject (): VideoFiltersKeys {
    const result: Partial<VideoFiltersKeys> = {}

    for (const [ key ] of this.defaultValues) {
      result[key] = this[key]
    }

    return result as VideoFiltersKeys
  }

  toUrlObject () {
    const result: { [ id: string ]: any } = {}

    for (const [ key, defaultValue ] of this.defaultValues) {
      if (this[key] !== defaultValue) {
        result[key] = this[key]
      }
    }

    return result
  }

  toVideosAPIObject () {
    let isLocal: boolean
    let include: VideoInclude
    let privacyOneOf: VideoPrivacy[]

    if (this.scope === 'local') {
      isLocal = true
    }

    if (this.allVideos) {
      include = VideoInclude.NOT_PUBLISHED_STATE
      privacyOneOf = getAllPrivacies()
    }

    let isLive: boolean
    if (this.live === 'true') isLive = true
    else if (this.live === 'false') isLive = false

    return {
      sort: this.sort,
      nsfw: this.nsfw,
      languageOneOf: this.languageOneOf,
      categoryOneOf: this.categoryOneOf,
      search: this.search,
      isLocal,
      include,
      privacyOneOf,
      isLive
    }
  }

  getNSFWDisplayLabel () {
    if (this.defaultNSFWPolicy === 'blur') return $localize`Blurred`

    return $localize`Displayed`
  }

  private getNSFWValue () {
    if (this.nsfw === 'false') return $localize`hidden`
    if (this.defaultNSFWPolicy === 'blur') return $localize`blurred`

    return $localize`displayed`
  }

  private updateDefaultNSFW (nsfwPolicy: NSFWPolicyType) {
    const nsfw = nsfwPolicy === 'do_not_list'
      ? 'false'
      : 'both'

    this.defaultValues.set('nsfw', nsfw)
    this.defaultNSFWPolicy = nsfwPolicy

    this.reset('nsfw')
  }
}
