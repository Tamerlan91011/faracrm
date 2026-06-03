/**
 * MassActionModal — массовое изменение одного поля для выбранных строк листа.
 *
 * Пользователь выбирает поле и значение, значение применяется ко всем
 * выбранным записям одним запросом через updateBulk (PUT /{model}/bulk).
 *
 * Инпут значения переиспользует InlineCell — он уже умеет рендерить нужный
 * контрол по типу поля (Many2one с поиском, Selection, Boolean, число, текст),
 * поэтому массовая смена stage_id / user_id / active и т.п. работает в том же
 * формате значения, что и обычное редактирование.
 */
import { useEffect, useState } from 'react';
import {
  Modal,
  Select,
  Button,
  Group,
  Stack,
  Input,
  Box,
  Text,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { InlineCell } from '@/components/Form/Fields/InlineCell';
import { useUpdateBulkMutation } from '@/services/api/crudApi';
import { FaraRecord, GetListField } from '@/services/api/crudTypes';

// Типы полей, для которых InlineCell рендерит полноценный инпут. Остальные
// (Decimal, Json, Date, списки-связи, id) в массовом действии не предлагаем.
const EDITABLE_TYPES = new Set([
  'Integer',
  'BigInteger',
  'SmallInteger',
  'Float',
  'Boolean',
  'Selection',
  'Char',
  'Text',
  'Many2one',
]);

export function MassActionModal({
  opened,
  onClose,
  model,
  fields,
  selectedIds,
  onDone,
}: {
  opened: boolean;
  onClose: () => void;
  model: string;
  fields: GetListField[];
  selectedIds: FaraRecord[];
  /** Вызывается после успешного применения (закрыть + сбросить выделение). */
  onDone: () => void;
}) {
  const [fieldName, setFieldName] = useState<string | null>(null);
  const [value, setValue] = useState<any>(undefined);
  const [updateBulk, { isLoading }] = useUpdateBulkMutation();

  // Сбрасываем состояние при каждом открытии.
  useEffect(() => {
    if (opened) {
      setFieldName(null);
      setValue(undefined);
    }
  }, [opened]);

  const editableFields = fields.filter(
    f => f.name !== 'id' && EDITABLE_TYPES.has(f.type),
  );
  const selected = editableFields.find(f => f.name === fieldName) || null;
  const ids = selectedIds.map(r => r.id);

  const handleSelectField = (name: string | null) => {
    setFieldName(name);
    setValue(undefined); // значение зависит от типа поля — сбрасываем
  };

  const handleApply = async () => {
    if (!fieldName || !selected) return;
    // Many2one: схема апдейта ждёт int id (или 'VirtualId'), а InlineCell
    // отдаёт объект {id, name} — достаём id.
    const outValue =
      selected.type === 'Many2one' && value && typeof value === 'object'
        ? value.id
        : value;
    try {
      await updateBulk({
        model,
        ids,
        values: { [fieldName]: outValue },
      }).unwrap();
      notifications.show({
        color: 'green',
        message: `Обновлено записей: ${ids.length}`,
      });
      onDone();
    } catch {
      notifications.show({
        color: 'red',
        message: 'Не удалось выполнить массовое обновление',
      });
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Массовое изменение (${ids.length})`}
      centered
    >
      <Stack gap="md">
        <Select
          label="Поле"
          placeholder="Выберите поле"
          data={editableFields.map(f => ({ value: f.name, label: f.name }))}
          value={fieldName}
          onChange={handleSelectField}
          searchable
          nothingFoundMessage="Нет доступных полей"
        />

        {selected && (
          <Input.Wrapper label="Значение">
            <Box
              style={{
                border: '1px solid var(--mantine-color-gray-4)',
                borderRadius: 'var(--mantine-radius-sm)',
                padding: '4px 8px',
              }}
            >
              <InlineCell
                value={value}
                fieldName={selected.name}
                fieldType={selected.type}
                options={selected.options}
                relation={selected.relation}
                onChange={setValue}
                quickCreate={false}
              />
            </Box>
          </Input.Wrapper>
        )}

        <Text size="xs" c="dimmed">
          Значение будет записано во все выбранные строки ({ids.length}).
        </Text>

        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={onClose}>
            Отмена
          </Button>
          <Button
            onClick={handleApply}
            loading={isLoading}
            disabled={!fieldName || ids.length === 0}
          >
            Применить
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
