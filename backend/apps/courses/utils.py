"""Helpers for course categories and EC (exam commission) assignment."""

from django.contrib.auth import get_user_model

User = get_user_model()

PDEK_ROLES = ('pdek_member', 'pdek_chairman')


def get_category_for_protocol(*, course=None, test=None, attempt=None):
    """Resolve LMS category from course, standalone test, or attempt's test."""
    if course is not None:
        return getattr(course, 'category', None)
    if test is not None:
        return getattr(test, 'category', None)
    if attempt is not None:
        t = getattr(attempt, 'test', None)
        return getattr(t, 'category', None) if t else None
    return None


def get_ec_signers_for_category(category):
    """
    Return queryset of users who should receive protocol signatures for this category.

    If category is None or no explicit reviewers are set on the category, returns all
    active users with EC roles. Otherwise returns only selected reviewers that still
    have EC roles (intersection). If that intersection is empty (stale data), falls
    back to all EC members.
    """
    base = User.objects.filter(role__in=PDEK_ROLES, is_active=True).order_by('id')
    if category is None:
        return base
    if not getattr(category, 'pk', None):
        return base
    reviewer_ids = list(category.ec_reviewers.values_list('pk', flat=True))
    if not reviewer_ids:
        return base
    selected = base.filter(pk__in=reviewer_ids)
    return selected if selected.exists() else base


def create_protocol_ec_signatures(protocol, signers_qs):
    """Create ProtocolSignature rows for each signer (chairman vs member by role)."""
    from apps.protocols.models import ProtocolSignature

    for member in signers_qs:
        ProtocolSignature.objects.create(
            protocol=protocol,
            signer=member,
            role='chairman' if member.role == 'pdek_chairman' else 'member',
        )
