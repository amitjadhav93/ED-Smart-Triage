const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

export class ApiError extends Error {
  constructor(message, code, status) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  let res
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    })
  } catch (networkErr) {
    throw new ApiError(
      'Could not reach the triage server. Check that the backend is running and reachable.',
      'NETWORK_ERROR',
      0
    )
  }

  let data = null
  const text = await res.text()
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      
    }
  }

  if (!res.ok) {
    const message = data?.error?.message || `Request failed (${res.status})`
    const code = data?.error?.code || (res.status === 401 ? 'UNAUTHORIZED' : 'UNKNOWN_ERROR')
    throw new ApiError(message, code, res.status)
  }

  return data
}


export const createPatient = (payload, token) =>
  request('/patients', { method: 'POST', body: payload, token })

export const listPatients = () => request('/patients')

export const getPatient = (id) => request(`/patients/${id}`)

export const overridePatient = (id, payload, token) =>
  request(`/patients/${id}/override`, { method: 'POST', body: payload, token })

export const retriagePatient = (id, token) =>
  request(`/patients/${id}/retriage`, { token })

export const updatePatientStatus = (id, status, token) =>
  request(`/patients/${id}/status`, { method: 'PATCH', body: { status }, token })

export const updatePatientVitals = (id, payload, token) =>
  request(`/patients/${id}/vitals`, { method: 'PATCH', body: payload, token })

// ---- Audit / stats / validation / beds / integration / config ----
export const getAuditLog = () => request('/audit-log')

export const getStats = () => request('/stats')

export const getValidationReport = () => request('/validation-report')

export const getBeds = () => request('/beds')

export const getIntegrationStatus = () => request('/integration/status')

export const getTrustMetrics = () => request('/trust-metrics')

export const getConfig = () => request('/config')

// ---- Surge ----
export const startSurge = (count, token) =>
  request('/surge', { method: 'POST', body: { count }, token })

export const endSurge = (token) =>
  request('/surge/end', { method: 'POST', token })

export const getSurgeStatus = () => request('/surge/status')
