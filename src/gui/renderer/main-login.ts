import { createApp } from 'vue';

import './bridge.ts';
import LoginApp from './pages/LoginApp.vue';

createApp(LoginApp).mount('#app');
