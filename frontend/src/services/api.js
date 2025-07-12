import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://192.168.1.4:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
};

export const audioAPI = {
  sendAudio: (formData) => api.post('/audio/send', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getMessages: () => api.get('/audio/messages'),
  respondToMessage: (id, formData) => api.post(`/audio/respond/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  respondWithText: (id, textResponse) => api.post(`/audio/respond-text/${id}`, { textResponse }),
  getAudioUrl: (s3Key) => api.get(`/audio/play/${s3Key}`),
};

export default api;