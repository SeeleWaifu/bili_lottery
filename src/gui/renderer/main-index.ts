import { createApp } from 'vue';

import './bridge.ts';
import IndexApp from './pages/IndexApp.vue';

createApp(IndexApp).mount('#app');
