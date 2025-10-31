from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DocumentViewSet, KnowledgeSourceViewSet, RAGViewSet

router = DefaultRouter()
router.register(r'documents', DocumentViewSet, basename='document')
router.register(r'knowledge-sources', KnowledgeSourceViewSet, basename='knowledge-source')
router.register(r'', RAGViewSet, basename='rag')

urlpatterns = [
    path('', include(router.urls)),
]
