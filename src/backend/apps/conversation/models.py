from django.db import models


class Conversation(models.Model):
    """Conversation model - matches Node.js backend schema"""
    id = models.AutoField(primary_key=True)
    session_id = models.CharField(max_length=255, unique=True)
    title = models.CharField(max_length=500, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    memory_summary = models.TextField(blank=True, null=True)
    context_window_size = models.IntegerField(default=4000)
    message_count = models.IntegerField(default=0)
    last_activity = models.DateTimeField(auto_now=True)
    is_archived = models.BooleanField(default=False)
    project_id = models.IntegerField(null=True, blank=True)
    is_starred = models.BooleanField(default=False)

    class Meta:
        db_table = 'conversations'
        managed = False  # Don't let Django manage this table
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.title or 'Untitled'} ({self.session_id})"
