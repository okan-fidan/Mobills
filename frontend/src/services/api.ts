import axios from 'axios';
import { auth } from '../config/firebase';

const BASE_URL = '';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  try {
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.error('Error getting auth token:', error);
  }
  return config;
});

export const postApi = {
  getAll: () => api.get('/api/posts'),
  getOne: (id: string) => api.get(`/api/posts/${id}`),
  create: (data: any) => api.post('/api/posts', data),
  like: (id: string) => api.post(`/api/posts/${id}/like`),
  delete: (id: string) => api.delete(`/api/posts/${id}`),
  getComments: (id: string) => api.get(`/api/posts/${id}/comments`),
  addComment: (id: string, data: any) => api.post(`/api/posts/${id}/comments`, data),
  share: (id: string) => api.post(`/api/posts/${id}/share`),
};

export const communityApi = {
  getAll: () => api.get('/api/communities'),
  getOne: (id: string) => api.get(`/api/communities/${id}`),
  join: (id: string) => api.post(`/api/communities/${id}/join`),
  leave: (id: string) => api.post(`/api/communities/${id}/leave`),
  getAnnouncements: (id: string) => api.get(`/api/communities/${id}/announcements`),
  createAnnouncement: (id: string, data: any) => api.post(`/api/communities/${id}/announcements`, data),
  deleteAnnouncement: (communityId: string, announcementId: string) => api.delete(`/api/communities/${communityId}/announcements/${announcementId}`),
  getSubgroups: (id: string) => api.get(`/api/communities/${id}/subgroups`),
};

export const subgroupApi = {
  getOne: (id: string) => api.get(`/api/subgroups/${id}`),
  join: (id: string) => api.post(`/api/subgroups/${id}/join`),
  requestJoin: (id: string) => api.post(`/api/subgroups/${id}/request-join`),
  leave: (id: string) => api.post(`/api/subgroups/${id}/leave`),
  getMessages: (id: string) => api.get(`/api/subgroups/${id}/messages`),
  sendMessage: (id: string, data: any) => api.post(`/api/subgroups/${id}/messages`, data),
  getPendingRequests: (id: string) => api.get(`/api/subgroups/${id}/pending-requests`),
  approveRequest: (subgroupId: string, userId: string) => api.post(`/api/subgroups/${subgroupId}/approve/${userId}`),
  rejectRequest: (subgroupId: string, userId: string) => api.post(`/api/subgroups/${subgroupId}/reject/${userId}`),
};

export const subgroupRequestApi = {
  request: (subgroupId: string) => api.post(`/api/subgroups/${subgroupId}/request-join`),
  approve: (subgroupId: string, userId: string) => api.post(`/api/subgroups/${subgroupId}/approve/${userId}`),
  reject: (subgroupId: string, userId: string) => api.post(`/api/subgroups/${subgroupId}/reject/${userId}`),
};

export const serviceApi = {
  getAll: (communityId?: string) => api.get(`/api/services${communityId ? `?community_id=${communityId}` : ''}`),
  getOne: (id: string) => api.get(`/api/services/${id}`),
  create: (data: any) => api.post('/api/services', data),
  update: (id: string, data: any) => api.put(`/api/services/${id}`, data),
  delete: (id: string) => api.delete(`/api/services/${id}`),
  getReviews: (id: string) => api.get(`/api/services/${id}/reviews`),
  addReview: (id: string, data: any) => api.post(`/api/services/${id}/reviews`, data),
};

export const userApi = {
  getProfile: () => api.get('/api/user/profile'),
  updateProfile: (data: any) => api.put('/api/user/profile', data),
  updateLocation: (data: any) => api.put('/api/user/location', data),
  getPrivacySettings: () => api.get('/api/user/privacy-settings'),
  updatePrivacySettings: (data: any) => api.put('/api/user/privacy-settings', data),
  savePushToken: (token: string) => api.post('/api/user/push-token', { token }),
};

export const userListApi = {
  getAll: () => api.get('/api/users'),
  getOne: (uid: string) => api.get(`/api/users/${uid}`),
  search: (query: string) => api.get(`/api/users/search?q=${query}`),
};

export const notificationApi = {
  getAll: () => api.get('/api/notifications'),
  markAsRead: (id: string) => api.put(`/api/notifications/${id}/read`),
  markAllAsRead: () => api.put('/api/notifications/read-all'),
  send: (data: any) => api.post('/api/notifications/send', data),
};

export const badgeApi = {
  getMyBadges: () => api.get('/api/badges/my-badges'),
  getDefinitions: () => api.get('/api/badges/definitions'),
  getLeaderboard: () => api.get('/api/badges/leaderboard'),
};

export const eventApi = {
  getAll: (params?: string) => api.get(`/api/events${params || ''}`),
  getOne: (id: string) => api.get(`/api/events/${id}`),
  create: (data: any) => api.post('/api/events', data),
  attend: (id: string) => api.post(`/api/events/${id}/attend`),
  unattend: (id: string) => api.post(`/api/events/${id}/unattend`),
};

export const generalApi = {
  getCities: () => api.get('/api/cities'),
};

export default api;
