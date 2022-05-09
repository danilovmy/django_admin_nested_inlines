from django.db import models
from django.utils.translation import gettext_lazy as _

class Shop(models.Model):
    title = models.CharField(verbose_name=_('Title of Shop'), max_length=255)

class Product(models.Model):
    title = models.CharField(verbose_name=_('Title of product'), max_length=255)
    price = models.DecimalField(verbose_name=_('Price of product'), max_digits=6, decimal_places=2, null=True)
    shop = models.ForeignKey(Shop, verbose_name=_('Link to shop'), on_delete=models.CASCADE, null=True)

class Image(models.Model):
    title = models.CharField(verbose_name=_('Title of image'), max_length=255, null=True)
    src = models.ImageField(verbose_name=_('Imagefile'), upload_to='images/', null=True)
    product = models.ForeignKey(Product, verbose_name=_('Link to product'), on_delete=models.CASCADE)
