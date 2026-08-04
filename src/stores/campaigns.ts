import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Aporte } from '../types/board'
import { BOARD_ID, supabase } from '../lib/supabase'
import { useToastStore } from './toast'

export interface Campaign {
  id: string
  organizer: string
  eventName: string
  description?: string
  aportes: Aporte[]
  finished?: boolean
  finishedAt?: string | null
  createdAt: string
  updatedAt: string
}

interface CampaignRow {
  id: string
  board_id: string
  organizer: string
  event_name: string
  description: string | null
  aportes: Aporte[] | null
  finished: boolean | null
  finished_at: string | null
  created_at: string
  updated_at: string
}

const STORAGE_KEY = 'kanban_runff_campaigns_v1'

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

export const useCampaignsStore = defineStore('campaigns', () => {
  const campaigns = ref<Campaign[]>([])
  const ready = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)

  let channel: RealtimeChannel | null = null
  let suppressRealtimeUntil = 0
  let reloadTimer: ReturnType<typeof setTimeout> | null = null
  let loadGeneration = 0

  function quietRealtime(ms = 2000) {
    suppressRealtimeUntil = Date.now() + ms
  }

  function reportError(raw: string) {
    error.value = raw
    useToastStore().error(raw)
  }

  async function migrateFromLocalStorageIfNeeded() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const localItems: Campaign[] = JSON.parse(raw)
      if (!Array.isArray(localItems) || localItems.length === 0) return

      const rows = localItems.map((item) => ({
        id: item.id,
        board_id: BOARD_ID,
        organizer: item.organizer,
        event_name: item.eventName,
        description: item.description ?? '',
        aportes: item.aportes ?? [],
        finished: item.finished ?? false,
        finished_at: item.finishedAt ?? null,
        created_at: item.createdAt,
        updated_at: item.updatedAt,
      }))

      const { error: insertErr } = await supabase.from('campaigns').upsert(rows, { onConflict: 'id' })
      if (!insertErr) {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch (e) {
      console.warn('Failed to migrate local campaigns to Supabase:', e)
    }
  }

  function mapRowToCampaign(row: CampaignRow): Campaign {
    return {
      id: row.id,
      organizer: row.organizer,
      eventName: row.event_name,
      description: row.description ?? undefined,
      aportes: Array.isArray(row.aportes) ? row.aportes : [],
      finished: row.finished ?? false,
      finishedAt: row.finished_at ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  async function loadCampaigns(opts?: { background?: boolean }) {
    const generation = ++loadGeneration
    if (!opts?.background) {
      loading.value = true
      error.value = null
    }

    try {
      const { data, error: fetchErr } = await supabase
        .from('campaigns')
        .select('*')
        .eq('board_id', BOARD_ID)
        .order('updated_at', { ascending: false })

      if (generation !== loadGeneration) return

      if (fetchErr) {
        if (!opts?.background) reportError(fetchErr.message)
        return
      }

      const rows = (data ?? []) as unknown as CampaignRow[]

      if (rows.length === 0) {
        await migrateFromLocalStorageIfNeeded()
        const { data: reData } = await supabase
          .from('campaigns')
          .select('*')
          .eq('board_id', BOARD_ID)
          .order('updated_at', { ascending: false })
        if (reData && reData.length > 0) {
          const reRows = reData as unknown as CampaignRow[]
          campaigns.value = reRows.map(mapRowToCampaign)
          ready.value = true
          return
        }
      }

      campaigns.value = rows.map(mapRowToCampaign)
      error.value = null
    } catch (err) {
      if (generation !== loadGeneration) return
      const msg = err instanceof Error ? err.message : String(err)
      if (!opts?.background) reportError(msg)
    } finally {
      if (generation === loadGeneration) {
        loading.value = false
        ready.value = true
      }
    }
  }

  function subscribeRealtime() {
    unsubscribeRealtime()
    channel = supabase
      .channel(`campaigns:${BOARD_ID}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campaigns' },
        () => {
          if (Date.now() < suppressRealtimeUntil) return
          if (reloadTimer) clearTimeout(reloadTimer)
          reloadTimer = setTimeout(() => {
            reloadTimer = null
            if (Date.now() < suppressRealtimeUntil) return
            void loadCampaigns({ background: true })
          }, 1000)
        },
      )
      .subscribe()
  }

  function unsubscribeRealtime() {
    if (reloadTimer) {
      clearTimeout(reloadTimer)
      reloadTimer = null
    }
    if (channel) {
      void supabase.removeChannel(channel)
      channel = null
    }
  }

  async function init() {
    if (ready.value) return
    await loadCampaigns()
    subscribeRealtime()
  }

  function reset() {
    unsubscribeRealtime()
    campaigns.value = []
    ready.value = false
    loading.value = false
    error.value = null
  }

  async function createCampaign(
    organizer: string,
    eventName: string,
    description?: string,
    initialAporte?: Omit<Aporte, 'id'>,
  ): Promise<Campaign> {
    const now = new Date().toISOString()
    const aportesList: Aporte[] = []
    if (initialAporte) {
      aportesList.push({
        id: createId('ap'),
        ...initialAporte,
      })
    }

    const campaign: Campaign = {
      id: createId('cmp'),
      organizer: organizer.trim(),
      eventName: eventName.trim(),
      description: description?.trim() || `Campanha para o evento ${eventName} do organizador ${organizer}.`,
      aportes: aportesList,
      finished: false,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    }

    campaigns.value.unshift(campaign)
    quietRealtime()

    try {
      const { error: insertErr } = await supabase.from('campaigns').insert({
        id: campaign.id,
        board_id: BOARD_ID,
        organizer: campaign.organizer,
        event_name: campaign.eventName,
        description: campaign.description,
        aportes: campaign.aportes,
        finished: campaign.finished,
        finished_at: campaign.finishedAt,
        created_at: campaign.createdAt,
        updated_at: campaign.updatedAt,
      })

      if (insertErr) {
        reportError(insertErr.message)
        campaigns.value = campaigns.value.filter((c) => c.id !== campaign.id)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      reportError(msg)
      campaigns.value = campaigns.value.filter((c) => c.id !== campaign.id)
    }

    return campaign
  }

  async function persistCampaign(campaign: Campaign) {
    quietRealtime()
    try {
      const { error: updateErr } = await supabase
        .from('campaigns')
        .update({
          organizer: campaign.organizer,
          event_name: campaign.eventName,
          description: campaign.description,
          aportes: campaign.aportes,
          finished: campaign.finished ?? false,
          finished_at: campaign.finishedAt ?? null,
          updated_at: campaign.updatedAt,
        })
        .eq('id', campaign.id)

      if (updateErr) {
        reportError(updateErr.message)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      reportError(msg)
    }
  }

  async function toggleFinishCampaign(campaignId: string) {
    const campaign = campaigns.value.find((c) => c.id === campaignId)
    if (!campaign) return
    const isFinished = !campaign.finished
    campaign.finished = isFinished
    campaign.finishedAt = isFinished ? new Date().toISOString() : null
    campaign.updatedAt = new Date().toISOString()
    await persistCampaign(campaign)
  }

  async function toggleFinishAporte(campaignId: string, aporteId: string) {
    const campaign = campaigns.value.find((c) => c.id === campaignId)
    if (!campaign) return
    const aporte = campaign.aportes.find((ap) => ap.id === aporteId)
    if (!aporte) return
    const isFinished = !aporte.finished
    aporte.finished = isFinished
    aporte.finishedAt = isFinished ? new Date().toISOString() : null
    campaign.updatedAt = new Date().toISOString()
    await persistCampaign(campaign)
  }

  async function addAporte(campaignId: string, aporteData: Omit<Aporte, 'id'>) {
    const campaign = campaigns.value.find((c) => c.id === campaignId)
    if (!campaign) return
    const aporte: Aporte = {
      id: createId('ap'),
      ...aporteData,
    }
    campaign.aportes.unshift(aporte)
    campaign.updatedAt = new Date().toISOString()
    await persistCampaign(campaign)
  }

  async function updateAporte(
    campaignId: string,
    aporteId: string,
    updatedData: Partial<Omit<Aporte, 'id'>>,
  ) {
    const campaign = campaigns.value.find((c) => c.id === campaignId)
    if (!campaign) return
    const aporte = campaign.aportes.find((ap) => ap.id === aporteId)
    if (!aporte) return
    Object.assign(aporte, updatedData)
    campaign.updatedAt = new Date().toISOString()
    await persistCampaign(campaign)
  }

  async function deleteAporte(campaignId: string, aporteId: string) {
    const campaign = campaigns.value.find((c) => c.id === campaignId)
    if (!campaign) return
    campaign.aportes = campaign.aportes.filter((ap) => ap.id !== aporteId)
    campaign.updatedAt = new Date().toISOString()
    await persistCampaign(campaign)
  }

  async function deleteCampaign(campaignId: string) {
    const backup = [...campaigns.value]
    campaigns.value = campaigns.value.filter((c) => c.id !== campaignId)
    quietRealtime()

    try {
      const { error: deleteErr } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', campaignId)

      if (deleteErr) {
        reportError(deleteErr.message)
        campaigns.value = backup
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      reportError(msg)
      campaigns.value = backup
    }
  }

  return {
    campaigns,
    ready,
    loading,
    error,
    init,
    reset,
    createCampaign,
    toggleFinishCampaign,
    toggleFinishAporte,
    addAporte,
    updateAporte,
    deleteAporte,
    deleteCampaign,
  }
})
