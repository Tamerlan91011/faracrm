import { useEffect } from 'react';
import {
  useGetPublicConfigQuery,
  brandingFileUrl,
  manifestUrl,
} from '@/services/config/config';

/**
 * Динамическая подмена favicon, <title> и PWA-манифеста под настройки
 * текущей компании (поля favicon_id / manifest_* в Company).
 *
 * Как работает:
 * — index.html выдаётся статикой с дефолтными значениями:
 *     <title>F.A.R.A.</title>
 *     <link rel="icon" href="/logo-mark.svg">
 *     <link rel="manifest" href="/api/public/manifest.json">
 * — После загрузки JS этот компонент уже в рантайме редактирует:
 *     - document.title — берёт name из manifest_json (бэк парсит в app_title)
 *     - href у link[rel=icon] / shortcut icon / apple-touch-icon
 *       (если в Company загружен favicon_id)
 *     - href у link[rel=manifest] — добавляем ?v=<manifest_version>
 *       для cache-bust. Сам манифест отдаёт бэк из /api/public/manifest.json
 *       с no-cache + ETag, поэтому при правке через админку Android
 *       перечитывает его при следующем открытии PWA.
 *
 * Что НЕ изменится:
 * — Уже установленные PWA. ОС кеширует name/icon на момент установки;
 *   юзеру придётся переустановить (или удалить ярлык) чтобы подхватить новые.
 * — og:title и др. SEO-теги — поисковики/соцсети читают серверный HTML
 *   до выполнения JS. Если нужна полноценная SEO-подмена, делать на бэке.
 */
export function BrandingHead() {
  const { data: publicConfig } = useGetPublicConfigQuery();

  useEffect(() => {
    const branding = publicConfig?.branding;
    if (!branding) return;

    // ---- 1. <title> ----------------------------------------------------
    const title = branding.app_title?.trim();
    if (title) {
      document.title = title;
    }

    // ---- 2. Favicon (link[rel=icon] + apple-touch-icon) ----------------
    // Если на бэке загружен favicon — подсовываем его во все link-теги
    // иконок. К URL клеим favicon_version (id Attachment-а): он меняется
    // при каждой загрузке новой иконки, поэтому браузер видит «новый» URL
    // и берёт файл из сети.
    if (branding.has_favicon) {
      const url = brandingFileUrl('favicon_id', branding.favicon_version);
      setIconHref('icon', url);
      setIconHref('shortcut icon', url);
      setIconHref('apple-touch-icon', url);
    }

    // ---- 3. PWA-манифест ----------------------------------------------
    // Сам JSON отдаёт бэк, фронту достаточно обновить href с версией —
    // чтобы Android/Chrome посчитали URL новым и перечитали манифест.
    if (branding.manifest_version) {
      setIconHref('manifest', manifestUrl(branding.manifest_version));
    }
  }, [publicConfig]);

  return null;
}

/**
 * Меняет href у link[rel=<rel>]. Если такого тега нет — создаёт.
 * Параллельно убираем `sizes`/`type`, т.к. для произвольной картинки мы их
 * не знаем, а старые значения из index.html могут мешать выбору иконки.
 */
function setIconHref(rel: string, href: string) {
  const selector = `link[rel="${rel}"]`;
  const nodes = document.querySelectorAll<HTMLLinkElement>(selector);
  if (nodes.length === 0) {
    const link = document.createElement('link');
    link.rel = rel;
    link.href = href;
    document.head.appendChild(link);
    return;
  }
  nodes.forEach(node => {
    node.setAttribute('href', href);
    node.removeAttribute('type');
    node.removeAttribute('sizes');
  });
}

export default BrandingHead;
