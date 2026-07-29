<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Megaphone,
  MessageCircle,
  Plus,
  Search,
  Trash2,
  Trophy,
  X,
} from '@lucide/vue'
import { getCardAporteStats, META_TAX_RATE } from '../stores/board'
import { useCampaignsStore } from '../stores/campaigns'
import type { Aporte } from '../types/board'
import type { Campaign } from '../stores/campaigns'

export interface WhatsappEventMetrics {
  campaignId: string
  eventName: string
  endDateText: string
  daysRemaining: number
  status: string
  salesCount: number | ''
  spentAmount: number | ''
  revenueAmount: number | ''
  roas: number | string
}

const campaignsStore = useCampaignsStore()

onMounted(() => {
  campaignsStore.init()
})

const searchQuery = ref('')
const selectedStatusFilter = ref<
  'all' | 'active' | 'ending_soon' | 'expired'
>('all')
const expandedOrganizers = ref<Record<string, boolean>>({})

// State for Modals
const showNewCampaignModal = ref(false)
const showNewAporteModal = ref(false)
const targetCampaignForAporte = ref<Campaign | null>(null)

// State for WhatsApp Cobrança Modal
const showWhatsappModal = ref(false)
const whatsappOrganizerName = ref('')
const whatsappEvents = ref<WhatsappEventMetrics[]>([])
const copiedWhatsappMsg = ref(false)

// Form Fields for New Campaign
const newOrganizerName = ref('')
const newEventName = ref('')
const initialAporteAmount = ref<number | ''>('')
const initialSpentAmount = ref<number | ''>('')
const initialDurationDays = ref<number | ''>(7)
const initialStartDate = ref(new Date().toISOString().slice(0, 10))
const initialEndDate = ref('')
const initialNotes = ref('')

// Form Fields for New Aporte Modal
const aporteAmount = ref<number | ''>('')
const aporteSpentAmount = ref<number | ''>('')
const aporteDurationDays = ref<number | ''>(7)
const aporteDate = ref(new Date().toISOString().slice(0, 10))
const aporteStartDate = ref(new Date().toISOString().slice(0, 10))
const aporteEndDate = ref('')
const aporteNotes = ref('')

// Live calculations for New Aporte Modal
const aporteGross = computed(() => Number(aporteAmount.value) || 0)
const aporteTax = computed(() => aporteGross.value * META_TAX_RATE)
const aporteNet = computed(() => aporteGross.value * (1 - META_TAX_RATE))
const aporteSpent = computed(() => Number(aporteSpentAmount.value) || 0)
const aporteAvailableNet = computed(() => Math.max(0, aporteNet.value - aporteSpent.value))

// Live calculations for Initial Campaign Modal
const initialGross = computed(() => Number(initialAporteAmount.value) || 0)
const initialTax = computed(() => initialGross.value * META_TAX_RATE)
const initialNet = computed(() => initialGross.value * (1 - META_TAX_RATE))
const initialSpent = computed(() => Number(initialSpentAmount.value) || 0)
const initialAvailable = computed(() => Math.max(0, initialNet.value - initialSpent.value))

function onAporteDaysChange() {
  const days = Number(aporteDurationDays.value)
  const sDate = aporteStartDate.value || new Date().toISOString().slice(0, 10)
  if (days && days > 0) {
    const d = new Date(sDate)
    d.setDate(d.getDate() + days)
    aporteEndDate.value = d.toISOString().slice(0, 10)
  }
}

function onAporteEndDateChange() {
  const sDate = aporteStartDate.value
  const eDate = aporteEndDate.value
  if (sDate && eDate) {
    const diff = new Date(eDate).getTime() - new Date(sDate).getTime()
    const days = Math.round(diff / (1000 * 60 * 60 * 24))
    if (days > 0) aporteDurationDays.value = days
  }
}

function onInitialDaysChange() {
  const days = Number(initialDurationDays.value)
  const sDate = initialStartDate.value || new Date().toISOString().slice(0, 10)
  if (days && days > 0) {
    const d = new Date(sDate)
    d.setDate(d.getDate() + days)
    initialEndDate.value = d.toISOString().slice(0, 10)
  }
}

// All campaign items stored exclusively in useCampaignsStore
const campaignCards = computed(() => campaignsStore.campaigns)

// List of campaigns requiring urgent renewal (ending in <= 2 days or expired)
const renewalAlertCampaigns = computed(() => {
  return campaignCards.value.filter((c) => {
    const stats = getCardAporteStats(c as any)
    return stats.status === 'ending_soon' || stats.status === 'expired'
  })
})

function calculateEventRoas(ev: WhatsappEventMetrics) {
  const rev = Number(ev.revenueAmount) || 0
  const spent = Number(ev.spentAmount) || 0
  if (rev > 0 && spent > 0) {
    ev.roas = Number((rev / spent).toFixed(2))
  }
}

function openWhatsappModalForOrganizer(orgName: string, singleCampaign?: Campaign) {
  whatsappOrganizerName.value = orgName
  
  let campaignsToInclude: Campaign[] = []
  if (singleCampaign) {
    campaignsToInclude = [singleCampaign]
  } else {
    // Only include campaigns ending in 1 to 2 days (or expired)
    const allOrgCampaigns = campaignsStore.campaigns.filter(
      (c) => (c.organizer || '').trim().toLowerCase() === orgName.trim().toLowerCase(),
    )
    
    const criticalCampaigns = allOrgCampaigns.filter((c) => {
      const stats = getCardAporteStats(c as any)
      return (
        stats.status === 'ending_soon' ||
        stats.status === 'expired' ||
        (stats.daysRemaining !== null && stats.daysRemaining !== undefined && stats.daysRemaining <= 2)
      )
    })

    campaignsToInclude = criticalCampaigns.length > 0 ? criticalCampaigns : allOrgCampaigns
  }

  whatsappEvents.value = campaignsToInclude.map((c) => {
    const stats = getCardAporteStats(c as any)
    const endDate = stats.activeAporte?.endDate || stats.latestAporte?.endDate || ''
    let endStr = ''
    if (endDate) {
      const [, m, d] = endDate.split('-').map(Number)
      if (d && m) endStr = `Acaba dia ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`
    } else {
      endStr = 'Em veiculação'
    }

    const spent = stats.totalSpent > 0 ? stats.totalSpent : stats.totalGross
    const daysRem = stats.daysRemaining ?? 0

    return {
      campaignId: c.id,
      eventName: (c.eventName || 'EVENTO').toUpperCase(),
      endDateText: endStr,
      daysRemaining: daysRem,
      status: stats.status,
      salesCount: '',
      spentAmount: spent || '',
      revenueAmount: '',
      roas: '',
    }
  })

  copiedWhatsappMsg.value = false
  showWhatsappModal.value = true
}

const generatedWhatsappReport = computed(() => {
  if (!whatsappOrganizerName.value || !whatsappEvents.value.length) return ''

  const lines: string[] = []

  // Intro Paragraph according to user specification
  if (whatsappEvents.value.length === 1) {
    const ev = whatsappEvents.value[0]
    const daysText =
      ev.status === 'expired'
        ? 'já encerrou'
        : ev.daysRemaining <= 0
          ? 'encerra hoje'
          : `encerra em ${ev.daysRemaining} dia(s)`

    lines.push(`Passando para avisar que a veiculação da campanha do evento ${ev.eventName} no Meta Ads ${daysText}.\n`)
  } else {
    lines.push(`Passando para avisar que a veiculação das campanhas no Meta Ads encerra nos próximos dias.\n`)
  }

  // Header Block
  lines.push(`DADOS DE TRÁFEGO ${whatsappOrganizerName.value.toUpperCase()}\n`)

  // Event Data Blocks
  whatsappEvents.value.forEach((ev, idx) => {
    if (idx > 0) lines.push('')
    lines.push(`(${ev.endDateText})`)
    lines.push(`${ev.eventName.toUpperCase()}`)
    lines.push(`Vendas: ${ev.salesCount || 0} inscrições`)
    
    const spentVal = Number(ev.spentAmount) || 0
    lines.push(`Valor investido: ${formatCurrency(spentVal)}`)

    const revVal = Number(ev.revenueAmount) || 0
    lines.push(`Receita: ${formatCurrency(revVal)}`)

    let roasVal = ev.roas
    if ((!roasVal || Number(roasVal) === 0) && revVal > 0 && spentVal > 0) {
      roasVal = (revVal / spentVal).toFixed(2)
    }
    const roasStr = roasVal ? String(roasVal).replace('.', ',') : '0,00'
    lines.push(`ROAS: ${roasStr}`)
  })

  // Outro Paragraph according to user specification
  lines.push(`\nPara garantirmos a continuidade dos anúncios e vendas sem interrupções, podemos seguir com o próximo aporte? 🚀`)

  return lines.join('\n')
})

async function copyWhatsappMessage() {
  if (!generatedWhatsappReport.value) return
  try {
    await navigator.clipboard.writeText(generatedWhatsappReport.value)
    copiedWhatsappMsg.value = true
    setTimeout(() => {
      copiedWhatsappMsg.value = false
    }, 3000)
  } catch (err) {
    console.error('Failed to copy', err)
  }
}

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

// Filtered campaign items
const filteredCards = computed(() => {
  return campaignCards.value.filter((card) => {
    const org = (card.organizer || '').toLowerCase()
    const evt = (card.eventName || '').toLowerCase()
    const query = searchQuery.value.toLowerCase().trim()

    const matchesQuery = !query || org.includes(query) || evt.includes(query)

    if (!matchesQuery) return false

    if (selectedStatusFilter.value === 'all') return true

    const stats = getCardAporteStats(card as any)
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
      cards: Campaign[]
      totalGross: number
      totalNet: number
      totalSpent: number
      totalAvailableNet: number
      activeCount: number
      hasAlert: boolean
    }
  > = {}

  filteredCards.value.forEach((card) => {
    const orgKey = card.organizer?.trim() || 'Sem Organizador'
    if (!groups[orgKey]) {
      groups[orgKey] = {
        organizer: orgKey,
        cards: [],
        totalGross: 0,
        totalNet: 0,
        totalSpent: 0,
        totalAvailableNet: 0,
        activeCount: 0,
        hasAlert: false,
      }
    }
    const stats = getCardAporteStats(card as any)
    groups[orgKey].cards.push(card)
    groups[orgKey].totalGross += stats.totalGross
    groups[orgKey].totalNet += stats.totalNet
    groups[orgKey].totalSpent += stats.totalSpent
    groups[orgKey].totalAvailableNet += stats.totalAvailableNet
    if (stats.status === 'active' || stats.status === 'ending_soon') {
      groups[orgKey].activeCount += 1
    }
    if (stats.status === 'ending_soon' || stats.status === 'expired') {
      groups[orgKey].hasAlert = true
    }
  })

  return Object.values(groups).sort((a, b) =>
    a.organizer.localeCompare(b.organizer),
  )
})

// Overall Statistics
const overallStats = computed(() => {
  let totalGross = 0
  let totalTax = 0
  let totalNet = 0
  let totalSpent = 0
  let totalAvailableNet = 0
  let activeCount = 0
  let endingSoonCount = 0
  const organizersSet = new Set<string>()

  campaignCards.value.forEach((card) => {
    if (card.organizer?.trim()) organizersSet.add(card.organizer.trim())
    const stats = getCardAporteStats(card as any)
    totalGross += stats.totalGross
    totalTax += stats.totalTax
    totalNet += stats.totalNet
    totalSpent += stats.totalSpent
    totalAvailableNet += stats.totalAvailableNet
    if (stats.status === 'active') activeCount += 1
    if (stats.status === 'ending_soon') endingSoonCount += 1
  })

  return {
    totalGross,
    totalTax,
    totalNet,
    totalSpent,
    totalAvailableNet,
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

function openAporteModalForCard(card: Campaign) {
  targetCampaignForAporte.value = card
  aporteAmount.value = ''
  aporteSpentAmount.value = ''
  aporteDurationDays.value = 7
  aporteNotes.value = ''
  aporteDate.value = new Date().toISOString().slice(0, 10)
  aporteStartDate.value = new Date().toISOString().slice(0, 10)
  onAporteDaysChange()

  showNewAporteModal.value = true
}

function submitCreateCampaign() {
  const org = newOrganizerName.value.trim()
  const evt = newEventName.value.trim()
  if (!org || !evt) return

  let initialAporte: Omit<Aporte, 'id'> | undefined = undefined
  const amountNum = Number(initialAporteAmount.value)
  if (amountNum && amountNum > 0) {
    const sDate =
      initialStartDate.value || new Date().toISOString().slice(0, 10)
    let eDate = initialEndDate.value
    if (!eDate) {
      const days = Number(initialDurationDays.value) || 7
      const d = new Date(sDate)
      d.setDate(d.getDate() + days)
      eDate = d.toISOString().slice(0, 10)
    }
    initialAporte = {
      amount: amountNum,
      spentAmount: Number(initialSpentAmount.value) || 0,
      durationDays: Number(initialDurationDays.value) || undefined,
      date: sDate,
      startDate: sDate,
      endDate: eDate,
      notes: initialNotes.value.trim() || undefined,
    }
  }

  campaignsStore.createCampaign(
    org,
    evt,
    `Campanha para o evento ${evt} do organizador ${org}.`,
    initialAporte,
  )

  // Reset modal fields
  newOrganizerName.value = ''
  newEventName.value = ''
  initialAporteAmount.value = ''
  initialSpentAmount.value = ''
  initialDurationDays.value = 7
  initialNotes.value = ''
  showNewCampaignModal.value = false
}

function submitAddAporte() {
  if (!targetCampaignForAporte.value) return
  const amountNum = Number(aporteAmount.value)
  if (!amountNum || amountNum <= 0) return

  const sDate =
    aporteStartDate.value ||
    aporteDate.value ||
    new Date().toISOString().slice(0, 10)
  let eDate = aporteEndDate.value
  if (!eDate) {
    const days = Number(aporteDurationDays.value) || 7
    const d = new Date(sDate)
    d.setDate(d.getDate() + days)
    eDate = d.toISOString().slice(0, 10)
  }

  campaignsStore.addAporte(targetCampaignForAporte.value.id, {
    amount: amountNum,
    spentAmount: Number(aporteSpentAmount.value) || 0,
    durationDays: Number(aporteDurationDays.value) || undefined,
    date: aporteDate.value || sDate,
    startDate: sDate,
    endDate: eDate,
    notes: aporteNotes.value.trim() || undefined,
  })

  showNewAporteModal.value = false
  targetCampaignForAporte.value = null
}

function deleteAporte(campaignId: string, aporteId: string) {
  if (window.confirm('Excluir este aporte do histórico?')) {
    campaignsStore.deleteAporte(campaignId, aporteId)
  }
}

function deleteCampaign(campaignId: string, title: string) {
  if (window.confirm(`Tem certeza que deseja excluir a campanha "${title}"?`)) {
    campaignsStore.deleteCampaign(campaignId)
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
            Gestão financeira de aportes, cálculo de impostos do Meta Ads (12,15%) e relatórios de cobrança.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-board shadow-lg shadow-accent/20 transition-transform hover:scale-[1.02] active:scale-95"
            @click="showNewCampaignModal = true; onInitialDaysChange()"
          >
            <Plus :size="16" :stroke-width="2.5" />
            Nova Campanha / Evento
          </button>
        </div>
      </header>

      <!-- PAINEL DE ALERTA DE RENOVAÇÃO URGENTE (VENCENDO EM 2 DIAS OU ENCERRADAS) -->
      <div
        v-if="renewalAlertCampaigns.length > 0"
        class="mb-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 shadow-lg shadow-amber-500/5 space-y-3"
      >
        <div class="flex items-center justify-between gap-2 border-b border-amber-500/20 pb-2.5">
          <div class="flex items-center gap-2.5">
            <div class="flex size-8 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300">
              <AlertTriangle :size="18" />
            </div>
            <div>
              <h2 class="text-sm font-extrabold text-amber-200">
                🔔 Alerta de Renovação de Aporte ({{ renewalAlertCampaigns.length }} evento(s) crítico(s))
              </h2>
              <p class="text-[11px] text-amber-300/80">
                Campanhas vencendo nos próximos 1 a 2 dias ou encerradas que necessitam de cobrança de novo aporte.
              </p>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="camp in renewalAlertCampaigns"
            :key="camp.id"
            class="flex items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-board-elevated/90 p-3 text-xs"
          >
            <div>
              <span class="font-extrabold text-text-primary block truncate max-w-[180px]">
                🏆 {{ camp.eventName }}
              </span>
              <span class="text-[11px] text-text-muted block">
                👤 {{ camp.organizer }}
              </span>
              <span
                :class="[
                  'inline-flex items-center gap-1 font-bold text-[10px] mt-1',
                  getCardAporteStats(camp as any).status === 'expired'
                    ? 'text-red-400'
                    : 'text-amber-300',
                ]"
              >
                {{
                  getCardAporteStats(camp as any).status === 'expired'
                    ? '🔴 Veiculação Encerrada'
                    : `🟡 Vence em ${getCardAporteStats(camp as any).daysRemaining} dia(s)`
                }}
              </span>
            </div>

            <button
              type="button"
              class="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-500/20 px-2.5 py-1.5 text-xs font-bold text-emerald-300 transition-colors hover:bg-emerald-500/30"
              @click="openWhatsappModalForOrganizer(camp.organizer, camp)"
            >
              <MessageCircle :size="14" />
              Cobrar
            </button>
          </div>
        </div>
      </div>

      <!-- Cards de Métricas Principais (Financeiras e Veiculação) -->
      <div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <!-- Saldo Líquido Disponível -->
        <div class="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 shadow-sm">
          <p class="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
            🟢 Saldo Líquido Disponível
          </p>
          <p class="mt-1 text-xl font-black text-emerald-400">
            {{ formatCurrency(overallStats.totalAvailableNet) }}
          </p>
          <p class="text-[10px] text-text-muted mt-0.5">
            Valor líquido pronto para veicular
          </p>
        </div>

        <!-- Total Líquido para Anúncios (Pós Imposto 12,15%) -->
        <div class="rounded-2xl border border-white/10 bg-board-elevated/70 p-4 shadow-sm">
          <p class="text-[10px] font-bold uppercase tracking-wider text-text-muted">Valor Líquido Total</p>
          <p class="mt-1 text-xl font-black text-sky-400">
            {{ formatCurrency(overallStats.totalNet) }}
          </p>
          <p class="text-[10px] text-text-muted mt-0.5">
            Bruto: {{ formatCurrency(overallStats.totalGross) }} (-12,15% tax)
          </p>
        </div>

        <!-- Total Já Investido / Gasto -->
        <div class="rounded-2xl border border-white/10 bg-board-elevated/70 p-4 shadow-sm">
          <p class="text-[10px] font-bold uppercase tracking-wider text-text-muted">Já Investido / Gasto</p>
          <p class="mt-1 text-xl font-black text-amber-300">
            {{ formatCurrency(overallStats.totalSpent) }}
          </p>
          <p class="text-[10px] text-text-muted mt-0.5">
            Total utilizado nas campanhas
          </p>
        </div>

        <!-- Campanhas Ativas e Vencendo -->
        <div class="rounded-2xl border border-white/10 bg-board-elevated/70 p-4 shadow-sm">
          <p class="text-[10px] font-bold uppercase tracking-wider text-text-muted">Veiculação Ativa</p>
          <p class="mt-1 text-xl font-black text-text-primary">
            🟢 {{ overallStats.activeCount }} <span class="text-xs font-semibold text-amber-300">({{ overallStats.endingSoonCount }} vencendo)</span>
          </p>
          <p class="text-[10px] text-text-muted mt-0.5">
            {{ overallStats.totalOrganizers }} organizador(es)
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
          @click="showNewCampaignModal = true; onInitialDaysChange()"
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
          :class="[
            'rounded-2xl border overflow-hidden shadow-md transition-colors',
            group.hasAlert
              ? 'border-amber-500/40 bg-amber-500/5'
              : 'border-white/10 bg-board-elevated/60',
          ]"
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
                <div class="flex items-center gap-2">
                  <h2 class="text-sm font-extrabold text-text-primary">
                    {{ group.organizer }}
                  </h2>
                  <span
                    v-if="group.hasAlert"
                    class="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30"
                  >
                    ⚠️ Renovação Próxima
                  </span>
                </div>
                <p class="text-[11px] text-text-muted">
                  {{ group.cards.length }} evento(s) registrado(s) · {{ group.activeCount }} ativo(s)
                </p>
              </div>
            </div>

            <div class="flex items-center gap-4">
              <!-- Botão de Cobrança Agrupada do Organizador (Filtra eventos a 1-2 dias do fim) -->
              <button
                type="button"
                class="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-300 transition-colors hover:bg-emerald-500/30"
                title="Gerar Relatório Agrupado de Tráfego (Eventos perto de vencer)"
                @click.stop="openWhatsappModalForOrganizer(group.organizer)"
              >
                <MessageCircle :size="14" />
                Cobrar ({{ group.cards.length }} evento(s))
              </button>

              <div class="text-right">
                <span class="text-[10px] uppercase font-bold tracking-wider text-text-muted block">Saldo Líquido Disponível</span>
                <span class="text-sm font-extrabold text-emerald-400">
                  {{ formatCurrency(group.totalAvailableNet) }}
                </span>
                <span class="text-[10px] text-text-muted block">
                  (Líquido Total: {{ formatCurrency(group.totalNet) }})
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
              :class="[
                'rounded-xl border p-4 space-y-3 shadow-sm transition-all',
                getCardAporteStats(card as any).status === 'ending_soon'
                  ? 'border-amber-500/50 bg-amber-500/10'
                  : getCardAporteStats(card as any).status === 'expired'
                    ? 'border-red-500/50 bg-red-500/10'
                    : 'border-white/10 bg-card hover:border-white/20',
              ]"
            >
              <!-- Topo do Evento -->
              <div class="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div class="flex items-center gap-2">
                    <Trophy :size="16" class="text-amber-400 shrink-0" />
                    <h3 class="text-sm font-bold text-text-primary">
                      {{ card.eventName }}
                    </h3>
                  </div>
                  <p class="mt-0.5 text-[11px] text-text-muted">
                    Organizador: <span class="font-medium text-text-secondary">{{ card.organizer }}</span>
                  </p>
                </div>

                <div class="flex items-center gap-2">
                  <!-- Tag de Status da Veiculação -->
                  <span
                    v-if="getCardAporteStats(card as any).status === 'active'"
                    class="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-300"
                  >
                    🟢 Em Veiculação ({{ getCardAporteStats(card as any).daysRemaining }}d restante(s))
                  </span>
                  <span
                    v-else-if="getCardAporteStats(card as any).status === 'ending_soon'"
                    class="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-bold text-amber-300 ring-1 ring-amber-500/40"
                  >
                    🟡 Vence em breve ({{ getCardAporteStats(card as any).daysRemaining }}d)
                  </span>
                  <span
                    v-else-if="getCardAporteStats(card as any).status === 'expired'"
                    class="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2.5 py-0.5 text-xs font-bold text-red-300 ring-1 ring-red-500/40"
                  >
                    🔴 Veiculação Encerrada
                  </span>
                  <span
                    v-else
                    class="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-text-muted"
                  >
                    Nenhum aporte
                  </span>

                  <!-- Botão de Cobrar Este Evento Individual -->
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-300 transition-colors hover:bg-emerald-500/30"
                    title="Gerar Relatório de Tráfego deste evento para WhatsApp"
                    @click="openWhatsappModalForOrganizer(card.organizer, card)"
                  >
                    <MessageCircle :size="13" />
                    Cobrar Este
                  </button>

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
                    @click="deleteCampaign(card.id, card.eventName)"
                  >
                    <Trash2 :size="14" />
                  </button>
                </div>
              </div>

              <!-- Resumo das Estatísticas Financeiras do Evento -->
              <div class="grid grid-cols-2 gap-3 rounded-lg border border-white/5 bg-surface/50 p-3 text-xs sm:grid-cols-4">
                <div>
                  <span class="text-[10px] text-text-muted block font-semibold uppercase">Bruto Aportado</span>
                  <span class="font-bold text-text-primary text-xs">
                    {{ formatCurrency(getCardAporteStats(card as any).totalGross) }}
                  </span>
                  <span class="text-[9px] text-text-muted block">Meta: -12,15%</span>
                </div>

                <div>
                  <span class="text-[10px] text-text-muted block font-semibold uppercase">Líquido Anúncios</span>
                  <span class="font-bold text-sky-400 text-xs">
                    {{ formatCurrency(getCardAporteStats(card as any).totalNet) }}
                  </span>
                  <span class="text-[9px] text-text-muted block">Taxa: {{ formatCurrency(getCardAporteStats(card as any).totalTax) }}</span>
                </div>

                <div>
                  <span class="text-[10px] text-text-muted block font-semibold uppercase">Já Investido / Gasto</span>
                  <span class="font-bold text-amber-300 text-xs">
                    {{ formatCurrency(getCardAporteStats(card as any).totalSpent) }}
                  </span>
                </div>

                <div class="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2">
                  <span class="text-[10px] text-emerald-300 block font-bold uppercase">Saldo Disponível</span>
                  <span class="font-extrabold text-emerald-400 text-sm">
                    {{ formatCurrency(getCardAporteStats(card as any).totalAvailableNet) }}
                  </span>
                </div>
              </div>

              <!-- Histórico de Aportes do Evento -->
              <div v-if="card.aportes?.length" class="space-y-1.5 pt-1">
                <p class="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  Histórico Detalhado dos Aportes ({{ card.aportes.length }}):
                </p>
                <div class="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  <div
                    v-for="ap in card.aportes"
                    :key="ap.id"
                    class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-board-elevated/70 px-3 py-2 text-xs"
                  >
                    <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span class="font-bold text-text-primary" title="Valor Bruto">
                        Bruto: {{ formatCurrency(ap.amount) }}
                      </span>
                      <span class="font-bold text-sky-400" title="Valor Líquido pós 12.15% imposto">
                        Líquido (-12,15%): {{ formatCurrency(ap.amount * (1 - META_TAX_RATE)) }}
                      </span>
                      <span v-if="ap.spentAmount" class="font-semibold text-amber-300">
                        Gasto: {{ formatCurrency(ap.spentAmount) }}
                      </span>
                      <span class="font-extrabold text-emerald-400">
                        Disponível: {{ formatCurrency(Math.max(0, ap.amount * (1 - META_TAX_RATE) - (ap.spentAmount || 0))) }}
                      </span>
                      <span class="text-text-secondary">
                        📅 {{ formatDateBr(ap.startDate) }} até {{ formatDateBr(ap.endDate) }}
                        <template v-if="ap.durationDays">({{ ap.durationDays }} dias)</template>
                      </span>
                      <span v-if="ap.notes" class="text-[10px] text-text-muted italic">
                        ({{ ap.notes }})
                      </span>
                    </div>
                    <button
                      type="button"
                      class="text-text-muted hover:text-danger p-1"
                      title="Apagar aporte"
                      @click="deleteAporte(card.id, ap.id)"
                    >
                      <Trash2 :size="13" />
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

          <div class="border-t border-white/10 pt-3 space-y-3">
            <p class="font-bold text-text-muted">Primeiro Aporte de Investimento (Opcional):</p>

            <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <label class="block">
                <span class="text-[10px] font-semibold text-text-muted block">Valor Bruto Aportado (R$)</span>
                <input
                  v-model.number="initialAporteAmount"
                  type="number"
                  step="0.01"
                  placeholder="Ex: 1000,00"
                  class="mt-0.5 w-full rounded-lg border border-border-subtle bg-column px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent"
                />
              </label>

              <label class="block">
                <span class="text-[10px] font-semibold text-text-muted block">Valor Já Investido / Gasto (R$)</span>
                <input
                  v-model.number="initialSpentAmount"
                  type="number"
                  step="0.01"
                  placeholder="Ex: 300,00 (ou 0)"
                  class="mt-0.5 w-full rounded-lg border border-border-subtle bg-column px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent"
                />
              </label>
            </div>

            <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <label class="block">
                <span class="text-[10px] font-semibold text-text-muted block">Início da Veiculação</span>
                <input
                  v-model="initialStartDate"
                  type="date"
                  class="mt-0.5 w-full rounded-lg border border-border-subtle bg-column px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent"
                  @change="onInitialDaysChange"
                />
              </label>

              <label class="block">
                <span class="text-[10px] font-semibold text-text-muted block">Duração (Dias)</span>
                <input
                  v-model.number="initialDurationDays"
                  type="number"
                  min="1"
                  placeholder="Ex: 7 ou 10"
                  class="mt-0.5 w-full rounded-lg border border-border-subtle bg-column px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent"
                  @input="onInitialDaysChange"
                />
              </label>

              <label class="block">
                <span class="text-[10px] font-semibold text-text-muted block">Término Calculado</span>
                <input
                  v-model="initialEndDate"
                  type="date"
                  class="mt-0.5 w-full rounded-lg border border-border-subtle bg-column px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent"
                />
              </label>
            </div>

            <!-- Prévia dos Cálculos Financeiros -->
            <div v-if="initialGross > 0" class="rounded-xl border border-white/10 bg-surface/70 p-3 space-y-1 text-xs">
              <div class="flex justify-between text-text-muted">
                <span>Imposto Meta Ads (12,15%):</span>
                <span class="text-danger font-semibold">- {{ formatCurrency(initialTax) }}</span>
              </div>
              <div class="flex justify-between text-text-muted">
                <span>Valor Líquido Real Anúncios:</span>
                <span class="text-sky-400 font-bold">{{ formatCurrency(initialNet) }}</span>
              </div>
              <div class="flex justify-between text-emerald-400 font-extrabold pt-1 border-t border-white/10">
                <span>Saldo Disponível Líquido:</span>
                <span>{{ formatCurrency(initialAvailable) }}</span>
              </div>
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
      v-if="showNewAporteModal && targetCampaignForAporte"
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
              {{ targetCampaignForAporte.eventName }} ({{ targetCampaignForAporte.organizer }})
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
          <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <label class="block">
              <span class="font-bold text-text-muted block mb-1">Valor Bruto Aportado (R$) *</span>
              <input
                v-model.number="aporteAmount"
                type="number"
                step="0.01"
                placeholder="Ex: 1000,00"
                class="w-full rounded-xl border border-border-subtle bg-column px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
                required
              />
            </label>

            <label class="block">
              <span class="font-bold text-text-muted block mb-1">Já Investido / Gasto (R$)</span>
              <input
                v-model.number="aporteSpentAmount"
                type="number"
                step="0.01"
                placeholder="Ex: 300,00 (ou 0)"
                class="w-full rounded-xl border border-border-subtle bg-column px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
              />
            </label>
          </div>

          <div class="grid grid-cols-3 gap-2">
            <label class="block">
              <span class="font-bold text-text-muted block mb-1">Início *</span>
              <input
                v-model="aporteStartDate"
                type="date"
                class="w-full rounded-xl border border-border-subtle bg-column px-2 py-2 text-xs text-text-primary outline-none focus:border-accent"
                required
                @change="onAporteDaysChange"
              />
            </label>

            <label class="block">
              <span class="font-bold text-text-muted block mb-1">Dias *</span>
              <input
                v-model.number="aporteDurationDays"
                type="number"
                min="1"
                placeholder="Ex: 7"
                class="w-full rounded-xl border border-border-subtle bg-column px-2 py-2 text-xs text-text-primary outline-none focus:border-accent"
                required
                @input="onAporteDaysChange"
              />
            </label>

            <label class="block">
              <span class="font-bold text-text-muted block mb-1">Término *</span>
              <input
                v-model="aporteEndDate"
                type="date"
                class="w-full rounded-xl border border-border-subtle bg-column px-2 py-2 text-xs text-text-primary outline-none focus:border-accent"
                required
                @change="onAporteEndDateChange"
              />
            </label>
          </div>

          <!-- Prévia dos Cálculos Financeiros do Aporte -->
          <div v-if="aporteGross > 0" class="rounded-xl border border-white/10 bg-surface/80 p-3 space-y-1 text-xs">
            <div class="flex justify-between text-text-muted">
              <span>Valor Bruto Aportado:</span>
              <span class="font-semibold text-text-primary">{{ formatCurrency(aporteGross) }}</span>
            </div>
            <div class="flex justify-between text-text-muted">
              <span>Desconto Imposto Meta (12,15%):</span>
              <span class="text-danger font-semibold">- {{ formatCurrency(aporteTax) }}</span>
            </div>
            <div class="flex justify-between text-text-muted">
              <span>Valor Líquido Anúncios:</span>
              <span class="text-sky-400 font-bold">{{ formatCurrency(aporteNet) }}</span>
            </div>
            <div v-if="aporteSpent > 0" class="flex justify-between text-text-muted">
              <span>Já Investido / Gasto:</span>
              <span class="text-amber-300 font-semibold">- {{ formatCurrency(aporteSpent) }}</span>
            </div>
            <div class="flex justify-between text-emerald-400 font-extrabold pt-1 border-t border-white/10 text-sm">
              <span>Saldo Disponível Líquido:</span>
              <span>{{ formatCurrency(aporteAvailableNet) }}</span>
            </div>
          </div>

          <label class="block">
            <span class="font-bold text-text-muted block mb-1">Observação / Notas (Opcional)</span>
            <input
              v-model="aporteNotes"
              type="text"
              placeholder="Ex: Meta Ads - Aporte Semanal"
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

  <!-- MODAL DE RELATÓRIO DE TRÁFEGO DADOS PARA WHATSAPP -->
  <Teleport to="body">
    <div
      v-if="showWhatsappModal && whatsappEvents.length"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        class="absolute inset-0 bg-black/70 backdrop-blur-sm"
        @click="showWhatsappModal = false"
      />
      <div class="relative z-10 w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-emerald-500/30 bg-board-elevated p-6 shadow-2xl overflow-hidden">
        <div class="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
          <div class="flex items-center gap-2">
            <div class="flex size-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300">
              <MessageCircle :size="18" />
            </div>
            <div>
              <h3 class="text-base font-bold text-text-primary">Gerador de Dados de Tráfego (WhatsApp)</h3>
              <p class="text-xs text-text-muted">
                Organizador: <strong class="text-text-primary">{{ whatsappOrganizerName }}</strong> ({{ whatsappEvents.length }} evento(s) no prazo de 1-2 dias)
              </p>
            </div>
          </div>
          <button
            type="button"
            class="text-text-muted hover:text-text-primary"
            @click="showWhatsappModal = false"
          >
            <X :size="18" />
          </button>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto py-4 pr-1 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <!-- LADO ESQUERDO: CAMPOS DE MÉTRICAS EDITÁVEIS PARA CADA EVENTO -->
          <div class="space-y-4">
            <p class="text-xs font-bold text-text-muted uppercase tracking-wider">
              Preencha os dados por evento (Máx. 1-2 dias de término):
            </p>

            <div
              v-for="ev in whatsappEvents"
              :key="ev.campaignId"
              class="rounded-xl border border-white/10 bg-surface/70 p-3.5 space-y-2.5 text-xs"
            >
              <div class="flex items-center justify-between border-b border-white/10 pb-2">
                <span class="font-extrabold text-amber-300 truncate max-w-[200px]" :title="ev.eventName">
                  🏆 {{ ev.eventName }}
                </span>
                <input
                  v-model="ev.endDateText"
                  type="text"
                  placeholder="Ex: Acaba dia 29/07"
                  class="rounded-lg border border-border-subtle bg-column px-2 py-1 text-[11px] text-text-primary outline-none focus:border-accent w-28 text-right font-semibold"
                />
              </div>

              <div class="grid grid-cols-2 gap-2">
                <label class="block">
                  <span class="text-[10px] text-text-muted block">Vendas (Inscrições)</span>
                  <input
                    v-model.number="ev.salesCount"
                    type="number"
                    placeholder="Ex: 32"
                    class="mt-0.5 w-full rounded-lg border border-border-subtle bg-column px-2 py-1 text-xs text-text-primary outline-none focus:border-accent"
                  />
                </label>

                <label class="block">
                  <span class="text-[10px] text-text-muted block">Valor Investido (R$)</span>
                  <input
                    v-model.number="ev.spentAmount"
                    type="number"
                    step="0.01"
                    placeholder="Ex: 716.33"
                    class="mt-0.5 w-full rounded-lg border border-border-subtle bg-column px-2 py-1 text-xs text-text-primary outline-none focus:border-accent"
                    @input="calculateEventRoas(ev)"
                  />
                </label>

                <label class="block">
                  <span class="text-[10px] text-text-muted block">Receita Faturada (R$)</span>
                  <input
                    v-model.number="ev.revenueAmount"
                    type="number"
                    step="0.01"
                    placeholder="Ex: 1799.68"
                    class="mt-0.5 w-full rounded-lg border border-border-subtle bg-column px-2 py-1 text-xs text-text-primary outline-none focus:border-accent"
                    @input="calculateEventRoas(ev)"
                  />
                </label>

                <label class="block">
                  <span class="text-[10px] text-text-muted block">ROAS (Calculado)</span>
                  <input
                    v-model.number="ev.roas"
                    type="number"
                    step="0.01"
                    placeholder="Ex: 2.51"
                    class="mt-0.5 w-full rounded-lg border border-border-subtle bg-column px-2 py-1 text-xs font-bold text-emerald-400 outline-none focus:border-accent"
                  />
                </label>
              </div>
            </div>
          </div>

          <!-- LADO DIREITO: PRÉVIA EM TEMPO REAL DO RELATÓRIO DO WHATSAPP -->
          <div class="flex flex-col space-y-2">
            <span class="text-xs font-bold text-text-muted uppercase tracking-wider block">
              Prévia Formatada da Mensagem (WhatsApp):
            </span>
            <textarea
              :value="generatedWhatsappReport"
              readonly
              class="flex-1 w-full rounded-xl border border-white/10 bg-column p-3.5 text-xs text-text-primary outline-none resize-none font-mono leading-relaxed min-h-[280px]"
            />
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-white/10 shrink-0">
          <span v-if="copiedWhatsappMsg" class="inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
            <Check :size="14" />
            Relatório copiado com sucesso! Prático para colar no WhatsApp.
          </span>
          <span v-else class="text-[11px] text-text-muted">
            Mensagem adaptada com a introdução e o pedido do novo aporte.
          </span>

          <div class="flex items-center gap-2">
            <button
              type="button"
              class="rounded-xl px-4 py-2 text-xs text-text-muted hover:bg-white/5"
              @click="showWhatsappModal = false"
            >
              Fechar
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2 text-xs font-bold text-board hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20"
              @click="copyWhatsappMessage"
            >
              <Copy :size="14" />
              Copiar Relatório para WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
