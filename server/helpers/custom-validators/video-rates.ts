function checkVideoRating (value: any) {
  if (![ 'like', 'dislike' ].includes(value)) throw new Error('Should have rating value be either "like" or "dislike"')
  return true
}

export { checkVideoRating }
