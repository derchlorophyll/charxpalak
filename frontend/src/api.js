const API_BASE = '/api';

function getHeaders() {
  const token = localStorage.getItem('charxpalak_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getHeaders(),
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Сервер билан алоқа хатоси юз берди');
  }

  return data;
}

export const api = {
  // Auth & Registration
  sendOtp: (phone) => request('/auth/send-otp', { method: 'POST', body: JSON.stringify({ phone }) }),
  verifyOtp: (phone, code) => request('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ phone, code }) }),
  verifyPin: (phone, pin) => request('/auth/verify-pin', { method: 'POST', body: JSON.stringify({ phone, pin }) }),
  setPin: (pin) => request('/auth/set-pin', { method: 'POST', body: JSON.stringify({ pin }) }),
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  fastLogin: (userId) => request('/auth/fast-login', { method: 'POST', body: JSON.stringify({ userId }) }),
  getMe: () => request('/auth/me'),

  // Transactions
  getTransactions: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/transactions?${qs}`);
  },
  createTransaction: (data) => request('/transactions', { method: 'POST', body: JSON.stringify(data) }),
  confirmTransaction: (id) => request(`/transactions/${id}/confirm`, { method: 'POST' }),
  rejectTransaction: (id, reason) => request(`/transactions/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),

  // Employees & Approvals (Top 3)
  getEmployees: () => request('/employees'),
  getPendingEmployees: () => request('/employees/pending'),
  approveEmployee: (id) => request(`/employees/${id}/approve`, { method: 'POST' }),
  rejectEmployeeRegistration: (id) => request(`/employees/${id}/reject-registration`, { method: 'POST' }),
  createEmployee: (data) => request('/employees', { method: 'POST', body: JSON.stringify(data) }),
  updateEmployee: (id, data) => request(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  toggleEmployeeStatus: (id) => request(`/employees/${id}`, { method: 'DELETE' }),

  // Stats & Settings
  getStats: () => request('/stats'),
  getSettings: () => request('/settings'),
  saveSettings: (data) => request('/settings', { method: 'POST', body: JSON.stringify(data) })
};
