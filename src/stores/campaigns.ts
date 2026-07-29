import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Aporte } from '../types/board'

export interface Campaign {
  id: string
  organizer: string
  eventName: string
  description?: string
  aportes: Aporte[]
  createdAt: string
  updatedAt: string
}

const STORAGE_KEY = 'kanban_runff_campaigns_v1'

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

export const useCampaignsStore = defineStore('campaigns', () => {
  const campaigns = ref<Campaign[]>([])
  const ready = ref(false)

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        campaigns.value = JSON.parse(raw)
      } else {
        campaigns.value = []
      }
    } catch {
      campaigns.value = []
    } finally {
      ready.value = true
    }
  }

  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(campaigns.value))
    } catch (err) {
      console.error('Error saving campaigns to storage', err)
    }
  }

  function init() {
    if (ready.value) return
    loadFromStorage()
  }

  function createCampaign(
    organizer: string,
    eventName: string,
    description?: string,
    initialAporte?: Omit<Aporte, 'id'>,
  ): Campaign {
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
      createdAt: now,
      updatedAt: now,
    }

    campaigns.value.unshift(campaign)
    saveToStorage()
    return campaign
  }

  function addAporte(campaignId: string, aporteData: Omit<Aporte, 'id'>) {
    const campaign = campaigns.value.find((c) => c.id === campaignId)
    if (!campaign) return
    const aporte: Aporte = {
      id: createId('ap'),
      ...aporteData,
    }
    campaign.aportes.unshift(aporte)
    campaign.updatedAt = new Date().toISOString()
    saveToStorage()
  }

  function updateAporte(
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
    saveToStorage()
  }

  function deleteAporte(campaignId: string, aporteId: string) {
    const campaign = campaigns.value.find((c) => c.id === campaignId)
    if (!campaign) return
    campaign.aportes = campaign.aportes.filter((ap) => ap.id !== aporteId)
    campaign.updatedAt = new Date().toISOString()
    saveToStorage()
  }

  function deleteCampaign(campaignId: string) {
    campaigns.value = campaigns.value.filter((c) => c.id !== campaignId)
    saveToStorage()
  }

  return {
    campaigns,
    ready,
    init,
    createCampaign,
    addAporte,
    updateAporte,
    deleteAporte,
    deleteCampaign,
  }
})
