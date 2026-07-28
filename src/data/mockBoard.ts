import type { Board } from '../types/board'

export const mockBoard: Board = {
  id: 'board-1',
  title: 'Meu Kanban',
  members: [],
  labels: [
    { id: 'l1', name: 'Urgente', color: 'red' },
    { id: 'l2', name: 'Importante', color: 'yellow' },
    { id: 'l3', name: 'Normal', color: 'blue' },
  ],
  columns: [
    { id: 'backlog', title: 'A Fazer', position: 0 },
    { id: 'in-progress', title: 'Em Andamento', position: 1 },
    { id: 'done', title: 'Concluído', position: 2, isDoneColumn: true },
  ],
  cards: [],
}
