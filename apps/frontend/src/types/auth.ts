export interface User {
  id: number;
  loginId: string;
  name: string;
  role: string;
}

export interface LoginRequest {
  loginId: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}
