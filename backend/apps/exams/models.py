from django.db import models
from django.conf import settings
from apps.tests.models import Test
import os


def test_attempt_video_upload_to(instance, filename):
    """Generate upload path for test attempt video"""
    ext = os.path.splitext(filename)[1]
    return f"test_attempts/{instance.id}/video{ext}"


def test_attempt_screen_upload_to(instance, filename):
    """Generate upload path for test attempt screen recording"""
    ext = os.path.splitext(filename)[1]
    return f"test_attempts/{instance.id}/screen{ext}"


class ExtraAttemptRequest(models.Model):
    """Request for additional test attempts"""
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='extra_attempt_requests', on_delete=models.CASCADE)
    test = models.ForeignKey(Test, related_name='extra_attempt_requests', on_delete=models.CASCADE)
    reason = models.TextField(help_text='Reason for requesting additional attempts')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    admin_response = models.TextField(blank=True, help_text='Admin response or rejection reason')
    processed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        related_name='processed_extra_attempt_requests',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    processed_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'extra_attempt_requests'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'test', 'status']),
            models.Index(fields=['status', '-created_at']),
        ]
    
    def __str__(self):
        return f"{self.user.full_name or self.user.phone} - {self.test.title} ({self.get_status_display()})"


class TestAttempt(models.Model):
    """Test attempt model"""
    
    test = models.ForeignKey(Test, related_name='attempts', on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='test_attempts', on_delete=models.CASCADE)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    score = models.FloatField(null=True, blank=True, help_text='Score percentage')
    passed = models.BooleanField(null=True, blank=True)
    answers = models.JSONField(default=dict, help_text='User answers: {question_id: answer}')
    video_recording = models.FileField(upload_to=test_attempt_video_upload_to, null=True, blank=True, help_text='Video recording of test attempt')
    screen_recording = models.FileField(upload_to=test_attempt_screen_upload_to, null=True, blank=True, help_text='Screen recording of test attempt')
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=255, blank=True)
    termination_reason = models.TextField(null=True, blank=True, help_text='Reason for early test termination')
    
    class Meta:
        db_table = 'test_attempts'
        ordering = ['-started_at']
    
    def __str__(self):
        return f"{self.user.full_name or self.user.phone} - {self.test.title} ({self.score}%)"
    
    def calculate_score(self):
        """Calculate score based on answers"""
        import logging
        logger = logging.getLogger(__name__)
        
        if not self.answers:
            return 0, False
        
        total_weight = 0
        correct_weight = 0
        
        for question in self.test.questions.all():
            total_weight += question.weight
            question_id = str(question.id)
            
            if question_id not in self.answers:
                logger.debug(f"Question {question_id}: No answer provided")
                continue
            
            user_answer = self.answers[question_id]
            correct_answers = question.get_correct_answers()
            
            # Логирование для отладки
            logger.debug(f"Question {question_id} (type: {question.type}):")
            logger.debug(f"  User answer: {user_answer} (type: {type(user_answer)})")
            logger.debug(f"  Correct answers: {correct_answers} (type: {type(correct_answers)})")
            logger.debug(f"  Options: {question.options}")
            
            # Check if answer is correct based on question type
            is_correct = False
            if question.type in ['single_choice', 'yes_no']:
                # For single_choice and yes_no, compare as strings
                # For single_choice: compare ID strings
                # For yes_no: compare text strings ("Да"/"Нет")
                user_answer_str = str(user_answer)
                correct_answers_str = [str(ca) for ca in correct_answers]
                is_correct = user_answer_str in correct_answers_str
                logger.debug(f"  Comparison: '{user_answer_str}' in {correct_answers_str} = {is_correct}")
            elif question.type == 'multiple_choice':
                # For multiple_choice, compare sets of ID strings
                user_answers = user_answer if isinstance(user_answer, list) else [user_answer]
                user_answers_set = set(str(a) for a in user_answers)
                correct_answers_set = set(str(ca) for ca in correct_answers)
                is_correct = user_answers_set == correct_answers_set
                logger.debug(f"  Comparison: {user_answers_set} == {correct_answers_set} = {is_correct}")
            elif question.type in ['matching', 'ordering', 'short_answer']:
                # For these types, compare directly as strings
                is_correct = str(user_answer) == str(correct_answers[0]) if correct_answers else False
                logger.debug(f"  Comparison: '{str(user_answer)}' == '{str(correct_answers[0]) if correct_answers else None}' = {is_correct}")
            
            logger.debug(f"  Result: {'CORRECT' if is_correct else 'INCORRECT'}")
            
            if is_correct:
                correct_weight += question.weight
        
        if total_weight == 0:
            return 0, False
        
        score_percentage = (correct_weight / total_weight) * 100
        passed = score_percentage >= self.test.passing_score
        
        return score_percentage, passed
    
    def get_answer_details(self):
        """Get detailed information about each answer"""
        if not self.answers:
            return []
        
        details = []
        for question in self.test.questions.all():
            question_id = str(question.id)
            user_answer = self.answers.get(question_id)
            correct_answers = question.get_correct_answers()
            
            # Determine if answer is correct
            is_correct = False
            if question_id in self.answers:
                user_answer_value = self.answers[question_id]
                if question.type in ['single_choice', 'yes_no']:
                    is_correct = str(user_answer_value) in [str(ca) for ca in correct_answers]
                elif question.type == 'multiple_choice':
                    user_answers = user_answer_value if isinstance(user_answer_value, list) else [user_answer_value]
                    is_correct = set(str(a) for a in user_answers) == set(str(ca) for ca in correct_answers)
                elif question.type in ['matching', 'ordering', 'short_answer']:
                    is_correct = str(user_answer_value) == str(correct_answers[0]) if correct_answers else False
            
            # Get answer texts for display (use user_answer_value if available, otherwise user_answer)
            user_answer_for_display = self.answers.get(question_id) if question_id in self.answers else user_answer
            user_answer_display = self._get_answer_display(question, user_answer_for_display)
            correct_answer_display = self._get_correct_answer_display(question, correct_answers)
            
            details.append({
                'question_id': str(question.id),
                'question_text': question.text,
                'question_type': question.type,
                'user_answer': user_answer_for_display if question_id in self.answers else user_answer,
                'user_answer_display': user_answer_display,
                'correct_answers': correct_answers,
                'correct_answer_display': correct_answer_display,
                'is_correct': is_correct,
            })
        
        return details
    
    def _get_answer_display(self, question, answer_value):
        """Get human-readable display of user answer"""
        if answer_value is None:
            return 'Не отвечено'
        
        if question.type in ['single_choice', 'yes_no']:
            # For single_choice, find option text by ID
            if question.type == 'single_choice' and question.options:
                for opt in question.options:
                    if str(opt.get('id')) == str(answer_value):
                        return opt.get('text', str(answer_value))
            # For yes_no, return as is (should be "Да" or "Нет")
            if question.type == 'yes_no':
                answer_str = str(answer_value).strip()
                # Handle cases where answer might be stored as boolean or number
                if answer_str in ['True', 'true', '1']:
                    return 'Да'
                elif answer_str in ['False', 'false', '0']:
                    return 'Нет'
                # Otherwise return as is (should be "Да" or "Нет")
                return answer_str if answer_str in ['Да', 'Нет'] else str(answer_value)
            return str(answer_value)
        elif question.type == 'multiple_choice':
            # For multiple_choice, find option texts by IDs
            if not isinstance(answer_value, list):
                answer_value = [answer_value]
            result = []
            for ans in answer_value:
                found = False
                ans_str = str(ans)
                if question.options:
                    for opt in question.options:
                        opt_id = opt.get('id')
                        if opt_id and str(opt_id) == ans_str:
                            result.append(opt.get('text', str(ans)))
                            found = True
                            break
                if not found:
                    result.append(str(ans))
            return ', '.join(result) if result else 'Не отвечено'
        else:
            return str(answer_value)
    
    def _get_correct_answer_display(self, question, correct_answers):
        """Get human-readable display of correct answers"""
        if not correct_answers:
            return 'Нет правильного ответа'
        
        if question.type in ['single_choice', 'yes_no']:
            # For single_choice, find option text by ID
            if question.type == 'single_choice' and question.options:
                ca_str = str(correct_answers[0])
                for opt in question.options:
                    opt_id = opt.get('id')
                    if opt_id and str(opt_id) == ca_str:
                        return opt.get('text', str(correct_answers[0]))
            # For yes_no, return as is
            return str(correct_answers[0])
        elif question.type == 'multiple_choice':
            # For multiple_choice, find option texts by IDs
            result = []
            for ca in correct_answers:
                found = False
                ca_str = str(ca)
                if question.options:
                    for opt in question.options:
                        opt_id = opt.get('id')
                        if opt_id and str(opt_id) == ca_str:
                            result.append(opt.get('text', str(ca)))
                            found = True
                            break
                if not found:
                    result.append(str(ca))
            return ', '.join(result)
        else:
            return str(correct_answers[0]) if correct_answers else ''

