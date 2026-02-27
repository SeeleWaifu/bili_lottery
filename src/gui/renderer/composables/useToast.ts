import { ref } from 'vue';

export interface ToastItem {
    id: number;
    message: string;
    type: 'error' | 'warn' | 'info';
}

const toasts = ref<ToastItem[]>([]);
let nextId = 0;

function show(message: string, type: ToastItem['type'] = 'error', duration = 4000) {
    const id = nextId++;
    toasts.value.push({ id, message, type });
    setTimeout(() => {
        toasts.value = toasts.value.filter(t => t.id !== id);
    }, duration);
}

export function useToast() {
    return {
        toasts,
        show,
        error: (msg: string) => show(msg, 'error'),
        warn: (msg: string) => show(msg, 'warn'),
        info: (msg: string) => show(msg, 'info'),
    };
}
