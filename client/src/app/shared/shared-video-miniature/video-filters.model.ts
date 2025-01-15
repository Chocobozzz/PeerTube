import { splitIntoArray, toBoolean } from '@app/helpers'
import { getAllPrivacies } from '@peertube/peertube-core-utils'
import {
  BooleanBothQuery,
  NSFWPolicyType,
  VideoInclude,
  VideoIncludeType,
  VideoPrivacyType,
  VideoSortField
} from '@peertube/peertube-models'
import { AttributesOnly } from '@peertube/peertube-typescript-utils'

type VideoFiltersKeys = {
  [ id in keyof AttributesOnly<VideoFilters> ]: any
}

export type VideoFilterScope = 'local' | 'federated'

export type VideoFilterActive = {
  key: string
  canRemove: boolean
  label: string
  value?: string
  rawValue?: string[] | number[]
}

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
    [ 'live', 'both' ],
    [ 'search', '' ]
  ])

  private activeFilters: VideoFilterActive[] = []
  private defaultNSFWPolicy: NSFWPolicyType

  private onChangeCallbacks: (() => void)[] = []
  private oldFormObjectString: string

  private readonly hiddenFields: string[] = []

  constructor (defaultSort: string, defaultScope: VideoFilterScope, hiddenFields: string[] = []) {
    this.setDefaultSort(defaultSort)
    this.setDefaultScope(defaultScope)

    this.hiddenFields = hiddenFields

    this.reset()
  }

  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------

  setDefaultScope (scope: VideoFilterScope) {
    this.defaultValues.set('scope', scope)
  }

  setDefaultSort (sort: string) {
    this.defaultValues.set('sort', sort)
  }

  setNSFWPolicy (nsfwPolicy: NSFWPolicyType) {
    this.updateDefaultNSFW(nsfwPolicy)
  }

  // ---------------------------------------------------------------------------

  reset (specificKey?: string) {
    for (const [ key, value ] of this.defaultValues) {
      if (specificKey && specificKey !== key) continue

      (this as any)[key] = value
    }

    this.buildActiveFilters()
  }

  // ---------------------------------------------------------------------------

  load (obj: Partial<AttributesOnly<VideoFilters>>) {
    if (obj.sort !== undefined) this.sort = obj.sort

    if (obj.nsfw !== undefined) this.nsfw = obj.nsfw

    if (obj.languageOneOf !== undefined) this.languageOneOf = splitIntoArray(obj.languageOneOf)
    if (obj.categoryOneOf !== undefined) this.categoryOneOf = splitIntoArray(obj.categoryOneOf)

    if (obj.scope !== undefined) this.scope = obj.scope
    if (obj.allVideos !== undefined) this.allVideos = toBoolean(obj.allVideos)

    if (obj.live !== undefined) this.live = obj.live

    if (obj.search !== undefined) this.search = obj.search

    this.buildActiveFilters()
  }

  clone () {
    const cloned = new VideoFilters(this.defaultValues.get('sort'), this.defaultValues.get('scope'), this.hiddenFields)
    cloned.setNSFWPolicy(this.defaultNSFWPolicy)

    cloned.load(this.toUrlObject())

    return cloned
  }

  // ---------------------------------------------------------------------------

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
        ? $localize`All platforms`
        : $localize`This platform`
    })

    if (this.languageOneOf && this.languageOneOf.length !== 0) {
      this.activeFilters.push({
        key: 'languageOneOf',
        canRemove: true,
        label: $localize`Languages`,
        value: this.languageOneOf.map(l => l.toUpperCase()).join(', '),
        rawValue: this.languageOneOf
      })
    }

    if (this.categoryOneOf && this.categoryOneOf.length !== 0) {
      this.activeFilters.push({
        key: 'categoryOneOf',
        canRemove: true,
        label: $localize`Categories`,
        value: this.categoryOneOf.join(', '),
        rawValue: this.categoryOneOf
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
        label: $localize`Only lives`
      })
    } else if (this.live === 'false') {
      this.activeFilters.push({
        key: 'live',
        canRemove: true,
        label: $localize`Only VOD`
      })
    }

    this.activeFilters = this.activeFilters
                             .filter(a => this.hiddenFields.includes(a.key) === false)
  }

  getActiveFilters () {
    return this.activeFilters
  }

  // ---------------------------------------------------------------------------

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
    let include: VideoIncludeType
    let privacyOneOf: VideoPrivacyType[]

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

  // ---------------------------------------------------------------------------

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
