<template>
    <main class="page">
        <section class="qr-panel">
            <div class="qr-box">
                <img v-if="qrImageDataUrl" :src="qrImageDataUrl" alt="qr-code" class="qr-image" />
                <div v-else class="qr-loading">二维码生成中...</div>
            </div>
            <p class="tip">请使用哔哩哔哩 App 扫码登录</p>
            <p class="status">{{ statusText }}</p>
            <button type="button" class="link-btn" @click="refreshQrCode">刷新二维码</button>
        </section>

        <section class="form-panel">
            <h1>账号密码登录</h1>
            <input type="text" class="input" placeholder="请输入账号" />
            <input type="password" class="input" placeholder="请输入密码" />
            <button type="button" class="submit-btn" disabled>登录（暂未实现）</button>
        </section>
    </main>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import QRCode from 'qrcode';
import { QrCodeStatus } from '../../types';
import "../env.d.ts"
const statusText = ref('正在初始化二维码...');
const qrImageDataUrl = ref('');
const qrCodeKey = ref('');
let timer: ReturnType<typeof setInterval> | undefined;

function stopPolling() {
    if (timer) {
        clearInterval(timer);
        timer = undefined;
    }
}

async function pollQrStatus() {
    if (!qrCodeKey.value) {
        return;
    }

    const result = await window.api.pollQrLoginStatus(qrCodeKey.value);
    if (result.isErr()) {
        statusText.value = `轮询失败: ${result.error.message}`;
        return;
    }

    switch (result.value) {
        case QrCodeStatus.waiting:
            statusText.value = '等待扫码...';
            break;
        case QrCodeStatus.scanned:
            statusText.value = '已扫码，等待确认...';
            break;
        case QrCodeStatus.success:
            statusText.value = '登录成功，正在关闭窗口...';
            stopPolling();
            break;
        case QrCodeStatus.expired:
            statusText.value = '二维码已过期，请刷新。';
            stopPolling();
            break;
        default:
            statusText.value = `未知状态: ${result.value}`;
            break;
    }
}

async function refreshQrCode() {
    stopPolling();
    statusText.value = '正在获取二维码...';

    const qrResult = await window.api.startQrLogin();
    if (qrResult.isErr()) {
        statusText.value = `获取二维码失败: ${qrResult.error.message}`;
        return;
    }

    qrCodeKey.value = qrResult.value.qrCodeKey;
    qrImageDataUrl.value = await QRCode.toDataURL(qrResult.value.url, {
        width: 230,
        margin: 1,
    });
    statusText.value = '等待扫码...';

    timer = setInterval(() => {
        void pollQrStatus();
    }, 1200);
}

onMounted(async () => {
    await refreshQrCode();
});

onUnmounted(() => {
    stopPolling();
});
</script>

<style scoped>
.page {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    padding: 24px;
    font-family: system-ui, -apple-system, sans-serif;
}

.qr-panel,
.form-panel {
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 18px;
    background: #fff;
}

.qr-panel {
    display: grid;
    justify-items: center;
    align-content: start;
    gap: 10px;
}

.qr-box {
    width: 240px;
    height: 240px;
    display: grid;
    place-items: center;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    background: #fafafa;
}

.qr-image {
    width: 230px;
    height: 230px;
}

.qr-loading {
    color: #6b7280;
    font-size: 13px;
}

.tip {
    margin: 0;
    color: #111827;
}

.status {
    margin: 0;
    color: #4b5563;
    font-size: 13px;
}

.link-btn {
    border: 0;
    background: transparent;
    color: #2563eb;
    cursor: pointer;
}

.form-panel {
    display: grid;
    align-content: start;
    gap: 10px;
}

h1 {
    margin: 0 0 10px;
    font-size: 20px;
}

.input {
    height: 36px;
    padding: 0 10px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
}

.submit-btn {
    height: 36px;
    border: 0;
    border-radius: 8px;
    background: #2563eb;
    color: #fff;
    opacity: 0.6;
}
</style>
