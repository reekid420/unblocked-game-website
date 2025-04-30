import axios from 'axios';

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    username: string;
  };
}

export interface RegisterResponse {
  token: string;
  user: {
    id: string;
    username: string;
  };
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const response = await axios.post('/api/users/login', { username, password });
  return response.data;
}

export async function register(username: string, password: string): Promise<RegisterResponse> {
  const response = await axios.post('/api/users/register', { username, password });
  return response.data;
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
}

export function isLoggedIn(): boolean {
  return Boolean(localStorage.getItem('token'));
}

export function getUsername(): string | null {
  return localStorage.getItem('username');
}
