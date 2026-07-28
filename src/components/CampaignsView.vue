<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  ChevronDown,
  ChevronUp,
  Megaphone,
  Plus,
  Search,
  Trash2,
  Trophy,
  X,
} from '@lucide/vue'
import { getCardAporteStats, useBoardStore } from '../stores/board'
import type { Aporte, Card } from '../types/board'

const board = useBoardStore()

const searchQuery = ref('')
const selectedStatusFilter = ref<
  'all' | 'active' | 'ending_soon' | 'expired'
>('all')
const expandedOrganizers = ref<Record<string, boolean>>({})

// State for Modals
const showNewCampaignModal = ref(false)
const showNewAporteModal = ref(false)
const targetCardForAporte = ref<Card | null>(null)

// Form Fields for New Campaign
const newOrganizerName = ref('')
const newEventName = ref('')
const initialAporteAmount = ref<number | ''>('')
const initialStartDate = ref(new Date().toISOString().slice(0, 10))
const initialEndDate = ref('')
const initialNotes = ref('')

// Form Fields for New Aporte Modal
const aporteAmount = ref<number | ''>('')
const aporteDate = ref(new Date().toISOString().slice(0, 10))
const aporteStartDate = ref(new Date().toISOString().slice(0, 10))
const aporteEndDate = ref('')
const aporteNotes = ref('')

// All cards that are considered campaigns (have organizer, eventName, or aportes)
const campaignCards = computed(() => {
  return board.cards.filter((card) => {
    return Boolean(
      card.organizer ||
        card.eventName ||
        (card.aportes && card.aportes.length > 0),
    )
  })
})

// Unique list of organizers
const existingOrganizers = computed(() => {
  const set = new Set<string>()
  campaignCards.value.forEach((card) => {
    if (card.organizer?.trim()) {
      set.add(card.organizer.trim())
    }
  })
  return Array.from(set).sort()
})

// Filtered campaign cards
const filteredCards = computed(() => {
  return campaignCards.value.filter((card) => {
    const org = (card.organizer || '').toLowerCase()
    const evt = (card.eventName || card.title).toLowerCase()
    const query = searchQuery.value.toLowerCase().trim()

    const matchesQuery = !query || org.includes(query) || evt.includes(query)

    if (!matchesQuery) return false

    if (selectedStatusFilter.value === 'all') return true

    const stats = getCardAporteStats(card)
    if (selectedStatusFilter.value === 'active') {
      return stats.status === 'active'
    }
    if (selectedStatusFilter.value === 'ending_soon') {
      return stats.status === 'ending_soon'
    }
    if (selectedStatusFilter.value === 'expired') {
      return stats.status === 'expired'
    }
    return true
  })
})

// Grouped by Organizer
const groupedByOrganizer = computed(() => {
  const groups: Record<
    string,
    {
      organizer: string
      cards: Card[]
      totalAmount: number
      activeCount: number
    }
  > = {}

  filteredCards.value.forEach((card) => {
    const orgKey = card.organizer?.trim() || 'Sem Organizador'
    if (!groups[orgKey]) {
      groups[orgKey] = {
        organizer: orgKey,
        cards: [],
        totalAmount: 0,
        activeCount: 0,
      }
    }
    const stats = getCardAporteStats(card)
    groups[orgKey].cards.push(card)
    groups[orgKey].totalAmount += stats.totalAmount
    if (stats.status === 'active' || stats.status === 'ending_soon') {
      groups[orgKey].activeCount += 1
    }
  })

  return Object.values(groups).sort((a, b) =>
    a.organizer.localeCompare(b.organizer),
  )
})

// Overall Statistics
const overallStats = computed(() => {
  let totalAmount = 0
  let activeCount = 0
  let endingSoonCount = 0
  const organizersSet = new Set<string>()

  campaignCards.value.forEach((card) => {
    if (card.organizer?.trim()) organizersSet.add(card.organizer.trim())
    const stats = getCardAporteStats(card)
    totalAmount += stats.totalAmount
    if (stats.status === 'active') activeCount += 1
    if (stats.status === 'ending_soon') endingSoonCount += 1
  })

  return {
    totalAmount,
    activeCount,
    endingSoonCount,
    totalOrganizers: organizersSet.size,
    totalCampaigns: campaignCards.value.length,
  }
})

function toggleOrganizer(orgName: string) {
  expandedOrganizers.value[orgName] = !isOrganizerExpanded(orgName)
}

function isOrganizerExpanded(orgName: string): boolean {
  return expandedOrganizers.value[orgName] !== false
}

function formatCurrency(val: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val)
}

function formatDateBr(dateStr: string) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return dateStr
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
}

function openAporteModalForCard(card: Card) {
  targetCardForAporte.value = card
  aporteAmount.value = ''
  aporteNotes.value = ''
  aporteDate.value = new Date().toISOString().slice(0, 10)
  aporteStartDate.value = new Date().toISOString().slice(0, 10)

  // Default end date 7 days from now
  const endD = new Date()
  endD.setDate(endD.getDate() + 7)
  aporteEndDate.value = endD.toISOString().slice(0, 10)

  showNewAporteModal.value = true
}

async function submitCreateCampaign() {
  const org = newOrganizerName.value.trim()
  const evt = newEventName.value.trim()
  if (!org || !evt) return

  const firstCol = board.columns[0]
  if (!firstCol) return

  const cardTitle = `${evt} - ${org}`
  const createdCard = await board.addCard(firstCol.id, cardTitle)

  if (createdCard) {
    const aportes: Omit<Aporte, 'id'>[] = []
    const amountNum = Number(initialAporteAmount.value)
    if (amountNum && amountNum > 0) {
      const sDate =
        initialStartDate.value || new Date().toISOString().slice(0, 10)
      let eDate = initialEndDate.value
      if (!eDate) {
        const d = new Date(sDate)
        d.setDate(d.getDate() + 7)
        eDate = d.toISOString().slice(0, 10)
      }
      aportes.push({
        amount: amountNum,
        date: sDate,
        startDate: sDate,
        endDate: eDate,
        notes: initialNotes.value.trim() || undefined,
      })
    }

    await board.updateCard(createdCard.id, {
      organizer: org,
      eventName: evt,
      description: `Campanha para o evento ${evt} do organizador ${org}.`,
    })

    if (aportes.length > 0) {
      await board.addAporte(createdCard.id, aportes[0])
    }
  }

  // Reset modal fields
  newOrganizerName.value = ''
  newEventName.value = ''
  initialAporteAmount.value = ''
  initialNotes.value = ''
  showNewCampaignModal.value = false
}

async function submitAddAporte() {
  if (!targetCardForAporte.value) return
  const amountNum = Number(aporteAmount.value)
  if (!amountNum || amountNum <= 0) return

  const sDate =
    aporteStartDate.value ||
    aporteDate.value ||
    new Date().toISOString().slice(0, 10)
  let eDate = aporteEndDate.value
  if (!eDate) {
    const d = new Date(sDate)
    d.setDate(d.getDate() + 7)
    eDate = d.toISOString().slice(0, 10)
  }

  await board.addAporte(targetCardForAporte.value.id, {
    amount: amountNum,
    date: aporteDate.value || sDate,
    startDate: sDate,
    endDate: eDate,
    notes: aporteNotes.value.trim() || undefined,
  })

  showNewAporteModal.value = false
  targetCardForAporte.value = null
}

async function deleteAporte(cardId: string, aporteId: string) {
  if (window.confirm('Excluir este aporte do histórico?')) {
    await board.deleteAporte(cardId, aporteId)
  }
}

async function deleteCampaign(cardId: string, title: string) {
  if (window.confirm(`Tem certeza que deseja excluir a campanha "${title}"?`)) {
    await board.deleteCard(cardId)
  }
}
</script>

<template>
  <div class="panel-glass relative mx-auto flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden rounded-2xl shadow-xl shadow-black/20">
    <div class="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-8 sm:py-7">
      
      <!-- Cabeçalho Principal -->
      <header class="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2.5">
            <div class="flex size-9 items-center justify-center rounded-xl bg-orange-500/20 text-orange-400">
              <Megaphone :size="20" />
            </div>
            <h1 class="text-2xl font-extrabold tracking-tight text-text-primary">
              Campanhas & Aportes Runff
            </h1>
          </div>
          <p class="mt-1 text-xs text-text-muted">
            Gestão de organizadores, eventos esportivos e prazos de veiculação de tráfego pago (Meta Ads).
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-board shadow-lg shadow-accent/20 transition-transform hover:scale-[1.02] active:scale-95"
            @click="showNewCampaignModal = true"
          >
            <Plus :size="16" :stroke-width="2.5" />
            Nova Campanha / Evento
          </button>
        </div>
      </header>

      <!-- Cards de Métricas Principais -->
      <div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="rounded-2xl border border-white/10 bg-board-elevated/70 p-4 shadow-sm">
          <p class="text-[10px] font-bold uppercase tracking-wider text-text-muted">Total Investido (Aportes)</p>
          <p class="mt-1 text-xl font-black text-emerald-400">
            {{ formatCurrency(overallStats.totalAmount) }}
          </p>
        </div>

        <div class="rounded-2xl border border-white/10 bg-board-elevated/70 p-4 shadow-sm">
          <p class="text-[10px] font-bold uppercase tracking-wider text-text-muted">Campanhas Ativas</p>
          <p class="mt-1 text-xl font-black text-emerald-300">
            🟢 {{ overallStats.activeCount }}
          </p>
        </div>

        <div class="rounded-2xl border border-white/10 bg-board-elevated/70 p-4 shadow-sm">
          <p class="text-[10px] font-bold uppercase tracking-wider text-text-muted">Vencendo em 2 Dias</p>
          <p class="mt-1 text-xl font-black text-amber-300">
            🟡 {{ overallStats.endingSoonCount }}
          </p>
        </div>

        <div class="rounded-2xl border border-white/10 bg-board-elevated/70 p-4 shadow-sm">
          <p class="text-[10px] font-bold uppercase tracking-wider text-text-muted">Organizadores Cadastrados</p>
          <p class="mt-1 text-xl font-black text-accent">
            👤 {{ overallStats.totalOrganizers }}
          </p>
        </div>
      </div>

      <!-- Barra de Pesquisa e Filtros -->
      <div class="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-surface/50 p-3">
        <div class="relative min-w-[220px] flex-1">
          <Search :size="15" class="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Buscar por organizador ou evento..."
            class="w-full rounded-xl border border-border-subtle bg-column pl-9 pr-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
          />
        </div>

        <div class="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            type="button"
            :class="[
              'rounded-lg px-3 py-1.5 font-semibold transition-colors',
              selectedStatusFilter === 'all'
                ? 'bg-accent/20 text-accent ring-1 ring-accent/40'
                : 'text-text-muted hover:bg-white/5 hover:text-text-primary',
            ]"
            @click="selectedStatusFilter = 'all'"
          >
            Todas ({{ campaignCards.length }})
          </button>
          <button
            type="button"
            :class="[
              'rounded-lg px-3 py-1.5 font-semibold transition-colors',
              selectedStatusFilter === 'active'
                ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
                : 'text-text-muted hover:bg-white/5 hover:text-text-primary',
            ]"
            @click="selectedStatusFilter = 'active'"
          >
            🟢 Em Veiculação
          </button>
          <button
            type="button"
            :class="[
              'rounded-lg px-3 py-1.5 font-semibold transition-colors',
              selectedStatusFilter === 'ending_soon'
                ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40'
                : 'text-text-muted hover:bg-white/5 hover:text-text-primary',
            ]"
            @click="selectedStatusFilter = 'ending_soon'"
          >
            🟡 Vencendo em breve
          </button>
          <button
            type="button"
            :class="[
              'rounded-lg px-3 py-1.5 font-semibold transition-colors',
              selectedStatusFilter === 'expired'
                ? 'bg-red-500/20 text-red-300 ring-1 ring-red-500/40'
                : 'text-text-muted hover:bg-white/5 hover:text-text-primary',
            ]"
            @click="selectedStatusFilter = 'expired'"
          >
            🔴 Encerradas
          </button>
        </div>
      </div>

      <!-- Estado Vazio / Sem Campanhas -->
      <div
        v-if="!groupedByOrganizer.length"
        class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-4 py-16 text-center"
      >
        <div class="mb-3 flex size-14 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-400">
          <Megaphone :size="28" />
        </div>
        <h3 class="text-base font-bold text-text-primary">Nenhuma campanha encontrada</h3>
        <p class="mt-1 max-w-sm text-xs text-text-muted">
          Cadastre seu primeiro organizador e evento da Runff para começar a registrar os aportes de tráfego pago.
        </p>
        <button
          type="button"
          class="mt-4 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-board hover:bg-accent-hover"
          @click="showNewCampaignModal = true"
        >
          <Plus :size="14" />
          Cadastrar Primeira Campanha
        </button>
      </div>

      <!-- Lista Agrupada por Organizador -->
      <div v-else class="space-y-6">
        <div
          v-for="group in groupedByOrganizer"
          :key="group.organizer"
          class="rounded-2xl border border-white/10 bg-board-elevated/60 overflow-hidden shadow-md"
        >
          <!-- Cabeçalho do Organizador -->
          <div
            class="flex cursor-pointer items-center justify-between gap-3 border-b border-white/10 bg-surface/80 px-4 py-3.5 hover:bg-surface"
            @click="toggleOrganizer(group.organizer)"
          >
            <div class="flex items-center gap-3">
              <div class="flex size-9 items-center justify-center rounded-full bg-accent/20 text-xs font-black text-accent">
                👤
              </div>
              <div>
                <h2 class="text-sm font-extrabold text-text-primary">
                  {{ group.organizer }}
                </h2>
                <p class="text-[11px] text-text-muted">
                  {{ group.cards.length }} evento(s) registrado(s) · {{ group.activeCount }} ativo(s)
                </p>
              </div>
            </div>

            <div class="flex items-center gap-4">
              <div class="text-right">
                <span class="text-[10px] uppercase font-bold tracking-wider text-text-muted block">Total Aportado</span>
                <span class="text-sm font-extrabold text-emerald-400">
                  {{ formatCurrency(group.totalAmount) }}
                </span>
              </div>
              <button
                type="button"
                class="rounded-lg p-1 text-text-muted hover:text-text-primary"
              >
                <ChevronUp v-if="isOrganizerExpanded(group.organizer)" :size="18" />
                <ChevronDown v-else :size="18" />
              </button>
            </div>
          </div>

          <!-- Conteúdo: Lista de Eventos do Organizador -->
          <div v-if="isOrganizerExpanded(group.organizer)" class="p-4 space-y-4">
            <div
              v-for="card in group.cards"
              :key="card.id"
              class="rounded-xl border border-white/10 bg-card p-4 space-y-3 shadow-sm hover:border-white/20"
            >
              <!-- Topo do Evento -->
              <div class="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div class="flex items-center gap-2">
                    <Trophy :size="16" class="text-amber-400 shrink-0" />
                    <h3 class="text-sm font-bold text-text-primary">
                      {{ card.eventName || card.title }}
                    </h3>
                  </div>
                  <p class="mt-0.5 text-[11px] text-text-muted">
                    Cartão no Kanban: <span class="font-medium text-text-secondary">{{ card.title }}</span>
                  </p>
                </div>

                <div class="flex items-center gap-2">
                  <!-- Tag de Status da Veiculação -->
                  <span
                    v-if="getCardAporteStats(card).status === 'active'"
                    class="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-300"
                  >
                    🟢 Em Veiculação ({{ getCardAporteStats(card).daysRemaining }}d restante(s))
                  </span>
                  <span
                    v-else-if="getCardAporteStats(card).status === 'ending_soon'"
                    class="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-bold text-amber-300"
                  >
                    🟡 Vence em breve ({{ getCardAporteStats(card).daysRemaining }}d)
                  </span>
                  <span
                    v-else-if="getCardAporteStats(card).status === 'expired'"
                    class="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2.5 py-0.5 text-xs font-bold text-red-300"
                  >
                    🔴 Veiculação Encerrada
                  </span>
                  <span
                    v-else
                    class="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-text-muted"
                  >
                    Nenhum aporte
                  </span>

                  <!-- Botão de Novo Aporte no Evento -->
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 rounded-lg bg-accent/20 px-2.5 py-1 text-xs font-bold text-accent hover:bg-accent/30"
                    @click="openAporteModalForCard(card)"
                  >
                    <Plus :size="13" />
                    + Aporte
                  </button>

                  <button
                    type="button"
                    class="rounded-lg p-1 text-text-muted hover:bg-danger/15 hover:text-danger"
                    title="Excluir Evento"
                    @click="deleteCampaign(card.id, card.eventName || card.title)"
                  >
                    <Trash2 :size="14" />
                  </button>
                </div>
              </div>

              <!-- Resumo das Estatísticas do Evento -->
              <div class="grid grid-cols-2 gap-3 rounded-lg border border-white/5 bg-surface/50 p-2.5 text-xs sm:grid-cols-3">
                <div>
                  <span class="text-[10px] text-text-muted block font-semibold uppercase">Total Aportado</span>
                  <span class="font-extrabold text-emerald-400 text-sm">
                    {{ formatCurrency(getCardAporteStats(card).totalAmount) }}
                  </span>
                </div>

                <div>
                  <span class="text-[10px] text-text-muted block font-semibold uppercase">Última Veiculação</span>
                  <span class="font-semibold text-text-primary">
                    <template v-if="getCardAporteStats(card).activeAporte">
                      {{ formatDateBr(getCardAporteStats(card).activeAporte!.startDate) }} até {{ formatDateBr(getCardAporteStats(card).activeAporte!.endDate) }}
                    </template>
                    <template v-else-if="getCardAporteStats(card).latestAporte">
                      {{ formatDateBr(getCardAporteStats(card).latestAporte!.startDate) }} até {{ formatDateBr(getCardAporteStats(card).latestAporte!.endDate) }}
                    </template>
                    <template v-else>-</template>
                  </span>
                </div>

                <div class="col-span-2 sm:col-span-1">
                  <span class="text-[10px] text-text-muted block font-semibold uppercase">Quantidade de Aportes</span>
                  <span class="font-semibold text-text-primary">
                    {{ card.aportes?.length || 0 }} registro(s)
                  </span>
                </div>
              </div>

              <!-- Histórico de Aportes do Evento -->
              <div v-if="card.aportes?.length" class="space-y-1.5 pt-1">
                <p class="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  Histórico Detalhado dos Aportes:
                </p>
                <div class="space-y-1 max-h-36 overflow-y-auto pr-1">
                  <div
                    v-for="ap in card.aportes"
                    :key="ap.id"
                    class="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-board-elevated/70 px-3 py-1.5 text-xs"
                  >
                    <div class="flex items-center gap-2">
                      <span class="font-bold text-emerald-400">
                        {{ formatCurrency(ap.amount) }}
                      </span>
                      <span class="text-text-secondary">
                        📅 Veiculação: {{ formatDateBr(ap.startDate) }} a {{ formatDateBr(ap.endDate) }}
                      </span>
                      <span v-if="ap.notes" class="text-[10px] text-text-muted italic">
                        ({{ ap.notes }})
                      </span>
                    </div>
                    <button
                      type="button"
                      class="text-text-muted hover:text-danger"
                      title="Apagar aporte"
                      @click="deleteAporte(card.id, ap.id)"
                    >
                      <Trash2 :size="12" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- MODAL: NOVA CAMPANHA / EVENTO -->
  <Teleport to="body">
    <div
      v-if="showNewCampaignModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        class="absolute inset-0 bg-black/70 backdrop-blur-sm"
        @click="showNewCampaignModal = false"
      />
      <form
        class="relative z-10 w-full max-w-lg rounded-2xl border border-white/10 bg-board-elevated p-6 shadow-2xl space-y-4"
        @submit.prevent="submitCreateCampaign"
      >
        <div class="flex items-center justify-between border-b border-white/10 pb-3">
          <h3 class="text-base font-bold text-text-primary">Cadastrar Nova Campanha / Evento</h3>
          <button
            type="button"
            class="text-text-muted hover:text-text-primary"
            @click="showNewCampaignModal = false"
          >
            <X :size="18" />
          </button>
        </div>

        <div class="space-y-3 text-xs">
          <label class="block">
            <span class="font-bold text-text-muted block mb-1">Nome do Organizador *</span>
            <input
              v-model="newOrganizerName"
              type="text"
              placeholder="Ex: João da Silva"
              list="organizers-list"
              class="w-full rounded-xl border border-border-subtle bg-column px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
              required
            />
            <datalist id="organizers-list">
              <option v-for="org in existingOrganizers" :key="org" :value="org" />
            </datalist>
          </label>

          <label class="block">
            <span class="font-bold text-text-muted block mb-1">Nome do Evento *</span>
            <input
              v-model="newEventName"
              type="text"
              placeholder="Ex: Corrida Turística Boituva"
              class="w-full rounded-xl border border-border-subtle bg-column px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
              required
            />
          </label>

          <div class="border-t border-white/10 pt-3">
            <p class="font-bold text-text-muted mb-2">Primeiro Aporte de Investimento (Opcional):</p>
            <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <label class="block">
                <span class="text-[10px] text-text-muted block">Valor (R$)</span>
                <input
                  v-model.number="initialAporteAmount"
                  type="number"
                  step="0.01"
                  placeholder="Ex: 500,00"
                  class="w-full rounded-lg border border-border-subtle bg-column px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent"
                />
              </label>

              <label class="block">
                <span class="text-[10px] text-text-muted block">Início da Veiculação</span>
                <input
                  v-model="initialStartDate"
                  type="date"
                  class="w-full rounded-lg border border-border-subtle bg-column px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent"
                />
              </label>

              <label class="block">
                <span class="text-[10px] text-text-muted block">Término da Veiculação</span>
                <input
                  v-model="initialEndDate"
                  type="date"
                  class="w-full rounded-lg border border-border-subtle bg-column px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent"
                />
              </label>
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <button
            type="button"
            class="rounded-xl px-4 py-2 text-xs text-text-muted hover:bg-white/5"
            @click="showNewCampaignModal = false"
          >
            Cancelar
          </button>
          <button
            type="submit"
            class="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-board hover:bg-accent-hover"
          >
            Salvar Campanha
          </button>
        </div>
      </form>
    </div>
  </Teleport>

  <!-- MODAL: ADICIONAR APORTE -->
  <Teleport to="body">
    <div
      v-if="showNewAporteModal && targetCardForAporte"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        class="absolute inset-0 bg-black/70 backdrop-blur-sm"
        @click="showNewAporteModal = false"
      />
      <form
        class="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-board-elevated p-6 shadow-2xl space-y-4"
        @submit.prevent="submitAddAporte"
      >
        <div class="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h3 class="text-base font-bold text-text-primary">Registrar Novo Aporte</h3>
            <p class="text-xs text-text-muted">
              {{ targetCardForAporte.eventName || targetCardForAporte.title }} ({{ targetCardForAporte.organizer }})
            </p>
          </div>
          <button
            type="button"
            class="text-text-muted hover:text-text-primary"
            @click="showNewAporteModal = false"
          >
            <X :size="18" />
          </button>
        </div>

        <div class="space-y-3 text-xs">
          <label class="block">
            <span class="font-bold text-text-muted block mb-1">Valor Aportado (R$) *</span>
            <input
              v-model.number="aporteAmount"
              type="number"
              step="0.01"
              placeholder="Ex: 500,00"
              class="w-full rounded-xl border border-border-subtle bg-column px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
              required
            />
          </label>

          <div class="grid grid-cols-2 gap-3">
            <label class="block">
              <span class="font-bold text-text-muted block mb-1">Início da Veiculação *</span>
              <input
                v-model="aporteStartDate"
                type="date"
                class="w-full rounded-xl border border-border-subtle bg-column px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
                required
              />
            </label>

            <label class="block">
              <span class="font-bold text-text-muted block mb-1">Término da Veiculação *</span>
              <input
                v-model="aporteEndDate"
                type="date"
                class="w-full rounded-xl border border-border-subtle bg-column px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
                required
              />
            </label>
          </div>

          <label class="block">
            <span class="font-bold text-text-muted block mb-1">Observação / Notas (Opcional)</span>
            <input
              v-model="aporteNotes"
              type="text"
              placeholder="Ex: Aporte via Meta Ads (semanal)"
              class="w-full rounded-xl border border-border-subtle bg-column px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
            />
          </label>
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <button
            type="button"
            class="rounded-xl px-4 py-2 text-xs text-text-muted hover:bg-white/5"
            @click="showNewAporteModal = false"
          >
            Cancelar
          </button>
          <button
            type="submit"
            class="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-board hover:bg-accent-hover"
          >
            Salvar Aporte
          </button>
        </div>
      </form>
    </div>
  </Teleport>
</template>
