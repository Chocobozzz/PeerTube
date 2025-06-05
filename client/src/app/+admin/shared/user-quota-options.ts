import { SelectOptionsItem } from '../../../types/select-options-item.model'

export function getVideoQuotaOptions (): SelectOptionsItem<number>[] {
  return [
    { id: -1, label: $localize`Unlimited` },
    { id: 0, label: $localize`None - no upload possible` },
    { id: 100 * 1024 * 1024, label: $localize`100MB` },
    { id: 500 * 1024 * 1024, label: $localize`500MB` },
    { id: 1024 * 1024 * 1024, label: $localize`1GB` },
    { id: 5 * 1024 * 1024 * 1024, label: $localize`5GB` },
    { id: 20 * 1024 * 1024 * 1024, label: $localize`20GB` },
    { id: 50 * 1024 * 1024 * 1024, label: $localize`50GB` },
    { id: 100 * 1024 * 1024 * 1024, label: $localize`100GB` },
    { id: 200 * 1024 * 1024 * 1024, label: $localize`200GB` },
    { id: 500 * 1024 * 1024 * 1024, label: $localize`500GB` }
  ]
}

export function getVideoQuotaDailyOptions (): SelectOptionsItem<number>[] {
  return [
    { id: -1, label: $localize`Unlimited` },
    { id: 0, label: $localize`None - no upload possible` },
    { id: 10 * 1024 * 1024, label: $localize`10MB` },
    { id: 50 * 1024 * 1024, label: $localize`50MB` },
    { id: 100 * 1024 * 1024, label: $localize`100MB` },
    { id: 500 * 1024 * 1024, label: $localize`500MB` },
    { id: 2 * 1024 * 1024 * 1024, label: $localize`2GB` },
    { id: 5 * 1024 * 1024 * 1024, label: $localize`5GB` },
    { id: 10 * 1024 * 1024 * 1024, label: $localize`10GB` },
    { id: 20 * 1024 * 1024 * 1024, label: $localize`20GB` },
    { id: 50 * 1024 * 1024 * 1024, label: $localize`50GB` }
  ]
}
