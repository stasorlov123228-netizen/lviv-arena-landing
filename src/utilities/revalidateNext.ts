
export function revalidatePath(path: string): void {
  if (!process.env.NEXT_RUNTIME) return
  void import('next/cache').then(({ revalidatePath: revalidate }) => revalidate(path)).catch((error) => {
    console.error('Next path revalidation failed:', error)
  })
}

export function revalidateTag(tag: string, profile: string = 'max'): void {
  if (!process.env.NEXT_RUNTIME) return
  void import('next/cache').then(({ revalidateTag: revalidate }) => revalidate(tag, profile)).catch((error) => {
    console.error('Next tag revalidation failed:', error)
  })
}
