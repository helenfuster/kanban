<script setup lang="ts">
import {
  CalendarDays,
  Columns3,
  LayoutGrid,
  ListChecks,
  Megaphone,
  NotebookPen,
} from '@lucide/vue'

export type NavTab =
  | 'agenda'
  | 'board'
  | 'daily'
  | 'notes'
  | 'campaigns'
  | 'charts'

defineProps<{
  activeTab: NavTab
}>()

const emit = defineEmits<{
  'update:activeTab': [tab: NavTab]
}>()

const tabs: { id: NavTab; label: string; icon: typeof CalendarDays }[] = [
  { id: 'agenda', label: 'Agenda', icon: CalendarDays },
  { id: 'board', label: 'Quadro', icon: Columns3 },
  { id: 'daily', label: 'Tarefas', icon: ListChecks },
  { id: 'notes', label: 'Notas', icon: NotebookPen },
  { id: 'campaigns', label: 'Campanhas', icon: Megaphone },
  { id: 'charts', label: 'Hub', icon: LayoutGrid },
]
</script>

<template>
  <nav
    class="pointer-events-none fixed inset-x-0 bottom-2 z-40 flex justify-center px-2 pb-[env(safe-area-inset-bottom)] sm:bottom-2.5 sm:px-3"
    aria-label="Navegação principal"
  >
    <div
      class="pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-white/15 bg-board-elevated/95 px-1.5 py-1 shadow-xl shadow-black/40 backdrop-blur-md sm:gap-1.5 sm:px-2 sm:py-1"
    >
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        :aria-current="activeTab === tab.id ? 'page' : undefined"
        :class="[
          'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-200 ease-out sm:px-3 sm:py-1.5 sm:text-xs',
          activeTab === tab.id
            ? 'bg-accent/20 text-text-primary ring-1 ring-accent/45 shadow-sm font-semibold'
            : 'text-text-secondary hover:bg-surface hover:text-text-primary',
        ]"
        @click="emit('update:activeTab', tab.id)"
      >
        <component :is="tab.icon" :size="14" :stroke-width="2" />
        <span>{{ tab.label }}</span>
      </button>
    </div>
  </nav>
</template>
