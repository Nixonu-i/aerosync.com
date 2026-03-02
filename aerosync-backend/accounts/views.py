from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import api_view
from django.shortcuts import get_object_or_404

from .models import Profile
from .serializers import RegisterSerializer, MeSerializer, ProfileSerializer, ProfileDetailSerializer


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
                data = serializer.data
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