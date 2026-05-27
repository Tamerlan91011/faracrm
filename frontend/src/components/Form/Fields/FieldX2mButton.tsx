/**
 * FieldX2mButton — smart button для x2m-связей
 * (One2many и Many2many).
 *
 * Использование:
 *   <FieldX2mButton
 *     name="sale_ids"
 *     icon={<IconShoppingCart size={18} />}
 *     label="Заказы"
 *     color="blue"
 *   />
 *
 * Можно и через legacy widget-string синтаксис:
 *   <Field name="sale_ids" widget="x2mButton" ... />
 * (см. FieldComponents в Form/Fields/Field.tsx — компонент зарегистрирован
 * под ключом FieldX2mButton, что даёт widget="x2mButton").
 *
 * Поведение:
 * - Считывает relatedModel и relatedField из метаданных поля
 *   (fieldsServer[name]).
 * - Показывает count — берёт из form.values[name].total (бэкенд
 *   возвращает {data, fields, total} для o2m/m2m на ручке /get/{id}
 *   через _wrap_relations_for_ui). На форме создания (нет id)
 *   связанных записей нет → count = 0.
 * - Клик → navigate(`/${relatedModel}`, { state: { initialFilter:
 *   [[relatedField, '=', recordId]] } }). List на той стороне
 *   подхватывает state.initialFilter и применяет как фильтр поверх
 *   props.filter / context filters. См. components/List/List.tsx.
 *
 * Зачем: в формах типа Contract таблица всех связанных Sale-ов
 * визуально перегружает форму и редко нужна целиком. Smart-button
 * показывает счётчик и одним кликом переводит в полноценный список
 * заказов уже с готовым фильтром по этому договору.
 */

import { useContext } from 'react';
import {
  Box,
  Group,
  MantineSpacing,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  UnstyledButton,
  Tooltip,
} from '@mantine/core';
import { useNavigate, useParams } from 'react-router-dom';
import { FormFieldsContext, useFormContext } from '../FormContext';

interface FieldX2mButtonProps {
  /** Имя o2m/m2m поля (как в модели/бэкенде). */
  name: string;
  /** Подпись под счётчиком; по умолчанию name. */
  label?: string;
  /** Иконка слева (любой ReactNode, обычно tabler-icon). */
  icon?: React.ReactNode;
  /** Mantine цвет для ThemeIcon (по умолчанию 'blue'). */
  color?: string;
  /** Сужающие фильтры поверх FK на текущую запись (опционально). */
  extraFilter?: any[];
  /** Горизонтальное выравнивание внутри своей строки. По умолчанию 'left'. */
  align?: 'left' | 'right' | 'center';
  /** Mantine margin-bottom — отступ до следующего блока формы. */
  mb?: MantineSpacing;
  /** Mantine margin-top — отступ от предыдущего блока формы. */
  mt?: MantineSpacing;
}

export function FieldX2mButton({
  name,
  label,
  icon,
  color = 'blue',
  extraFilter,
  align = 'left',
  mb,
  mt,
}: FieldX2mButtonProps) {
  const { fields: fieldsServer } = useContext(FormFieldsContext);
  const form = useFormContext();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const meta = fieldsServer[name];
  const relatedModel = meta?.relatedModel;
  const relatedField = meta?.relatedField;
  const displayLabel = label ?? name;
  const recordId = id ? Number(id) : null;

  // Backend на /get/{id} оборачивает x2m в {data, fields, total}
  // даже без запрошенных nested полей — см. _wrap_relations_for_ui.
  // На create-форме default_values пропускает o2m без nested → undefined,
  // что для новой записи всё равно даёт корректный count = 0.
  const formValue = form.getValues()[name] as
    | { total?: number; data?: unknown[] }
    | undefined;
  const count = formValue?.total ?? formValue?.data?.length ?? 0;

  const clickable = !!recordId && !!relatedModel && !!relatedField;

  const handleClick = () => {
    if (!clickable) return;
    const filter = [
      [relatedField as string, '=', recordId],
      ...(extraFilter || []),
    ];
    navigate(`/${relatedModel}`, {
      state: { initialFilter: filter },
    });
  };

  if (!relatedModel) {
    // Поле ещё не пришло в fieldsServer (форма не успела загрузиться)
    // или это вообще не relation — не рендерим, чтобы не мигать
    // пустой плашкой.
    return null;
  }

  const button = (
    <UnstyledButton
      onClick={clickable ? handleClick : undefined}
      disabled={!clickable}
      style={{ width: 'fit-content', display: 'inline-block' }}>
      <Paper
        withBorder
        radius="sm"
        p="xs"
        style={{
          cursor: clickable ? 'pointer' : 'not-allowed',
          opacity: clickable ? 1 : 0.55,
          transition: 'background-color 120ms ease',
          minWidth: 140,
        }}
        // Лёгкий hover-эффект средствами CSS-переменных Mantine,
        // чтобы не тащить отдельный module.css.
        onMouseEnter={e => {
          if (clickable)
            e.currentTarget.style.backgroundColor =
              'var(--mantine-color-gray-1)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}>
        <Group gap="sm" wrap="nowrap" align="center">
          {icon && (
            <ThemeIcon variant="light" color={color} size="lg" radius="sm">
              {icon}
            </ThemeIcon>
          )}
          <Stack gap={2}>
            <Text fw={700} size="lg" lh={1}>
              {count}
            </Text>
            <Text size="xs" c="dimmed" lh={1}>
              {displayLabel}
            </Text>
          </Stack>
        </Group>
      </Paper>
    </UnstyledButton>
  );

  // Подсказка на форме создания — объясняем почему не кликается.
  const inner = !recordId ? (
    <Tooltip
      label="Сохраните запись, чтобы увидеть связанные"
      position="top"
      withArrow>
      {button}
    </Tooltip>
  ) : (
    button
  );

  // Wrapper-Box заполняет ширину строки формы и через justifyContent
  // позиционирует саму кнопку (у неё width: fit-content). mb/mt
  // прокидываем как Mantine spacing.
  const justifyContent =
    align === 'right'
      ? 'flex-end'
      : align === 'center'
        ? 'center'
        : 'flex-start';

  return (
    <Box mb={mb} mt={mt} style={{ display: 'flex', justifyContent }}>
      {inner}
    </Box>
  );
}

export default FieldX2mButton;
