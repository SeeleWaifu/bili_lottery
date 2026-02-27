<template>
    <main class="page">
        <section class="login-panel">
            <!-- Loading: before first onLogin event -->
            <div v-if="!loginChecked" class="login-tag login-loading">
                <span class="loading-spinner"></span>
                <span class="loading-text">正在检查登录状态…</span>
            </div>
            <!-- Not logged in -->
            <button v-else-if="!loginStatus.isLogin" type="button" class="action-btn" @click="goLogin">
                登录
            </button>
            <!-- Logged in -->
            <div v-else class="login-tag">
                <img
                    v-if="loginStatus.user?.avatar"
                    :src="loginStatus.user.avatar"
                    alt="avatar"
                    class="avatar"
                />
                <span class="user-text">
                    <span class="user-name">{{ loginStatus.user?.name }}</span>
                    <span class="uid">uid: {{ loginStatus.user?.uid }}</span>
                </span>
                <button
                    type="button"
                    class="logout-btn"
                    title="退出登录"
                    :disabled="isLoggingOut"
                    @click="onLogout"
                >退出</button>
            </div>
        </section>

        <section class="config-panel">
            <span class="config-path" :title="configPath">{{ configPath }}</span>
            <button type="button" class="action-btn" @click="onSelectConfig">选择配置</button>
        </section>

        <section class="workspace">
            <h1>抽奖面板</h1>

            <div class="source-row">
                <input v-model="oid" class="input" type="text" placeholder="oid" />
                <input v-model="type" class="input" type="text" placeholder="type" />
                <input v-model="mode" class="input" type="text" placeholder="mode (默认 2)" />
                <button type="button" class="action-btn" @click="onLoadCandidates" :disabled="isLoadingCandidates || isEnrichingRelations">加载初始用户</button>
            </div>

            <div class="enrich-row" v-if="allUsers.length > 0">
                <button
                    type="button"
                    class="action-btn"
                    :disabled="isEnrichingRelations || isLoadingCandidates"
                    @click="onEnrichRelations"
                >{{ enrichedCount > 0 && enrichedCount < allUsers.length ? '继续加载关系' : '加载关系' }}</button>
                <button
                    v-if="isEnrichingRelations"
                    type="button"
                    class="action-btn stop-btn"
                    @click="onStopEnrich"
                >停止</button>
                <span class="enrich-progress">
                    <span class="progress-bar" :style="{ width: enrichProgress + '%' }"></span>
                </span>
                <span class="enrich-text">{{ enrichedCount }} / {{ allUsers.length }}</span>
                <span v-if="enrichError" class="enrich-warn">⚠️ 部分加载失败，可使用已有数据筛选</span>
            </div>

            <div class="filters">
                <label :class="{ 'filter-disabled': !canUseRelationFilters }"><input type="checkbox" :checked="filters.none" :disabled="!canUseRelationFilters" @change="onToggle('none', $event)" />无关系</label>
                <label :class="{ 'filter-disabled': !canUseRelationFilters }"><input type="checkbox" :checked="filters.fan" :disabled="!canUseRelationFilters" @change="onToggle('fan', $event)" />粉丝</label>
                <label :class="{ 'filter-disabled': !canUseRelationFilters }"><input type="checkbox" :checked="filters.follow" :disabled="!canUseRelationFilters" @change="onToggle('follow', $event)" />已关注</label>
                <label :class="{ 'filter-disabled': !canUseRelationFilters }"><input type="checkbox" :checked="filters.mutual" :disabled="!canUseRelationFilters" @change="onToggle('mutual', $event)" />互相关注</label>
                <label><input type="checkbox" :checked="filters.likedBySelf" @change="onToggle('likedBySelf', $event)" />被自己点赞</label>
                <label><input type="checkbox" :checked="filters.likedByUp" @change="onToggle('likedByUp', $event)" />被 up 点赞</label>
            </div>

            <div class="action-row">
                <button type="button" class="action-btn" @click="applyFilters">应用筛选条件</button>
                <span class="hit-tag">预计命中 {{ currentMatchedCount }} 人</span>
                <input
                    v-model.number="winnerCount"
                    class="input winner-input"
                    type="number"
                    min="1"
                    placeholder="中奖人数"
                />
                <button type="button" class="action-btn" @click="drawWinners">抽奖</button>
            </div>

            <div class="lists">
                <!-- 候选池 -->
                <div class="list-col list-pool">
                    <div class="list-header">
                        <h2>候选池 ({{ poolUsers.length }})</h2>
                        <div class="list-actions">
                            <button
                                type="button"
                                class="sm-btn"
                                @click="toggleSelectAllPool"
                            >{{ isAllPoolSelected ? '取消全选' : '全选' }}</button>
                            <button
                                type="button"
                                class="sm-btn sm-btn-move"
                                :disabled="poolSelected.size === 0"
                                @click="moveSelectedToDrawPool"
                            >移入抽奖池 →</button>
                        </div>
                    </div>
                    <div class="list-body">
                        <p v-if="poolUsers.length === 0" class="empty">暂无数据</p>
                        <article
                            v-for="user in poolUsers"
                            :key="`pool-${user.uid}`"
                            class="user-tag"
                            :class="{ 'user-tag--selected': poolSelected.has(user.uid) }"
                        >
                            <input
                                type="checkbox"
                                class="user-check"
                                :checked="poolSelected.has(user.uid)"
                                @change="togglePoolSelect(user.uid)"
                            />
                            <img v-if="user.avatar" :src="user.avatar" alt="avatar" class="avatar" />
                            <div class="user-meta">
                                <a class="user-link" @click.prevent="openSpace(user.uid)">{{ user.uname }}</a>
                                <span class="uid">uid: {{ user.uid }}</span>
                            </div>
                            <button type="button" class="move-btn" title="移入抽奖池" @click="moveToDrawPool(user)">→</button>
                        </article>
                    </div>
                </div>

                <!-- 抽奖池 -->
                <div class="list-col list-draw">
                    <div class="list-header">
                        <h2>抽奖池 ({{ drawPool.length }})</h2>
                        <div class="list-actions">
                            <button
                                type="button"
                                class="sm-btn sm-btn-move"
                                :disabled="drawSelected.size === 0"
                                @click="moveSelectedToPool"
                            >← 移回候选池</button>
                            <button
                                type="button"
                                class="sm-btn"
                                @click="toggleSelectAllDraw"
                            >{{ isAllDrawSelected ? '取消全选' : '全选' }}</button>
                        </div>
                    </div>
                    <div class="list-body">
                        <p v-if="drawPool.length === 0" class="empty">暂无数据</p>
                        <article
                            v-for="user in drawPool"
                            :key="`draw-${user.uid}`"
                            class="user-tag"
                            :class="{ 'user-tag--selected': drawSelected.has(user.uid) }"
                        >
                            <button type="button" class="move-btn" title="移回候选池" @click="moveToPool(user)">←</button>
                            <input
                                type="checkbox"
                                class="user-check"
                                :checked="drawSelected.has(user.uid)"
                                @change="toggleDrawSelect(user.uid)"
                            />
                            <img v-if="user.avatar" :src="user.avatar" alt="avatar" class="avatar" />
                            <div class="user-meta">
                                <a class="user-link" @click.prevent="openSpace(user.uid)">{{ user.uname }}</a>
                                <span class="uid">uid: {{ user.uid }}</span>
                            </div>
                        </article>
                    </div>
                </div>

                <!-- 中奖 -->
                <div class="list-col list-winner">
                    <div class="list-header">
                        <h2>中奖用户 ({{ winnerUsers.length }})</h2>
                    </div>
                    <div class="list-body">
                        <p v-if="winnerUsers.length === 0" class="empty">暂无数据</p>
                        <article
                            v-for="user in winnerUsers"
                            :key="`winner-${user.uid}`"
                            class="user-tag"
                        >
                            <img v-if="user.avatar" :src="user.avatar" alt="avatar" class="avatar" />
                            <div class="user-meta">
                                <a class="user-link" @click.prevent="openSpace(user.uid)">{{ user.uname }}</a>
                                <span class="uid">uid: {{ user.uid }}</span>
                            </div>
                        </article>
                    </div>
                </div>
            </div>
        </section>
        <AppToast />
    </main>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import {
    filterCandidates,
    type LoginStatus,
    type Candidate,
    type FilterFlags,
    type LotteryRelation,
} from '../../types';
import AppToast from '../components/AppToast.vue';
import { useToast } from '../composables/useToast';
import "../env.d.ts"
const toast = useToast();

const loginStatus = ref<LoginStatus>({ isLogin: false });
const loginChecked = ref(false);
const isLoggingOut = ref(false);
const configPath = ref('配置文件: -');

const oid = ref('');
const type = ref('');
const mode = ref('2');

/** All loaded users — preserved as the single source of truth. */
const allUsers = ref<Candidate[]>([]);

/** 候选池: users NOT in the draw pool. */
const poolUsers = ref<Candidate[]>([]);

/** 抽奖池: users eligible for drawing. */
const drawPool = ref<Candidate[]>([]);

const winnerUsers = ref<Candidate[]>([]);
const winnerCount = ref(1);

// --- loading state ---
const isLoadingCandidates = ref(false);

// --- enrichment state ---
const isEnrichingRelations = ref(false);
const enrichedCount = ref(0);
const enrichError = ref(false);
let enrichAbortFlag = false;

const enrichProgress = computed(() => {
    if (allUsers.value.length === 0) return 0;
    return Math.round((enrichedCount.value / allUsers.value.length) * 100);
});

/** Relation checkboxes are usable only after at least partial enrichment. */
const canUseRelationFilters = computed(() => enrichedCount.value > 0 && !isEnrichingRelations.value);

// --- selection state ---
const poolSelected = reactive(new Set<string>());
const drawSelected = reactive(new Set<string>());

const isAllPoolSelected = computed(() => poolUsers.value.length > 0 && poolSelected.size === poolUsers.value.length);
const isAllDrawSelected = computed(() => drawPool.value.length > 0 && drawSelected.size === drawPool.value.length);

const filters = ref({
    none: false,
    fan: false,
    follow: false,
    mutual: false,
    likedBySelf: false,
    likedByUp: false,
});

const currentMatchedCount = computed(() => {
    const flags = buildFilterFlags();
    return filterCandidates(poolUsers.value, flags).matched.length;
});

// --- selection helpers ---
function togglePoolSelect(uid: string) {
    if (poolSelected.has(uid)) poolSelected.delete(uid);
    else poolSelected.add(uid);
}

function toggleDrawSelect(uid: string) {
    if (drawSelected.has(uid)) drawSelected.delete(uid);
    else drawSelected.add(uid);
}

function toggleSelectAllPool() {
    if (isAllPoolSelected.value) {
        poolSelected.clear();
    } else {
        poolUsers.value.forEach(u => poolSelected.add(u.uid));
    }
}

function toggleSelectAllDraw() {
    if (isAllDrawSelected.value) {
        drawSelected.clear();
    } else {
        drawPool.value.forEach(u => drawSelected.add(u.uid));
    }
}

// --- move helpers ---
function moveToDrawPool(user: Candidate) {
    poolUsers.value = poolUsers.value.filter(u => u.uid !== user.uid);
    drawPool.value.push(user);
    poolSelected.delete(user.uid);
}

function moveToPool(user: Candidate) {
    drawPool.value = drawPool.value.filter(u => u.uid !== user.uid);
    poolUsers.value.push(user);
    drawSelected.delete(user.uid);
}

function moveSelectedToDrawPool() {
    const toMove = poolUsers.value.filter(u => poolSelected.has(u.uid));
    poolUsers.value = poolUsers.value.filter(u => !poolSelected.has(u.uid));
    drawPool.value.push(...toMove);
    poolSelected.clear();
}

function moveSelectedToPool() {
    const toMove = drawPool.value.filter(u => drawSelected.has(u.uid));
    drawPool.value = drawPool.value.filter(u => !drawSelected.has(u.uid));
    poolUsers.value.push(...toMove);
    drawSelected.clear();
}

// --- open user space ---
async function openSpace(uid: string) {
    const result = await window.api.openExternal(`https://space.bilibili.com/${uid}`);
    if (result.isErr()) {
        toast.error(`打开链接失败: ${result.error.message}`);
    }
}

// --- existing logic (login, config, filters) ---
async function goLogin() {
    const result = await window.api.openLoginWindow();
    if (result.isErr()) {
        toast.error(`打开登录窗口失败: ${result.error.message}`);
    }
}

async function onLogout() {
    isLoggingOut.value = true;
    const result = await window.api.logout();
    isLoggingOut.value = false;
    if (result.isErr()) {
        toast.error(`退出登录失败: ${result.error.message}`);
    }
}

async function refreshConfigPath() {
    const result = await window.api.getConfigPath();
    result.match(
        path => {
            configPath.value = `配置文件: ${path}`;
        },
        error => {
            configPath.value = `配置文件: 读取失败 (${error.message})`;
        },
    );
}

async function onSelectConfig() {
    const pickResult = await window.api.pickConfigPath();
    if (pickResult.isErr()) {
        toast.error(`选择配置失败: ${pickResult.error.message}`);
        return;
    }

    const selectedPath = pickResult.value;
    if (!selectedPath) {
        return;
    }

    const updateResult = await window.api.updateConfig(selectedPath);
    updateResult.match(
        path => {
            refreshConfigPath();
            configPath.value = `配置文件: ${path}`;
        },
        error => {
            toast.error(`更新配置失败: ${error.message}`);
        },
    );
}

function onToggle(key: keyof typeof filters.value, event: Event) {
    filters.value[key] = (event.target as HTMLInputElement).checked;
}

function buildFilterFlags(): FilterFlags {
    const relations: LotteryRelation[] = (['none', 'fan', 'follow', 'mutual'] as const).filter(
        r => filters.value[r],
    );
    return {
        relations,
        likedBySelf: filters.value.likedBySelf,
        likedByUp: filters.value.likedByUp,
    };
}

/** Auto-filter: distribute ALL users into pool / drawPool, resetting manual adjustments. */
function applyFilters() {
    const flags = buildFilterFlags();
    const { matched, unmatched } = filterCandidates(poolUsers.value, flags);
    drawPool.value.push(...matched);
    poolUsers.value = unmatched;
    winnerUsers.value = [];
    poolSelected.clear();
    drawSelected.clear();
}

async function drawWinners() {
    if (drawPool.value.length === 0) {
        toast.warn('抽奖池为空，请先筛选或手动添加用户');
        return;
    }

    const count = Math.max(1, Number(winnerCount.value) || 1);

    // Deep-clone to strip Vue reactive proxies — reactive objects cannot be
    // structured-cloned by Electron IPC.
    const plainCandidates = JSON.parse(JSON.stringify(drawPool.value));

    const result = await window.api.draw({
        candidates: plainCandidates,
        winnerCount: count,
    });

    result.match(
        ({ winners }) => {
            winnerUsers.value = winners;
        },
        error => {
            toast.error(`抽奖失败: ${error}`);
        },
    );
}

async function onLoadCandidates() {
    if (!oid.value.trim() || !type.value.trim()) {
        toast.warn('请先输入 oid 与 type');
        return;
    }

    isLoadingCandidates.value = true;
    enrichedCount.value = 0;
    enrichError.value = false;

    const result = await window.api.loadCandidates(oid.value.trim(), type.value.trim(), mode.value.trim() || '2');
    isLoadingCandidates.value = false;

    result.match(
        users => {
            allUsers.value = users;
            poolUsers.value = [...users];
            drawPool.value = [];
            winnerUsers.value = [];
            poolSelected.clear();
            drawSelected.clear();
            // Reset relation filter checkboxes since fresh candidates have no relation data
            filters.value.none = false;
            filters.value.fan = false;
            filters.value.follow = false;
            filters.value.mutual = false;
        },
        error => {
            toast.error(`加载初始用户失败: ${error.message}`);
        },
    );
}

async function onEnrichRelations() {
    if (isEnrichingRelations.value || allUsers.value.length === 0) return;

    isEnrichingRelations.value = true;
    enrichError.value = false;
    enrichAbortFlag = false;

    const users = allUsers.value;
    const BATCH_SIZE = 5;
    let consecutiveErrors = 0;

    // Helper to process a single user
    const processUser = async (user: Candidate, idx: number) => {
        if (enrichAbortFlag || user.relation !== 'none') return null;

        const result = await window.api.enrichRelation(user.uid);
        return { idx, result };
    };

    // Iterate in chunks
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
        if (enrichAbortFlag) {
            toast.warn('已停止加载关系数据');
            break;
        }

        const batch = users.slice(i, i + BATCH_SIZE);
        const promises = batch.map((u, offset) => processUser(u, i + offset));
        const results = await Promise.all(promises);

        // Process results
        for (const item of results) {
            if (!item) continue; // Skipped (aborted or already done)

            const { idx, result } = item;
            if (result.isOk()) {
                users[idx] = { ...users[idx], relation: result.value };
                consecutiveErrors = 0;
            } else {
                enrichError.value = true;
                consecutiveErrors++;
                toast.warn(`加载用户 ${users[idx].uname} 失败: ${result.error.message}`);
            }
            updateUserInLists(users[idx]);
        }

        if (consecutiveErrors >= 5) {
            toast.error('连续请求失败，已自动停止加载');
            break;
        }

        enrichedCount.value = Math.min(i + BATCH_SIZE, users.length);
    }

    allUsers.value = [...users];
    isEnrichingRelations.value = false;

    if (!enrichAbortFlag && !enrichError.value) {
        toast.info(`关系数据加载完成 (${enrichedCount.value}/${users.length})`);
    }
}

function onStopEnrich() {
    enrichAbortFlag = true;
}

/** Update a single user in poolUsers/drawPool if present (for live reactivity during enrichment). */
function updateUserInLists(user: Candidate) {
    const poolIdx = poolUsers.value.findIndex(u => u.uid === user.uid);
    if (poolIdx !== -1) {
        poolUsers.value[poolIdx] = user;
    }
    const drawIdx = drawPool.value.findIndex(u => u.uid === user.uid);
    if (drawIdx !== -1) {
        drawPool.value[drawIdx] = user;
    }
}

onMounted(async () => {
    await refreshConfigPath();

    window.nativeEvent.onLogin(result => {
        loginStatus.value = result;
        loginChecked.value = true;
    });
});
</script>

<style scoped>
.page {
    position: relative;
    min-height: 100vh;
    padding: 70px 16px 16px;
    font-family: system-ui, -apple-system, sans-serif;
    background: #f8fafc;
}

.login-panel {
    position: absolute;
    top: 16px;
    left: 16px;
    display: flex;
    align-items: center;
}

.config-panel {
    position: absolute;
    top: 16px;
    right: 16px;
    max-width: 50vw;
    display: flex;
    align-items: center;
    gap: 8px;
}

.action-btn {
    height: 32px;
    padding: 0 14px;
    border: 1px solid #1d4ed8;
    border-radius: 6px;
    background: #2563eb;
    color: #fff;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
}

.action-btn:hover {
    background: #1e40af;
}

.login-tag {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 10px;
    border: 1px solid #ddd;
    border-radius: 10px;
    background: #fff;
}

.login-loading {
    color: #6b7280;
    font-size: 13px;
    gap: 8px;
}

.loading-spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid #d1d5db;
    border-top-color: #2563eb;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    flex-shrink: 0;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

.loading-text {
    white-space: nowrap;
}

.logout-btn {
    height: 26px;
    padding: 0 10px;
    margin-left: 4px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    background: #f9fafb;
    color: #374151;
    font-size: 12px;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s, color 0.15s;
}

.logout-btn:hover:not(:disabled) {
    background: #fee2e2;
    border-color: #fca5a5;
    color: #dc2626;
}

.logout-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.avatar {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    object-fit: cover;
}

.user-text {
    display: flex;
    flex-direction: column;
    line-height: 1.15;
}

.user-name {
    font-size: 14px;
    font-weight: 600;
    color: #111827;
}

.uid {
    margin-top: 2px;
    font-size: 12px;
    color: #6b7280;
}

.config-path {
    font-size: 13px;
    line-height: 1.4;
    word-break: break-all;
}

.workspace {
    display: grid;
    gap: 12px;
}

h1,
h2 {
    margin: 0;
}

h2 {
    font-size: 14px;
}

.source-row,
.action-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
}

.input {
    height: 32px;
    padding: 0 10px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    background: #fff;
}

.winner-input {
    width: 110px;
}

.hit-tag {
    display: inline-flex;
    align-items: center;
    height: 32px;
    padding: 0 10px;
    border: 1px solid #93c5fd;
    border-radius: 6px;
    background: #eff6ff;
    color: #1d4ed8;
    font-size: 13px;
}

.filters {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    padding: 10px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: #fff;
}

.filters label {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
}

.filter-disabled {
    opacity: 0.45;
    cursor: not-allowed;
}

.enrich-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
}

.enrich-progress {
    position: relative;
    width: 160px;
    height: 8px;
    border-radius: 4px;
    background: #e5e7eb;
    overflow: hidden;
}

.progress-bar {
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    border-radius: 4px;
    background: #2563eb;
    transition: width 0.15s ease;
}

.enrich-text {
    font-size: 13px;
    color: #374151;
    min-width: 70px;
}

.enrich-warn {
    font-size: 12px;
    color: #b45309;
}

.stop-btn {
    background: #dc2626;
    border-color: #b91c1c;
}

.stop-btn:hover {
    background: #b91c1c;
}

.action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.lists {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
}

.list-col {
    border: 1px solid #d1d5db;
    border-radius: 10px;
    background: #fff;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 420px;
}

.list-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
}

.list-actions {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
}

.sm-btn {
    height: 26px;
    padding: 0 8px;
    border: 1px solid #d1d5db;
    border-radius: 5px;
    background: #f9fafb;
    font-size: 12px;
    cursor: pointer;
    white-space: nowrap;
}

.sm-btn:hover {
    background: #e5e7eb;
}

.sm-btn:disabled {
    opacity: 0.4;
    cursor: default;
}

.sm-btn-move {
    border-color: #93c5fd;
    color: #1d4ed8;
    background: #eff6ff;
}

.sm-btn-move:hover:not(:disabled) {
    background: #dbeafe;
}

.list-pool {
    border-color: #93c5fd;
}

.list-draw {
    border-color: #86efac;
}

.list-winner {
    border-color: #fcd34d;
}

.list-body {
    display: grid;
    align-content: start;
    gap: 8px;
    flex: 1;
    max-height: 540px;
    overflow: auto;
}

.empty {
    margin: 0;
    color: #6b7280;
    font-size: 13px;
}

.user-tag {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    transition: opacity 0.15s;
}

.user-tag--selected {
    background: #eff6ff;
    border-color: #93c5fd;
}

.user-check {
    flex-shrink: 0;
    cursor: pointer;
    width: 15px;
    height: 15px;
}

.user-meta {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
    min-width: 0;
    flex: 1;
}

.user-link {
    font-size: 14px;
    font-weight: 600;
    color: #2563eb;
    cursor: pointer;
    text-decoration: none;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.user-link:hover {
    text-decoration: underline;
    color: #1d4ed8;
}

.move-btn {
    flex-shrink: 0;
    width: 26px;
    height: 26px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    background: #f9fafb;
    cursor: pointer;
    font-size: 14px;
    font-weight: 700;
    color: #374151;
    line-height: 1;
}

.move-btn:hover {
    background: #e5e7eb;
    color: #111827;
}
</style>
