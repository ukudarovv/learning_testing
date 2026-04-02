"""
Custom middleware for Aqlant LMS project
"""


class PDFFrameOptionsMiddleware:
    """
    Middleware to allow PDF files to be embedded in iframes
    by removing X-Frame-Options header for PDF files
    """
    
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        
        # Check if this is a request for a PDF file
        if request.path.startswith('/media/') and request.path.lower().endswith('.pdf'):
            # Remove X-Frame-Options header to allow embedding
            if 'X-Frame-Options' in response:
                del response['X-Frame-Options']
            # Also set Content-Security-Policy if needed (optional)
            # response['Content-Security-Policy'] = "frame-ancestors 'self' *"
        
        return response
