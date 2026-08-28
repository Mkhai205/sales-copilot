import { fetchApi } from './client';
import type {
  AuthTokensDto,
  LoginDto,
  LoginResponseDto,
  LogoutDto,
  RefreshTokenDto,
  UpdateUserProfileDto,
  UserDto,
} from '@sales-copilot/shared-contracts';

export const authApi = {
  login: (dto: LoginDto) =>
    fetchApi<LoginResponseDto>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  refresh: (dto: RefreshTokenDto) =>
    fetchApi<AuthTokensDto>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  logout: (dto: LogoutDto = {}) =>
    fetchApi<{ loggedOut: boolean }>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  me: () => fetchApi<UserDto>('/auth/me'),

  updateProfile: (dto: UpdateUserProfileDto) =>
    fetchApi<UserDto>('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),
};
