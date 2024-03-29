type Summary = {
  success: number
  duplicates: number
  errors: number
}

export interface UserImportResultSummary {
  stats: {
    blocklist: Summary
    channels: Summary
    likes: Summary
    dislikes: Summary
    following: Summary
    videoPlaylists: Summary
    videos: Summary

    account: Summary
    userSettings: Summary

    userVideoHistory: Summary

    watchedWordsLists: Summary
    commentAutoTagPolicies: Summary
  }
}
