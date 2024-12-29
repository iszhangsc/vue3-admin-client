import { useUserStore } from '@/store/modules/user'

export default class WebSocketService {
  private readonly url: string
  private socket: WebSocket | null = null
  private readonly reconnectInterval: number
  private reconnectAttempts: number
  private readonly maxReconnectAttempts: number
  private listeners: Map<string, ((data: any) => void)[]> // 更加明确的类型
  private readonly heartbeatInterval: number
  private heartbeatTimer: number | NodeJS.Timeout | null = null // 使用 null 作为初始值
  private readonly heartbeatTimeout: number
  private heartbeatTimeoutTimer: number | NodeJS.Timeout | null = null // 使用 null 作为初始值

  constructor(basePath = '/ws') {
    this.url = this.buildWebSocketURL(basePath)
    this.reconnectInterval = 5000 // 重连间隔时间
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 10 // 最大重连次数
    this.listeners = new Map() // 事件监听器

    // 心跳检测相关
    this.heartbeatInterval = 30000 // 心跳间隔时间 30s
    this.heartbeatTimeout = 10000 // 心跳超时时间 10s
  }

  // 初始化 WebSocket
  initWebSocket() {
    if (this.socket) return
    console.log('WebSocket init: url:', this.url)

    let userStore = useUserStore()
    if (!userStore.token) {
      console.log('WebSocket init token 为空')
      return
    }

    this.socket = new WebSocket(this.url + '?token=' + userStore.token)

    // WebSocket 事件绑定
    this.socket.onopen = () => {
      console.log('WebSocket connected')
      this.reconnectAttempts = 0
      this.startHeartbeat() // 开始心跳检测
    }

    this.socket.onmessage = (event) => {
      const data = JSON.parse(event.data)
      const { cmd } = data

      // 如果是心跳响应，清除心跳超时定时器
      if (cmd === 'PONG') {
        console.log('收到心跳响应')
        if (this.heartbeatTimeoutTimer) clearTimeout(this.heartbeatTimeoutTimer)
        return
      }

      if (this.listeners.has(cmd)) {
        const callbacks = this.listeners.get(cmd)
        callbacks?.forEach((callback) => callback(data))
      }
    }

    this.socket.onclose = () => {
      console.log('WebSocket closed, attempting to reconnect...')
      this.socket = null
      this.stopHeartbeat() // 停止心跳检测
      this.reconnect()
    }

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error)
      if (this.socket) this.socket.close()
    }
  }

  // 关闭 WebSocket
  closeWebSocket() {
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
    this.stopHeartbeat() // 停止心跳检测
  }

  // 重连逻辑
  reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts && !this.socket) {
      setTimeout(() => {
        console.log(`Reconnecting attempt #${this.reconnectAttempts + 1}`)
        this.reconnectAttempts++
        this.initWebSocket()
      }, this.reconnectInterval)
    } else {
      console.error('达到最大重连次数，停止重连。')
    }
  }

  // 发送消息
  sendMessage(message: string) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message))
    } else {
      console.error('WebSocket is not connected.')
    }
  }

  // 添加消息监听器
  addMessageListener(type: string, callback: (data: any) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, [])
    }
    const callbacks = this.listeners.get(type)
    callbacks?.push(callback)
  }

  // 移除消息监听器
  removeMessageListener(type: string, callback: (data: any) => void) {
    if (this.listeners.has(type)) {
      const callbacks = this.listeners.get(type)
      const index = callbacks?.indexOf(callback)
      if (index && index !== -1) callbacks?.splice(index, 1)
    }
  }

  // 构建 WebSocket URL
  buildWebSocketURL(basePath: string) {
    const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://'
    const host = window.location.hostname
    const port = protocol === 'wss://' ? 443 : 1025
    return `${protocol}${host}:${port}${basePath}`
  }

  // 开始心跳检测
  startHeartbeat() {
    this.stopHeartbeat() // 清理旧的定时器
    this.heartbeatTimer = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        console.log('发送心跳消息')
        this.socket.send(JSON.stringify({ cmd: 'PING' })) // 发送心跳消息
        this.startHeartbeatTimeout() // 开始心跳超时检测
      }
    }, this.heartbeatInterval)
  }

  // 停止心跳检测
  stopHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    if (this.heartbeatTimeoutTimer) clearTimeout(this.heartbeatTimeoutTimer)
    this.heartbeatTimer = null
    this.heartbeatTimeoutTimer = null
  }

  // 开始心跳超时检测
  startHeartbeatTimeout() {
    if (this.heartbeatTimeoutTimer) clearTimeout(this.heartbeatTimeoutTimer)
    this.heartbeatTimeoutTimer = setTimeout(() => {
      console.error('心跳超时，关闭连接并尝试重连...')
      if (this.socket) this.socket.close() // 触发重连逻辑
    }, this.heartbeatTimeout)
  }
}
