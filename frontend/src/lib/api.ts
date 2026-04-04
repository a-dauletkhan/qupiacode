function normalizePath(path: string) {
  if (/^https?:\/\//.test(path)) {
    return path
  }

  return path.startsWith("/") ? path : `/${path}`
}

function joinBaseUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, "")}${normalizePath(path)}`
}

export function getApiBaseUrl() {
  return (
    import.meta.env.VITE_API_BASE_URL?.trim() ||
    import.meta.env.VITE_VOICE_API_BASE_URL?.trim() ||
    ""
  )
}

export function getVoiceApiBaseUrl() {
  return (
    import.meta.env.VITE_VOICE_API_BASE_URL?.trim() || getApiBaseUrl()
  )
}

export function buildApiUrl(path: string, baseUrl?: string) {
  const normalizedPath = normalizePath(path)
  const resolvedBaseUrl = baseUrl?.trim() || getApiBaseUrl()

  if (!resolvedBaseUrl || /^https?:\/\//.test(normalizedPath)) {
    return normalizedPath
  }

  return joinBaseUrl(resolvedBaseUrl, normalizedPath)
}

export function buildVoiceApiUrl(path: string, baseUrl?: string) {
  const normalizedPath = normalizePath(path)
  const resolvedBaseUrl = baseUrl?.trim() || getVoiceApiBaseUrl()

  if (!resolvedBaseUrl || /^https?:\/\//.test(normalizedPath)) {
    return normalizedPath
  }

  return joinBaseUrl(resolvedBaseUrl, normalizedPath)
}
