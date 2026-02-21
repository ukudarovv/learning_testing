from django.db import models


class NewsCategory(models.Model):
    """News category model"""

    name = models.CharField(max_length=100, unique=True, verbose_name='Название')
    name_kz = models.CharField(max_length=100, blank=True, verbose_name='Название (каз)')
    name_en = models.CharField(max_length=100, blank=True, verbose_name='Название (англ)')
    description = models.TextField(blank=True, verbose_name='Описание')
    order = models.IntegerField(default=0, verbose_name='Порядок отображения')
    is_active = models.BooleanField(default=True, verbose_name='Активна')

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Дата обновления')

    class Meta:
        db_table = 'news_categories'
        verbose_name = 'Категория новости'
        verbose_name_plural = 'Категории новостей'
        ordering = ['order', 'name']

    def __str__(self):
        return self.name


class News(models.Model):
    """News model"""

    title = models.CharField(max_length=255, verbose_name='Заголовок')
    title_kz = models.CharField(max_length=255, blank=True, verbose_name='Заголовок (казахский)')
    title_en = models.CharField(max_length=255, blank=True, verbose_name='Заголовок (английский)')
    excerpt = models.TextField(blank=True, verbose_name='Краткое описание')
    excerpt_kz = models.TextField(blank=True, verbose_name='Краткое описание (казахский)')
    excerpt_en = models.TextField(blank=True, verbose_name='Краткое описание (английский)')
    content = models.TextField(verbose_name='Содержание')
    content_kz = models.TextField(blank=True, verbose_name='Содержание (казахский)')
    content_en = models.TextField(blank=True, verbose_name='Содержание (английский)')
    category = models.ForeignKey(
        NewsCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='news',
        verbose_name='Категория'
    )
    image = models.ImageField(upload_to='news/', blank=True, null=True, verbose_name='Изображение')
    is_published = models.BooleanField(default=True, verbose_name='Опубликована')
    published_at = models.DateTimeField(null=True, blank=True, verbose_name='Дата публикации')
    order = models.IntegerField(default=0, verbose_name='Порядок отображения')

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Дата обновления')

    class Meta:
        db_table = 'news'
        verbose_name = 'Новость'
        verbose_name_plural = 'Новости'
        ordering = ['order', '-published_at', '-created_at']

    def __str__(self):
        return self.title
