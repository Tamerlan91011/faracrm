from copy import deepcopy
from typing import Any

from backend.base.system.dotorm.dotorm.fields import (
    Char,
    Integer,
    Boolean,
    JSONField,
    Many2one,
    One2many,
    PolymorphicMany2one,
    Selection,
)
from backend.base.system.dotorm.dotorm.model import DotModel
from backend.base.system.core.enviroment import env
from backend.base.crm.attachments.models.attachments import Attachment

# Единственный источник правды для дефолтного PWA-манифеста.
# Используется:
#   1. как default нового поля manifest_json (новые компании
#      получают его при INSERT через ORM);
#   2. как fallback в публичной ручке /api/public/manifest.json,
#      если в БД лежит null или не-dict.
# Иконки указывают на /icon-192.png и /icon-512.png — они физически
# лежат в frontend/public/ и отдаются статикой, так что PWA можно
# поставить даже на пустой инсталляции без загруженных файлов.
# Если в Company загружены manifest_icon_192_id / manifest_icon_512_id —
# бэк перекрывает icons[] на их URL (см. _build_manifest в роутере).
DEFAULT_MANIFEST: dict[str, Any] = {
    "name": "FARA CRM",
    "short_name": "FARA",
    "description": "FARA CRM - Customer Relationship Management",
    "start_url": "/",
    "display": "standalone",
    "background_color": "#ffffff",
    "theme_color": "#228be6",
    "icons": [
        {
            "src": "/icon-192.png",
            "sizes": "192x192",
            "type": "image/png",
            "purpose": "any maskable",
        },
        {
            "src": "/icon-512.png",
            "sizes": "512x512",
            "type": "image/png",
            "purpose": "any maskable",
        },
    ],
}


def _default_manifest() -> dict[str, Any]:
    """deepcopy при каждом INSERT — иначе все компании будут шарить
    один и тот же словарь и правка одной полезет всем."""
    return deepcopy(DEFAULT_MANIFEST)


# Доступные типы соцсетей для странички логина.
# Список расширяемый — добавил новый, и сразу появился в Selection.
# label на фронте берётся из SOCIAL_TYPE_META (см. SignIn.tsx),
# здесь label нужен только для админки.
_SOCIAL_OPTIONS: list[tuple[str, str]] = [
    ("telegram", "Telegram"),
    ("github", "GitHub"),
    ("rutube", "RuTube"),
    ("youtube", "YouTube"),
    ("vk", "ВКонтакте"),
    ("whatsapp", "WhatsApp"),
    ("linkedin", "LinkedIn"),
    ("x", "X (Twitter)"),
    ("facebook", "Facebook"),
    ("instagram", "Instagram"),
    ("discord", "Discord"),
    ("email", "Email"),
    ("website", "Website"),
]


class Company(DotModel):
    __table__ = "company"

    id: int = Integer(primary_key=True)
    name: str = Char(string="Company Name")
    active: bool = Boolean(default=True)
    sequence: int = Integer(
        help="Used to order Companies in the company switcher", default=10
    )
    parent_id: "Company | None" = Many2one(
        lambda: env.models.company,
        string="Parent Company",
        index=True,
        ondelete="restrict",
    )
    child_ids: list["Company"] = One2many(
        lambda: env.models.company, "parent_id", string="Child companies"
    )

    logo_id: "Attachment | None" = PolymorphicMany2one(
        relation_table=Attachment,
    )
    login_logo_id: "Attachment | None" = PolymorphicMany2one(
        relation_table=Attachment,
    )
    login_background_id: "Attachment | None" = PolymorphicMany2one(
        relation_table=Attachment,
    )
    # Кастомный фавикон вкладки браузера и apple-touch-icon. Не используется
    # в PWA-манифесте — для PWA отдельные поля manifest_icon_192_id /
    # manifest_icon_512_id (Android требует именно квадратные PNG 192/512 px,
    # а вкладке/iOS подходит и SVG). Если пусто — /logo-mark.svg из public/.
    favicon_id: "Attachment | None" = PolymorphicMany2one(
        relation_table=Attachment,
    )

    # Иконки PWA. Подставляются в manifest.json через бэк-ручку
    # /api/public/manifest.json (дополняют/перекрывают пользовательский JSON,
    # если в нём не задан icons).
    manifest_icon_192_id: "Attachment | None" = PolymorphicMany2one(
        relation_table=Attachment,
    )
    manifest_icon_512_id: "Attachment | None" = PolymorphicMany2one(
        relation_table=Attachment,
    )

    # PWA-манифест в виде JSONB. Редактируется админом в форме компании,
    # отдаётся бэком из /api/public/manifest.json с правильным Content-Type
    # и заголовками против кеширования. Поле name используется ещё и как
    # <title> вкладки браузера. icons можно опустить — бэк подставит URL
    # загруженных manifest_icon_192_id / manifest_icon_512_id.
    # Дефолт берётся из DEFAULT_MANIFEST (тот же объект, что и fallback
    # на отдаче) — единственный источник правды.
    manifest_json: dict | None = JSONField(
        string="PWA manifest (JSON)",
        description=(
            "Содержимое манифеста PWA. Поле icons можно опустить — "
            "бэк подставит URL загруженных manifest_icon_192_id и "
            "manifest_icon_512_id."
        ),
        default=_default_manifest,
    )

    # Тексты на странице входа
    login_title: str | None = Char(
        string="Login title",
        description="Заголовок на странице входа",
    )
    login_subtitle: str | None = Char(
        string="Login subtitle",
        description="Подзаголовок (под логотипом) на странице входа",
    )
    # Цвет кнопки "Войти" на странице входа (HEX, например "#009982").
    # Если пусто — используется дефолтный цвет из CSS.
    login_button_color: str | None = Char(
        string="Login button color",
        description="Цвет кнопки входа в формате HEX (#RRGGBB)",
    )

    # Стиль карточки на странице входа.
    # - elevated: современный объёмный (тень, скругление, отступ от краёв)
    # - flat:     классический плоский (на всю высоту, без тени)
    # Список расширяемый — в будущем можно добавить glass, outlined и пр.
    login_card_style: str = Selection(
        string="Login card style",
        description="Стиль карточки на странице входа",
        options=[
            ("elevated", "Elevated (объёмный)"),
            ("flat", "Flat (плоский)"),
        ],
        default="elevated",
    )

    # Соцсети на странице входа. До 3 штук.
    # Если type или url пусты — ссылка не выводится. Если все 3 пусты —
    # показываются дефолтные ссылки FARA (Telegram/GitHub/RuTube).
    # Label генерируется по type на фронте (см. SOCIAL_TYPE_META).
    login_social1_type: str | None = Selection(
        string="Login social #1 type",
        description="Тип первой соцсети на странице входа",
        options=_SOCIAL_OPTIONS,
    )
    login_social1_url: str | None = Char(
        string="Login social #1 URL",
        description="Ссылка для первой соцсети",
    )
    login_social2_type: str | None = Selection(
        string="Login social #2 type",
        description="Тип второй соцсети на странице входа",
        options=_SOCIAL_OPTIONS,
    )
    login_social2_url: str | None = Char(
        string="Login social #2 URL",
        description="Ссылка для второй соцсети",
    )
    login_social3_type: str | None = Selection(
        string="Login social #3 type",
        description="Тип третьей соцсети на странице входа",
        options=_SOCIAL_OPTIONS,
    )
    login_social3_url: str | None = Char(
        string="Login social #3 URL",
        description="Ссылка для третьей соцсети",
    )
