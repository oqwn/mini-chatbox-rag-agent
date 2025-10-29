from django.db import models


class Message(models.Model):
    """Chat message model - matches Node.js backend schema"""
    MESSAGE_ROLES = [
        ('user', 'User'),
        ('assistant', 'Assistant'),
        ('system', 'System'),
    ]

    id = models.AutoField(primary_key=True)
    conversation_id = models.IntegerField(db_index=True, null=True, blank=True)
    role = models.CharField(max_length=20, choices=MESSAGE_ROLES)
    content = models.TextField()
    metadata = models.JSONField(default=dict, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    token_count = models.IntegerField(null=True, blank=True)
    importance_score = models.FloatField(default=0.5, null=True, blank=True)
    is_summarized = models.BooleanField(default=False)

    class Meta:
        db_table = 'messages'
        managed = False  # Don't let Django manage this table
        ordering = ['created_at']

    def __str__(self):
        return f"{self.role}: {self.content[:50]}"