/**
 * useFilteredSearchQuery — useSearchQuery с автоматическим подмешиванием
 * общего фильтра вью из FilterContext (его выставляет <ViewWrapper>) и
 * префильтра x2m-навигации из location.state.initialFilter.
 *
 * Зачем: раньше каждое вью (list/kanban/gantt) должно было вручную звать
 * useFilters() и прокидывать filter в запрос. Это легко забыть — именно так
 * фильтр пропадал в канбанах файлов и пользователей. Хук убирает ритуал:
 * вызови useFilteredSearchQuery вместо useSearchQuery для ОСНОВНОГО запроса
 * записей вью — и общий фильтр применится сам.
 *
 * Когда НЕ использовать (нужен обычный useSearchQuery без фильтра вью):
 *   - пикеры relation-полей (FieldMany2one, ButtonModalSelect, …);
 *   - запрос колонок-стадий в канбане (стадии показываем все);
 *   - probe первой записи в ViewWrapper, preloader'ы и т.п.
 */
import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useSearchQuery } from '@/services/api/crudApi';
import { FilterExpression, GetListParams } from '@/services/api/crudTypes';
import { useFilters } from './FilterContext';

/**
 * AND-склейка нескольких FilterExpression. Каждый непустой источник
 * оборачивается в отдельную группу, поэтому внутренний OR не «протекает»
 * через приоритет AND > OR. Парсер на бэке (filter_parser.py) рекурсивно
 * разбирает вложенные группы, берёт каждую в скобки и ставит между ними
 * AND. Пустые/undefined источники отбрасываются.
 *
 *   mergeFilters(undefined, [t1])          -> [t1]
 *   mergeFilters([t1], [t2, 'or', t3])     -> [[t1], [t2, 'or', t3]]
 *       => (t1) AND (t2 OR t3)
 */
export function mergeFilters(
  ...sources: (FilterExpression | undefined | null)[]
): FilterExpression | undefined {
  const groups = sources.filter(
    (s): s is FilterExpression => Array.isArray(s) && s.length > 0,
  );
  if (groups.length === 0) return undefined;
  if (groups.length === 1) return groups[0];
  // Каждая группа — вложенный FilterExpression (бэк возьмёт её в скобки).
  return groups;
}

export function useFilteredSearchQuery(
  params: GetListParams,
  options?: Parameters<typeof useSearchQuery>[1],
) {
  const contextFilters = useFilters();
  // X2m-навигация «показать связанные» (FieldX2mButton) передаёт префильтр
  // через location.state.initialFilter. Раньше его читал только <List> —
  // теперь здесь, поэтому ВСЕ вью (list/kanban/gantt) его уважают.
  const location = useLocation();
  const stateFilter = useMemo<FilterExpression>(() => {
    const raw = (location.state as { initialFilter?: FilterExpression } | null)
      ?.initialFilter;
    return Array.isArray(raw) ? raw : [];
  }, [location.state]);
  const filter = useMemo(
    () => mergeFilters(params.filter, stateFilter, contextFilters),
    [params.filter, stateFilter, contextFilters],
  );
  return useSearchQuery({ ...params, filter }, options);
}
