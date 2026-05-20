from typing import Type

# from backend.base.crm.users.audit_mixin import AuditMixin
from backend.base.system.dotorm.dotorm.model import DotModel


class ModelsCore:
    """Структура для работы с моделями."""

    _table_to_model_name: dict[str, str] = {}
    _table_to_model_class: dict[str, Type[DotModel]] = {}

    def _build_table_mapping(self):
        """Строит маппинг table_name → model_name + таблицы @depends.
        Возвращает self для chaining."""
        for model_name in dir(self):
            if model_name.startswith("_"):
                continue
            model_cls = getattr(self, model_name)
            # Проверяем что это класс (не метод) с __table__
            if isinstance(model_cls, type) and hasattr(model_cls, "__table__"):
                self._table_to_model_name[model_cls.__table__] = model_name
                self._table_to_model_class[model_cls.__table__] = model_cls

                # Встраиваем AuditMixin in-place — все импорты
                # `from .models import Partner` остаются валидными.
                # if AuditMixin not in model_cls.__mro__:
                #     model_cls.__bases__ = (AuditMixin,) + model_cls.__bases__
                #     model_cls._build_field_cache()
        # TODO: refactor
        # @depends: собираем таблицы триггеров _depends_local_triggers и
        # _depends_parent_triggers по всем зарегистрированным моделям.
        # Cross-model инверсию (parent_triggers на детях) нельзя собрать
        # на уровне __init_subclass__ одной модели — нужно знать все
        # модели сразу, поэтому делаем это здесь, после регистрации.
        #
        # ВАЖНО: _build_depends_tables разворачивает dotted-deps вида
        # "order_line_ids.X" и для этого читает field.relation_table.
        # У One2many/Many2one relation_table обычно объявлен лямбдой
        # `lambda: env.models.X` — лямбда дёргается прямо здесь. Чтобы
        # она резолвилась, привязываем self к env.models ДО билда
        # таблиц. Внешнее `env.models = Models()._build_table_mapping()`
        # потом запишет тот же объект ещё раз — идемпотентно.
        from backend.base.system.core.enviroment import env as _env

        _env.models = self

        from backend.base.system.dotorm.dotorm.orm.mixins.primary import (
            OrmPrimaryMixin,
        )

        OrmPrimaryMixin._build_depends_tables(
            self._table_to_model_class.values()
        )

        return self

    def _get_model_name_by_table(self, model: str):
        return self._table_to_model_name[model]

    def _get_model_class_by_table(self, model: str):
        return self._table_to_model_class[model]

    def _get_models(self) -> list[Type[DotModel]]:
        return [
            getattr(self, model_name)
            for model_name in dir(self)
            if not model_name.startswith("_")
        ]

    def _get_models_names(self) -> list[str]:
        return [
            model_name
            for model_name in dir(self)
            if not model_name.startswith("_")
        ]

    def _get_model(self, model_class_name) -> Type[DotModel]:
        return getattr(self, model_class_name)
