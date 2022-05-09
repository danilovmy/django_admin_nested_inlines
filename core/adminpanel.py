from django.contrib.admin.apps import AdminConfig as BaseAdminConfig

from django.contrib.admin.options import ModelAdmin
from django.contrib.admin.sites import AdminSite as BaseAdmin

class AdminSite(BaseAdmin):

    def admin_view(self, view, cacheable=False):

        def wrapper(func):
            def wrapped(*args, **kwargs):
                instance = getattr(func, '__self__', None)
                if isinstance(instance, ModelAdmin):
                    new_instance = type(instance)(instance.model, instance.admin_site)
                    return func.__func__(new_instance, *args, **kwargs)
                return func(*args, **kwargs)

            return wrapped

        return super().admin_view(wrapper(view), cacheable)


class AdminConfig(BaseAdminConfig):
    default_site = 'core.adminpanel.AdminSite'
    label = 'admin'