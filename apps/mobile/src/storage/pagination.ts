export type Page<TItem, TCursor> = {
  items: TItem[];
  nextCursor: TCursor | null;
};

const defaultPageSize = 100;
const maximumPageSize = 250;

export function normalizePageSize(value?: number) {
  if (value === undefined || !Number.isFinite(value)) return defaultPageSize;
  return Math.min(maximumPageSize, Math.max(1, Math.floor(value)));
}

export async function collectAllPages<TItem, TCursor>(
  loadPage: (cursor: TCursor | undefined) => Promise<Page<TItem, TCursor>>,
) {
  const items: TItem[] = [];
  let cursor: TCursor | undefined;

  do {
    const page = await loadPage(cursor);
    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor !== undefined);

  return items;
}
