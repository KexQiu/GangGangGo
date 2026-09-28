import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTrainingStore } from '../../training/trainingStore';
import { useToiletStore } from '../../toilet/toiletStore';
import { useHabitStore } from '../../habits/habitStore';

const reads = vi.hoisted(() => ({ training: vi.fn(), toilet: vi.fn(), habits: vi.fn() }));
vi.mock('../../../storage/repositories/trainingRepository', () => ({
  listTrainingSessionsPage: reads.training,
  insertTrainingSession: vi.fn(),
}));
vi.mock('../../../storage/repositories/toiletRepository', () => ({
  listToiletSessionsPage: reads.toilet,
  insertToiletSession: vi.fn(),
  updateToiletSession: vi.fn(),
  deleteToiletSession: vi.fn(),
}));
vi.mock('../../../storage/repositories/habitRepository', () => ({
  listHabitCheckInsPage: reads.habits,
  saveHabitLevel: vi.fn(),
}));

const cases = [
  {
    name: 'training',
    read: reads.training,
    state: useTrainingStore.getState,
    items: () => useTrainingStore.getState().sessions,
  },
  {
    name: 'toilet',
    read: reads.toilet,
    state: useToiletStore.getState,
    items: () => useToiletStore.getState().sessions,
  },
  { name: 'habits', read: reads.habits, state: useHabitStore.getState, items: () => useHabitStore.getState().checkIns },
];
beforeEach(() => {
  vi.resetAllMocks();
  for (const entry of cases) entry.state().reset();
});

describe.each(cases)('$name profile hydration', ({ read, state, items }) => {
  it.each(['success', 'failure'])('ignores late %s from the previous profile', async (result) => {
    let resolve!: (value: unknown) => void;
    let reject!: (reason: unknown) => void;
    const pending = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    read.mockReturnValueOnce(pending).mockResolvedValueOnce({ items: [{ id: 'B' }], nextCursor: null });
    const previous = state().hydrate();
    state().reset();
    await state().hydrate();
    if (result === 'success') resolve({ items: [{ id: 'A' }], nextCursor: null });
    else reject(new Error('old read failed'));
    await previous;
    expect(items()).toEqual([{ id: 'B' }]);
    expect(state()).toMatchObject({ error: null, hasHydrated: true, isHydrating: false });
  });
});
