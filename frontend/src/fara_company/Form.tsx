import type { CompanyRecord as Company } from '@/types/records';
import { Form } from '@/components/Form/Form';
import { Field } from '@/components/List/Field';
import { ViewFormProps } from '@/route/type';
import {
  FormSection,
  FormRow,
  FormTabs,
  FormTab,
} from '@/components/Form/Layout';
import {
  IconBuilding,
  IconUsers,
  IconPhoto,
  IconTextCaption,
  IconShare,
  IconWindowMaximize,
} from '@tabler/icons-react';

/**
 * Форма компании
 */
export function ViewFormCompany(props: ViewFormProps) {
  return (
    <Form<Company> model="company" {...props}>
      {/* Основная информация */}
      <FormSection
        title="Основная информация"
        icon={<IconBuilding size={18} />}>
        <FormRow cols={2}>
          <Field name="name" label="Название" />
          <Field name="active" label="Активна" />
        </FormRow>
        <FormRow cols={2}>
          <Field name="sequence" label="Последовательность" />
        </FormRow>
        <Field name="parent_id" label="Родительская компания" />
      </FormSection>

      {/* Вкладки */}
      <FormTabs defaultTab="branding">
        <FormTab
          name="branding"
          label="Брендинг"
          icon={<IconPhoto size={16} />}>
          <FormSection title="Логотипы и иконки">
            {/* Все картинки UI одной сеткой: 3 логотипа/фон + фавикон.
                favicon_id — иконка вкладки браузера и apple-touch-icon
                на iOS. Не используется в PWA — для PWA отдельные иконки
                ниже (192/512 px). */}
            <FormRow cols={2}>
              <Field name="logo_id" label="Логотип CRM" />
              <Field name="login_logo_id" label="Логотип входа" />
              <Field name="login_background_id" label="Фон страницы входа" />
              <Field name="favicon_id" label="Фавикон вкладки/iOS" />
            </FormRow>
          </FormSection>

          <FormSection
            title="PWA-манифест"
            icon={<IconWindowMaximize size={18} />}>
            {/* manifest_icon_192/512 — иконки PWA. Android требует именно
                квадратные PNG 192 и 512 px. Загруженные URL можно скопировать
                через превью (кнопка «Скопировать URL») и подставить в icons[]
                манифеста ниже — или оставить пустыми, тогда бэк подставит
                URL'ы автоматически.

                manifest_json — текст PWA-манифеста (имя, цвета, display и т.д.).
                Если пусто или невалидный JSON — бэк отдаёт дефолтный.
                Имя из поля name становится <title> вкладки браузера.

                ⚠️ Уже установленные PWA не обновят иконку/имя автоматически —
                ОС кеширует их при установке. Юзеру нужно переустановить ярлык. */}
            <FormRow cols={2}>
              <Field
                name="manifest_icon_192_id"
                label="Иконка PWA 192×192 (PNG)"
              />
              <Field
                name="manifest_icon_512_id"
                label="Иконка PWA 512×512 (PNG)"
              />
            </FormRow>
            <FormRow cols={1}>
              {/* manifest_json — поле типа JSONB на бэке, фронт автоматически
                  подбирает FieldJson (mantine JsonInput с подсветкой и
                  валидацией). Дефолтный объект подставляется на бэке через
                  default=DEFAULT_MANIFEST — placeholder не нужен. */}
              <Field
                name="manifest_json"
                label="Манифест PWA (JSON)"
                minRows={10}
                formatOnBlur
              />
            </FormRow>
          </FormSection>

          <FormSection
            title="Тексты страницы входа"
            icon={<IconTextCaption size={18} />}>
            <FormRow cols={1}>
              <Field
                name="login_title"
                label="Заголовок"
                placeholder="Вход в систему"
              />
              <Field
                name="login_subtitle"
                label="Подзаголовок"
                placeholder="Платформа для управления бизнесом"
              />
              <Field
                name="login_button_color"
                widget="color"
                label="Цвет кнопки входа"
                placeholder="#009982"
              />
              <Field name="login_card_style" label="Стиль карточки логина" />
            </FormRow>
          </FormSection>

          <FormSection
            title="Соцсети на странице входа"
            icon={<IconShare size={18} />}>
            {/* До 3 ссылок: пустые пары (без типа или без URL) не выводятся.
                Если все 3 пусты — на странице входа показываются дефолтные
                ссылки FARA (Telegram/GitHub/RuTube). */}
            <FormRow cols={2}>
              <Field name="login_social1_type" label="Тип №1" />
              <Field
                name="login_social1_url"
                label="Ссылка №1"
                placeholder="https://..."
              />
            </FormRow>
            <FormRow cols={2}>
              <Field name="login_social2_type" label="Тип №2" />
              <Field
                name="login_social2_url"
                label="Ссылка №2"
                placeholder="https://..."
              />
            </FormRow>
            <FormRow cols={2}>
              <Field name="login_social3_type" label="Тип №3" />
              <Field
                name="login_social3_url"
                label="Ссылка №3"
                placeholder="https://..."
              />
            </FormRow>
          </FormSection>
        </FormTab>

        <FormTab
          name="children"
          label="Дочерние компании"
          icon={<IconUsers size={16} />}>
          <Field name="child_ids">
            <Field name="id" />
            <Field name="name" />
          </Field>
        </FormTab>
      </FormTabs>
    </Form>
  );
}
