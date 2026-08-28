const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

class ApiError extends Error {
  constructor(message, code, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch (networkErr) {
    throw new ApiError(
      "Could not reach the triage server. Check your connection and try again.",
      "NETWORK_ERROR",
      0
    );
  }

  let body = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!res.ok) {
    const message =
      body?.error?.message || `Request failed (${res.status}).`;
    const code = body?.error?.code || "UNKNOWN_ERROR";
    throw new ApiError(message, code, res.status);
  }

  return body;
}

export const api = {
  baseUrl: API_BASE_URL,

  createPatient(payload) {
    return request("/patients", { method: "POST", body: JSON.stringify(payload) });
  },
  listPatients() {
    return request("/patients");
  },
  getPatient(id) {
    return request(`/patients/${id}`);
  },
  overridePatient(id, payload) {
    return request(`/patients/${id}/override`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  retriagePatient(id) {
    return request(`/patients/${id}/retriage`);
  },
  setPatientStatus(id, status) {
    return request(`/patients/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  },
  getAuditLog() {
    return request("/audit-log");
  },
  triggerSurge(count) {
    return request("/surge", { method: "POST", body: JSON.stringify({ count }) });
  },
  getStats() {
    return request("/stats");
  },
  getValidationReport() {
    return request("/validation-report");
  },
};

export { ApiError };
