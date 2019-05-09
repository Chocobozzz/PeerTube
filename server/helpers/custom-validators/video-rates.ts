function isRatingValid (value: any) {
  return value === 'like' || value === 'dislike'
}

export { isRatingValid }
