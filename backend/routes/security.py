"""
Güvenlik Modülü - 2FA, Rate Limiting, Güvenlik Logları, Raporlama
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime, timedelta
from typing import Optional
import uuid
import pyotp
import qrcode
import io
import base64
from cryptography.fernet import Fernet
import os
import hashlib

security_router = APIRouter(prefix="/security", tags=["security"])

# Şifreleme anahtarı (production'da env'den alınmalı)
ENCRYPTION_KEY = os.environ.get('ENCRYPTION_KEY', Fernet.generate_key().decode())

def get_fernet():
    """Fernet şifreleme instance'ı"""
    key = ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY
    # Eğer key 32 byte değilse, hash'leyerek 32 byte yap
    if len(key) != 44:  # Base64 encoded 32 bytes = 44 chars
        key = base64.urlsafe_b64encode(hashlib.sha256(key).digest())
    return Fernet(key)

def encrypt_message(message: str) -> str:
    """Mesajı şifrele"""
    f = get_fernet()
    return f.encrypt(message.encode()).decode()

def decrypt_message(encrypted_message: str) -> str:
    """Şifreli mesajı çöz"""
    try:
        f = get_fernet()
        return f.decrypt(encrypted_message.encode()).decode()
    except:
        return encrypted_message  # Şifrelenmemiş eski mesajlar için

def setup_security_routes(db, get_current_user):
    
    # ==================== 2FA (İki Faktörlü Doğrulama) ====================
    
    @security_router.post("/2fa/setup")
    async def setup_2fa(current_user: dict = Depends(get_current_user)):
        """2FA kurulumu başlat - QR kod ve secret key döndür"""
        user = await db.users.find_one({"uid": current_user['uid']})
        if not user:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
        
        # Zaten aktifse hata ver
        if user.get('twoFactorEnabled'):
            raise HTTPException(status_code=400, detail="2FA zaten aktif")
        
        # Secret key oluştur
        secret = pyotp.random_base32()
        
        # TOTP URI oluştur
        totp = pyotp.TOTP(secret)
        provisioning_uri = totp.provisioning_uri(
            name=user.get('email', current_user['uid']),
            issuer_name="Network Solution"
        )
        
        # QR kod oluştur
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(provisioning_uri)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        qr_base64 = base64.b64encode(buffer.getvalue()).decode()
        
        # Secret'ı geçici olarak kaydet (doğrulama sonrası aktif edilecek)
        await db.users.update_one(
            {"uid": current_user['uid']},
            {"$set": {"twoFactorSecret": secret, "twoFactorPending": True}}
        )
        
        # Güvenlik logu
        await log_security_event(db, current_user['uid'], "2fa_setup_started", {})
        
        return {
            "secret": secret,
            "qrCode": f"data:image/png;base64,{qr_base64}",
            "manualEntry": secret
        }
    
    @security_router.post("/2fa/verify")
    async def verify_2fa(data: dict, current_user: dict = Depends(get_current_user)):
        """2FA doğrulama - OTP kodunu kontrol et ve aktif et"""
        code = data.get('code')
        if not code:
            raise HTTPException(status_code=400, detail="Doğrulama kodu gerekli")
        
        user = await db.users.find_one({"uid": current_user['uid']})
        if not user:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
        
        secret = user.get('twoFactorSecret')
        if not secret:
            raise HTTPException(status_code=400, detail="Önce 2FA kurulumu yapın")
        
        # TOTP doğrula
        totp = pyotp.TOTP(secret)
        if not totp.verify(code, valid_window=1):
            await log_security_event(db, current_user['uid'], "2fa_verify_failed", {"code": code[:2] + "****"})
            raise HTTPException(status_code=400, detail="Geçersiz doğrulama kodu")
        
        # 2FA'yı aktif et ve yedek kodlar oluştur
        backup_codes = [str(uuid.uuid4())[:8].upper() for _ in range(10)]
        
        await db.users.update_one(
            {"uid": current_user['uid']},
            {
                "$set": {
                    "twoFactorEnabled": True,
                    "twoFactorPending": False,
                    "twoFactorBackupCodes": backup_codes,
                    "twoFactorEnabledAt": datetime.utcnow()
                }
            }
        )
        
        await log_security_event(db, current_user['uid'], "2fa_enabled", {})
        
        return {
            "message": "2FA başarıyla aktif edildi",
            "backupCodes": backup_codes
        }
    
    @security_router.post("/2fa/disable")
    async def disable_2fa(data: dict, current_user: dict = Depends(get_current_user)):
        """2FA'yı devre dışı bırak"""
        code = data.get('code')
        password = data.get('password')
        
        user = await db.users.find_one({"uid": current_user['uid']})
        if not user:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
        
        if not user.get('twoFactorEnabled'):
            raise HTTPException(status_code=400, detail="2FA zaten kapalı")
        
        # OTP veya yedek kod ile doğrula
        secret = user.get('twoFactorSecret')
        totp = pyotp.TOTP(secret)
        
        backup_codes = user.get('twoFactorBackupCodes', [])
        is_backup = code in backup_codes
        
        if not totp.verify(code, valid_window=1) and not is_backup:
            await log_security_event(db, current_user['uid'], "2fa_disable_failed", {})
            raise HTTPException(status_code=400, detail="Geçersiz doğrulama kodu")
        
        # 2FA'yı kapat
        await db.users.update_one(
            {"uid": current_user['uid']},
            {
                "$unset": {
                    "twoFactorSecret": "",
                    "twoFactorEnabled": "",
                    "twoFactorBackupCodes": "",
                    "twoFactorPending": "",
                    "twoFactorEnabledAt": ""
                }
            }
        )
        
        await log_security_event(db, current_user['uid'], "2fa_disabled", {})
        
        return {"message": "2FA devre dışı bırakıldı"}
    
    @security_router.get("/2fa/status")
    async def get_2fa_status(current_user: dict = Depends(get_current_user)):
        """2FA durumunu kontrol et"""
        user = await db.users.find_one({"uid": current_user['uid']})
        if not user:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
        
        return {
            "enabled": user.get('twoFactorEnabled', False),
            "enabledAt": user.get('twoFactorEnabledAt'),
            "backupCodesRemaining": len(user.get('twoFactorBackupCodes', []))
        }
    
    @security_router.post("/2fa/login-verify")
    async def verify_2fa_login(data: dict):
        """Giriş sırasında 2FA doğrulama"""
        uid = data.get('uid')
        code = data.get('code')
        
        if not uid or not code:
            raise HTTPException(status_code=400, detail="UID ve kod gerekli")
        
        user = await db.users.find_one({"uid": uid})
        if not user:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
        
        if not user.get('twoFactorEnabled'):
            return {"verified": True, "required": False}
        
        secret = user.get('twoFactorSecret')
        totp = pyotp.TOTP(secret)
        
        # Yedek kod kontrolü
        backup_codes = user.get('twoFactorBackupCodes', [])
        is_backup = code in backup_codes
        
        if totp.verify(code, valid_window=1):
            await log_security_event(db, uid, "2fa_login_success", {})
            return {"verified": True, "required": True}
        elif is_backup:
            # Yedek kodu kullanıldı olarak işaretle
            backup_codes.remove(code)
            await db.users.update_one(
                {"uid": uid},
                {"$set": {"twoFactorBackupCodes": backup_codes}}
            )
            await log_security_event(db, uid, "2fa_backup_code_used", {})
            return {"verified": True, "required": True, "backupUsed": True}
        else:
            await log_security_event(db, uid, "2fa_login_failed", {})
            raise HTTPException(status_code=401, detail="Geçersiz 2FA kodu")
    
    # ==================== KULLANICI RAPORLAMA ====================
    
    @security_router.post("/report/user")
    async def report_user(data: dict, current_user: dict = Depends(get_current_user)):
        """Kullanıcı raporla"""
        reported_uid = data.get('userId')
        reason = data.get('reason')
        details = data.get('details', '')
        
        if not reported_uid or not reason:
            raise HTTPException(status_code=400, detail="Kullanıcı ID ve sebep gerekli")
        
        # Kendini raporlama engelle
        if reported_uid == current_user['uid']:
            raise HTTPException(status_code=400, detail="Kendinizi raporlayamazsınız")
        
        report = {
            "id": str(uuid.uuid4()),
            "type": "user",
            "reporterId": current_user['uid'],
            "reportedId": reported_uid,
            "reason": reason,
            "details": details,
            "status": "pending",
            "createdAt": datetime.utcnow()
        }
        
        await db.reports.insert_one(report)
        await log_security_event(db, current_user['uid'], "user_reported", {"reportedId": reported_uid, "reason": reason})
        
        return {"message": "Rapor gönderildi", "reportId": report['id']}
    
    @security_router.post("/report/content")
    async def report_content(data: dict, current_user: dict = Depends(get_current_user)):
        """İçerik raporla (post, mesaj, yorum)"""
        content_type = data.get('contentType')  # post, message, comment
        content_id = data.get('contentId')
        reason = data.get('reason')
        details = data.get('details', '')
        
        if not content_type or not content_id or not reason:
            raise HTTPException(status_code=400, detail="İçerik tipi, ID ve sebep gerekli")
        
        valid_types = ['post', 'message', 'comment', 'service']
        if content_type not in valid_types:
            raise HTTPException(status_code=400, detail=f"Geçersiz içerik tipi. Geçerli: {valid_types}")
        
        report = {
            "id": str(uuid.uuid4()),
            "type": "content",
            "contentType": content_type,
            "contentId": content_id,
            "reporterId": current_user['uid'],
            "reason": reason,
            "details": details,
            "status": "pending",
            "createdAt": datetime.utcnow()
        }
        
        await db.reports.insert_one(report)
        await log_security_event(db, current_user['uid'], "content_reported", {
            "contentType": content_type,
            "contentId": content_id,
            "reason": reason
        })
        
        return {"message": "Rapor gönderildi", "reportId": report['id']}
    
    @security_router.get("/reports")
    async def get_reports(current_user: dict = Depends(get_current_user), status: str = "all"):
        """Raporları listele (sadece admin)"""
        user = await db.users.find_one({"uid": current_user['uid']})
        if not user.get('isAdmin'):
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
        
        query = {}
        if status != "all":
            query["status"] = status
        
        reports = await db.reports.find(query).sort("createdAt", -1).limit(100).to_list(100)
        for r in reports:
            if '_id' in r:
                del r['_id']
        
        return reports
    
    @security_router.put("/reports/{report_id}")
    async def update_report_status(report_id: str, data: dict, current_user: dict = Depends(get_current_user)):
        """Rapor durumunu güncelle (sadece admin)"""
        user = await db.users.find_one({"uid": current_user['uid']})
        if not user.get('isAdmin'):
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
        
        status = data.get('status')
        action = data.get('action')
        notes = data.get('notes', '')
        
        valid_statuses = ['pending', 'reviewing', 'resolved', 'dismissed']
        if status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Geçersiz durum. Geçerli: {valid_statuses}")
        
        await db.reports.update_one(
            {"id": report_id},
            {
                "$set": {
                    "status": status,
                    "action": action,
                    "adminNotes": notes,
                    "resolvedBy": current_user['uid'],
                    "resolvedAt": datetime.utcnow()
                }
            }
        )
        
        await log_security_event(db, current_user['uid'], "report_updated", {
            "reportId": report_id,
            "status": status,
            "action": action
        })
        
        return {"message": "Rapor güncellendi"}
    
    # ==================== GÜVENLİK LOGLARI ====================
    
    @security_router.get("/logs")
    async def get_security_logs(current_user: dict = Depends(get_current_user), limit: int = 50):
        """Kullanıcının güvenlik loglarını getir"""
        logs = await db.security_logs.find(
            {"userId": current_user['uid']}
        ).sort("timestamp", -1).limit(limit).to_list(limit)
        
        for log in logs:
            if '_id' in log:
                del log['_id']
        
        return logs
    
    @security_router.get("/logs/admin")
    async def get_all_security_logs(current_user: dict = Depends(get_current_user), limit: int = 100, event_type: str = None):
        """Tüm güvenlik loglarını getir (sadece admin)"""
        user = await db.users.find_one({"uid": current_user['uid']})
        if not user.get('isAdmin'):
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
        
        query = {}
        if event_type:
            query["eventType"] = event_type
        
        logs = await db.security_logs.find(query).sort("timestamp", -1).limit(limit).to_list(limit)
        
        for log in logs:
            if '_id' in log:
                del log['_id']
        
        return logs
    
    @security_router.get("/logs/suspicious")
    async def get_suspicious_activities(current_user: dict = Depends(get_current_user)):
        """Şüpheli aktiviteleri getir (sadece admin)"""
        user = await db.users.find_one({"uid": current_user['uid']})
        if not user.get('isAdmin'):
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
        
        suspicious_events = [
            "2fa_verify_failed",
            "2fa_login_failed", 
            "login_failed",
            "rate_limit_exceeded",
            "unauthorized_access"
        ]
        
        # Son 24 saatteki şüpheli aktiviteler
        since = datetime.utcnow() - timedelta(hours=24)
        
        logs = await db.security_logs.find({
            "eventType": {"$in": suspicious_events},
            "timestamp": {"$gte": since}
        }).sort("timestamp", -1).to_list(500)
        
        for log in logs:
            if '_id' in log:
                del log['_id']
        
        # Kullanıcı bazlı grupla
        user_counts = {}
        for log in logs:
            uid = log.get('userId', 'unknown')
            if uid not in user_counts:
                user_counts[uid] = {"count": 0, "events": []}
            user_counts[uid]["count"] += 1
            user_counts[uid]["events"].append(log.get('eventType'))
        
        return {
            "totalSuspicious": len(logs),
            "byUser": user_counts,
            "recentLogs": logs[:50]
        }
    
    return security_router


async def log_security_event(db, user_id: str, event_type: str, metadata: dict, request: Request = None):
    """Güvenlik olayını logla"""
    log_entry = {
        "id": str(uuid.uuid4()),
        "userId": user_id,
        "eventType": event_type,
        "metadata": metadata,
        "timestamp": datetime.utcnow()
    }
    
    if request:
        log_entry["ip"] = request.client.host if request.client else None
        log_entry["userAgent"] = request.headers.get("user-agent")
    
    await db.security_logs.insert_one(log_entry)
    return log_entry


# ==================== MESAJ ŞİFRELEME FONKSİYONLARI ====================

async def encrypt_chat_message(message: str) -> str:
    """Sohbet mesajını şifrele"""
    return encrypt_message(message)

async def decrypt_chat_message(encrypted_message: str) -> str:
    """Şifreli sohbet mesajını çöz"""
    return decrypt_message(encrypted_message)
