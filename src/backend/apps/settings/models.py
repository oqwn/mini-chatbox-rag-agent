from django.db import models


class UserSettings(models.Model):
    """
    User settings model for API configuration
    Stores user preferences, API keys, and RAG configuration
    """
    id = models.AutoField(primary_key=True)
    user_id = models.CharField(max_length=255, unique=True, default='default_user')

    # API Configuration
    api_key = models.CharField(max_length=500, blank=True, null=True)
    base_url = models.CharField(max_length=500, blank=True, null=True)
    model = models.CharField(max_length=100, default='gpt-4')

    # Model Parameters
    temperature = models.FloatField(default=0.7)
    max_tokens = models.IntegerField(default=2048)
    top_p = models.FloatField(default=1.0)

    # RAG Configuration
    rag_enabled = models.BooleanField(default=False)
    rag_config = models.JSONField(default=dict, blank=True, null=True)

    # UI Preferences
    theme = models.CharField(max_length=50, default='light')
    language = models.CharField(max_length=10, default='en')

    # Additional settings
    metadata = models.JSONField(default=dict, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user_settings'
        managed = False  # Don't let Django manage this table
        ordering = ['-updated_at']

    def __str__(self):
        return f"Settings for {self.user_id}"
