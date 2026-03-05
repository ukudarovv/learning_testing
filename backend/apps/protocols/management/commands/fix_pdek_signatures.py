"""
Добавляет недостающие подписи ПДЭК для существующих протоколов.
Запуск: python manage.py fix_pdek_signatures
"""
from django.core.management.base import BaseCommand
from apps.protocols.models import Protocol, ProtocolSignature
from apps.accounts.models import User


class Command(BaseCommand):
    help = 'Добавить подписи ПДЭК для протоколов, где член комиссии ещё не назначен подписантом'

    def handle(self, *args, **options):
        pdek_users = User.objects.filter(role__in=['pdek_member', 'pdek_chairman'])
        if not pdek_users.exists():
            self.stdout.write(self.style.WARNING('Нет пользователей с ролями pdek_member или pdek_chairman'))
            return

        protocols = Protocol.objects.all()
        added = 0
        for protocol in protocols:
            for member in pdek_users:
                if not ProtocolSignature.objects.filter(protocol=protocol, signer=member).exists():
                    role = 'chairman' if member.role == 'pdek_chairman' else 'member'
                    ProtocolSignature.objects.create(
                        protocol=protocol,
                        signer=member,
                        role=role
                    )
                    added += 1
                    self.stdout.write(
                        f'  + Подпись для {member.full_name or member.phone} ({role}) в протоколе {protocol.number}'
                    )

        if added:
            self.stdout.write(self.style.SUCCESS(f'Добавлено подписей: {added}'))
        else:
            self.stdout.write('Все протоколы уже имеют подписи для всех членов ПДЭК.')
