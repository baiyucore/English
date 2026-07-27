import axios from 'axios'
import type { Token } from '@en/common/user'
import type { Response } from '..'

const refreshServer = axios.create({
  baseURL: '/api/v1',
  timeout: 50000,
})

refreshServer.interceptors.response.use(response => {
  return response.data
},(error) => {
  return Promise.reject(error)
})

export const refreshTokenApi = (data: Omit<Token, 'accessToken'>) => {
  return refreshServer.post('/user/refresh-token', data) as Promise<Response<Token>>
}