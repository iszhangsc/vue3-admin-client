<template>
  <div class="notification"></div>
</template>
<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import { ElNotification } from 'element-plus'
import webSocketInstance from '@/main'

defineOptions({
  name: 'GlobalNotification'
})
onMounted(() => {
  webSocketInstance.initWebSocket()

  // 添加监听器
  webSocketInstance.addMessageListener('NOTIFICATION', (data) => {
    console.log('Received data:', data)
    ElNotification({
      type: data.type,
      title: data.title,
      message: data.message,
      duration: 0,
      offset: 100
    })
  })
})

onBeforeUnmount(() => {
  webSocketInstance.closeWebSocket()
})
</script>

<style lang="scss"></style>
