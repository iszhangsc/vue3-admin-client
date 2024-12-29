import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
  AxiosResponse,
  AxiosError
} from 'axios'
import { ResultData } from './interface'
import { useUserStore } from '@/store/modules/user'
import router from '@/router'
import { LOGIN_URL } from '@/config'
import { ElMessage } from 'element-plus'

const config: AxiosRequestConfig = {
  // 默认地址请求地址，可在 .env.** 文件中修改
  baseURL: import.meta.env.VITE_API_URL as string,
  // 设置超时时间
  timeout: 30000
}

class Http {
  private static axiosInstance: AxiosInstance

  constructor(config: AxiosRequestConfig) {
    Http.axiosInstance = axios.create(config)
    this.interceptorsRequest()
    this.interceptorsResponse()
  }

  //请求拦截器
  private interceptorsRequest() {
    Http.axiosInstance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        // 为请求头对象，添加 Token 验证的 Authorization 字段
        const userStore = useUserStore()
        if (userStore.token) {
          config.headers.Authorization = userStore.token
        }
        return config
      },
      (error: string) => {
        return Promise.reject(error)
      }
    )
  }

  //响应拦截器
  private interceptorsResponse() {
    Http.axiosInstance.interceptors.response.use(
      async (response: AxiosResponse) => {
        const { code, msg, data } = response.data
        switch (code) {
          case 200:
            return response.data
          case 40100:
            ElMessage.warning('登录失效')
            useUserStore().setTokenWithExpires('', 0)
            await router.replace(LOGIN_URL)
            break
          case 50000:
            ElMessage.error('服务器内部错误，请稍后重试')
            break
          default:
            ElMessage.error(msg)
        }
        // 抛出错误，业务层捕获
        return Promise.reject({ code, msg, data })
      },
      (error: AxiosError) => {
        // 处理 HTTP 层面的错误（非业务错误）
        if (error.response) {
          // 服务端返回的错误
          ElMessage.error(`请求失败: ${error.response.status} ${error.response.statusText}`)
        } else if (error.request) {
          // 无响应
          ElMessage.error('服务器无响应，请稍后重试')
        } else {
          // 请求配置问题或其它错误
          ElMessage.error(`请求异常: ${error.message}`)
        }
        console.error('网络异常或服务器无响应', error)
        return Promise.reject(error)
      }
    )
  }

  get<T>(url: string, params?: object, _object = {}): Promise<ResultData<T>> {
    return Http.axiosInstance.get(url, { params, ..._object })
  }

  post<T>(url: string, params?: object | string, _object = {}): Promise<ResultData<T>> {
    return Http.axiosInstance.post(url, params, _object)
  }

  put<T>(url: string, params?: object, _object = {}): Promise<ResultData<T>> {
    return Http.axiosInstance.put(url, params, _object)
  }

  delete<T>(url: string, params?: any, _object = {}): Promise<ResultData<T>> {
    return Http.axiosInstance.delete(url, { params, ..._object })
  }
}

export default new Http(config)
