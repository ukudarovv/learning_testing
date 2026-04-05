# Add protocol_sign_method for EC users

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0003_alter_smsverificationcode_purpose'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='protocol_sign_method',
            field=models.CharField(
                choices=[('both', 'SMS и ЭЦП'), ('sms', 'Только SMS'), ('eds', 'Только ЭЦП')],
                default='both',
                help_text='Способ подписания протоколов для членов ЭК',
                max_length=10
            ),
        ),
    ]
