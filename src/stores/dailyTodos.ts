import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { DailyEntry, DailyStatus, DailyTodoItem } from '../types/daily'
import { BOARD_ID, supabase } from '../lib/supabase'
import { useBoardStore } from './board'
import { useToastStore } from './toast'
import type { Json } from '../lib/database.types'

const STORAGE_KEY = 'kanban-daily-ui-v1'

export type DailyViewMode = 'day' | 'week' | 'month'

export type RecurrenceMode =
  | 'today'
  | 'rest_of_week'
  | 'weekdays'
  | 'next_7_days'
  | 'next_30_days'

export function getRecurrenceTargetDates(
  startDateKey: string,
  mode: RecurrenceMode,
): string[] {
  const start = parseDateKey(startDateKey)
  const result: string[] = []

  if (mode === 'today') {
    return [startDateKey]
  }

  if (mode === 'rest_of_week') {
    const sunday = startOfWeek(start)
    sunday.setDate(sunday.getDate() + 6)
    const curr = new Date(start)
    while (curr <= sunday) {
      result.push(toDateKey(curr))
      curr.setDate(curr.getDate() + 1)
    }
    return result
  }

  if (mode === 'weekdays') {
    const sunday = startOfWeek(start)
    sunday.setDate(sunday.getDate() + 6)
    const curr = new Date(start)
    while (curr <= sunday) {
      const day = curr.getDay()
      if (day !== 0 && day !== 6) {
        result.push(toDateKey(curr))
      }
      curr.setDate(curr.getDate() + 1)
    }
    if (result.length < 2) {
      const curr2 = new Date(start)
      for (let i = 0; i < 7; i++) {
        const day = curr2.getDay()
        const key = toDateKey(curr2)
        if (day !== 0 && day !== 6 && !result.includes(key)) {
          result.push(key)
        }
        curr2.setDate(curr2.getDate() + 1)
      }
    }
    return result
  }

  if (mode === 'next_7_days') {
    const curr = new Date(start)
    for (let i = 0; i < 7; i++) {
      result.push(toDateKey(curr))
      curr.setDate(curr.getDate() + 1)
    }
    return result
  }

  if (mode === 'next_30_days') {
    const curr = new Date(start)
    for (let i = 0; i < 30; i++) {
      result.push(toDateKey(curr))
      curr.setDate(curr.getDate() + 1)
    }
    return result
  }

  return [startDateKey]
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

export function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function parseDateKey(dateKey: string) {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function startOfWeek(date: Date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  copy.setDate(copy.getDate() - copy.getDay())
  return copy
}

function asTodos(value: Json): DailyTodoItem[] {
  if (!Array.isArray(value)) return []
  return value as unknown as DailyTodoItem[]
}

function emptyEntry(memberId: string, dateKey: string): DailyEntry {
  return {
    id: `day_${memberId}_${dateKey}`,
    memberId,
    dateKey,
    status: 'todo',
    campaign: '',
    todos: [],
    updatedAt: new Date().toISOString(),
  }
}

export function entryProgress(entry: DailyEntry | null | undefined) {
  if (!entry || entry.todos.length === 0) {
    return { done: 0, total: 0, percent: 0, complete: false }
  }
  const done = entry.todos.filter((item) => item.completed).length
  const total = entry.todos.length
  return {
    done,
    total,
    percent: Math.round((done / total) * 100),
    complete: done === total,
  }
}

function loadUiState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as {
      selectedDateKey?: string
      viewMode?: DailyViewMode
      detailMemberId?: string | null
    }
  } catch {
    return null
  }
}

export const useDailyStore = defineStore('daily', () => {
  const board = useBoardStore()
  const ui = loadUiState()
  const entries = ref<DailyEntry[]>([])
  const selectedDateKey = ref(ui?.selectedDateKey ?? toDateKey(new Date()))
  const viewMode = ref<DailyViewMode>(ui?.viewMode ?? 'day')
  const detailMemberId = ref<string | null>(ui?.detailMemberId ?? null)
  const loading = ref(false)
  const ready = ref(false)
  const error = ref<string | null>(null)
  let channel: RealtimeChannel | null = null
  let suppressRealtimeUntil = 0
  const persistTimers = new Map<string, ReturnType<typeof setTimeout>>()
  let reloadTimer: ReturnType<typeof setTimeout> | null = null

  function quietRealtime(ms = 800) {
    suppressRealtimeUntil = Date.now() + ms
  }

  function schedulePersist(entry: DailyEntry) {
    const existing = persistTimers.get(entry.id)
    if (existing) clearTimeout(existing)
    persistTimers.set(
      entry.id,
      setTimeout(() => {
        persistTimers.delete(entry.id)
        void persistEntry(entry)
      }, 350),
    )
  }

  function sanitizeDetailMember() {
    if (
      detailMemberId.value &&
      !board.members.some((member) => member.id === detailMemberId.value)
    ) {
      detailMemberId.value = board.members[0]?.id ?? null
      persistUi()
    }
  }

  async function persistEntry(entry: DailyEntry) {
    quietRealtime()
    const { error: upsertError } = await supabase.from('daily_entries').upsert(
      {
        id: entry.id,
        board_id: BOARD_ID,
        member_id: entry.memberId,
        date_key: entry.dateKey,
        status: entry.status,
        campaign: entry.campaign,
        todos: entry.todos as unknown as Json,
        updated_at: entry.updatedAt,
      },
      { onConflict: 'id' },
    )
    if (upsertError) {
      error.value = upsertError.message
      useToastStore().error(upsertError.message)
    }
  }

  async function loadEntries() {
    loading.value = true
    error.value = null
    const { data, error: loadError } = await supabase
      .from('daily_entries')
      .select('*')
      .eq('board_id', BOARD_ID)

    if (loadError) {
      error.value = loadError.message
      useToastStore().error(loadError.message)
      loading.value = false
      return
    }

    const localByKey = new Map(
      entries.value.map((entry) => [`${entry.memberId}:${entry.dateKey}`, entry]),
    )
    const remote = (data ?? []).map((row) => ({
      id: row.id,
      memberId: row.member_id,
      dateKey: row.date_key,
      status: row.status as DailyStatus,
      campaign: row.campaign,
      todos: asTodos(row.todos),
      updatedAt: row.updated_at,
    }))

    const merged = remote.map((row) => {
      const local = localByKey.get(`${row.memberId}:${row.dateKey}`)
      // Mantém edição local ainda não persistida
      if (local && persistTimers.has(local.id)) return local
      return row
    })

    for (const [key, local] of localByKey) {
      if (
        persistTimers.has(local.id) &&
        !merged.some(
          (entry) => `${entry.memberId}:${entry.dateKey}` === key,
        )
      ) {
        merged.push(local)
      }
    }

    entries.value = merged
    loading.value = false
  }

  function subscribeRealtime() {
    unsubscribeRealtime()
    channel = supabase
      .channel(`daily:${BOARD_ID}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_entries' },
        () => {
          if (Date.now() < suppressRealtimeUntil) return
          if (reloadTimer) clearTimeout(reloadTimer)
          reloadTimer = setTimeout(() => {
            reloadTimer = null
            if (Date.now() < suppressRealtimeUntil) return
            void loadEntries()
          }, 700)
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
    await loadEntries()
    sanitizeDetailMember()
    subscribeRealtime()
    ready.value = true
  }

  function reset() {
    unsubscribeRealtime()
    for (const timer of persistTimers.values()) clearTimeout(timer)
    persistTimers.clear()
    entries.value = []
    ready.value = false
  }

  function persistUi() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        selectedDateKey: selectedDateKey.value,
        viewMode: viewMode.value,
        detailMemberId: detailMemberId.value,
      }),
    )
  }

  const activeMemberId = computed(
    () =>
      board.memberFilterId ??
      detailMemberId.value ??
      board.members[0]?.id ??
      'owner',
  )

  const currentEntry = computed(() => {
    const memberId = activeMemberId.value
    if (!memberId) return null
    return (
      entries.value.find(
        (entry) =>
          entry.memberId === memberId &&
          entry.dateKey === selectedDateKey.value,
      ) ?? null
    )
  })

  function entriesForDate(dateKey: string) {
    const filter = board.memberFilterId
    return entries.value.filter(
      (entry) =>
        entry.dateKey === dateKey &&
        entry.todos.length > 0 &&
        (!filter || entry.memberId === filter),
    )
  }

  const weekDays = computed(() => {
    const start = startOfWeek(parseDateKey(selectedDateKey.value))
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start)
      date.setDate(start.getDate() + index)
      const dateKey = toDateKey(date)
      const dayEntries = entriesForDate(dateKey)
      return {
        date,
        dateKey,
        dayNumber: date.getDate(),
        weekday: new Intl.DateTimeFormat('pt-BR', {
          weekday: 'short',
        }).format(date),
        isToday: dateKey === toDateKey(new Date()),
        isSelected: dateKey === selectedDateKey.value,
        entries: dayEntries,
      }
    })
  })

  const monthCells = computed(() => {
    const anchor = parseDateKey(selectedDateKey.value)
    const year = anchor.getFullYear()
    const month = anchor.getMonth()
    const first = new Date(year, month, 1)
    const start = startOfWeek(first)
    const cells = []

    for (let i = 0; i < 42; i++) {
      const date = new Date(start)
      date.setDate(start.getDate() + i)
      const dateKey = toDateKey(date)
      cells.push({
        date,
        dateKey,
        dayNumber: date.getDate(),
        inMonth: date.getMonth() === month,
        isToday: dateKey === toDateKey(new Date()),
        isSelected: dateKey === selectedDateKey.value,
        entries: entriesForDate(dateKey),
      })
    }

    return cells
  })

  const periodLabel = computed(() => {
    const date = parseDateKey(selectedDateKey.value)
    if (viewMode.value === 'day') {
      return new Intl.DateTimeFormat('pt-BR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(date)
    }
    return new Intl.DateTimeFormat('pt-BR', {
      month: 'long',
      year: 'numeric',
    }).format(date)
  })

  function ensureEntry(
    memberId = activeMemberId.value,
    dateKey = selectedDateKey.value,
    options?: { persistEmpty?: boolean },
  ) {
    if (!memberId) return null
    let targetMemberId = memberId
    if (
      board.members.length &&
      !board.members.some((member) => member.id === targetMemberId)
    ) {
      targetMemberId = board.members[0]?.id ?? targetMemberId
    }
    let entry = entries.value.find(
      (item) => item.memberId === targetMemberId && item.dateKey === dateKey,
    )
    if (!entry) {
      entry = emptyEntry(targetMemberId, dateKey)
      entries.value.push(entry)
      // Só grava no banco quando há conteúdo real (evita race com load)
      if (options?.persistEmpty) schedulePersist(entry)
    }
    return entry
  }

  function setViewMode(mode: DailyViewMode) {
    viewMode.value = mode
    persistUi()
  }

  function setDateKey(dateKey: string) {
    selectedDateKey.value = dateKey
    persistUi()
  }

  function openEntry(memberId: string, dateKey: string) {
    detailMemberId.value = memberId
    if (board.memberFilterId) {
      board.setMemberFilter(memberId)
    }
    selectedDateKey.value = dateKey
    viewMode.value = 'day'
    persistUi()
  }

  function shiftPeriod(delta: number) {
    const date = parseDateKey(selectedDateKey.value)
    if (viewMode.value === 'day') date.setDate(date.getDate() + delta)
    else if (viewMode.value === 'week') date.setDate(date.getDate() + delta * 7)
    else date.setMonth(date.getMonth() + delta)
    selectedDateKey.value = toDateKey(date)
    persistUi()
  }

  function goToday() {
    selectedDateKey.value = toDateKey(new Date())
    persistUi()
  }

  function setStatus(status: DailyStatus) {
    const entry = ensureEntry()
    if (!entry) return
    entry.status = status
    entry.updatedAt = new Date().toISOString()
    schedulePersist(entry)
  }

  function setCampaign(campaign: string) {
    const entry = ensureEntry()
    if (!entry) return
    entry.campaign = campaign
    entry.updatedAt = new Date().toISOString()
    schedulePersist(entry)
  }

  function addTodo(text: string) {
    addTodoWithRecurrence(text, 'today')
  }

  function addTodoWithRecurrence(
    text: string,
    mode: RecurrenceMode = 'today',
    startDateKey = selectedDateKey.value,
  ) {
    const trimmed = text.trim()
    if (!trimmed) return

    const dates = getRecurrenceTargetDates(startDateKey, mode)
    const mId = activeMemberId.value
    let count = 0

    for (const dKey of dates) {
      const entry = ensureEntry(mId, dKey)
      if (!entry) continue

      const lower = trimmed.toLowerCase()
      const exists = entry.todos.some(
        (item) => item.text.trim().toLowerCase() === lower,
      )

      if (!exists) {
        const todo: DailyTodoItem = {
          id: createId('td'),
          text: trimmed,
          completed: false,
        }
        entry.todos.push(todo)
        entry.updatedAt = new Date().toISOString()
        if (entry.status === 'done') entry.status = 'in_progress'
        schedulePersist(entry)
        count++
      }
    }

    if (dates.length > 1 && count > 0) {
      useToastStore().success(`Tarefa criada para ${count} dia(s)!`)
    }
  }

  function toggleTodo(todoId: string) {
    const entry = ensureEntry()
    if (!entry) return
    const todo = entry.todos.find((item) => item.id === todoId)
    if (!todo) return
    todo.completed = !todo.completed
    entry.updatedAt = new Date().toISOString()

    if (entry.todos.length && entry.todos.every((item) => item.completed)) {
      entry.status = 'done'
    } else if (entry.todos.some((item) => item.completed)) {
      entry.status = 'in_progress'
    } else {
      entry.status = 'todo'
    }
    schedulePersist(entry)
  }

  function updateTodoText(todoId: string, text: string) {
    const entry = ensureEntry()
    if (!entry) return
    const todo = entry.todos.find((item) => item.id === todoId)
    if (!todo) return
    todo.text = text
    entry.updatedAt = new Date().toISOString()
    schedulePersist(entry)
  }

  function removeTodo(todoId: string) {
    const entry = ensureEntry()
    if (!entry) return
    entry.todos = entry.todos.filter((item) => item.id !== todoId)
    entry.updatedAt = new Date().toISOString()
    schedulePersist(entry)
  }

  const progress = computed(() => entryProgress(currentEntry.value))

  return {
    entries,
    selectedDateKey,
    viewMode,
    detailMemberId,
    activeMemberId,
    currentEntry,
    progress,
    weekDays,
    monthCells,
    periodLabel,
    loading,
    ready,
    error,
    init,
    reset,
    sanitizeDetailMember,
    setViewMode,
    setDateKey,
    openEntry,
    shiftPeriod,
    goToday,
    setStatus,
    setCampaign,
    addTodo,
    addTodoWithRecurrence,
    toggleTodo,
    updateTodoText,
    removeTodo,
    ensureEntry,
    entryProgress,
  }
})
