from django.db import models


class Project(models.Model):
    """Project model - matches Node.js backend schema"""
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    color = models.CharField(max_length=7, default='#3B82F6')
    icon = models.CharField(max_length=50, default='folder')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'projects'
        managed = False  # Don't manage - exists in Node.js backend
        ordering = ['-updated_at']

    def __str__(self):
        return self.name
