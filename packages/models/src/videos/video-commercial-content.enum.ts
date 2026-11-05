export const VideoCommercialContent = {
  NONE: 1,
  // The creator promotes their own products, services or business
  PROMOTIONAL: 2,
  // A third party paid, or provided goods or services, in exchange for the promotion
  PAID_PARTNERSHIP: 3
} as const

export type VideoCommercialContentType = typeof VideoCommercialContent[keyof typeof VideoCommercialContent]
