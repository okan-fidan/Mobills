from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
import uuid
from typing import List, Optional

badges_router = APIRouter(prefix="/badges", tags=["badges"])

# Badge tanımları
BADGE_DEFINITIONS = {
    "early_adopter": {
        "id": "early_adopter",
        "name": "Erken Kuş",
        "description": "Platformun ilk 100 kullanıcısından biri",
        "icon": "🐦",
        "color": "#f59e0b",
        "category": "special",
        "points": 100
    },
    "community_founder": {
        "id": "community_founder",
        "name": "Topluluk Kurucusu",
        "description": "Bir topluluk oluşturdu",
        "icon": "🏆",
        "color": "#6366f1",
        "category": "community",
        "points": 200
    },
    "active_member": {
        "id": "active_member",
        "name": "Aktif Üye",
        "description": "30 gün boyunca aktif kaldı",
        "icon": "⭐",
        "color": "#10b981",
        "category": "activity",
        "points": 150
    },
    "helper": {
        "id": "helper",
        "name": "Yardımsever",
        "description": "10 kişiye yardım etti",
        "icon": "🤝",
        "color": "#ec4899",
        "category": "social",
        "points": 100
    },
    "networker": {
        "id": "networker",
        "name": "Ağ Kurucu",
        "description": "50+ bağlantı kurdu",
        "icon": "🔗",
        "color": "#8b5cf6",
        "category": "social",
        "points": 250
    },
    "event_organizer": {
        "id": "event_organizer",
        "name": "Etkinlik Organizatörü",
        "description": "5 etkinlik düzenledi",
        "icon": "📅",
        "color": "#14b8a6",
        "category": "events",
        "points": 200
    },
    "top_contributor": {
        "id": "top_contributor",
        "name": "En İyi Katkıcı",
        "description": "Ayın en çok katkı sağlayan üyesi",
        "icon": "🏅",
        "color": "#f97316",
        "category": "special",
        "points": 500
    },
    "verified_business": {
        "id": "verified_business",
        "name": "Onaylı İşletme",
        "description": "İşletme bilgileri doğrulandı",
        "icon": "✅",
        "color": "#22c55e",
        "category": "business",
        "points": 300
    },
    "mentor": {
        "id": "mentor",
        "name": "Mentor",
        "description": "5+ kişiye mentorluk yaptı",
        "icon": "🎓",
        "color": "#3b82f6",
        "category": "mentorship",
        "points": 400
    },
    "first_post": {
        "id": "first_post",
        "name": "İlk Adım",
        "description": "İlk gönderisini paylaştı",
        "icon": "📝",
        "color": "#a855f7",
        "category": "activity",
        "points": 50
    },
    "messenger": {
        "id": "messenger",
        "name": "Sohbetçi",
        "description": "100+ mesaj gönderdi",
        "icon": "💬",
        "color": "#06b6d4",
        "category": "activity",
        "points": 75
    },
    "service_provider": {
        "id": "service_provider",
        "name": "Hizmet Sağlayıcı",
        "description": "Hizmet sunmaya başladı",
        "icon": "💼",
        "color": "#84cc16",
        "category": "business",
        "points": 100
    }
}

def setup_badges_routes(db, get_current_user, check_global_admin):
    
    @badges_router.get("/definitions")
    async def get_badge_definitions():
        """Tüm rozet tanımlarını döner"""
        return list(BADGE_DEFINITIONS.values())
    
    @badges_router.get("/my-badges")
    async def get_my_badges(current_user: dict = Depends(get_current_user)):
        """Kullanıcının rozetlerini döner"""
        user = await db.users.find_one({"uid": current_user['uid']})
        if not user:
            return {"badges": [], "totalPoints": 0}
        
        user_badges = user.get('badges', [])
        badges_with_details = []
        total_points = 0
        
        for badge_id in user_badges:
            if badge_id in BADGE_DEFINITIONS:
                badge = BADGE_DEFINITIONS[badge_id].copy()
                badges_with_details.append(badge)
                total_points += badge.get('points', 0)
        
        return {
            "badges": badges_with_details,
            "totalPoints": total_points,
            "level": calculate_level(total_points)
        }
    
    @badges_router.get("/user/{user_id}")
    async def get_user_badges(user_id: str, current_user: dict = Depends(get_current_user)):
        """Belirli bir kullanıcının rozetlerini döner"""
        user = await db.users.find_one({"uid": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
        
        user_badges = user.get('badges', [])
        badges_with_details = []
        total_points = 0
        
        for badge_id in user_badges:
            if badge_id in BADGE_DEFINITIONS:
                badge = BADGE_DEFINITIONS[badge_id].copy()
                badges_with_details.append(badge)
                total_points += badge.get('points', 0)
        
        return {
            "badges": badges_with_details,
            "totalPoints": total_points,
            "level": calculate_level(total_points)
        }
    
    @badges_router.post("/award/{user_id}/{badge_id}")
    async def award_badge(user_id: str, badge_id: str, current_user: dict = Depends(get_current_user)):
        """Kullanıcıya rozet ver (sadece admin)"""
        if not await check_global_admin(current_user):
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekiyor")
        
        if badge_id not in BADGE_DEFINITIONS:
            raise HTTPException(status_code=400, detail="Geçersiz rozet ID")
        
        user = await db.users.find_one({"uid": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
        
        # Rozeti ekle
        result = await db.users.update_one(
            {"uid": user_id},
            {"$addToSet": {"badges": badge_id}}
        )
        
        # Bildirim oluştur
        notification = {
            "id": str(uuid.uuid4()),
            "userId": user_id,
            "type": "badge_earned",
            "title": "Yeni Rozet Kazandınız!",
            "message": f"{BADGE_DEFINITIONS[badge_id]['icon']} {BADGE_DEFINITIONS[badge_id]['name']} rozeti kazandınız!",
            "data": {"badgeId": badge_id},
            "isRead": False,
            "timestamp": datetime.utcnow()
        }
        await db.notifications.insert_one(notification)
        
        return {"message": "Rozet verildi", "badge": BADGE_DEFINITIONS[badge_id]}
    
    @badges_router.delete("/revoke/{user_id}/{badge_id}")
    async def revoke_badge(user_id: str, badge_id: str, current_user: dict = Depends(get_current_user)):
        """Kullanıcıdan rozet al (sadece admin)"""
        if not await check_global_admin(current_user):
            raise HTTPException(status_code=403, detail="Admin yetkisi gerekiyor")
        
        await db.users.update_one(
            {"uid": user_id},
            {"$pull": {"badges": badge_id}}
        )
        
        return {"message": "Rozet alındı"}
    
    @badges_router.get("/leaderboard")
    async def get_leaderboard(current_user: dict = Depends(get_current_user)):
        """En çok puana sahip kullanıcıları döner"""
        users = await db.users.find({"badges": {"$exists": True, "$ne": []}}).to_list(100)
        
        leaderboard = []
        for user in users:
            total_points = 0
            for badge_id in user.get('badges', []):
                if badge_id in BADGE_DEFINITIONS:
                    total_points += BADGE_DEFINITIONS[badge_id].get('points', 0)
            
            if total_points > 0:
                leaderboard.append({
                    "uid": user['uid'],
                    "name": f"{user.get('firstName', '')} {user.get('lastName', '')}".strip(),
                    "profileImageUrl": user.get('profileImageUrl'),
                    "totalPoints": total_points,
                    "level": calculate_level(total_points),
                    "badgeCount": len(user.get('badges', []))
                })
        
        # Puana göre sırala
        leaderboard.sort(key=lambda x: x['totalPoints'], reverse=True)
        
        return leaderboard[:50]
    
    return badges_router

def calculate_level(points: int) -> dict:
    """Puana göre seviye hesapla"""
    levels = [
        {"level": 1, "name": "Başlangıç", "minPoints": 0, "maxPoints": 100},
        {"level": 2, "name": "Bronz", "minPoints": 100, "maxPoints": 300},
        {"level": 3, "name": "Gümüş", "minPoints": 300, "maxPoints": 600},
        {"level": 4, "name": "Altın", "minPoints": 600, "maxPoints": 1000},
        {"level": 5, "name": "Platin", "minPoints": 1000, "maxPoints": 1500},
        {"level": 6, "name": "Elmas", "minPoints": 1500, "maxPoints": 2500},
        {"level": 7, "name": "Efsane", "minPoints": 2500, "maxPoints": float('inf')},
    ]
    
    for lvl in levels:
        if lvl['minPoints'] <= points < lvl['maxPoints']:
            progress = (points - lvl['minPoints']) / (lvl['maxPoints'] - lvl['minPoints']) if lvl['maxPoints'] != float('inf') else 1
            return {
                "level": lvl['level'],
                "name": lvl['name'],
                "points": points,
                "nextLevelPoints": lvl['maxPoints'] if lvl['maxPoints'] != float('inf') else None,
                "progress": min(progress, 1)
            }
    
    return levels[-1]
