<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Flame,
  LayoutGrid,
  Megaphone,
  Pencil,
  Plus,
  ShoppingBag,
  Trash2,
  TrendingUp,
  X,
  Zap,
} from '@lucide/vue'
import { useBoardStore } from '../stores/board'
import { useDailyStore } from '../stores/dailyTodos'
import { useCampaignsStore } from '../stores/campaigns'

type PeriodType = 'daily' | 'weekly' | 'monthly'
type SourceFilter = 'all' | 'board' | 'daily'

export interface HubLink {
  id: string
  title: string
  url: string
  brand: 'runff' | 'kalfe'
  category: 'planilha' | 'marketplace' | 'meta_ads' | 'outro'
  description?: string
}

const STORAGE_LINKS_KEY = 'kanban_hub_all_links_v2'

const defaultLinks: HubLink[] = [
  // Runff
  {
    id: 'link-runff-1',
    title: 'Planilha de Aportes Runff',
    url: 'https://docs.google.com',
    brand: 'runff',
    category: 'planilha',
    description: 'Controle de investimentos e aportes de organizadores',
  },
  {
    id: 'link-runff-2',
    title: 'ClickUp Runff (Eventos)',
    url: 'https://clickup.com',
    brand: 'runff',
    category: 'outro',
    description: 'Demandas e tarefas recebidas de organizadores',
  },
  {
    id: 'link-runff-3',
    title: 'Meta Ads Manager (Runff)',
    url: 'https://business.facebook.com',
    brand: 'runff',
    category: 'meta_ads',
    description: 'Gerenciador de anúncios Meta da Runff',
  },
  // Kalfe
  {
    id: 'link-kalfe-1',
    title: 'Mercado Livre Seller Center',
    url: 'https://www.mercadolivre.com.br',
    brand: 'kalfe',
    category: 'marketplace',
    description: 'Painel de produtos e Product Ads Mercado Livre',
  },
  {
    id: 'link-kalfe-2',
    title: 'Netshoes Partner Ads',
    url: 'https://www.netshoes.com.br',
    brand: 'kalfe',
    category: 'marketplace',
    description: 'Gestão de anúncios e catálogo Netshoes',
  },
  {
    id: 'link-kalfe-3',
    title: 'Zattini Partner',
    url: 'https://www.zattini.com.br',
    brand: 'kalfe',
    category: 'marketplace',
    description: 'Gestão de campanhas Zattini',
  },
  {
    id: 'link-kalfe-4',
    title: 'Amazon Seller Central',
    url: 'https://sellercentral.amazon.com.br',
    brand: 'kalfe',
    category: 'marketplace',
    description: 'Painel de vendas e Sponsored Products Amazon',
  },
  {
    id: 'link-kalfe-5',
    title: 'Planilha de MKT Kalfe',
    url: 'https://docs.google.com',
    brand: 'kalfe',
    category: 'planilha',
    description: 'Planejamento de tráfego e marketplace ads',
  },
]

const boardStore = useBoardStore()
const dailyStore = useDailyStore()
const campaignsStore = useCampaignsStore()

const period = ref<PeriodType>('daily')
const sourceFilter = ref<SourceFilter>('all')
const hoveredBarIndex = ref<number | null>(null)

// Links State
const hubLinks = ref<HubLink[]>([])
const showAddLinkModal = ref(false)
const showEditLinkModal = ref(false)

// Add Form Fields
const newLinkTitle = ref('')
const newLinkUrl = ref('')
const newLinkBrand = ref<'runff' | 'kalfe'>('runff')
const newLinkCategory = ref<'planilha' | 'marketplace' | 'meta_ads' | 'outro'>('planilha')
const newLinkDesc = ref('')

// Edit Form Fields
const editingLinkId = ref<string | null>(null)
const editLinkTitle = ref('')
const editLinkUrl = ref('')
const editLinkBrand = ref<'runff' | 'kalfe'>('runff')
const editLinkCategory = ref<'planilha' | 'marketplace' | 'meta_ads' | 'outro'>('planilha')
const editLinkDesc = ref('')

function loadLinks() {
  try {
    const raw = localStorage.getItem(STORAGE_LINKS_KEY)
    if (raw) {
      hubLinks.value = JSON.parse(raw)
    } else {
      hubLinks.value = [...defaultLinks]
      saveLinks()
    }
  } catch {
    hubLinks.value = [...defaultLinks]
  }
}

function saveLinks() {
  try {
    localStorage.setItem(STORAGE_LINKS_KEY, JSON.stringify(hubLinks.value))
  } catch (err) {
    console.error('Error saving links', err)
  }
}

function submitAddLink() {
  const title = newLinkTitle.value.trim()
  let url = newLinkUrl.value.trim()
  if (!title || !url) return

  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`
  }

  const newLink: HubLink = {
    id: `link-${Date.now()}`,
    title,
    url,
    brand: newLinkBrand.value,
    category: newLinkCategory.value,
    description: newLinkDesc.value.trim() || undefined,
  }

  hubLinks.value.unshift(newLink)
  saveLinks()

  // Reset Form
  newLinkTitle.value = ''
  newLinkUrl.value = ''
  newLinkDesc.value = ''
  showAddLinkModal.value = false
}

function openEditLinkModal(link: HubLink) {
  editingLinkId.value = link.id
  editLinkTitle.value = link.title
  editLinkUrl.value = link.url
  editLinkBrand.value = link.brand
  editLinkCategory.value = link.category
  editLinkDesc.value = link.description || ''
  showEditLinkModal.value = true
}

function submitEditLink() {
  if (!editingLinkId.value) return
  const link = hubLinks.value.find((l) => l.id === editingLinkId.value)
  if (!link) return

  let url = editLinkUrl.value.trim()
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`
  }

  link.title = editLinkTitle.value.trim()
  link.url = url
  link.brand = editLinkBrand.value
  link.category = editLinkCategory.value
  link.description = editLinkDesc.value.trim() || undefined

  saveLinks()
  showEditLinkModal.value = false
  editingLinkId.value = null
}

function deleteLink(linkId: string) {
  if (window.confirm('Excluir este atalho de planilha/link?')) {
    hubLinks.value = hubLinks.value.filter((l) => l.id !== linkId)
    saveLinks()
  }
}

const runffLinks = computed(() => hubLinks.value.filter((l) => l.brand === 'runff'))
const kalfeLinks = computed(() => hubLinks.value.filter((l) => l.brand === 'kalfe'))

onMounted(async () => {
  loadLinks()
  campaignsStore.init()
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
  const totalBoardCards = boardStore.cards.length
  const totalDailyTodos = dailyStore.entries.reduce((acc, e) => acc + (e.todos?.length || 0), 0)
  
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

const maxChartValue = computed(() => {
  const max = Math.max(...chartData.value.map((b) => b.total), 1)
  return Math.ceil(max * 1.15)
})
</script>

<template>
  <div class="page-shell my-4 flex flex-1 flex-col gap-6 overflow-y-auto no-scrollbar pb-24 pr-1">
    <!-- Header Principal -->
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="flex items-center gap-2.5 text-2xl font-extrabold text-text-primary tracking-tight">
          <div class="flex size-9 items-center justify-center rounded-xl bg-accent/20 text-accent">
            <LayoutGrid :size="22" />
          </div>
          Hub & Central de Operações
        </h1>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-board shadow-lg shadow-accent/20 transition-transform hover:scale-[1.02] active:scale-95"
          @click="showAddLinkModal = true"
        >
          <Plus :size="16" :stroke-width="2.5" />
          Adicionar Link / Planilha
        </button>
      </div>
    </div>

    <!-- SEÇÕES DE PLANILHAS E ATALHOS (RUNFF vs KALFE) -->
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      
      <!-- SEÇÃO 🟧 RUNFF -->
      <div class="panel-glass flex flex-col rounded-2xl p-5 space-y-4 border border-orange-500/20 bg-orange-500/5">
        <div class="flex items-center justify-between border-b border-orange-500/20 pb-3">
          <div class="flex items-center gap-2.5">
            <div class="flex size-8 items-center justify-center rounded-xl bg-orange-500/20 text-orange-400">
              <Megaphone :size="18" />
            </div>
            <h2 class="text-base font-extrabold text-text-primary">Runff</h2>
          </div>
          <span class="rounded-full bg-orange-500/20 px-2.5 py-0.5 text-[10px] font-bold text-orange-300">
            {{ runffLinks.length }} atalho(s)
          </span>
        </div>

        <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div
            v-for="link in runffLinks"
            :key="link.id"
            class="group relative flex flex-col justify-between rounded-xl border border-white/10 bg-board-elevated/80 p-3.5 transition-all hover:border-orange-500/40 hover:bg-board-elevated"
          >
            <div>
              <div class="flex items-center justify-between gap-2">
                <span class="inline-flex items-center gap-1 rounded bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-orange-300">
                  {{ link.category === 'planilha' ? '📊 Planilha' : link.category === 'meta_ads' ? '📢 Meta Ads' : '🔗 Link' }}
                </span>
                
                <!-- Botões de Ação: Editar e Excluir -->
                <div class="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    class="rounded p-1 text-text-muted hover:bg-white/10 hover:text-text-primary"
                    title="Editar atalho"
                    @click="openEditLinkModal(link)"
                  >
                    <Pencil :size="13" />
                  </button>
                  <button
                    type="button"
                    class="rounded p-1 text-text-muted hover:bg-danger/15 hover:text-danger"
                    title="Excluir atalho"
                    @click="deleteLink(link.id)"
                  >
                    <Trash2 :size="13" />
                  </button>
                </div>
              </div>

              <h3 class="mt-2 text-xs font-bold text-text-primary group-hover:text-orange-400 transition-colors">
                {{ link.title }}
              </h3>
              <p v-if="link.description" class="mt-0.5 text-[11px] text-text-muted line-clamp-2">
                {{ link.description }}
              </p>
            </div>

            <a
              :href="link.url"
              target="_blank"
              rel="noopener noreferrer"
              class="mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg bg-orange-500/20 px-3 py-1.5 text-xs font-bold text-orange-300 transition-colors hover:bg-orange-500/30"
            >
              Abrir Ferramenta
              <ExternalLink :size="13" />
            </a>
          </div>
        </div>
      </div>

      <!-- SEÇÃO 🟢 KALFE -->
      <div class="panel-glass flex flex-col rounded-2xl p-5 space-y-4 border border-emerald-500/20 bg-emerald-500/5">
        <div class="flex items-center justify-between border-b border-emerald-500/20 pb-3">
          <div class="flex items-center gap-2.5">
            <div class="flex size-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
              <ShoppingBag :size="18" />
            </div>
            <h2 class="text-base font-extrabold text-text-primary">Kalfe</h2>
          </div>
          <span class="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
            {{ kalfeLinks.length }} atalho(s)
          </span>
        </div>

        <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div
            v-for="link in kalfeLinks"
            :key="link.id"
            class="group relative flex flex-col justify-between rounded-xl border border-white/10 bg-board-elevated/80 p-3.5 transition-all hover:border-emerald-500/40 hover:bg-board-elevated"
          >
            <div>
              <div class="flex items-center justify-between gap-2">
                <span class="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
                  {{ link.category === 'marketplace' ? '🛒 Marketplace' : link.category === 'planilha' ? '📊 Planilha' : '🔗 Link' }}
                </span>
                
                <!-- Botões de Ação: Editar e Excluir -->
                <div class="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    class="rounded p-1 text-text-muted hover:bg-white/10 hover:text-text-primary"
                    title="Editar atalho"
                    @click="openEditLinkModal(link)"
                  >
                    <Pencil :size="13" />
                  </button>
                  <button
                    type="button"
                    class="rounded p-1 text-text-muted hover:bg-danger/15 hover:text-danger"
                    title="Excluir atalho"
                    @click="deleteLink(link.id)"
                  >
                    <Trash2 :size="13" />
                  </button>
                </div>
              </div>

              <h3 class="mt-2 text-xs font-bold text-text-primary group-hover:text-emerald-400 transition-colors">
                {{ link.title }}
              </h3>
              <p v-if="link.description" class="mt-0.5 text-[11px] text-text-muted line-clamp-2">
                {{ link.description }}
              </p>
            </div>

            <a
              :href="link.url"
              target="_blank"
              rel="noopener noreferrer"
              class="mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-300 transition-colors hover:bg-emerald-500/30"
            >
              Abrir Ferramenta
              <ExternalLink :size="13" />
            </a>
          </div>
        </div>
      </div>

    </div>

    <!-- SEÇÃO DE GRÁFICOS & ANALYTICS INTEGRADO -->
    <div class="border-t border-white/10 pt-6 space-y-6">
      
      <!-- Controles de Período e Origem dos Gráficos -->
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 class="text-lg font-bold text-text-primary flex items-center gap-2">
            <BarChart3 class="h-5 w-5 text-accent" />
            Métricas de Entregas & Produtividade
          </h2>
          <p class="text-xs text-text-muted">Acompanhamento do volume de tarefas concluídas no sistema.</p>
        </div>

        <div class="flex flex-wrap items-center gap-2.5 text-xs">
          <!-- Filtro de Origem -->
          <div class="flex items-center rounded-xl bg-surface/90 p-1 border border-border-subtle/60">
            <button
              type="button"
              :class="[
                'rounded-lg px-2.5 py-1.5 font-semibold transition-all',
                sourceFilter === 'all'
                  ? 'bg-accent/20 text-text-primary ring-1 ring-accent/45'
                  : 'text-text-muted hover:text-text-primary',
              ]"
              @click="sourceFilter = 'all'"
            >
              Todas
            </button>
            <button
              type="button"
              :class="[
                'rounded-lg px-2.5 py-1.5 font-semibold transition-all',
                sourceFilter === 'board'
                  ? 'bg-accent/20 text-text-primary ring-1 ring-accent/45'
                  : 'text-text-muted hover:text-text-primary',
              ]"
              @click="sourceFilter = 'board'"
            >
              Quadro
            </button>
            <button
              type="button"
              :class="[
                'rounded-lg px-2.5 py-1.5 font-semibold transition-all',
                sourceFilter === 'daily'
                  ? 'bg-accent/20 text-text-primary ring-1 ring-accent/45'
                  : 'text-text-muted hover:text-text-primary',
              ]"
              @click="sourceFilter = 'daily'"
            >
              Diárias
            </button>
          </div>

          <!-- Período -->
          <div class="flex items-center rounded-xl bg-surface/90 p-1 border border-border-subtle/60">
            <button
              type="button"
              :class="[
                'rounded-lg px-3 py-1.5 font-semibold transition-all',
                period === 'daily' ? 'bg-accent text-board' : 'text-text-muted hover:text-text-primary',
              ]"
              @click="period = 'daily'"
            >
              Diário
            </button>
            <button
              type="button"
              :class="[
                'rounded-lg px-3 py-1.5 font-semibold transition-all',
                period === 'weekly' ? 'bg-accent text-board' : 'text-text-muted hover:text-text-primary',
              ]"
              @click="period = 'weekly'"
            >
              Semanal
            </button>
            <button
              type="button"
              :class="[
                'rounded-lg px-3 py-1.5 font-semibold transition-all',
                period === 'monthly' ? 'bg-accent text-board' : 'text-text-muted hover:text-text-primary',
              ]"
              @click="period = 'monthly'"
            >
              Mensal
            </button>
          </div>
        </div>
      </div>

      <!-- Métricas Resumidas -->
      <div class="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <div class="panel-glass flex items-center gap-3.5 rounded-2xl p-4">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400">
            <CheckCircle2 class="h-5 w-5" />
          </div>
          <div>
            <span class="text-[11px] font-medium text-text-muted block">Total Entregues</span>
            <span class="text-xl font-extrabold text-text-primary">{{ stats.totalCompleted }}</span>
          </div>
        </div>

        <div class="panel-glass flex items-center gap-3.5 rounded-2xl p-4">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
            <Zap class="h-5 w-5" />
          </div>
          <div>
            <span class="text-[11px] font-medium text-text-muted block">Entregues Hoje</span>
            <span class="text-xl font-extrabold text-emerald-400">{{ stats.todayCount }}</span>
          </div>
        </div>

        <div class="panel-glass flex items-center gap-3.5 rounded-2xl p-4">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/15 text-purple-400">
            <Calendar class="h-5 w-5" />
          </div>
          <div>
            <span class="text-[11px] font-medium text-text-muted block">Esta Semana</span>
            <span class="text-xl font-extrabold text-text-primary">{{ stats.thisWeekCount }}</span>
          </div>
        </div>

        <div class="panel-glass flex items-center gap-3.5 rounded-2xl p-4">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
            <TrendingUp class="h-5 w-5" />
          </div>
          <div>
            <span class="text-[11px] font-medium text-text-muted block">Taxa de Conclusão</span>
            <span class="text-xl font-extrabold text-amber-400">{{ stats.completionRate }}%</span>
          </div>
        </div>
      </div>

      <!-- Gráfico Principal em Barras -->
      <div class="panel-glass flex flex-col rounded-2xl p-5">
        <div class="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
          <h3 class="text-sm font-bold text-text-primary flex items-center gap-2">
            <Flame class="h-4 w-4 text-amber-400" />
            Evolução de Entregas ({{ period === 'daily' ? 'Visão Diária' : period === 'weekly' ? 'Visão Semanal' : 'Visão Mensal' }})
          </h3>
          <div class="flex items-center gap-4 text-xs font-medium">
            <div class="flex items-center gap-1.5">
              <span class="h-2.5 w-2.5 rounded-full bg-blue-500"></span>
              <span class="text-text-muted text-[11px]">Quadro</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
              <span class="text-text-muted text-[11px]">Diárias</span>
            </div>
          </div>
        </div>

        <div class="relative h-56 w-full">
          <div v-if="chartData.every((b) => b.total === 0)" class="flex h-full w-full items-center justify-center text-xs text-text-muted">
            Nenhuma tarefa concluída no período.
          </div>
          <div v-else class="flex h-full w-full flex-col justify-between pt-2">
            <div class="relative flex h-40 w-full items-end gap-1.5 sm:gap-3 px-2">
              <div
                v-for="(bar, index) in chartData"
                :key="bar.dateKey"
                class="group relative flex flex-col items-center h-full justify-end"
                @mouseenter="hoveredBarIndex = index"
                @mouseleave="hoveredBarIndex = null"
              >
                <div
                  v-if="hoveredBarIndex === index"
                  class="absolute -top-10 z-30 flex flex-col items-center rounded-lg bg-surface border border-accent/40 px-2 py-1 text-center shadow-xl backdrop-blur-md"
                >
                  <span class="text-[10px] font-bold text-text-primary">{{ bar.label }}</span>
                  <span class="text-[9px] text-text-muted">Total: {{ bar.total }}</span>
                </div>

                <div
                  class="w-full max-w-[24px] rounded-t-md overflow-hidden flex flex-col justify-end transition-all duration-300 group-hover:brightness-125"
                  :style="{ height: `${Math.max((bar.total / maxChartValue) * 100, bar.total > 0 ? 6 : 2)}%` }"
                >
                  <div
                    v-if="bar.boardCount > 0"
                    class="w-full bg-gradient-to-t from-blue-600 to-blue-400"
                    :style="{ height: `${(bar.boardCount / bar.total) * 100}%` }"
                  />
                  <div
                    v-if="bar.dailyCount > 0"
                    class="w-full bg-gradient-to-t from-emerald-600 to-emerald-400"
                    :style="{ height: `${(bar.dailyCount / bar.total) * 100}%` }"
                  />
                </div>

                <span v-if="bar.total > 0" class="mb-1 text-[9px] font-bold text-text-primary">
                  {{ bar.total }}
                </span>
              </div>
            </div>

            <div class="flex w-full justify-between gap-1 px-2 pt-2 border-t border-white/10 text-[9px] text-text-muted truncate">
              <div v-for="bar in chartData" :key="'lbl-' + bar.dateKey" class="flex-1 text-center">
                {{ bar.subLabel || bar.label }}
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>

  <!-- MODAL: ADICIONAR NOVO LINK / PLANILHA -->
  <Teleport to="body">
    <div
      v-if="showAddLinkModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        class="absolute inset-0 bg-black/70 backdrop-blur-sm"
        @click="showAddLinkModal = false"
      />
      <form
        class="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-board-elevated p-6 shadow-2xl space-y-4"
        @submit.prevent="submitAddLink"
      >
        <div class="flex items-center justify-between border-b border-white/10 pb-3">
          <h3 class="text-base font-bold text-text-primary">Adicionar Novo Atalho / Planilha</h3>
          <button
            type="button"
            class="text-text-muted hover:text-text-primary"
            @click="showAddLinkModal = false"
          >
            <X :size="18" />
          </button>
        </div>

        <div class="space-y-3 text-xs">
          <label class="block">
            <span class="font-bold text-text-muted block mb-1">Empresa Pertencente *</span>
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                :class="[
                  'rounded-xl border p-2.5 font-bold transition-all text-center',
                  newLinkBrand === 'runff'
                    ? 'border-orange-500 bg-orange-500/20 text-orange-300'
                    : 'border-white/10 bg-surface text-text-muted hover:text-text-primary',
                ]"
                @click="newLinkBrand = 'runff'"
              >
                🟧 Runff
              </button>
              <button
                type="button"
                :class="[
                  'rounded-xl border p-2.5 font-bold transition-all text-center',
                  newLinkBrand === 'kalfe'
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                    : 'border-white/10 bg-surface text-text-muted hover:text-text-primary',
                ]"
                @click="newLinkBrand = 'kalfe'"
              >
                🟢 Kalfe
              </button>
            </div>
          </label>

          <label class="block">
            <span class="font-bold text-text-muted block mb-1">Título do Atalho / Planilha *</span>
            <input
              v-model="newLinkTitle"
              type="text"
              placeholder="Ex: Planilha Mercado Livre Julho"
              class="w-full rounded-xl border border-border-subtle bg-column px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
              required
            />
          </label>

          <label class="block">
            <span class="font-bold text-text-muted block mb-1">URL / Link do Google Sheets ou Ferramenta *</span>
            <input
              v-model="newLinkUrl"
              type="text"
              placeholder="Ex: https://docs.google.com/spreadsheets/d/..."
              class="w-full rounded-xl border border-border-subtle bg-column px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
              required
            />
          </label>

          <label class="block">
            <span class="font-bold text-text-muted block mb-1">Categoria</span>
            <select
              v-model="newLinkCategory"
              class="w-full rounded-xl border border-border-subtle bg-column px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
            >
              <option value="planilha">📊 Planilha / Google Sheets</option>
              <option value="marketplace">🛒 Marketplace (ML, Netshoes, Amazon, Zattini)</option>
              <option value="meta_ads">📢 Meta / Google Ads</option>
              <option value="outro">🔗 Outro Link Utilitário</option>
            </select>
          </label>

          <label class="block">
            <span class="font-bold text-text-muted block mb-1">Descrição Curta (Opcional)</span>
            <input
              v-model="newLinkDesc"
              type="text"
              placeholder="Ex: Controle mensal de verba de tráfego"
              class="w-full rounded-xl border border-border-subtle bg-column px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
            />
          </label>
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <button
            type="button"
            class="rounded-xl px-4 py-2 text-xs text-text-muted hover:bg-white/5"
            @click="showAddLinkModal = false"
          >
            Cancelar
          </button>
          <button
            type="submit"
            class="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-board hover:bg-accent-hover"
          >
            Salvar Atalho
          </button>
        </div>
      </form>
    </div>
  </Teleport>

  <!-- MODAL: EDITAR LINK / PLANILHA -->
  <Teleport to="body">
    <div
      v-if="showEditLinkModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        class="absolute inset-0 bg-black/70 backdrop-blur-sm"
        @click="showEditLinkModal = false"
      />
      <form
        class="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-board-elevated p-6 shadow-2xl space-y-4"
        @submit.prevent="submitEditLink"
      >
        <div class="flex items-center justify-between border-b border-white/10 pb-3">
          <h3 class="text-base font-bold text-text-primary">Editar Atalho / Planilha</h3>
          <button
            type="button"
            class="text-text-muted hover:text-text-primary"
            @click="showEditLinkModal = false"
          >
            <X :size="18" />
          </button>
        </div>

        <div class="space-y-3 text-xs">
          <label class="block">
            <span class="font-bold text-text-muted block mb-1">Empresa Pertencente *</span>
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                :class="[
                  'rounded-xl border p-2.5 font-bold transition-all text-center',
                  editLinkBrand === 'runff'
                    ? 'border-orange-500 bg-orange-500/20 text-orange-300'
                    : 'border-white/10 bg-surface text-text-muted hover:text-text-primary',
                ]"
                @click="editLinkBrand = 'runff'"
              >
                🟧 Runff
              </button>
              <button
                type="button"
                :class="[
                  'rounded-xl border p-2.5 font-bold transition-all text-center',
                  editLinkBrand === 'kalfe'
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                    : 'border-white/10 bg-surface text-text-muted hover:text-text-primary',
                ]"
                @click="editLinkBrand = 'kalfe'"
              >
                🟢 Kalfe
              </button>
            </div>
          </label>

          <label class="block">
            <span class="font-bold text-text-muted block mb-1">Título do Atalho / Planilha *</span>
            <input
              v-model="editLinkTitle"
              type="text"
              class="w-full rounded-xl border border-border-subtle bg-column px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
              required
            />
          </label>

          <label class="block">
            <span class="font-bold text-text-muted block mb-1">URL / Link *</span>
            <input
              v-model="editLinkUrl"
              type="text"
              class="w-full rounded-xl border border-border-subtle bg-column px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
              required
            />
          </label>

          <label class="block">
            <span class="font-bold text-text-muted block mb-1">Categoria</span>
            <select
              v-model="editLinkCategory"
              class="w-full rounded-xl border border-border-subtle bg-column px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
            >
              <option value="planilha">📊 Planilha / Google Sheets</option>
              <option value="marketplace">🛒 Marketplace (ML, Netshoes, Amazon, Zattini)</option>
              <option value="meta_ads">📢 Meta / Google Ads</option>
              <option value="outro">🔗 Outro Link Utilitário</option>
            </select>
          </label>

          <label class="block">
            <span class="font-bold text-text-muted block mb-1">Descrição Curta</span>
            <input
              v-model="editLinkDesc"
              type="text"
              class="w-full rounded-xl border border-border-subtle bg-column px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
            />
          </label>
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <button
            type="button"
            class="rounded-xl px-4 py-2 text-xs text-text-muted hover:bg-white/5"
            @click="showEditLinkModal = false"
          >
            Cancelar
          </button>
          <button
            type="submit"
            class="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-board hover:bg-accent-hover"
          >
            Salvar Alterações
          </button>
        </div>
      </form>
    </div>
  </Teleport>
</template>
