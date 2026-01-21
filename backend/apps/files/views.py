from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.http import FileResponse, Http404
from django.conf import settings
import os
import subprocess
import tempfile
import logging

from .models import File
from .serializers import FileSerializer
from apps.accounts.permissions import IsAdminOrReadOnly

logger = logging.getLogger(__name__)


class FileViewSet(viewsets.ModelViewSet):
    """File ViewSet"""
    queryset = File.objects.select_related('uploaded_by').all()
    serializer_class = FileSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['file_type', 'uploaded_by']
    search_fields = ['name']
    ordering_fields = ['uploaded_at', 'name', 'size']
    ordering = ['-uploaded_at']
    
    def get_queryset(self):
        """Filter files by user unless admin"""
        queryset = super().get_queryset()
        if not self.request.user.is_admin:
            queryset = queryset.filter(uploaded_by=self.request.user)
        return queryset
    
    def perform_create(self, serializer):
        """Set uploaded_by to current user"""
        serializer.save(uploaded_by=self.request.user)
    
    @action(detail=False, methods=['get', 'post'], url_path='upload')
    def upload(self, request):
        """Upload file endpoint"""
        if request.method == 'GET':
            # List files
            files = self.get_queryset()
            serializer = self.get_serializer(files, many=True)
            return Response(serializer.data)
        
        elif request.method == 'POST':
            # Upload file
            if 'file' not in request.FILES:
                return Response(
                    {'error': 'No file provided'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            file_obj = request.FILES['file']
            name = request.data.get('name', file_obj.name)
            
            file_instance = File.objects.create(
                name=name,
                file=file_obj,
                uploaded_by=request.user
            )
            
            serializer = self.get_serializer(file_instance, context={'request': request})
            return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['get'], url_path='convert-to-pdf')
    def convert_to_pdf(self, request, pk=None):
        """Convert PPT/PPTX file to PDF"""
        file_instance = self.get_object()
        
        # Check if file is PPT/PPTX
        file_ext = os.path.splitext(file_instance.file.name)[1].lower()
        if file_ext not in ['.ppt', '.pptx']:
            return Response(
                {'error': 'File must be PPT or PPTX format'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if PDF already exists
        pdf_path = file_instance.file.path.replace(file_ext, '.pdf')
        if os.path.exists(pdf_path):
            logger.info(f'PDF already exists: {pdf_path}')
            return FileResponse(
                open(pdf_path, 'rb'),
                content_type='application/pdf',
                filename=os.path.basename(pdf_path),
                as_attachment=False  # Display inline
            )
        
        # Convert using LibreOffice (if available) or python-pptx
        try:
            # Try LibreOffice first (most reliable)
            if self._convert_with_libreoffice(file_instance.file.path, pdf_path):
                logger.info(f'Successfully converted with LibreOffice: {pdf_path}')
                return FileResponse(
                    open(pdf_path, 'rb'),
                    content_type='application/pdf',
                    filename=os.path.basename(pdf_path),
                    as_attachment=False
                )
            else:
                # Fallback: return error or try alternative method
                return Response(
                    {'error': 'LibreOffice not available. Please install LibreOffice for PPT/PPTX conversion.'},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE
                )
        except Exception as e:
            logger.error(f'Error converting file to PDF: {str(e)}')
            return Response(
                {'error': f'Conversion failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def _convert_with_libreoffice(self, input_path, output_path):
        """Convert PPT/PPTX to PDF using LibreOffice headless"""
        try:
            # Create output directory if it doesn't exist
            output_dir = os.path.dirname(output_path)
            os.makedirs(output_dir, exist_ok=True)
            
            # Try different LibreOffice command names
            libreoffice_cmd = None
            for cmd in ['libreoffice', 'soffice', '/usr/bin/libreoffice', 'C:\\Program Files\\LibreOffice\\program\\soffice.exe']:
                try:
                    result = subprocess.run(
                        [cmd, '--version'],
                        capture_output=True,
                        timeout=5
                    )
                    if result.returncode == 0:
                        libreoffice_cmd = cmd
                        break
                except (FileNotFoundError, subprocess.TimeoutExpired):
                    continue
            
            if not libreoffice_cmd:
                logger.warning('LibreOffice not found')
                return False
            
            # Convert file
            # --headless: run without GUI
            # --convert-to pdf: convert to PDF
            # --outdir: output directory
            result = subprocess.run(
                [
                    libreoffice_cmd,
                    '--headless',
                    '--convert-to', 'pdf',
                    '--outdir', output_dir,
                    input_path
                ],
                capture_output=True,
                timeout=60,  # 60 seconds timeout
                cwd=output_dir
            )
            
            if result.returncode == 0:
                # LibreOffice outputs PDF with same name but .pdf extension
                expected_pdf = os.path.join(
                    output_dir,
                    os.path.basename(input_path).replace(os.path.splitext(input_path)[1], '.pdf')
                )
                
                if os.path.exists(expected_pdf):
                    # Rename to match expected output path if different
                    if expected_pdf != output_path:
                        os.rename(expected_pdf, output_path)
                    return True
                else:
                    logger.warning(f'PDF file not found after conversion: {expected_pdf}')
                    return False
            else:
                logger.error(f'LibreOffice conversion failed: {result.stderr.decode()}')
                return False
                
        except subprocess.TimeoutExpired:
            logger.error('LibreOffice conversion timeout')
            return False
        except Exception as e:
            logger.error(f'Error in LibreOffice conversion: {str(e)}')
            return False

