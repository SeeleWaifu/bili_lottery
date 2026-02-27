<template>
    <Teleport to="body">
        <TransitionGroup name="toast" tag="div" class="toast-container">
            <div
                v-for="t in toasts"
                :key="t.id"
                class="toast-item"
                :class="`toast-${t.type}`"
            >
                {{ t.message }}
            </div>
        </TransitionGroup>
    </Teleport>
</template>

<script setup lang="ts">
import { useToast } from '../composables/useToast';

const { toasts } = useToast();
</script>

<style scoped>
.toast-container {
    position: fixed;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 99999;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    pointer-events: none;
}

.toast-item {
    pointer-events: auto;
    max-width: 480px;
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 13px;
    line-height: 1.5;
    color: #fff;
    box-shadow: 0 4px 12px rgb(0 0 0 / 15%);
    word-break: break-all;
}

.toast-error {
    background: #ef4444;
}

.toast-warn {
    background: #f59e0b;
    color: #1c1917;
}

.toast-info {
    background: #2563eb;
}

/* transitions */
.toast-enter-active,
.toast-leave-active {
    transition: all 0.3s ease;
}

.toast-enter-from {
    opacity: 0;
    transform: translateY(-12px);
}

.toast-leave-to {
    opacity: 0;
    transform: translateY(-12px);
}
</style>
