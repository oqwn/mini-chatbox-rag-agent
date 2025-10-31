from django.urls import path
from .views import SettingsViewSet

urlpatterns = [
    path('', SettingsViewSet.as_view({
        'get': 'list',
        'put': 'bulk_update'
    }), name='settings'),
    path('reset/', SettingsViewSet.as_view({
        'post': 'reset'
    }), name='settings-reset'),
]
