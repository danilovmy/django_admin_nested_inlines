from django.contrib import admin

from django.contrib.admin import ModelAdmin

from django.utils.crypto import get_random_string
from django.contrib.admin.options import TabularInline, StackedInline
from django.template.loader import get_template
from django.utils.functional import cached_property
from django.forms import ModelForm
from .models import Image, Product, Shop


class ImageAdminInline(StackedInline):
    extra = 1
    model = Image

class MyForm(StackedInline.form):

    def __init__(self, *args, **kwargs):
        super(MyForm, self).__init__(*args, **kwargs)
        self.instance.form = self

    def is_valid(self):
        return super().is_valid() and self.nested.formset.is_valid()

    @cached_property
    def nested(self):
        modeladmin = ProductModelAdmin(self._meta.model, self.modeladmin.admin_site)

        # get formsets and instances for change/add view depending on the request
        formsets, instances = modeladmin._create_formsets(self.modeladmin.request, self.instance, change=self.instance.pk)

        # gets the inline from inline_formsets
        inline = modeladmin.get_inline_formsets(self.modeladmin.request, formsets[:1], instances[:1], self.instance)[0]

        # handles prefix
        inline.formset.prefix = f'{self.prefix}_{formsets[0].prefix}'.replace('-', '_')
        return inline

    def is_multipart(self, *args, **kwargs):
        return super().is_multipart() or self.nested.formset.form().is_multipart()

    @cached_property
    def changed_data(self):
        changed_inline_fields = []
        for form in self.nested.formset:
            for name, bf in form._bound_items():
                if bf._has_changed():
                    changed_inline_fields.append(name)
        return super().changed_data + changed_inline_fields

    def save(self, *args, **kwargs):
        response = super().save(*args, **kwargs)
        self.nested.formset.save(*args, **kwargs)
        return response

class ProductInline(StackedInline):
    extra = 1
    model = Product
    fields = ('title', 'image_inline', 'shop')
    readonly_fields = ('image_inline',)
    form = MyForm

    def image_inline(self, obj=None, *args, **kwargs):
        context = getattr(self.modeladmin.response, 'context_data', None) or {}
        # insert nested inline from form
        return get_template(obj.form.nested.opts.template).render(context | {'inline_admin_formset': obj.form.nested}, self.modeladmin.request)

    def get_formset(self, *args, **kwargs):
        formset = super().get_formset(*args, **kwargs)
        # from.modeladmin is needed in property form.nested
        # for nested inline
        formset.form.modeladmin = self.modeladmin
        return formset

@admin.register(Shop)
class ShopModelAdmin(ModelAdmin):
    inlines = ProductInline,
    fields = ('title', )

    def changeform_view(self, request, *args, **kwargs):
        self.request = request
        return super().changeform_view(request, *args, **kwargs)

    def render_change_form(self, request, *args, **kwargs):
        self.response = super().render_change_form(request, *args, **kwargs)
        return self.response

    def get_inline_instances(self, *args, **kwargs):
        yield from ((inline, vars(inline).update(modeladmin=self))[0] for inline in super().get_inline_instances(*args, **kwargs))


@admin.register(Product)
class ProductModelAdmin(ModelAdmin):

    inlines = (ImageAdminInline,)
    fields = ('title', 'price', 'shop')

    def changeform_view(self, request, *args, **kwargs):
        self.request = request
        return super().changeform_view(request, *args, **kwargs)

    def render_change_form(self, request, context, *args, **kwargs):
        self.response = super().render_change_form(request, context, *args, **kwargs)
        return self.response

@admin.register(Image)
class ImageModelAdmin(ModelAdmin):
    fields = ('title', 'src', 'product')