<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Plus,
  Repeat,
  Trash2,
  X,
} from '@lucide/vue'
import { useBoardStore } from '../stores/board'
import { useAuthStore } from '../stores/auth'
import {
  entryProgress,
  toDateKey,
  useDailyStore,
  type RecurrenceMode,
} from '../stores/dailyTodos'
import type { DailyEntry, DailyStatus } from '../types/daily'
import MemberAvatar from './MemberAvatar.vue'

const board = useBoardStore()
const auth = useAuthStore()
const daily = useDailyStore()

const newTodoText = ref('')
const campaignDraft = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const celebratePin = ref(false)

const recurrenceModalOpen = ref(false)
const pendingTodoText = ref('')

const weekDaysHeader = ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.']

const statusMeta: Record<DailyStatus, { label: string; className: string }> = {
  todo: { label: 'Não realizado', className: 'bg-danger/25 text-danger' },
  in_progress: { label: 'Em andamento', className: 'bg-amber-500/25 text-amber-200' },
  done: { label: 'Concluído', className: 'bg-success/25 text-success' },
}

/** Membro focado no detalhe: filtro do header ou último selecionado */
const focusMemberId = computed(
  () =>
    board.memberFilterId ??
    daily.detailMemberId ??
    board.members[0]?.id ??
    null,
)

const selectedMember = computed(
  () => board.members.find((member) => member.id === focusMemberId.value) ?? null,
)

watch(
  focusMemberId,
  (memberId) => {
    if (memberId) daily.detailMemberId = memberId
  },
  { immediate: true },
)

watch(
  [focusMemberId, () => daily.selectedDateKey, () => daily.ready],
  () => {
    if (!daily.ready || daily.loading) return
    if (focusMemberId.value) {
      daily.ensureEntry(focusMemberId.value, daily.selectedDateKey)
    }
  },
  { immediate: true },
)

function openDay(dateKey: string) {
  const memberId = focusMemberId.value ?? board.members[0]?.id
  if (!memberId) return
  daily.openEntry(memberId, dateKey)
}

const focusedEntry = computed(() => {
  const memberId = focusMemberId.value
  if (!memberId) return null
  return (
    daily.entries.find(
      (entry) =>
        entry.memberId === memberId && entry.dateKey === daily.selectedDateKey,
    ) ?? null
  )
})

watch(
  () => focusedEntry.value?.campaign,
  (value) => {
    campaignDraft.value = value ?? ''
  },
  { immediate: true },
)

const focusedProgress = computed(() => entryProgress(focusedEntry.value))

watch(
  () => focusedProgress.value.complete,
  (complete, wasComplete) => {
    if (complete && wasComplete === false && focusedProgress.value.total > 0) {
      celebratePin.value = true
      window.setTimeout(() => {
        celebratePin.value = false
      }, 1200)
    }
  },
)

const dateLabel = computed(() => {
  const [y, m, d] = daily.selectedDateKey.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(y, m - 1, d))
})

const isViewingToday = computed(
  () => daily.selectedDateKey === toDateKey(new Date()),
)

function memberOf(entry: DailyEntry) {
  return board.getMemberById(entry.memberId)
}

function statusOf(entry: DailyEntry) {
  const progress = entryProgress(entry)
  if (progress.complete) return statusMeta.done
  return statusMeta[entry.status]
}

function openRecurrenceModalForText(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return
  pendingTodoText.value = trimmed
  recurrenceModalOpen.value = true
}

function submitTodo() {
  if (!newTodoText.value.trim()) return
  openRecurrenceModalForText(newTodoText.value)
}

function confirmRecurrence(mode: RecurrenceMode) {
  if (!pendingTodoText.value.trim()) return
  daily.addTodoWithRecurrence(pendingTodoText.value, mode, daily.selectedDateKey)
  if (pendingTodoText.value.trim() === newTodoText.value.trim()) {
    newTodoText.value = ''
  }
  pendingTodoText.value = ''
  recurrenceModalOpen.value = false
  nextTick(() => inputRef.value?.focus())
}

function closeRecurrenceModal() {
  recurrenceModalOpen.value = false
  pendingTodoText.value = ''
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col pb-[4.75rem] pt-2 sm:pb-16 sm:pt-3">
    <div class="page-shell flex min-h-0 flex-1 flex-col gap-2 sm:gap-3">
    <p v-if="daily.error" class="rounded-lg border border-red-400/30 bg-red-950/50 px-3 py-2 text-xs text-red-200">
      {{ daily.error }}
      <button type="button" class="ml-2 underline" @click="daily.error = null">fechar</button>
    </p>
    <!-- Controles: só modo + navegação (dropdown fica no header) -->
    <div class="flex flex-wrap items-center gap-2">
      <div class="flex rounded-xl border border-border-subtle/70 bg-board-elevated/90 p-1">
        <button
          v-for="mode in [
            { id: 'day' as const, label: 'Diário' },
            { id: 'week' as const, label: 'Semanal' },
            { id: 'month' as const, label: 'Mensal' },
          ]"
          :key="mode.id"
          type="button"
          :class="[
            'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
            daily.viewMode === mode.id
              ? 'bg-surface text-text-primary'
              : 'text-text-secondary hover:text-text-primary',
          ]"
          @click="daily.setViewMode(mode.id)"
        >
          {{ mode.label }}
        </button>
      </div>

      <p class="hidden text-sm capitalize text-text-muted sm:block">
        {{ daily.periodLabel }}
        <span v-if="selectedMember"> · {{ selectedMember.name }}</span>
      </p>

      <div class="ml-auto flex items-center gap-1 rounded-xl bg-board-elevated/90 p-1">
        <button
          type="button"
          :class="[
            'rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors',
            isViewingToday
              ? 'bg-accent text-board'
              : 'bg-accent/15 text-accent hover:bg-accent/25',
          ]"
          title="Ir para hoje"
          @click="daily.goToday()"
        >
          Hoje
        </button>
        <button
          type="button"
          class="rounded-lg p-1.5 text-text-secondary hover:bg-surface hover:text-text-primary"
          aria-label="Anterior"
          @click="daily.shiftPeriod(-1)"
        >
          <ChevronLeft :size="18" />
        </button>
        <button
          type="button"
          class="rounded-lg p-1.5 text-text-secondary hover:bg-surface hover:text-text-primary"
          aria-label="Próximo"
          @click="daily.shiftPeriod(1)"
        >
          <ChevronRight :size="18" />
        </button>
      </div>
    </div>

    <!-- SEMANAL / MENSAL / DIÁRIO -->
    <div class="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <Transition name="view-fade">
        <section
          v-if="daily.viewMode === 'week'"
          key="week"
          class="panel-glass flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl"
        >
      <header class="flex shrink-0 items-center justify-between border-b border-border-subtle/70 px-4 py-3">
        <div>
          <h2 class="text-sm font-semibold capitalize text-text-primary">
            {{ daily.periodLabel }}
          </h2>
          <p class="text-xs text-text-muted">
            Tarefas
            <span v-if="board.memberFilterId && selectedMember">
              · {{ selectedMember.name }}
            </span>
            <span v-else> · todos</span>
          </p>
        </div>
      </header>

      <div class="grid min-h-0 flex-1 grid-cols-7 gap-px overflow-hidden bg-border-subtle">
        <div
          v-for="day in daily.weekDays"
          :key="day.dateKey"
          class="flex min-h-0 flex-col gap-2 overflow-hidden bg-column p-2"
        >
          <button
            type="button"
            class="flex w-full items-center justify-between gap-1 rounded-lg px-0.5 text-left hover:bg-white/5"
            :title="`Abrir diário de ${day.dayNumber}`"
            @click="openDay(day.dateKey)"
          >
            <span class="text-[11px] capitalize text-text-muted">{{ day.weekday }}</span>
            <span
              :class="[
                'inline-flex size-6 items-center justify-center rounded-full text-xs',
                day.isToday ? 'bg-danger font-semibold text-white' : 'text-text-secondary',
              ]"
            >
              {{ day.dayNumber }}
            </span>
          </button>

          <div class="min-h-0 flex-1 space-y-2 overflow-y-auto">
            <button
              v-for="entry in day.entries"
              :key="entry.id"
              type="button"
              class="relative w-full rounded-xl border border-border-subtle/70 bg-card p-3 text-left shadow-sm transition-colors hover:bg-card-hover"
              @click="daily.openEntry(entry.memberId, day.dateKey)"
            >
              <div
                v-if="entryProgress(entry).complete"
                class="absolute right-2 top-2"
              >
                <div
                  class="flex size-5 items-center justify-center rounded-full bg-success text-board shadow-md"
                >
                  <Check :size="11" :stroke-width="3" />
                </div>
              </div>

              <!-- Header do card no dia -->
              <div class="mb-2 flex items-center justify-between gap-1">
                <div class="flex items-center gap-1.5 min-w-0">
                  <MemberAvatar
                    v-if="memberOf(entry)"
                    :member="memberOf(entry)!"
                    size="sm"
                  />
                  <span class="truncate text-xs font-semibold text-text-primary">
                    {{ memberOf(entry)?.name }}
                  </span>
                </div>
                <span
                  v-if="entryProgress(entry).total > 0"
                  class="shrink-0 rounded-full bg-accent/20 px-1.5 py-0.5 text-[10px] font-bold text-accent"
                >
                  {{ entryProgress(entry).done }}/{{ entryProgress(entry).total }}
                </span>
              </div>

              <!-- Lista de Tarefas do dia no card semanal -->
              <ul v-if="entry.todos.length" class="mb-2.5 space-y-1">
                <li
                  v-for="todo in entry.todos.slice(0, 4)"
                  :key="todo.id"
                  class="flex items-center gap-1.5 text-[11px] leading-tight"
                >
                  <span
                    :class="[
                      'inline-flex size-3.5 shrink-0 items-center justify-center rounded border text-[9px] font-bold transition-colors',
                      todo.completed
                        ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
                        : 'border-white/20 bg-surface/60 text-transparent',
                    ]"
                  >
                    ✓
                  </span>
                  <span
                    :class="[
                      'min-w-0 flex-1 truncate',
                      todo.completed ? 'text-text-muted line-through' : 'font-medium text-text-primary',
                    ]"
                  >
                    {{ todo.text }}
                  </span>
                </li>
                <li
                  v-if="entry.todos.length > 4"
                  class="pl-5 text-[10px] italic text-text-muted"
                >
                  +{{ entry.todos.length - 4 }} outra(s)...
                </li>
              </ul>
              <p
                v-else-if="entry.campaign"
                class="mb-2 line-clamp-2 text-[11px] leading-snug text-text-muted"
              >
                {{ entry.campaign }}
              </p>

              <!-- Footer do Card: Status + Contagem de Concluídas/Pendentes -->
              <div class="flex flex-wrap items-center justify-between gap-1 border-t border-white/5 pt-1.5">
                <span
                  :class="[
                    'inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
                    statusOf(entry).className,
                  ]"
                >
                  {{ statusOf(entry).label }}
                </span>
                <span
                  v-if="entryProgress(entry).total > 0"
                  class="text-[10px] font-medium text-text-muted"
                >
                  {{ entryProgress(entry).done }} de {{ entryProgress(entry).total }} concluídas
                </span>
              </div>
            </button>

            <button
              v-if="!day.entries.length"
              type="button"
              class="flex w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border-subtle/60 px-2 py-3 text-center transition-colors hover:border-accent/40 hover:bg-white/5"
              title="Adicionar tarefa para este dia"
              @click.stop="openDay(day.dateKey)"
            >
              <Plus :size="14" class="text-text-muted" />
              <span class="text-[11px] font-medium text-text-muted">
                Adicionar tarefa
              </span>
            </button>
          </div>
        </div>
      </div>
        </section>

        <section
          v-else-if="daily.viewMode === 'month'"
          key="month"
          class="panel-glass flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl"
        >
      <header class="flex shrink-0 items-center justify-between border-b border-border-subtle/70 px-4 py-3">
        <h2 class="text-sm font-semibold capitalize text-text-primary">
          {{ daily.periodLabel }}
        </h2>
        <p class="text-xs text-text-muted">Visão mensal</p>
      </header>

      <div
        class="grid min-h-0 flex-1 grid-cols-7 gap-px overflow-hidden bg-border-subtle"
        style="grid-template-rows: auto repeat(6, minmax(0, 1fr))"
      >
        <div
          v-for="weekday in weekDaysHeader"
          :key="weekday"
          class="bg-surface px-1 py-1.5 text-center text-[11px] capitalize text-text-muted"
        >
          {{ weekday }}
        </div>

        <div
          v-for="cell in daily.monthCells"
          :key="cell.dateKey"
          :class="[
            'flex min-h-0 cursor-pointer flex-col gap-1 overflow-hidden p-1.5 transition-colors hover:bg-white/5',
            cell.inMonth ? 'bg-column' : 'bg-board/80 opacity-55',
          ]"
          @click="openDay(cell.dateKey)"
        >
          <span
            :class="[
              'mb-0.5 inline-flex size-6 items-center justify-center rounded-full text-xs',
              cell.isToday ? 'bg-danger font-semibold text-white' : 'text-text-secondary',
            ]"
          >
            {{ cell.dayNumber }}
          </span>

          <div class="min-h-0 flex-1 space-y-1 overflow-y-auto">
            <button
              v-for="entry in cell.entries"
              :key="entry.id"
              type="button"
              class="relative w-full rounded-lg border border-border-subtle/60 bg-card px-1.5 py-1.5 pr-6 text-left hover:bg-card-hover"
              @click.stop="daily.openEntry(entry.memberId, cell.dateKey)"
            >
              <div
                v-if="entryProgress(entry).complete"
                class="absolute right-1 top-1"
              >
                <div
                  class="flex size-4 items-center justify-center rounded-full bg-success text-board"
                >
                  <Check :size="9" :stroke-width="3" />
                </div>
              </div>
              <p class="truncate text-[10px] font-semibold text-text-primary">
                {{ memberOf(entry)?.name }}
              </p>
              <p class="truncate text-[10px] text-text-muted">
                {{ entry.campaign || 'Tarefas' }}
              </p>
              <span
                :class="[
                  'mt-1 inline-flex rounded px-1 py-0.5 text-[9px] font-semibold',
                  statusOf(entry).className,
                ]"
              >
                {{ statusOf(entry).label }}
              </span>
            </button>
          </div>
        </div>
      </div>
        </section>

        <section
          v-else
          key="day"
          class="panel-glass relative mx-auto flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-2xl shadow-xl shadow-black/20"
        >
      <div class="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-7">
        <header class="mb-6">
          <div class="mb-2 flex items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <label
                class="relative flex size-10 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10 text-xs font-semibold text-white"
                title="Sua foto de perfil"
              >
                <img
                  v-if="auth.avatarUrl"
                  :src="auth.avatarUrl"
                  alt=""
                  class="size-full object-cover"
                />
                <span v-else>{{ (auth.user?.email?.[0] || 'H').toUpperCase() }}</span>
              </label>
              <h2 class="text-3xl font-bold tracking-tight text-text-primary">
                {{ auth.user?.email?.split('@')[0] || 'Helen Fuster' }}
              </h2>
            </div>
            <div
              v-if="focusedProgress.complete"
              class="flex size-9 items-center justify-center rounded-full bg-success text-board shadow-md"
              :class="{ 'daily-pin-pop': celebratePin }"
              title="Dia concluído"
            >
              <Check :size="18" :stroke-width="3" />
            </div>
          </div>
          <p class="text-sm text-text-muted">
            Afazeres de {{ dateLabel }}
          </p>
        </header>

        <dl class="mb-6 space-y-3 text-sm">
          <div class="grid grid-cols-[140px_1fr] items-center gap-3 sm:grid-cols-[160px_1fr]">
            <dt class="flex items-center gap-2 text-text-muted">
              <Calendar :size="15" />
              Data
            </dt>
            <dd class="text-text-primary">{{ dateLabel }}</dd>
          </div>

          <div class="grid grid-cols-[140px_1fr] items-center gap-3 sm:grid-cols-[160px_1fr]">
            <dt class="flex items-center gap-2 text-text-muted">
              <CircleDashed :size="15" />
              Status
            </dt>
            <dd class="flex flex-wrap gap-1.5">
              <button
                v-for="(meta, key) in statusMeta"
                :key="key"
                type="button"
                :class="[
                  'rounded-md px-2.5 py-1 text-xs font-medium',
                  meta.className,
                  focusedEntry?.status === key
                    ? 'ring-1 ring-white/25'
                    : 'opacity-55 hover:opacity-100',
                ]"
                @click="daily.setStatus(key as DailyStatus)"
              >
                {{ meta.label }}
              </button>
            </dd>
          </div>
        </dl>

        <!-- Resumo Visual dos Afazeres Diários -->
        <div
          v-if="focusedEntry?.todos.length"
          class="mb-6 rounded-2xl border border-white/10 bg-board-elevated/70 p-4 shadow-sm"
        >
          <div class="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold uppercase tracking-wider text-text-muted">
                Resumo dos Afazeres
              </span>
              <span
                class="rounded-full bg-accent/20 px-2.5 py-0.5 text-xs font-bold text-accent"
              >
                {{ focusedProgress.done }} de {{ focusedProgress.total }} concluídas
              </span>
            </div>
            <span
              v-if="focusedProgress.total - focusedProgress.done > 0"
              class="text-xs font-semibold text-amber-300/90"
            >
              {{ focusedProgress.total - focusedProgress.done }} pendente(s)
            </span>
            <span v-else class="text-xs font-semibold text-emerald-400">
              Tudo concluído! 🎉
            </span>
          </div>

          <!-- Barra de Progresso Animada -->
          <div class="h-2.5 w-full overflow-hidden rounded-full bg-surface">
            <div
              class="h-full bg-accent transition-all duration-500 ease-out"
              :style="{ width: `${focusedProgress.percent}%` }"
            />
          </div>
        </div>

        <h3 class="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
          Afazeres do dia
        </h3>

        <ul class="space-y-1.5">
          <li
            v-for="todo in focusedEntry?.todos ?? []"
            :key="todo.id"
            :class="[
              'group flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface/60',
              todo.highlighted && 'bg-amber-400/10',
            ]"
          >
            <input
              type="checkbox"
              class="mt-1 size-4 shrink-0 accent-accent"
              :checked="todo.completed"
              @change="daily.toggleTodo(todo.id)"
            />
            <input
              :value="todo.text"
              type="text"
              :class="[
                'min-w-0 flex-1 bg-transparent text-sm outline-none',
                todo.completed
                  ? 'text-text-muted line-through'
                  : 'text-text-primary',
              ]"
              @change="
                daily.updateTodoText(
                  todo.id,
                  ($event.target as HTMLInputElement).value,
                )
              "
            />
            <button
              type="button"
              class="rounded-md p-1 text-text-muted opacity-0 transition-opacity hover:bg-accent/15 hover:text-accent group-hover:opacity-100"
              title="Repetir este afazer para outros dias"
              @click="openRecurrenceModalForText(todo.text)"
            >
              <Repeat :size="14" />
            </button>
            <button
              type="button"
              class="rounded-md p-1 text-text-muted opacity-0 transition-opacity hover:bg-danger/15 hover:text-danger group-hover:opacity-100"
              aria-label="Remover tarefa"
              @click="daily.removeTodo(todo.id)"
            >
              <Trash2 :size="14" />
            </button>
          </li>
        </ul>

        <form class="mt-3 flex items-center gap-2 px-2" @submit.prevent="submitTodo">
          <Plus :size="16" class="shrink-0 text-text-muted" />
          <input
            ref="inputRef"
            v-model="newTodoText"
            type="text"
            placeholder="Adicionar um afazer…"
            class="min-w-0 flex-1 bg-transparent py-2 text-sm text-text-primary outline-none placeholder:text-text-muted"
          />
          <button
            v-if="newTodoText.trim()"
            type="submit"
            class="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-board hover:bg-accent-hover"
          >
            Adicionar
          </button>
        </form>
      </div>
        </section>
      </Transition>
    </div>
    </div>

    <!-- Modal de Recorrência -->
    <Teleport to="body">
      <div
        v-if="recurrenceModalOpen"
        class="fixed inset-0 z-[250] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        @click.self="closeRecurrenceModal"
      >
        <div class="panel-glass w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-board-elevated p-6 shadow-2xl">
          <div class="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
            <div class="flex items-center gap-2.5">
              <div class="flex size-9 items-center justify-center rounded-xl bg-accent/20 text-accent">
                <Repeat :size="18" />
              </div>
              <div class="min-w-0 flex-1">
                <h3 class="text-base font-bold text-text-primary">Recorrência do Afazer</h3>
                <p class="truncate text-xs text-text-muted max-w-[240px]">"{{ pendingTodoText }}"</p>
              </div>
            </div>
            <button
              type="button"
              class="rounded-lg p-1.5 text-text-muted hover:bg-white/10 hover:text-text-primary"
              @click="closeRecurrenceModal"
            >
              <X :size="18" />
            </button>
          </div>

          <p class="mb-4 text-xs text-text-secondary">
            Escolha com que frequência deseja criar este afazer nos próximos dias:
          </p>

          <div class="space-y-2.5">
            <button
              v-for="opt in [
                {
                  id: 'today' as const,
                  title: 'Somente hoje',
                  desc: 'Cria o afazer apenas para a data selecionada',
                  icon: '📌',
                },
                {
                  id: 'rest_of_week' as const,
                  title: 'Restante desta semana',
                  desc: 'Cria o afazer para todos os dias restantes (até Domingo)',
                  icon: '📅',
                },
                {
                  id: 'weekdays' as const,
                  title: 'Dias úteis da semana (Segunda a Sexta)',
                  desc: 'Cria o afazer para os dias de semana',
                  icon: '💼',
                },
                {
                  id: 'next_7_days' as const,
                  title: 'Próximos 7 dias seguidos',
                  desc: 'Cria o afazer para os próximos 7 dias corridos',
                  icon: '🔄',
                },
                {
                  id: 'next_30_days' as const,
                  title: 'Próximos 30 dias (Mês inteiro)',
                  desc: 'Cria o afazer para os próximos 30 dias corridos',
                  icon: '🗓️',
                },
              ]"
              :key="opt.id"
              type="button"
              class="flex w-full items-start gap-3 rounded-xl border border-white/10 bg-surface/80 p-3 text-left transition-all hover:border-accent hover:bg-white/10"
              @click="confirmRecurrence(opt.id)"
            >
              <span class="text-xl leading-none">{{ opt.icon }}</span>
              <div class="min-w-0 flex-1">
                <p class="text-xs font-semibold text-text-primary">{{ opt.title }}</p>
                <p class="mt-0.5 text-[11px] leading-tight text-text-muted">{{ opt.desc }}</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
