<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Clock,
  Flame,
  Kanban,
  Layers,
  PieChart,
  TrendingUp,
  UserCheck,
  Zap,
} from '@lucide/vue'
import { useBoardStore } from '../stores/board'
import { useDailyStore } from '../stores/dailyTodos'
import MemberAvatar from './MemberAvatar.vue'

type PeriodType = 'daily' | 'weekly' | 'monthly'
type SourceFilter = 'all' | 'board' | 'daily'

const boardStore = useBoardStore()
const dailyStore = useDailyStore()

const period = ref<PeriodType>('daily')
const sourceFilter = ref<SourceFilter>('all')
const hoveredBarIndex = ref<number | null>(null)

// Initialize stores if needed on mount
onMounted(async () => {
  if (!dailyStore.ready) {
    await dailyStore.init()
  }
})

// Helper date utilities
function formatDateKey(date: Date): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function parseDateKey(dateKey: string): Date {
  const parts = dateKey.split('-').map(Number)
  if (parts.length === 3 && !parts.some(isNaN)) {
    return new Date(parts[0], parts[1] - 1, parts[2])
  }
  return new Date(dateKey)
}

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

// Extract all completed items from Board and Daily
interface CompletedItem {
  id: string
  title: string
  source: 'board' | 'daily' | 'checklist'
  completedAt: Date
  dateKey: string
  memberId?: string | null
  memberName?: string
}

const allCompletedItems = computed<CompletedItem[]>(() => {
  const items: CompletedItem[] = []

  // 1. Kanban Cards
  const doneColumnIds = new Set(
    boardStore.columns
      .filter(
        (col) =>
          col.isDoneColumn ||
          /conclu[íi]do|done|pronto|finalizad/i.test(col.title),
      )
      .map((col) => col.id),
  )

  for (const card of boardStore.cards) {
    const isCardDone = card.completed || doneColumnIds.has(card.columnId)
    if (isCardDone) {
      const dateStr = card.updatedAt || card.createdAt
      const dateObj = dateStr ? new Date(dateStr) : new Date()
      items.push({
        id: `card-${card.id}`,
        title: card.title,
        source: 'board',
        completedAt: dateObj,
        dateKey: formatDateKey(dateObj),
        memberId: card.memberIds[0] || null,
      })
    }

    // 2. Card Checklists Items
    for (const checklist of card.checklists || []) {
      for (const item of checklist.items || []) {
        if (item.completed) {
          const dateObj = card.updatedAt ? new Date(card.updatedAt) : new Date()
          items.push({
            id: `chk-${item.id}`,
            title: `${card.title} > ${item.text}`,
            source: 'checklist',
            completedAt: dateObj,
            dateKey: formatDateKey(dateObj),
            memberId: item.assigneeIds?.[0] || card.memberIds[0] || null,
          })
        }
      }
    }
  }

  // 3. Daily Todos
  for (const entry of dailyStore.entries) {
    const entryDate = parseDateKey(entry.dateKey)
    for (const todo of entry.todos || []) {
      if (todo.completed) {
        items.push({
          id: `daily-${todo.id}`,
          title: todo.text,
          source: 'daily',
          completedAt: entryDate,
          dateKey: entry.dateKey,
          memberId: entry.memberId,
        })
      }
    }
  }

  return items
})

// Filtered completed items based on source filter
const filteredCompletedItems = computed(() => {
  if (sourceFilter.value === 'all') return allCompletedItems.value
  if (sourceFilter.value === 'board') {
    return allCompletedItems.value.filter((i) => i.source === 'board' || i.source === 'checklist')
  }
  return allCompletedItems.value.filter((i) => i.source === 'daily')
})

// Summary Stats
const todayKey = formatDateKey(new Date())

const stats = computed(() => {
  const now = new Date()
  const items = filteredCompletedItems.value

  const todayCount = items.filter((i) => i.dateKey === todayKey).length

  // Start of week (Monday)
  const startOfWeek = new Date(now)
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  startOfWeek.setDate(diff)
  startOfWeek.setHours(0, 0, 0, 0)

  const thisWeekCount = items.filter((i) => i.completedAt >= startOfWeek).length

  // Start of month
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const thisMonthCount = items.filter((i) => i.completedAt >= startOfMonth).length

  // Total items (done + pending) for completion rate
  let totalBoardCards = boardStore.cards.length
  let totalDailyTodos = dailyStore.entries.reduce((acc, e) => acc + (e.todos?.length || 0), 0)
  
  let totalTaskCount = 0
  if (sourceFilter.value === 'all') totalTaskCount = totalBoardCards + totalDailyTodos
  else if (sourceFilter.value === 'board') totalTaskCount = totalBoardCards
  else totalTaskCount = totalDailyTodos

  const totalCompleted = items.length
  const completionRate = totalTaskCount > 0 ? Math.min(100, Math.round((totalCompleted / totalTaskCount) * 100)) : 0

  return {
    totalCompleted,
    todayCount,
    thisWeekCount,
    thisMonthCount,
    completionRate,
    totalTaskCount,
  }
})

// Aggregation for Charts (Daily / Weekly / Monthly)
interface ChartBar {
  label: string
  subLabel?: string
  dateKey: string
  boardCount: number
  dailyCount: number
  total: number
}

const chartData = computed<ChartBar[]>(() => {
  const bars: ChartBar[] = []
  const now = new Date()
  const items = filteredCompletedItems.value

  if (period.value === 'daily') {
    // Last 14 days
    for (let i = 13; i >= 0; i--) {
      const d = new Date()
      d.setDate(now.getDate() - i)
      const key = formatDateKey(d)

      const dayItems = items.filter((item) => item.dateKey === key)
      const boardCount = dayItems.filter((item) => item.source === 'board' || item.source === 'checklist').length
      const dailyCount = dayItems.filter((item) => item.source === 'daily').length

      const dayName = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
      const dayNum = d.getDate()
      const monthNum = d.getMonth() + 1

      bars.push({
        label: `${dayName}, ${dayNum}/${monthNum}`,
        subLabel: `${dayNum}/${monthNum}`,
        dateKey: key,
        boardCount,
        dailyCount,
        total: boardCount + dailyCount,
      })
    }
  } else if (period.value === 'weekly') {
    // Last 12 weeks
    for (let i = 11; i >= 0; i--) {
      const d = new Date()
      d.setDate(now.getDate() - i * 7)
      const weekNum = getWeekNumber(d)
      const year = d.getFullYear()

      // Find all items within week range
      const weekStart = new Date(d)
      const dayOfWeek = d.getDay()
      const diffToMon = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
      weekStart.setDate(diffToMon)
      weekStart.setHours(0, 0, 0, 0)

      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)
      weekEnd.setHours(23, 59, 59, 999)

      const weekItems = items.filter((item) => item.completedAt >= weekStart && item.completedAt <= weekEnd)
      const boardCount = weekItems.filter((item) => item.source === 'board' || item.source === 'checklist').length
      const dailyCount = weekItems.filter((item) => item.source === 'daily').length

      bars.push({
        label: `Sem ${weekNum}`,
        subLabel: `${weekStart.getDate()}/${weekStart.getMonth() + 1}`,
        dateKey: `W${weekNum}-${year}`,
        boardCount,
        dailyCount,
        total: boardCount + dailyCount,
      })
    }
  } else {
    // Last 12 months
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthName = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
      const year = d.getFullYear()

      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1)
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)

      const monthItems = items.filter((item) => item.completedAt >= monthStart && item.completedAt <= monthEnd)
      const boardCount = monthItems.filter((item) => item.source === 'board' || item.source === 'checklist').length
      const dailyCount = monthItems.filter((item) => item.source === 'daily').length

      bars.push({
        label: `${monthName.toUpperCase()} ${year !== now.getFullYear() ? `'${String(year).slice(-2)}` : ''}`,
        subLabel: monthName,
        dateKey: `${year}-${d.getMonth() + 1}`,
        boardCount,
        dailyCount,
        total: boardCount + dailyCount,
      })
    }
  }

  return bars
})

// Peak value for scaling chart
const maxChartValue = computed(() => {
  const max = Math.max(...chartData.value.map((b) => b.total), 1)
  return Math.ceil(max * 1.15)
})

// Distribution by Source (Donut Chart data)
const sourceDistribution = computed(() => {
  const items = allCompletedItems.value
  const kanbanCount = items.filter((i) => i.source === 'board').length
  const checklistCount = items.filter((i) => i.source === 'checklist').length
  const dailyCount = items.filter((i) => i.source === 'daily').length
  const total = items.length || 1

  return [
    { name: 'Cartões Quadro', count: kanbanCount, percent: Math.round((kanbanCount / total) * 100), color: '#3b82f6' },
    { name: 'Checklists', count: checklistCount, percent: Math.round((checklistCount / total) * 100), color: '#a855f7' },
    { name: 'Tarefas Diárias', count: dailyCount, percent: Math.round((dailyCount / total) * 100), color: '#10b981' },
  ]
})

// SVG Donut Calculations
const donutSegments = computed(() => {
  const dist = sourceDistribution.value
  const total = dist.reduce((acc, d) => acc + d.count, 0) || 1
  let cumulativeAngle = 0

  return dist.map((item) => {
    const angle = (item.count / total) * 360
    const startAngle = cumulativeAngle
    cumulativeAngle += angle

    // SVG arc stroke-dasharray approach
    const strokeDasharray = `${(angle / 360) * 282.7} 282.7`
    const strokeDashoffset = -((startAngle / 360) * 282.7)

    return {
      ...item,
      strokeDasharray,
      strokeDashoffset,
    }
  })
})

// Member Performance Ranking
const memberPerformance = computed(() => {
  const members = boardStore.members
  const items = filteredCompletedItems.value
  const map: Record<string, { member: typeof members[0]; count: number }> = {}

  for (const member of members) {
    map[member.id] = { member, count: 0 }
  }

  for (const item of items) {
    if (item.memberId && map[item.memberId]) {
      map[item.memberId].count++
    }
  }

  const list = Object.values(map).sort((a, b) => b.count - a.count)
  const max = Math.max(...list.map((l) => l.count), 1)

  return list.map((l) => ({
    ...l,
    percentage: Math.round((l.count / max) * 100),
  }))
})

// Recent Completed Items List (top 8)
const recentCompletedList = computed(() => {
  return [...filteredCompletedItems.value]
    .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime())
    .slice(0, 8)
})

function getMemberObj(memberId?: string | null) {
  if (!memberId) return null
  return boardStore.members.find((m) => m.id === memberId) || null
}
</script>

<template>
  <div class="page-shell my-4 flex flex-1 flex-col gap-6 overflow-y-auto pb-24 pr-1">
    <!-- Header with Title & Period Controls -->
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="flex items-center gap-2 text-2xl font-bold text-text-primary tracking-tight">
          <BarChart3 class="h-7 w-7 text-accent" />
          Métricas de Tarefas Realizadas
        </h1>
        <p class="mt-1 text-sm text-text-secondary">
          Acompanhe o desempenho e a entrega de tarefas no seu fluxo de trabalho.
        </p>
      </div>

      <!-- Controls: Period Tabs & Source Filter -->
      <div class="flex flex-wrap items-center gap-2.5">
        <!-- Source Filter Dropdown/Pills -->
        <div class="flex items-center rounded-xl bg-surface/90 p-1 border border-border-subtle/60 text-xs">
          <button
            type="button"
            :class="[
              'rounded-lg px-2.5 py-1.5 font-medium transition-all',
              sourceFilter === 'all'
                ? 'bg-accent/20 text-text-primary ring-1 ring-accent/45'
                : 'text-text-secondary hover:text-text-primary',
            ]"
            @click="sourceFilter = 'all'"
          >
            Todas
          </button>
          <button
            type="button"
            :class="[
              'rounded-lg px-2.5 py-1.5 font-medium transition-all',
              sourceFilter === 'board'
                ? 'bg-accent/20 text-text-primary ring-1 ring-accent/45'
                : 'text-text-secondary hover:text-text-primary',
            ]"
            @click="sourceFilter = 'board'"
          >
            Quadro
          </button>
          <button
            type="button"
            :class="[
              'rounded-lg px-2.5 py-1.5 font-medium transition-all',
              sourceFilter === 'daily'
                ? 'bg-accent/20 text-text-primary ring-1 ring-accent/45'
                : 'text-text-secondary hover:text-text-primary',
            ]"
            @click="sourceFilter = 'daily'"
          >
            Diárias
          </button>
        </div>

        <!-- Period Toggle -->
        <div class="flex items-center rounded-xl bg-surface/90 p-1 border border-border-subtle/60 text-xs">
          <button
            type="button"
            :class="[
              'rounded-lg px-3 py-1.5 font-semibold transition-all',
              period === 'daily'
                ? 'bg-accent text-board shadow-md'
                : 'text-text-secondary hover:text-text-primary',
            ]"
            @click="period = 'daily'"
          >
            Diário
          </button>
          <button
            type="button"
            :class="[
              'rounded-lg px-3 py-1.5 font-semibold transition-all',
              period === 'weekly'
                ? 'bg-accent text-board shadow-md'
                : 'text-text-secondary hover:text-text-primary',
            ]"
            @click="period = 'weekly'"
          >
            Semanal
          </button>
          <button
            type="button"
            :class="[
              'rounded-lg px-3 py-1.5 font-semibold transition-all',
              period === 'monthly'
                ? 'bg-accent text-board shadow-md'
                : 'text-text-secondary hover:text-text-primary',
            ]"
            @click="period = 'monthly'"
          >
            Mensal
          </button>
        </div>
      </div>
    </div>

    <!-- Key Metrics Cards Grid -->
    <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
      <!-- Card 1: Total Concluídas -->
      <div class="panel-glass flex items-center gap-4 rounded-2xl p-4 transition-all hover:border-accent/40">
        <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400">
          <CheckCircle2 class="h-6 w-6" />
        </div>
        <div>
          <span class="text-xs font-medium text-text-secondary">Total Realizadas</span>
          <div class="mt-0.5 flex items-baseline gap-2">
            <span class="text-2xl font-bold text-text-primary">{{ stats.totalCompleted }}</span>
            <span class="text-xs text-text-muted">tarefas</span>
          </div>
        </div>
      </div>

      <!-- Card 2: Concluídas Hoje -->
      <div class="panel-glass flex items-center gap-4 rounded-2xl p-4 transition-all hover:border-accent/40">
        <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
          <Zap class="h-6 w-6" />
        </div>
        <div>
          <span class="text-xs font-medium text-text-secondary">Concluídas Hoje</span>
          <div class="mt-0.5 flex items-baseline gap-2">
            <span class="text-2xl font-bold text-text-primary">{{ stats.todayCount }}</span>
            <span class="text-xs text-emerald-400 font-medium">Hoje</span>
          </div>
        </div>
      </div>

      <!-- Card 3: Esta Semana -->
      <div class="panel-glass flex items-center gap-4 rounded-2xl p-4 transition-all hover:border-accent/40">
        <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-500/15 text-purple-400">
          <Calendar class="h-6 w-6" />
        </div>
        <div>
          <span class="text-xs font-medium text-text-secondary">Esta Semana</span>
          <div class="mt-0.5 flex items-baseline gap-2">
            <span class="text-2xl font-bold text-text-primary">{{ stats.thisWeekCount }}</span>
            <span class="text-xs text-text-muted">nos últimos 7 dias</span>
          </div>
        </div>
      </div>

      <!-- Card 4: Taxa de Conclusão -->
      <div class="panel-glass flex items-center gap-4 rounded-2xl p-4 transition-all hover:border-accent/40">
        <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
          <TrendingUp class="h-6 w-6" />
        </div>
        <div>
          <span class="text-xs font-medium text-text-secondary">Taxa de Conclusão</span>
          <div class="mt-0.5 flex items-baseline gap-2">
            <span class="text-2xl font-bold text-text-primary">{{ stats.completionRate }}%</span>
            <span class="text-xs text-amber-400 font-medium">Entregas</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Chart Section: Interactive SVG Bar/Line Chart -->
    <div class="panel-glass flex flex-col rounded-2xl p-5">
      <div class="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle/40 pb-4">
        <div>
          <h2 class="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Flame class="h-5 w-5 text-amber-400" />
            Evolução de Entregas ({{ period === 'daily' ? 'Visão Diária' : period === 'weekly' ? 'Visão Semanal' : 'Visão Mensal' }})
          </h2>
          <p class="text-xs text-text-secondary">
            Quantidade de tarefas concluídas ao longo do tempo.
          </p>
        </div>

        <!-- Chart Legend -->
        <div class="flex items-center gap-4 text-xs font-medium">
          <div class="flex items-center gap-1.5">
            <span class="h-3 w-3 rounded-full bg-blue-500"></span>
            <span class="text-text-secondary">Quadro Kanban</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="h-3 w-3 rounded-full bg-emerald-500"></span>
            <span class="text-text-secondary">Tarefas Diárias</span>
          </div>
        </div>
      </div>

      <!-- SVG Chart Canvas Container -->
      <div class="relative h-64 w-full">
        <!-- Empty state if no data -->
        <div
          v-if="chartData.every((b) => b.total === 0)"
          class="flex h-full w-full items-center justify-center text-sm text-text-muted"
        >
          Nenhuma tarefa realizada registrada para o período selecionado.
        </div>

        <div v-else class="flex h-full w-full flex-col justify-between pt-4">
          <!-- Bars Container -->
          <div class="relative flex h-48 w-full items-end gap-1.5 sm:gap-3 px-2">
            <!-- Y-Axis Grid Lines -->
            <div class="pointer-events-none absolute inset-0 flex flex-col justify-between opacity-15">
              <div class="border-b border-white"></div>
              <div class="border-b border-white"></div>
              <div class="border-b border-white"></div>
            </div>

            <!-- Interactive Bars -->
            <div
              v-for="(bar, index) in chartData"
              :key="bar.dateKey"
              class="group relative flex flex-1 flex-col items-center h-full justify-end"
              @mouseenter="hoveredBarIndex = index"
              @mouseleave="hoveredBarIndex = null"
            >
              <!-- Tooltip on hover -->
              <div
                v-if="hoveredBarIndex === index"
                class="absolute -top-12 z-30 flex flex-col items-center rounded-lg bg-surface border border-accent/40 px-2.5 py-1 text-center shadow-xl backdrop-blur-md"
              >
                <span class="text-[11px] font-bold text-text-primary">{{ bar.label }}</span>
                <span class="text-[10px] text-text-secondary">
                  Total: <strong class="text-accent">{{ bar.total }}</strong> (Kanban: {{ bar.boardCount }} | Daily: {{ bar.dailyCount }})
                </span>
              </div>

              <!-- Bar Stacks -->
              <div
                class="w-full max-w-[28px] rounded-t-md overflow-hidden flex flex-col justify-end transition-all duration-300 group-hover:brightness-125"
                :style="{
                  height: `${Math.max((bar.total / maxChartValue) * 100, bar.total > 0 ? 6 : 2)}%`,
                }"
              >
                <!-- Board Portion -->
                <div
                  v-if="bar.boardCount > 0"
                  class="w-full bg-gradient-to-t from-blue-600 to-blue-400 transition-all"
                  :style="{ height: `${(bar.boardCount / bar.total) * 100}%` }"
                ></div>
                <!-- Daily Portion -->
                <div
                  v-if="bar.dailyCount > 0"
                  class="w-full bg-gradient-to-t from-emerald-600 to-emerald-400 transition-all"
                  :style="{ height: `${(bar.dailyCount / bar.total) * 100}%` }"
                ></div>
              </div>

              <!-- Value Badge on top of bar if not 0 -->
              <span
                v-if="bar.total > 0"
                class="mb-1 text-[10px] font-bold text-text-primary group-hover:scale-110 transition-transform"
              >
                {{ bar.total }}
              </span>
            </div>
          </div>

          <!-- X-Axis Labels -->
          <div class="flex w-full justify-between gap-1.5 sm:gap-3 px-2 pt-2 border-t border-border-subtle/50 text-[10px] text-text-muted overflow-hidden">
            <div
              v-for="bar in chartData"
              :key="'lbl-' + bar.dateKey"
              class="flex flex-1 justify-center text-center font-medium truncate"
            >
              {{ bar.subLabel || bar.label }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Secondary Charts Grid: Distribution Donut & Member Ranking -->
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <!-- Donut Chart: Distribution by Source -->
      <div class="panel-glass flex flex-col rounded-2xl p-5">
        <h3 class="text-base font-semibold text-text-primary flex items-center gap-2 mb-1">
          <PieChart class="h-5 w-5 text-indigo-400" />
          Distribuição por Origem
        </h3>
        <p class="text-xs text-text-secondary mb-4">
          Origem das tarefas finalizadas no sistema.
        </p>

        <div class="flex flex-col sm:flex-row items-center justify-around gap-6 my-auto py-2">
          <!-- SVG Donut -->
          <div class="relative h-44 w-44 shrink-0 flex items-center justify-center">
            <svg class="h-full w-full -rotate-90 transform" viewBox="0 0 100 100">
              <!-- Background Circle -->
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="transparent"
                stroke="#1f1f23"
                stroke-width="10"
              />
              <!-- Donut Segments -->
              <circle
                v-for="seg in donutSegments"
                :key="seg.name"
                cx="50"
                cy="50"
                r="45"
                fill="transparent"
                :stroke="seg.color"
                stroke-width="10"
                :stroke-dasharray="seg.strokeDasharray"
                :stroke-dashoffset="seg.strokeDashoffset"
                class="transition-all duration-500 hover:opacity-80"
              />
            </svg>
            <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span class="text-2xl font-bold text-text-primary">{{ stats.totalCompleted }}</span>
              <span class="text-[10px] text-text-muted font-medium uppercase">Tarefas</span>
            </div>
          </div>

          <!-- Donut Legend & Percentages -->
          <div class="flex flex-col gap-3 w-full max-w-xs">
            <div
              v-for="seg in sourceDistribution"
              :key="seg.name"
              class="flex items-center justify-between rounded-xl bg-surface/60 p-2.5 text-xs border border-border-subtle/40"
            >
              <div class="flex items-center gap-2.5">
                <span class="h-3 w-3 rounded-full" :style="{ backgroundColor: seg.color }"></span>
                <span class="font-medium text-text-primary">{{ seg.name }}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="font-bold text-text-primary">{{ seg.count }}</span>
                <span class="text-text-muted text-[11px]">({{ seg.percent }}%)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Member Ranking / Assignee Breakdown -->
      <div class="panel-glass flex flex-col rounded-2xl p-5">
        <h3 class="text-base font-semibold text-text-primary flex items-center gap-2 mb-1">
          <UserCheck class="h-5 w-5 text-emerald-400" />
          Produtividade da Equipe
        </h3>
        <p class="text-xs text-text-secondary mb-4">
          Tarefas concluídas atribuídas a membros.
        </p>

        <div v-if="memberPerformance.length === 0" class="flex flex-1 items-center justify-center text-xs text-text-muted">
          Nenhum membro cadastrado.
        </div>

        <div v-else class="flex flex-col gap-3.5 my-auto">
          <div
            v-for="item in memberPerformance"
            :key="item.member.id"
            class="flex flex-col gap-1.5"
          >
            <div class="flex items-center justify-between text-xs">
              <div class="flex items-center gap-2">
                <MemberAvatar :member="item.member" size="sm" />
                <span class="font-medium text-text-primary">{{ item.member.name }}</span>
              </div>
              <span class="font-bold text-accent">{{ item.count }} concluídas</span>
            </div>
            <!-- Progress Bar -->
            <div class="h-2 w-full overflow-hidden rounded-full bg-surface">
              <div
                class="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                :style="{ width: `${item.percentage}%` }"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Recent Activity Table -->
    <div class="panel-glass flex flex-col rounded-2xl p-5">
      <h3 class="text-base font-semibold text-text-primary flex items-center gap-2 mb-4">
        <Clock class="h-5 w-5 text-sky-400" />
        Últimas Tarefas Concluídas
      </h3>

      <div v-if="recentCompletedList.length === 0" class="py-8 text-center text-xs text-text-muted">
        Nenhuma tarefa concluída recentemente.
      </div>

      <div v-else class="flex flex-col divide-y divide-border-subtle/30">
        <div
          v-for="item in recentCompletedList"
          :key="item.id"
          class="flex items-center justify-between py-2.5 text-xs transition-colors hover:bg-surface/40 px-2 rounded-lg"
        >
          <div class="flex items-center gap-3 min-w-0 pr-2">
            <!-- Source Badge -->
            <span
              :class="[
                'inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase',
                item.source === 'board'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : item.source === 'checklist'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
              ]"
            >
              <Kanban v-if="item.source === 'board'" class="h-3 w-3" />
              <CheckSquare v-else-if="item.source === 'checklist'" class="h-3 w-3" />
              <Layers v-else class="h-3 w-3" />
              {{ item.source === 'board' ? 'Quadro' : item.source === 'checklist' ? 'Checklist' : 'Diária' }}
            </span>

            <span class="truncate font-medium text-text-primary">{{ item.title }}</span>
          </div>

          <div class="flex items-center gap-3 shrink-0">
            <MemberAvatar
              v-if="getMemberObj(item.memberId)"
              :member="getMemberObj(item.memberId)!"
              size="sm"
            />
            <span class="text-[11px] text-text-muted">
              {{ item.completedAt.toLocaleDateString('pt-BR') }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
