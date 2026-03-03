from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import api_view
from django.shortcuts import get_object_or_404

from .models import Profile
from .serializers import RegisterSerializer, MeSerializer, ProfileSerializer, ProfileDetailSerializer

# media serving helpers
from django.conf import settings
from django.http import FileResponse, Http404
import os
from django.utils._os import safe_join

from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication


@api_view(["GET"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def protected_media(request, path):
    """Serve user-uploaded media only to authenticated clients.

    This replaces Django's standard static view which would return files to
    anyone with the URL.  We restrict access so that ordinary users can only
    fetch their own profile photo (or any media if they are staff).

    The frontend must include the JWT in the ``Authorization`` header when
    requesting the URL returned by ``ProfileSerializer``.  e.g.
    ``Authorization: Bearer <token>``.
    """
    # prevent path traversal
    try:
        final_path = safe_join(settings.MEDIA_ROOT, path)
    except Exception:
        raise Http404()

    if not os.path.isfile(final_path):
        raise Http404()

    # if the media is in the profile_photos directory, enforce ownership
    rel = os.path.relpath(final_path, settings.MEDIA_ROOT)
    if rel.startswith("profile_photos") and not (
        request.user.is_staff or request.user.is_superuser
    ):
        filename = os.path.basename(final_path)
        if not filename.startswith(f"user{request.user.id}-"):
            # users may only see their own uploads
            raise Http404()

    return FileResponse(open(final_path, "rb"))


class RegisterView(generics.CreateAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer


class MeView(APIView):
    def get(self, request):
        return Response(MeSerializer(request.user).data)


@api_view(['GET', 'POST'])
def profile_view(request):
    profile, created = Profile.objects.get_or_create(user=request.user)
    
    if request.method == 'GET':
        serializer = ProfileDetailSerializer(profile, context={'request': request})
        return Response(serializer.data)
    
    elif request.method == 'POST':
        serializer = ProfileSerializer(profile, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            # mark initial_setup_done for first-time customer/agent users
            if not profile.initial_setup_done and request.user.role in (
                request.user.Role.CUST,
                request.user.Role.AGENT,
            ):
                # Re-fetch the profile to get the updated data including profile_photo_url
                profile.refresh_from_db()
                data = ProfileDetailSerializer(profile, context={'request': request}).data
                required = [
                    'date_of_birth',
                    'gender',
                    'nationality',
                    'phone_number',
                    'profile_photo_url',
                ]
                if all(data.get(f) for f in required):
                    profile.initial_setup_done = True
                    profile.save(update_fields=['initial_setup_done'])
            return Response(serializer.data)
        return Response(serializer.errors, status=400)