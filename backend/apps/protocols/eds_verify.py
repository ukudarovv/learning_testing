"""
Extract certificate info from CMS detached signature (Kazakhstan EDS).
Used for audit trail and IIN verification.
"""
import base64
import re
import logging
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

# Kazakhstan IIN OIDs (НУЦ РК) - various formats used by НУЦ РК
OID_IIN_LIST = [
    "1.2.398.3.3.2.1",
    "2.16.398.3.3.2.1",
    "1.2.398.3.2.1",
    "2.16.398.3.2.1",
]
# OID 2.5.4.5 = serialNumber - often used for IIN in KZ certs (e.g. "IIN040309500033")
OID_SERIAL_NUMBER = "2.5.4.5"

# IIN pattern: 12 digits, optionally prefixed with "IIN"
IIN_PATTERN = re.compile(r"(?:IIN)?(\d{12})\b")


def _decode_signature(signature_base64: str) -> bytes:
    """Decode Base64 signature, handle PEM wrapper if present."""
    data = signature_base64.strip()
    # Remove PEM headers if present
    if "-----BEGIN" in data:
        lines = [l for l in data.splitlines() if not l.startswith("-----")]
        data = "".join(lines)
    return base64.b64decode(data)


def _extract_iin_from_subject(subject) -> Optional[str]:
    """Extract IIN from X.509 subject. Kazakhstan certs may have IIN in various places."""
    try:
        from cryptography.x509.oid import NameOID
        # Try OID for IIN
        for attr in subject:
            oid_str = attr.oid.dotted_string
            if oid_str in OID_IIN_LIST and attr.value:
                val = str(attr.value).strip()
                if val.isdigit() and len(val) == 12:
                    return val
            # OID 2.5.4.5 (serialNumber) - KZ certs use "IIN040309500033" format
            if oid_str == OID_SERIAL_NUMBER and attr.value:
                val = str(attr.value).strip().upper()
                match = IIN_PATTERN.search(val)
                if match:
                    return match.group(1)
        # Try CN - sometimes "Lastname Firstname IIN123456789012" or "Фамилия Имя 123456789012"
        cn_attrs = subject.get_attributes_for_oid(NameOID.COMMON_NAME)
        if cn_attrs:
            cn = str(cn_attrs[0].value)
            match = IIN_PATTERN.search(cn)
            if match:
                return match.group(1)
        # Scan all attribute values for 12-digit IIN (including "IIN123456789012" format)
        for attr in subject:
            val = str(attr.value).upper()
            match = IIN_PATTERN.search(val)
            if match:
                return match.group(1)
    except Exception as e:
        logger.warning("Error extracting IIN from subject: %s", e)
    return None


def _extract_iin_from_extensions(cert) -> Optional[str]:
    """Extract IIN from certificate extensions (SubjectAltName, custom OIDs)."""
    try:
        for ext in cert.extensions:
            val = str(ext.value)
            match = IIN_PATTERN.search(val)
            if match:
                return match.group(1)
            if hasattr(ext.value, 'value') and ext.value.value:
                val_inner = str(ext.value.value)
                match = IIN_PATTERN.search(val_inner)
                if match:
                    return match.group(1)
    except Exception as e:
        logger.warning("Error extracting IIN from extensions: %s", e)
    return None


def _extract_iin_from_rfc4514(subject) -> Optional[str]:
    """Extract IIN from subject RFC4514 string representation."""
    try:
        subject_str = subject.rfc4514_string()
        match = IIN_PATTERN.search(subject_str)
        if match:
            return match.group(1)
    except Exception as e:
        logger.warning("Error extracting IIN from rfc4514: %s", e)
    return None


def extract_certificate_info(signature_base64: str) -> Optional[dict]:
    """
    Extract signer certificate info from CMS detached signature.
    Returns dict with iin, full_name, serial_number, issuer, valid_from, valid_to.
    Returns None if parsing fails.
    """
    try:
        from cryptography.hazmat.primitives.serialization import pkcs7
        from cryptography.x509.oid import NameOID
    except ImportError:
        logger.error("cryptography package not installed")
        return None

    try:
        raw = _decode_signature(signature_base64)
    except Exception as e:
        logger.warning("Failed to decode signature: %s", e)
        return None

    try:
        certs = pkcs7.load_der_pkcs7_certificates(raw)
    except Exception:
        try:
            certs = pkcs7.load_pem_pkcs7_certificates(signature_base64.encode() if isinstance(signature_base64, str) else signature_base64)
        except Exception as e:
            logger.warning("Failed to load PKCS7 certificates: %s", e)
            return None

    if not certs:
        logger.warning("No certificates in CMS signature")
        return None

    try:
        # First cert is typically the signer
        cert = certs[0]
        subject = cert.subject
        issuer = cert.issuer

        full_name = None
        cn_attrs = subject.get_attributes_for_oid(NameOID.COMMON_NAME)
        if cn_attrs:
            full_name = str(cn_attrs[0].value).strip()

        iin = (
            _extract_iin_from_subject(subject)
            or _extract_iin_from_extensions(cert)
            or _extract_iin_from_rfc4514(subject)
        )
        if not iin:
            try:
                subj_str = subject.rfc4514_string()
                ext_oids = [e.oid.dotted_string for e in cert.extensions]
                logger.info("IIN not found in cert. Subject: %s. Extension OIDs: %s", subj_str[:200], ext_oids)
            except Exception:
                pass

        issuer_str = None
        issuer_cn = issuer.get_attributes_for_oid(NameOID.COMMON_NAME)
        if issuer_cn:
            issuer_str = str(issuer_cn[0].value)

        return {
            "iin": iin,
            "full_name": full_name,
            "serial_number": format(cert.serial_number, "x").upper(),
            "issuer": issuer_str,
            "valid_from": cert.not_valid_before_utc.isoformat() if cert.not_valid_before_utc else None,
            "valid_to": cert.not_valid_after_utc.isoformat() if cert.not_valid_after_utc else None,
        }
    except Exception as e:
        logger.exception("Error extracting certificate info: %s", e)
        return None


def verify_iin_match(cert_iin: Optional[str], user_iin: Optional[str]) -> Tuple[bool, Optional[str]]:
    """
    Verify that IIN from certificate matches user's IIN.
    Returns (matches, error_message).
    """
    user_iin_clean = (user_iin or "").strip().replace(" ", "")
    cert_iin_clean = (cert_iin or "").strip().replace(" ", "")

    if not user_iin_clean:
        return False, "Укажите ИИН в профиле для подписания протоколов ЭЦП."

    if not cert_iin_clean:
        return False, "ИИН в сертификате не найден. Невозможно проверить соответствие."

    if user_iin_clean != cert_iin_clean:
        return False, f"ИИН в сертификате ({cert_iin_clean}) не совпадает с ИИН пользователя ({user_iin_clean})."

    return True, None
