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
            return Response(serializer.data)
        return Response(serializer.errors, status=400)