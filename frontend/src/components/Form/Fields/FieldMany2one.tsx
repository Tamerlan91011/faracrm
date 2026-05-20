import { Combobox, InputBase, useCombobox } from '@mantine/core';
import { ReactElement, useContext, useEffect, useState, useMemo } from 'react';
import { IconChevronDown, IconPlus } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import {
  BaseQueryFn,
  TypedUseQueryHookResult,
} from '@reduxjs/toolkit/query/react';
import { FormFieldsContext, useFormContext } from '../FormContext';
import { useSearchQuery, useCreateMutation } from '@/services/api/crudApi';
import {
  FaraRecord,
  GetListParams,
  GetListResult,
  Triplet,
} from '@/services/api/crudTypes';
import { FieldWrapper } from './FieldWrapper';
import { LabelPosition } from '../FormSettingsContext';

const QUICK_CREATE_VALUE = '__quick_create__';

interface FieldMany2oneProps {
  name: string;
  label?: string;
  labelPosition?: LabelPosition;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  limit?: number;
  required?: boolean;
  /** Поле связанной модели для отображения и поиска. По умолчанию 'name'. */
  displayField?: string;
  /** Быстрое создание записи по введённому тексту. По умолчанию выкл. */
  quickCreate?: boolean;
  /** Поле, в которое писать введённый текст при быстром создании.
   *  По умолчанию = displayField (или 'name', если displayField='id'). */
  quickCreateField?: string;
  filter?: Triplet[] | ((values: Record<string, any>) => Triplet[]); // Статичный домен или функция
  [key: string]: any;
}

export const FieldMany2one = <RecordType extends FaraRecord>({
  name,
  label,
  labelPosition,
  sortKey = 'id',
  sortDirection = 'asc',
  limit = 10,
  required,
  displayField = 'name',
  quickCreate = false,
  quickCreateField,
  filter,
  ...props
}: FieldMany2oneProps) => {
  const form = useFormContext();
  const {
    fields: fieldsServer,
    handleFieldChange,
    onchangeFields,
  } = useContext(FormFieldsContext);
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<ReactElement[]>();
  const [startFetch, setStartFetch] = useState(false);
  const displayLabel = label ?? name;

  const relatedModel = fieldsServer[name]?.relatedModel || '';
  const [createRecord] = useCreateMutation();
  const createField =
    quickCreateField || (displayField !== 'id' ? displayField : 'name');

  // Вычисляем домен - статичный или через функцию
  const filterDomain = useMemo((): Triplet[] => {
    if (!filter) return [];
    if (typeof filter === 'function') {
      return filter(form.values || {});
    }
    return filter;
  }, [filter, form.values]);

  const combinedFilter = useMemo(() => {
    const filters: Triplet[] = [];
    if (search) {
      filters.push([displayField, 'ilike', search]);
    }
    if (filterDomain.length > 0) {
      filters.push(...filterDomain);
    }
    return filters;
  }, [search, filterDomain]);

  const { data, isLoading } = useSearchQuery(
    {
      model: relatedModel,
      limit,
      sort: sortKey,
      order: sortDirection,
      fields: displayField === 'id' ? ['id'] : ['id', displayField],
      filter: combinedFilter,
    },
    {
      // Пропускаем только если dropdown не открыт и нет поиска
      skip: !startFetch && search === '',
    },
  ) as TypedUseQueryHookResult<
    GetListResult<RecordType>,
    GetListParams,
    BaseQueryFn
  >;

  useEffect(() => {
    if (data) {
      const optionsData = data.data.map(item => (
        <Combobox.Option value={item.id.toString()} key={item.id}>
          {item[displayField] ?? item.id}
        </Combobox.Option>
      ));
      setOptions(optionsData);
    }
  }, [data]);

  // Пункт "Создать «...»" — когда включён quickCreate, есть введённый
  // текст и нет точного совпадения по displayField.
  const trimmedSearch = search.trim();
  const hasExactMatch = useMemo(
    () =>
      !!data?.data.some(
        r =>
          String(r[displayField] ?? '').toLowerCase() ===
          trimmedSearch.toLowerCase(),
      ),
    [data, displayField, trimmedSearch],
  );
  const showQuickCreate =
    quickCreate && !!relatedModel && !!trimmedSearch && !hasExactMatch;

  const selectRecord = (record: FaraRecord) => {
    if (onchangeFields?.includes(name) && handleFieldChange) {
      handleFieldChange(name, record);
    } else {
      form.setValues({ [name]: record });
    }
  };

  const combobox = useCombobox({
    onDropdownClose: () => {
      combobox.resetSelectedOption();
      combobox.focusTarget();
      setSearch('');
    },

    onDropdownOpen: () => {
      setStartFetch(true);
      combobox.focusSearchInput();
    },
  });

  return (
    <>
      {form.getValues() && (
        <FieldWrapper
          label={displayLabel}
          labelPosition={labelPosition}
          required={required}>
          <InputBase
            display={'none'}
            readOnly={true}
            key={form.key(name)}
            {...form.getInputProps(name)}
          />
          <Combobox
            {...props}
            {...form.getInputProps(name)}
            store={combobox}
            width={250}
            position="bottom-start"
            withArrow
            onOptionSubmit={async val => {
              if (val === QUICK_CREATE_VALUE) {
                try {
                  const created = await createRecord({
                    model: relatedModel,
                    values: { [createField]: trimmedSearch },
                  }).unwrap();
                  selectRecord({
                    id: created.id,
                    [displayField]: trimmedSearch,
                  } as FaraRecord);
                } catch {
                  notifications.show({
                    color: 'red',
                    message: 'Не удалось создать запись',
                  });
                }
                combobox.closeDropdown();
                return;
              }
              if (data) {
                const record = data.data.find(obj => {
                  return obj.id.toString() === val;
                });
                if (record) {
                  selectRecord(record);
                }
              }
              combobox.closeDropdown();
            }}>
            <Combobox.Target>
              <InputBase
                component="button"
                type="button"
                pointer
                rightSection={
                  <IconChevronDown
                    size={16}
                    style={{
                      opacity: 0.4,
                      transition: 'transform 150ms ease',
                      transform: combobox.dropdownOpened
                        ? 'rotate(180deg)'
                        : 'rotate(0deg)',
                    }}
                  />
                }
                rightSectionPointerEvents="none"
                onClick={() => {
                  combobox.openDropdown();
                }}
                onFocus={() => combobox.openDropdown()}
                onBlur={() => combobox.closeDropdown()}>
                {form.getValues()[name] ? (
                  (form.getValues()[name][displayField] ??
                  form.getValues()[name].id)
                ) : (
                  <span style={{ opacity: 0.4 }}>Выбрать...</span>
                )}
              </InputBase>
            </Combobox.Target>

            <Combobox.Dropdown>
              <Combobox.Search
                value={search}
                onChange={event => {
                  setSearch(event.currentTarget.value);
                }}
                placeholder={'Поиск...'}
              />
              <Combobox.Options>
                {isLoading ? (
                  <Combobox.Empty>Загрузка...</Combobox.Empty>
                ) : options && !!options.length ? (
                  options
                ) : !showQuickCreate ? (
                  <Combobox.Empty>Ничего не найдено</Combobox.Empty>
                ) : null}
                {showQuickCreate && (
                  <Combobox.Option
                    value={QUICK_CREATE_VALUE}
                    key={QUICK_CREATE_VALUE}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        color: 'var(--mantine-color-blue-6)',
                      }}>
                      <IconPlus size={14} />
                      Создать «{trimmedSearch}»
                    </span>
                  </Combobox.Option>
                )}
              </Combobox.Options>
            </Combobox.Dropdown>
          </Combobox>
        </FieldWrapper>
      )}
    </>
  );
};
