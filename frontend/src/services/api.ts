import axios from 'axios';
import { auth } from '../config/firebase';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const userApi = {
  register: (data: any) => api.post('/user/register', data),
  getProfile: () => api.get('/user/profile'),
  updateProfile: (data: any) => api.put('/user/profile', data),
  isAdmin: () => api.get('/user/is-admin'),
};

export const communityApi = {
  getAll: () => api.get('/communities'),
  getOne: (id: string) => api.get(`/communities/${id}`),
  join: (id: string) => api.post(`/communities/${id}/join`),
  leave: (id: string) => api.post(`/communities/${id}/leave`),
  createSubgroup: (communityId: string, data: any) => api.post(`/communities/${communityId}/subgroups`, data),
  getAnnouncements: (id: string) => api.get(`/communities/${id}/announcements`),
  sendAnnouncement: (id: string, data: any) => api.post(`/communities/${id}/announcements`, data),
};

export const subgroupApi = {
  getOne: (id: string) => api.get(`/subgroups/${id}`),
  join: (id: string) => api.post(`/subgroups/${id}/join`),
  leave: (id: string) => api.post(`/subgroups/${id}/leave`),
  getMessages: (id: string) => api.get(`/subgroups/${id}/messages`),
  sendMessage: (id: string, data: any) => api.post(`/subgroups/${id}/messages`, data),
  deleteMessage: (groupId: string, messageId: string) => api.delete(`/subgroups/${groupId}/messages/${messageId}`),
  editMessage: (groupId: string, messageId: string, content: string) => api.put(`/subgroups/${groupId}/messages/${messageId}`, { content }),
};

export const messageApi = {
  delete: (id: string) => api.delete(`/messages/${id}`),
  getPrivate: (userId: string) => api.get(`/private-messages/${userId}`),
  sendPrivate: (data: any) => api.post('/private-messages', data),
};

export const userListApi = {
  getAll: () => api.get('/users'),
  getOne: (id: string) => api.get(`/users/${id}`),
};

export const postApi = {
  getAll: () => api.get('/posts'),
  create: (data: any) => api.post('/posts', data),
  like: (id: string) => api.post(`/posts/${id}/like`),
  getComments: (id: string) => api.get(`/posts/${id}/comments`),
  addComment: (id: string, data: any) => api.post(`/posts/${id}/comments`, data),
  delete: (id: string) => api.delete(`/posts/${id}`),
  getMy: () => api.get('/my-posts'),
};

export const serviceApi = {
  getAll: () => api.get('/services'),
  create: (data: any) => api.post('/services', data),
  delete: (id: string) => api.delete(`/services/${id}`),
};

export const generalApi = {
  getCities: () => api.get('/cities'),
};

// Subgroup request-join API
export const subgroupRequestApi = {
  requestJoin: (subgroupId: string) => api.post(`/subgroups/${subgroupId}/request-join`),
  approve: (subgroupId: string, userId: string) => api.post(`/subgroups/${subgroupId}/approve/${userId}`),
  reject: (subgroupId: string, userId: string) => api.post(`/subgroups/${subgroupId}/reject/${userId}`),
  getPendingRequests: (subgroupId: string) => api.get(`/subgroups/${subgroupId}/pending-requests`),
};

// Admin API
export const adminApi = {
  // Dashboard
  getDashboard: () => api.get('/admin/dashboard'),
  
  // Users
  getUsers: (search?: string) => api.get(`/admin/users${search ? `?search=${search}` : ''}`),
  banUser: (userId: string) => api.post(`/admin/users/${userId}/ban`),
  unbanUser: (userId: string) => api.post(`/admin/users/${userId}/unban`),
  restrictUser: (userId: string, data: { hours: number; reason?: string }) => api.post(`/admin/users/${userId}/restrict`, data),
  unrestrictUser: (userId: string) => api.post(`/admin/users/${userId}/unrestrict`),
  makeAdmin: (userId: string) => api.post(`/admin/users/${userId}/make-admin`),
  removeAdmin: (userId: string) => api.post(`/admin/users/${userId}/remove-admin`),
  deleteUserMessages: (userId: string, data: { hours: number }) => api.delete(`/admin/users/${userId}/messages`, { data }),
  
  // Communities
  getCommunities: () => api.get('/admin/communities'),
  createCommunity: (data: { name: string; city: string; description?: string }) => api.post('/admin/communities', data),
  updateCommunity: (communityId: string, data: { name?: string; description?: string; imageUrl?: string }) => api.put(`/admin/communities/${communityId}`, data),
  deleteCommunity: (communityId: string) => api.delete(`/admin/communities/${communityId}`),
  getCommunityMembers: (communityId: string) => api.get(`/admin/communities/${communityId}/members`),
  banFromCommunity: (communityId: string, userId: string) => api.post(`/admin/communities/${communityId}/ban/${userId}`),
  kickFromCommunity: (communityId: string, userId: string) => api.post(`/admin/communities/${communityId}/kick/${userId}`),
  addSuperAdmin: (communityId: string, userId: string) => api.post(`/admin/communities/${communityId}/super-admin/${userId}`),
  removeSuperAdmin: (communityId: string, userId: string) => api.delete(`/admin/communities/${communityId}/super-admin/${userId}`),
  
  // Subgroups
  updateSubgroup: (subgroupId: string, data: { name?: string; description?: string; imageUrl?: string }) => api.put(`/admin/subgroups/${subgroupId}`, data),
  deleteSubgroup: (subgroupId: string) => api.delete(`/admin/subgroups/${subgroupId}`),
  getSubgroupMembers: (subgroupId: string) => api.get(`/admin/subgroups/${subgroupId}/members`),
  
  // Join Requests
  getAllJoinRequests: (communityId?: string) => api.get(`/admin/subgroup-join-requests${communityId ? `?community_id=${communityId}` : ''}`),
};

export default api;
