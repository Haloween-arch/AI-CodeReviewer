// src/services/history.js
import axios from "axios";

const API_BASE = "http://127.0.0.1:8000";

export async function getHistory(limit = 5) {
  const response = await axios.get(`${API_BASE}/history?limit=${limit}`);
  return response.data;
}
