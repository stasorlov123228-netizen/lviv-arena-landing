

type PlainObject = Record<string, unknown>

export function isObject(item: unknown): item is PlainObject {
  return typeof item === 'object' && !Array.isArray(item)
}

export default function deepMerge<T, R>(target: T, source: R): T {
  const output = { ...(target as object) } as PlainObject
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      const sourceValue = source[key]
      if (isObject(sourceValue)) {
        if (!(key in target)) {
          Object.assign(output, { [key]: sourceValue })
        } else {
          output[key] = deepMerge(target[key], sourceValue)
        }
      } else {
        Object.assign(output, { [key]: sourceValue })
      }
    })
  }

  return output as T
}
