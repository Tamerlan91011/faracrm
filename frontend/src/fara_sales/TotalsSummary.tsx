import { useEffect, useState, type ReactNode } from 'react';
import {
  Paper,
  Stack,
  Group,
  Text,
  Divider,
  NumberInput,
  Box,
} from '@mantine/core';
import { useFormContext } from '@/components/Form/FormContext';

/**
 * Блок итогов заказа продаж. Рендерится СПРАВА от таблицы позиций
 * (узкая колонка ~25%, см. ViewFormSales: FormRow/FormCol).
 *
 * Компонент включён в LAYOUT_COMPONENTS (utils.tsx), поэтому
 * переживает рендерер формы. Свои children (объявленные в форме
 * <Field name="amount_*">) НЕ рендерит — они нужны лишь для того,
 * чтобы форма запросила эти поля с сервера. Значения читаются из
 * контекста формы.
 *
 * Маппинг (скидка применяется построчно на бэкенде):
 *   - "Сумма без налога"  = amount_undiscounted
 *   - "Налог"             = amount_tax
 *   - "Итого"             = amount_undiscounted + amount_tax (до скидки)
 *   - "Скидка N%"         = amount_undiscounted − amount_untaxed
 *   - "Итого со скидкой"  = amount_total
 *   - "Оплачено / Аванс"  = amount_paid (ручной ввод)
 *
 * Оформление:
 *   - скидка == 0 → строки скидки серые, «Итого» — основной тотал;
 *   - скидка != 0 → «Итого» перечёркнут, «Итого со скидкой» — основной.
 * Индикатор оплаты: серый — 0; жёлтый — частично; зелёный — полностью.
 */

const toNum = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};

const money = (v: number): string => v.toFixed(2);

const percent = (part: number, whole: number): string => {
  if (whole <= 0) return '0';
  return String(Math.round((part / whole) * 100 * 100) / 100);
};

const PAID_COLOR: Record<string, string> = {
  gray: '#adb5bd',
  yellow: '#f59f00',
  green: '#2f9e44',
};

function TotalRow({
  label,
  value,
  bold,
  dimmed,
  strike,
}: {
  label: string;
  value: string;
  bold?: boolean;
  dimmed?: boolean;
  strike?: boolean;
}) {
  return (
    <Group justify="space-between" gap="sm" wrap="nowrap">
      <Text
        size="sm"
        c={dimmed ? 'dimmed' : undefined}
        fw={bold ? 600 : 400}
        td={strike ? 'line-through' : undefined}>
        {label}
      </Text>
      <Text
        size={bold ? 'md' : 'sm'}
        fw={bold ? 700 : 600}
        c={dimmed ? 'dimmed' : undefined}
        td={strike ? 'line-through' : undefined}
        style={{ whiteSpace: 'nowrap' }}>
        {value}
      </Text>
    </Group>
  );
}

// children объявляются в форме (<Field name="amount_*">) только ради
// выборки полей с сервера и здесь намеренно НЕ рендерятся.
export function SalesTotalsSummary(_props: { children?: ReactNode }) {
  const form = useFormContext();
  const values = form.getValues();

  const undiscounted = toNum(values.amount_undiscounted);
  const untaxed = toNum(values.amount_untaxed);
  const tax = toNum(values.amount_tax);
  const total = toNum(values.amount_total);

  const discountMoney = Math.max(undiscounted - untaxed, 0);
  const hasDiscount = discountMoney > 0.005;
  const totalBeforeDiscount = undiscounted + tax;

  const [paid, setPaid] = useState<number>(toNum(values.amount_paid));
  useEffect(() => {
    setPaid(toNum(form.getValues().amount_paid));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.id]);

  let paidColor = 'gray';
  if (paid > 0 && paid < total) paidColor = 'yellow';
  else if (paid > 0 && paid >= total) paidColor = 'green';

  const paidProps = form.getInputProps('amount_paid');

  return (
    <Paper withBorder p="sm" radius="md">
      <Stack gap={6}>
        <TotalRow label="Сумма без налога" value={money(undiscounted)} />
        <TotalRow label="Налог" value={money(tax)} />
        <Divider my={4} />

        {/* Итого до скидки: перечёркнут когда есть скидка */}
        <TotalRow
          label="Итого"
          value={money(totalBeforeDiscount)}
          bold={!hasDiscount}
          strike={hasDiscount}
          dimmed={hasDiscount}
        />

        {/* Скидка: серая когда 0 */}
        <TotalRow
          label={`Скидка ${percent(discountMoney, undiscounted)}%`}
          value={`− ${money(discountMoney)}`}
          dimmed={!hasDiscount}
        />

        {/* Итого со скидкой: основной тотал когда есть скидка */}
        <TotalRow
          label="Итого со скидкой"
          value={money(total)}
          bold={hasDiscount}
          dimmed={!hasDiscount}
        />

        <Divider my={4} />

        {/* Оплачено / Аванс — в узкой колонке метка над полем */}
        <Group gap="xs" wrap="nowrap" align="center">
          <Box
            w={4}
            h={20}
            bg={PAID_COLOR[paidColor]}
            style={{ borderRadius: 2 }}
          />
          <Text size="sm" c="dimmed">
            Оплачено / Аванс
          </Text>
        </Group>
        <NumberInput
          {...paidProps}
          key={form.key('amount_paid')}
          onChange={value => {
            paidProps.onChange?.(value);
            setPaid(toNum(value));
          }}
          decimalScale={2}
          fixedDecimalScale
          hideControls
          size="xs"
          w="100%"
          styles={{
            input: {
              textAlign: 'right',
              fontWeight: 700,
              color: PAID_COLOR[paidColor],
            },
          }}
        />
      </Stack>
    </Paper>
  );
}

SalesTotalsSummary.displayName = 'SalesTotalsSummary';

export default SalesTotalsSummary;
