"""Utility functions for protocol PDF generation"""
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from io import BytesIO
from django.conf import settings


def generate_protocol_pdf(protocol):
    """Generate PDF for protocol"""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    story = []
    styles = getSampleStyleSheet()
    
    # Title style
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.HexColor('#1a1a1a'),
        spaceAfter=30,
        alignment=TA_CENTER,
    )
    
    # Header
    story.append(Paragraph('ПРОТОКОЛ', title_style))
    story.append(Paragraph(f'№ {protocol.number}', styles['Heading2']))
    story.append(Spacer(1, 0.5*cm))
    
    # Course/Test title (protocol can be for course or standalone test)
    course_or_test_title = (
        protocol.course.title if protocol.course
        else (protocol.test.title if protocol.test else '—')
    )
    course_or_test_label = 'Курс:' if protocol.course else 'Тест:'

    # Protocol details
    data = [
        ['Студент:', protocol.student.full_name or protocol.student.phone],
        ['ИИН:', protocol.student.iin or 'Не указан'],
        [course_or_test_label, course_or_test_title],
        ['Дата экзамена:', protocol.exam_date.strftime('%d.%m.%Y %H:%M')],
        ['Балл:', f'{protocol.score:.1f}%'],
        ['Проходной балл:', f'{protocol.passing_score:.1f}%'],
        ['Результат:', 'Сдан' if protocol.result == 'passed' else 'Не сдан'],
    ]
    
    table = Table(data, colWidths=[5*cm, 10*cm])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f5f5f5')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
    ]))
    
    story.append(table)
    story.append(Spacer(1, 1*cm))
    
    # Signatures
    story.append(Paragraph('Подписи комиссии ПДЭК:', styles['Heading3']))
    story.append(Spacer(1, 0.5*cm))
    
    signatures_data = [['Член комиссии', 'Подпись', 'Дата']]
    for sig in protocol.signatures.all():
        if sig.signed_at:
            signatures_data.append([
                sig.signer.full_name or sig.signer.phone,
                'Подписано',
                sig.signed_at.strftime('%d.%m.%Y')
            ])
        else:
            signatures_data.append([
                sig.signer.full_name or sig.signer.phone,
                'Ожидает подписи',
                '-'
            ])
    
    sig_table = Table(signatures_data, colWidths=[6*cm, 5*cm, 4*cm])
    sig_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e0e0e0')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
    ]))
    
    story.append(sig_table)
    
    # Build PDF
    doc.build(story)
    buffer.seek(0)
    return buffer

