"""
Контекст доступа для DotORM.

Использование:

    # При старте приложения (security/app.py):
    set_access_checker(SecurityAccessChecker(env))

    # При каждом запросе (verify_access):
    set_access_session(session)  # Session из security модуля

    # В DotModel автоматически:
    # - check_table_access() перед CRUD операциями
    # - check_row_access() для конкретных записей (get/update/delete)
    # - get_domain_filter() для фильтрации выборки (search)
"""

from contextvars import ContextVar
from enum import StrEnum
from typing import TYPE_CHECKING, TypeVar, Generic

if TYPE_CHECKING:
    from backend.base.crm.security.access_control import SecurityAccessChecker


class Operation(StrEnum):
    """Операции доступа."""

    READ = "read"
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"


BYPASS_DOMAIN = []
BYPASS_DOMAIN_LEGACY = [["id", "!=", None]]

# Зарезервированный токен для field-level доступа (атрибуты role_* на полях,
# см. fields.Field.required_roles). Означает «писать/читать это поле может
# только суперпользователь». Конкретную трактовку даёт SecurityAccessChecker:
# для FARA это session.user_id.is_admin. Это НЕ код реальной роли —
# подобрано так, чтобы не пересекаться с code в таблице roles.
SUPERUSER = "__superuser__"

# Generic тип для Session
TSession = TypeVar("TSession")


class AccessChecker(Generic[TSession]):
    """
    Базовый класс проверки доступа.

    По умолчанию разрешает всё.
    Модуль security наследует и переопределяет методы.
    """

    async def check_access(
        self,
        session: TSession,
        model: str,
        operation: Operation,
        record_ids: list[int] | None = None,
    ) -> tuple[bool, list]:
        """
        Единая проверка доступа: ACL + Rules.

        Args:
            session: Сессия пользователя
            model: Имя модели (таблицы)
            operation: Операция (read/create/update/delete)
            record_ids: ID записей (для проверки Rules)

        Returns:
            (has_access, domain_filter):
            - has_access: True если доступ разрешён
            - domain_filter: фильтр для search (пустой если не нужен)
        """
        return True, []

    async def check_table_access(
        self,
        session: TSession,
        model: str,
        operation: Operation,
    ) -> bool:
        """
        Проверяет доступ к таблице (ACL уровень).
        """
        return True

    async def check_row_access(
        self,
        session: TSession,
        model: str,
        operation: Operation,
        record_ids: list[int],
    ) -> bool:
        """
        Проверяет доступ к записям (Rules уровень).

        Для одной или нескольких записей проверяет что они
        попадают под domain из Rules.
        """
        return True

    async def get_domain_filter(
        self,
        session: TSession,
        model: str,
        operation: Operation,
    ) -> list:
        """
        Возвращает domain-фильтр для ограничения выборки.

        Используется для search — добавляется к filter ДО запроса.
        """
        return []

    async def check_field_access(
        self,
        session: TSession,
        model: str,
        operation: Operation,
        field_names: list[str],
    ) -> list[str]:
        """
        Field-level доступ: какие из переданных полей роль НЕ вправе писать.

        Это третья ось контроля доступа (помимо ACL=таблица и Rules=строка):
        ограничение на уровне отдельных полей записи. Используется против
        privilege escalation через mass-assignment — например, обычный
        пользователь, выставляющий себе role_ids или is_admin.

        Вызывается из write-пути (create/update/update_bulk) уже ПОСЛЕ
        ACL/Rules и только для полей, которые реально меняются и помечены
        атрибутом role_* (фильтрацию «меняется/помечено» делает вызывающий
        слой ORM, у которого есть и payload, и текущее значение).

        Args:
            field_names: поля-кандидаты (уже отобранные как меняющиеся
                и role_*-ограниченные).

        Returns:
            Список полей, запрещённых для записи этой сессией. Пустой —
            всё разрешено. База разрешает всё; политику задаёт security.
        """
        return []


class AccessDenied(Exception):
    """Доступ запрещён."""

    def __init__(self, message: str = "Access denied"):
        self.message = message
        super().__init__(self.message)


# ============================================================
# State
# ============================================================

_state: dict = {"checker": AccessChecker()}

_access_session: ContextVar = ContextVar("access_session", default=None)


# ============================================================
# Public API
# ============================================================


def set_access_checker(checker: "SecurityAccessChecker") -> None:
    """Устанавливает SecurityAccessChecker (один раз при старте)."""
    _state["checker"] = checker


def get_access_checker() -> "SecurityAccessChecker":
    """Возвращает текущий SecurityAccessChecker."""
    return _state["checker"]


def set_access_session(session) -> None:
    """Устанавливает сессию для текущего запроса."""
    _access_session.set(session)


def get_access_session():
    """Возвращает сессию текущего запроса."""
    return _access_session.get()


def clear_access_session() -> None:
    """Очищает сессию (после завершения post_init)."""
    _access_session.set(None)
