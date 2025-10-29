from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DocumentViewSet, KnowledgeSourceViewSet

router = DefaultRouter()
router.register(r'documents', DocumentViewSet, basename='document')
router.register(r'knowledge-sources', KnowledgeSourceViewSet, basename='knowledge-source')

urlpatterns = [
    path('', include(router.urls)),
]
