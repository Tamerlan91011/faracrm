import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Stack,
  Group,
  Button,
  TextInput,
  Checkbox,
  MultiSelect,
  Divider,
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import {
  useCreateMutation,
  useUpdateMutation,
} from '@/services/api/crudApi';
import { useGetChatsQuery, ChatFolder } from '@/services/api/chat';

interface FolderModalProps {
  opened: boolean;
  onClose: () => void;
  /** null/undefined → создание; иначе — редактирование своей папки. */
  folder?: ChatFolder | null;
}

// Папка хранит FARA-домен над chat. UI редактирует два «среза»:
//   • по типу (чекбоксы) → готовые условия ниже;
//   • конкретные чаты → ["id","in",[...]].
// Все выбранные условия объединяются оператором OR (как в Яндекс-папках).
type Clause = [string, string, unknown];

const TYPE_CLAUSES: Record<string, Clause> = {
  direct: ['chat_type', '=', 'direct'],
  group: ['chat_type', 'in', ['group', 'channel']],
  internal: ['is_internal', '=', true],
  external: ['is_internal', '=', false],
};

const TYPE_OPTS: { token: string; key: string; fb: string }[] = [
  { token: 'direct', key: 'directChat', fb: 'Личные' },
  { token: 'group', key: 'groupChat', fb: 'Группы' },
  { token: 'internal', key: 'internal', fb: 'Внутренние' },
  { token: 'external', key: 'external', fb: 'Внешние' },
];

const eq = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

function parseDomain(domain: unknown): {
  types: string[];
  chatIds: string[];
} {
  const types: string[] = [];
  let chatIds: string[] = [];
  if (Array.isArray(domain)) {
    for (const term of domain) {
      if (typeof term === 'string') continue; // and/or
      if (Array.isArray(term)) {
        if (term[0] === 'id' && term[1] === 'in' && Array.isArray(term[2])) {
          chatIds = (term[2] as unknown[]).map(String);
          continue;
        }
        for (const [tok, cl] of Object.entries(TYPE_CLAUSES)) {
          if (eq(term, cl)) types.push(tok);
        }
      }
    }
  }
  return { types, chatIds };
}

function buildDomain(types: string[], chatIds: string[]): unknown[] {
  const clauses: unknown[] = [];
  for (const tkn of types) if (TYPE_CLAUSES[tkn]) clauses.push(TYPE_CLAUSES[tkn]);
  if (chatIds.length) clauses.push(['id', 'in', chatIds.map(Number)]);
  // Объединяем OR-инфиксом: [c1, "or", c2, "or", c3].
  const domain: unknown[] = [];
  clauses.forEach((c, i) => {
    if (i > 0) domain.push('or');
    domain.push(c);
  });
  return domain;
}

export function FolderModal({ opened, onClose, folder }: FolderModalProps) {
  const { t } = useTranslation('chat');

  const [name, setName] = useState('');
  const [types, setTypes] = useState<string[]>([]);
  const [chatIds, setChatIds] = useState<string[]>([]);

  const [createFolder, { isLoading: creating }] = useCreateMutation();
  const [updateFolder, { isLoading: updating }] = useUpdateMutation();

  const { data: chatsData } = useGetChatsQuery(
    { limit: 100 },
    { skip: !opened },
  );

  useEffect(() => {
    if (!opened) return;
    setName(folder?.name || '');
    const parsed = parseDomain(folder?.domain);
    setTypes(parsed.types);
    setChatIds(parsed.chatIds);
  }, [opened, folder]);

  const chatOptions = useMemo(
    () =>
      (chatsData?.data || []).map(c => ({
        value: String(c.id),
        label: c.name || `#${c.id}`,
      })),
    [chatsData],
  );

  const toggleType = (token: string, on: boolean) =>
    setTypes(prev =>
      on ? [...new Set([...prev, token])] : prev.filter(x => x !== token),
    );

  const isEdit = !!folder;
  const canSave = name.trim().length > 0 && !creating && !updating;

  const handleSave = async () => {
    const values = {
      name: name.trim(),
      domain: buildDomain(types, chatIds),
      icon: 'folder',
    };
    if (isEdit && folder) {
      await updateFolder({
        model: 'chat_folder',
        id: folder.id,
        values: values as any,
      });
    } else {
      await createFolder({ model: 'chat_folder', values: values as any });
    }
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        isEdit
          ? t('editFolder', 'Изменить папку')
          : t('newFolder', 'Новая папка')
      }
      size="md">
      <Stack gap="md">
        <TextInput
          label={t('folderName', 'Название папки')}
          placeholder={t('folderNamePlaceholder', 'Например: Работа')}
          value={name}
          onChange={e => setName(e.currentTarget.value)}
          data-autofocus
        />

        <Divider
          label={t('chatsByType', 'Чаты по типу')}
          labelPosition="left"
        />
        <Stack gap="xs">
          {TYPE_OPTS.map(o => (
            <Checkbox
              key={o.token}
              label={t(o.key, o.fb)}
              checked={types.includes(o.token)}
              onChange={e => toggleType(o.token, e.currentTarget.checked)}
            />
          ))}
        </Stack>

        <Divider
          label={t('specificChats', 'Конкретные чаты')}
          labelPosition="left"
        />
        <MultiSelect
          data={chatOptions}
          value={chatIds}
          onChange={setChatIds}
          placeholder={t('selectChats', 'Выберите чаты')}
          searchable
          clearable
          nothingFoundMessage={t('noChatsFound', 'Чаты не найдены')}
          maxDropdownHeight={240}
        />

        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onClose}>
            {t('cancel', 'Отмена')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSave}
            loading={creating || updating}>
            {isEdit ? t('save', 'Сохранить') : t('create', 'Создать')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export default FolderModal;
