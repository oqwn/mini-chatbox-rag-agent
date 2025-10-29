from django.db import models


class Document(models.Model):
    """Document model - matches Node.js backend schema"""
    id = models.AutoField(primary_key=True)
    title = models.CharField(max_length=500, blank=True, null=True)
    content = models.TextField()
    metadata = models.JSONField(default=dict, blank=True, null=True)
    file_path = models.CharField(max_length=1000, blank=True, null=True)
    file_type = models.CharField(max_length=50, blank=True, null=True)
    file_size = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    knowledge_source_id = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = 'documents'
        managed = False  # Don't let Django manage this table
        ordering = ['-created_at']

    def __str__(self):
        return self.title or f"Document {self.id}"


class KnowledgeSource(models.Model):
    """Knowledge Source model - matches Node.js backend schema"""
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    source_type = models.CharField(max_length=50)
    config = models.JSONField(default=dict, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'knowledge_sources'
        managed = False  # Don't let Django manage this table
        ordering = ['-created_at']

    def __str__(self):
        return self.name
