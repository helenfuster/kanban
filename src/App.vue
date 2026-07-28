<script setup lang="ts">
import {
  defineAsyncComponent,
  markRaw,
  onMounted,
  onUnmounted,
  type Component,
  ref,
  watch,
} from 'vue'
import AppHeader from './components/AppHeader.vue'
import AppFooter from './components/AppFooter.vue'
import BoardView from './components/BoardView.vue'
import CardDetailPanel from './components/CardDetailPanel.vue'
import AuthView from './components/AuthView.vue'
import ToastHost from './components/ToastHost.vue'
import type { NavTab } from './components/AppFooter.vue'
import { Loader2 } from '@lucide/vue'
import { useAuthStore } from './stores/auth'
import { useBoardStore } from './stores/board'
import { useNotesStore } from './stores/notes'
import { useDailyStore } from './stores/dailyTodos'
import { useNotificationsStore } from './stores/notifications'
import { useCommunityStore } from './stores/community'
import { useHubSectionsStore } from './stores/hubSections'

const asyncOpts = { delay: 320 }

const AgendaView = defineAsyncComponent({
  loader: () => import('./components/AgendaView.vue'),
  ...asyncOpts,
})
const DailyView = defineAsyncComponent({
  loader: () => import('./components/DailyView.vue'),
  ...asyncOpts,
})
const NotesView = defineAsyncComponent({
  loader: () => import('./components/NotesView.vue'),
  ...asyncOpts,
})
const tabViews: Record<NavTab, Component> = {
  board: markRaw(BoardView),
  agenda: markRaw(AgendaView),
  daily: markRaw(DailyView),
  notes: markRaw(NotesView),
}

const auth = useAuthStore()
const board = useBoardStore()
const notes = useNotesStore()
const daily = useDailyStore()
const notifications = useNotificationsStore()
const community = useCommunityStore()
const hubSections = useHubSectionsStore()
const activeTab = ref<NavTab>('board')
const bootstrapping = ref(false)
const notesReady = ref(false)
const dailyReady = ref(false)
const chunksPrefetched = ref(false)

onMounted(async () => {
  window.addEventListener('keydown', handleKeydown)
  await auth.init()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

function handleKeydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null
  const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
  
  if (e.key === 'Escape') {
    if (board.selectedCardId) {
      board.closeCard()
    }
  } else if (!isInput && (e.key === 'n' || e.key === 'N')) {
    if (activeTab.value === 'board' && board.columns.length > 0) {
      e.preventDefault()
      const firstCol = board.columns[0]
      if (firstCol) {
        void board.addCard(firstCol.id, 'Nova Tarefa')
      }
    }
  }
}

function prefetchTabChunks() {
  if (chunksPrefetched.value) return
  chunksPrefetched.value = true
  void import('./components/AgendaView.vue')
  void import('./components/DailyView.vue')
  void import('./components/NotesView.vue')
  void import('./components/HubView.vue')
}

watch(
  () => [auth.isAuthenticated, auth.passwordRecovery] as const,
  async ([authenticated, recovering]) => {
    if (!authenticated || recovering) {
      board.reset()
      notes.reset()
      daily.reset()
      notifications.reset()
      community.reset()
      hubSections.reset()
      notesReady.value = false
      dailyReady.value = false
      return
    }
    bootstrapping.value = true
    try {
      await board.init()
      await notifications.init()
      prefetchTabChunks()
    } finally {
      bootstrapping.value = false
    }
  },
  { immediate: true },
)

watch(activeTab, async (tab) => {
  board.closeCard()
  if (!auth.isAuthenticated || auth.passwordRecovery) return
  if (tab === 'notes' && !notesReady.value) {
    await notes.init()
    notesReady.value = true
  }
  if (tab === 'daily' && !dailyReady.value) {
    await daily.init()
    daily.sanitizeDetailMember()
    dailyReady.value = true
  }
})
</script>

<template>
  <AuthView
    v-if="!auth.loading && (!auth.isAuthenticated || auth.passwordRecovery)"
  />

  <div
    v-else-if="auth.loading || bootstrapping || !board.ready"
    class="app-bg flex h-full min-h-0 items-center justify-center"
  >
    <Loader2
      class="animate-spin text-accent"
      :size="28"
      :stroke-width="2"
      aria-label="Carregando"
    />
  </div>

  <div
    v-else
    class="app-bg relative flex h-full min-h-0 flex-col"
  >
    <div class="relative z-10 flex h-full min-h-0 flex-col">
      <AppHeader />
      <main class="tab-stage relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <Transition name="tab-fade">
          <KeepAlive :max="5">
            <component
              :is="tabViews[activeTab]"
              :key="activeTab"
              class="tab-panel flex min-h-0 w-full flex-1 flex-col"
            />
          </KeepAlive>
        </Transition>
      </main>
      <AppFooter v-model:active-tab="activeTab" />
      <CardDetailPanel />
    </div>
  </div>

  <ToastHost />
</template>
