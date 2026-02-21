"""Utility functions for certificate PDF generation"""
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from io import BytesIO
from django.conf import settings


def generate_certificate_pdf(certificate):
    """Generate PDF for certificate"""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    story = []
    styles = getSampleStyleSheet()
    
    # Title style
    title_style = ParagraphStyle(
        'CertificateTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#1a1a1a'),
        spaceAfter=20,
        alignment=TA_CENTER,
    )
    
    # Header
    story.append(Spacer(1, 2*cm))
    story.append(Paragraph('СЕРТИФИКАТ', title_style))
    story.append(Spacer(1, 0.5*cm))
    
    # Certificate number
    story.append(Paragraph(f'№ {certificate.number}', styles['Heading2']))
    story.append(Spacer(1, 1*cm))
    
    # Certificate text
    text_style = ParagraphStyle(
        'CertificateText',
        parent=styles['Normal'],
        fontSize=14,
        alignment=TA_CENTER,
        spaceAfter=20,
    )
    
    story.append(Paragraph(
        f'Настоящим удостоверяется, что',
        text_style
    ))
    story.append(Spacer(1, 0.3*cm))
    
    # Student name
    name_style = ParagraphStyle(
        'StudentName',
        parent=styles['Heading2'],
        fontSize=16,
        textColor=colors.HexColor('#000000'),
        alignment=TA_CENTER,
        spaceAfter=20,
    )
    story.append(Paragraph(
        certificate.student.full_name or certificate.student.phone,
        name_style
    ))
    story.append(Spacer(1, 0.3*cm))
    
    # Course or test (certificate can be for course or standalone test)
    is_course = certificate.course is not None
    course_or_test_title = (
        certificate.course.title if certificate.course
        else (certificate.test.title if certificate.test else '—')
    )
    completion_text = 'успешно прошел(а) обучение по курсу' if is_course else 'успешно прошел(а) тестирование по тесту'

    story.append(Paragraph(completion_text, text_style))
    story.append(Spacer(1, 0.3*cm))

    # Course/Test name
    course_style = ParagraphStyle(
        'CourseName',
        parent=styles['Heading3'],
        fontSize=14,
        textColor=colors.HexColor('#000000'),
        alignment=TA_CENTER,
        spaceAfter=20,
    )
    story.append(Paragraph(course_or_test_title, course_style))
    story.append(Spacer(1, 0.5*cm))
    
    # Certificate details
    data = [
        ['Дата выдачи:', certificate.issued_at.strftime('%d.%m.%Y')],
    ]
    
    if certificate.valid_until:
        data.append(['Действителен до:', certificate.valid_until.strftime('%d.%m.%Y')])
    
    if certificate.protocol:
        data.append(['Протокол:', certificate.protocol.number])
    
    table = Table(data, colWidths=[6*cm, 9*cm])
    table.setStyle(TableStyle([
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
    ]))
    
    story.append(table)
    story.append(Spacer(1, 1*cm))
    
    # QR Code (if available)
    if certificate.qr_code:
        try:
            qr_buffer = certificate.generate_qr_code()
            qr_buffer.seek(0)
            qr_image = Image(qr_buffer, width=3*cm, height=3*cm)
            story.append(Spacer(1, 0.5*cm))
            story.append(qr_image)
            story.append(Paragraph(
                'Отсканируйте QR-код для верификации',
                ParagraphStyle(
                    'QRText',
                    parent=styles['Normal'],
                    fontSize=9,
                    alignment=TA_CENTER,
                )
            ))
        except Exception:
            pass
    
    # Build PDF
    doc.build(story)
    buffer.seek(0)
    return buffer

