from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
from firebase_config import verify_firebase_token
import socketio
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'network_solution')]

# Socket.IO setup
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# Admin email - Ana yönetici
ADMIN_EMAIL = "metaticaretim@gmail.com"

# Default subgroups for each community
DEFAULT_SUBGROUPS = [
    {"name": "Start", "description": "Yeni başlayanlar için başlangıç grubu", "isPublic": False},
    {"name": "Gelişim", "description": "Gelişim odaklı girişimciler grubu", "isPublic": False},
    {"name": "Değerlendirme", "description": "Performans ve ilerleme değerlendirme grubu", "isPublic": False},
    {"name": "Mastermind", "description": "İleri seviye girişimciler için mastermind grubu", "isPublic": False},
]

# Turkish Cities List
TURKISH_CITIES = [
    'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Aksaray', 'Amasya', 'Ankara', 'Antalya',
    'Ardahan', 'Artvin', 'Aydın', 'Balıkesir', 'Bartın', 'Batman', 'Bayburt', 'Bilecik',
    'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa', 'Çanakkale', 'Çankırı', 'Çorum',
    'Denizli', 'Diyarbakır', 'Düzce', 'Edirne', 'Elazığ', 'Erzincan', 'Erzurum', 'Eskişehir',
    'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari', 'Hatay', 'Iğdır', 'Isparta', 'İstanbul',
    'İzmir', 'Kahramanmaraş', 'Karabük', 'Karaman', 'Kars', 'Kastamonu', 'Kayseri', 'Kilis',
    'Kırıkkale', 'Kırklareli', 'Kırşehir', 'Kocaeli', 'Konya', 'Kütahya', 'Malatya', 'Manisa',
    'Mardin', 'Mersin', 'Muğla', 'Muş', 'Nevşehir', 'Niğde', 'Ordu', 'Osmaniye',
    'Rize', 'Sakarya', 'Samsun', 'Şanlıurfa', 'Siirt', 'Sinop', 'Sivas', 'Şırnak',
    'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Uşak', 'Van', 'Yalova', 'Yozgat', 'Zonguldak'
]

# Dependency to verify Firebase token
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        decoded_token = verify_firebase_token(token)
        return decoded_token
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

# Check if user is global admin
async def check_global_admin(current_user: dict):
    user = await db.users.find_one({"uid": current_user['uid']})
    if not user:
        return False
    return user.get('isAdmin', False) or user.get('email', '').lower() == ADMIN_EMAIL.lower()

# Create default subgroups for a community
async def create_default_subgroups(community_id: str, community_name: str, creator_uid: str = "system"):
    subgroup_ids = []
    for sg_data in DEFAULT_SUBGROUPS:
        subgroup_id = str(uuid.uuid4())
        new_subgroup = {
            "id": subgroup_id,
            "communityId": community_id,
            "name": f"{community_name} - {sg_data['name']}",
            "description": sg_data['description'],
            "imageUrl": None,
            "groupAdmins": [],
            "members": [],
            "bannedUsers": [],
            "restrictedUsers": [],
            "pinnedMessages": [],
            "pendingRequests": [],
            "isPublic": sg_data['isPublic'],
            "requiresApproval": True,
            "createdBy": creator_uid,
            "createdByName": "System",
            "createdAt": datetime.utcnow()
        }
        await db.subgroups.insert_one(new_subgroup)
        subgroup_ids.append(subgroup_id)
    return subgroup_ids

# Initialize city communities
async def initialize_city_communities():
    for city in TURKISH_CITIES:
        existing = await db.communities.find_one({"city": city})
        if not existing:
            announcement_id = str(uuid.uuid4())
            community_id = str(uuid.uuid4())
            community = {
                "id": community_id,
                "name": f"{city} Girişimciler",
                "description": f"{city} ilindeki girişimcilerin buluşma noktası",
                "city": city,
                "imageUrl": None,
                "superAdmins": [],
                "members": [],
                "subGroups": [],
                "bannedUsers": [],
                "restrictedUsers": [],
                "announcementChannelId": announcement_id,
                "createdBy": "system",
                "createdByName": "System",
                "createdAt": datetime.utcnow()
            }
            await db.communities.insert_one(community)
            
            # Create default subgroups
            subgroup_ids = await create_default_subgroups(community_id, f"{city} Girişimciler")
            await db.communities.update_one(
                {"id": community_id},
                {"$set": {"subGroups": subgroup_ids}}
            )
        else:
            # Mevcut topluluğun alt gruplarını kontrol et
            existing_subgroups = await db.subgroups.find({"communityId": existing['id']}).to_list(20)
            existing_names = {sg.get('name', '') for sg in existing_subgroups}

            missing_default_subgroups = []
            for sg_data in DEFAULT_SUBGROUPS:
                full_name = f"{existing['name']} - {sg_data['name']}"
                if full_name not in existing_names:
                    missing_default_subgroups.append(sg_data)

            if missing_default_subgroups:
                # Sadece eksik olan default grupları oluştur
                subgroup_ids = []
                for sg_data in missing_default_subgroups:
                    subgroup_id = str(uuid.uuid4())
                    new_subgroup = {
                        "id": subgroup_id,
                        "communityId": existing['id'],
                        "name": f"{existing['name']} - {sg_data['name']}",
                        "description": sg_data['description'],
                        "imageUrl": None,
                        "groupAdmins": [],
                        "members": [],
                        "bannedUsers": [],
                        "restrictedUsers": [],
                        "pinnedMessages": [],
                        "pendingRequests": [],
                        "isPublic": sg_data['isPublic'],
                        "requiresApproval": True,
                        "createdBy": "system",
                        "createdByName": "System",
                        "createdAt": datetime.utcnow()
                    }
                    await db.subgroups.insert_one(new_subgroup)
                    subgroup_ids.append(subgroup_id)

                if subgroup_ids:
                    await db.communities.update_one(
                        {"id": existing['id']},
                        {"$addToSet": {"subGroups": {"$each": subgroup_ids}}}
                    )

# Ensure admin is in all communities
async def ensure_admin_in_all_communities():
    admin_user = await db.users.find_one({"email": {"$regex": f"^{ADMIN_EMAIL}$", "$options": "i"}})
    if admin_user:
        await db.communities.update_many(
            {},
            {"$addToSet": {"superAdmins": admin_user['uid'], "members": admin_user['uid']}}
        )
        await db.users.update_one(
            {"uid": admin_user['uid']},
            {"$set": {"isAdmin": True}}
        )
        # Admin'i tüm alt gruplara da admin ve üye olarak ekle
        await db.subgroups.update_many(
            {},
            {"$addToSet": {"groupAdmins": admin_user['uid'], "members": admin_user['uid']}}
        )

# Routes
@api_router.get("/")
async def root():
    return {"message": "Network Solution API"}

@api_router.get("/cities")
async def get_cities():
    return {"cities": TURKISH_CITIES}

@api_router.post("/user/register")
async def register_user(user_data: dict, current_user: dict = Depends(get_current_user)):
    existing_user = await db.users.find_one({"uid": current_user['uid']})
    if existing_user:
        if '_id' in existing_user:
            del existing_user['_id']
        return existing_user

    email = user_data.get('email', '')
    is_admin = email.lower() == ADMIN_EMAIL.lower()
    user_communities = []

    # Şehre göre topluluk ataması
    city = user_data.get('city', '')
    city_community = await db.communities.find_one({"city": city})
    if city_community:
        user_communities.append(city_community['id'])
        await db.communities.update_one(
            {"id": city_community['id']},
            {"$addToSet": {"members": current_user['uid']}}
        )

    # Admin ise tüm topluluklara süper admin olarak ekle
    if is_admin:
        all_communities = await db.communities.find().to_list(100)
        for community in all_communities:
            if community['id'] not in user_communities:
                user_communities.append(community['id'])
            await db.communities.update_one(
                {"id": community['id']},
                {"$addToSet": {"superAdmins": current_user['uid'], "members": current_user['uid']}}
            )

    user_profile = {
        "uid": current_user['uid'],
        "email": email,
        "firstName": user_data.get('firstName', ''),
        "lastName": user_data.get('lastName', ''),
        "phone": user_data.get('phone'),
        "city": city,
        "occupation": user_data.get('occupation'),
        "profileImageUrl": None,
        "isAdmin": is_admin,
        "isBanned": False,
        "isRestricted": False,
        "restrictedUntil": None,
        "communities": user_communities,
        "createdAt": datetime.utcnow()
    }

    await db.users.insert_one(user_profile)
    
    if '_id' in user_profile:
        del user_profile['_id']
    return user_profile

@api_router.get("/user/profile")
async def get_user_profile(current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"uid": current_user['uid']})
    if not user:
        return {
            "uid": current_user['uid'],
            "email": current_user.get('email', ''),
            "firstName": "",
            "lastName": "",
            "phone": None,
            "city": "",
            "profileImageUrl": None,
            "isAdmin": False,
            "communities": [],
            "needsRegistration": True
        }
    if '_id' in user:
        del user['_id']
    return user

@api_router.put("/user/profile")
async def update_user_profile(updates: dict, current_user: dict = Depends(get_current_user)):
    allowed_fields = ['firstName', 'lastName', 'phone', 'city', 'occupation', 'profileImageUrl']
    filtered_updates = {k: v for k, v in updates.items() if k in allowed_fields}
    await db.users.update_one(
        {"uid": current_user['uid']},
        {"$set": filtered_updates}
    )
    return {"message": "Profile updated"}

@api_router.get("/user/is-admin")
async def check_user_admin(current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"uid": current_user['uid']})
    is_admin = user.get('isAdmin', False) if user else False
    if user and user.get('email', '').lower() == ADMIN_EMAIL.lower():
        is_admin = True
    return {"isAdmin": is_admin}

@api_router.post("/user/push-token")
async def save_push_token(data: dict, current_user: dict = Depends(get_current_user)):
    """Push notification token'ını kaydet"""
    token = data.get('token')
    if not token:
        raise HTTPException(status_code=400, detail="Token gerekli")
    
    await db.users.update_one(
        {"uid": current_user['uid']},
        {"$set": {"pushToken": token, "pushTokenUpdatedAt": datetime.utcnow()}}
    )
    return {"message": "Push token kaydedildi"}

@api_router.delete("/user/push-token")
async def remove_push_token(current_user: dict = Depends(get_current_user)):
    """Push notification token'ını sil"""
    await db.users.update_one(
        {"uid": current_user['uid']},
        {"$unset": {"pushToken": "", "pushTokenUpdatedAt": ""}}
    )
    return {"message": "Push token silindi"}

# ==================== COMMUNITIES ====================

@api_router.get("/communities")
async def get_communities(current_user: dict = Depends(get_current_user)):
    communities = await db.communities.find().sort("name", 1).to_list(100)
    for c in communities:
        if '_id' in c:
            del c['_id']
        c['memberCount'] = len(c.get('members', []))
        c['isMember'] = current_user['uid'] in c.get('members', [])
        c['isSuperAdmin'] = current_user['uid'] in c.get('superAdmins', [])
    return communities

@api_router.get("/communities/{community_id}")
async def get_community(community_id: str, current_user: dict = Depends(get_current_user)):
    community = await db.communities.find_one({"id": community_id})
    if not community:
        raise HTTPException(status_code=404, detail="Topluluk bulunamadı")
    
    if '_id' in community:
        del community['_id']
    
    community['memberCount'] = len(community.get('members', []))
    community['isMember'] = current_user['uid'] in community.get('members', [])
    community['isSuperAdmin'] = current_user['uid'] in community.get('superAdmins', [])
    
    # Check global admin
    user = await db.users.find_one({"uid": current_user['uid']})
    if user and (user.get('isAdmin') or user.get('email', '').lower() == ADMIN_EMAIL.lower()):
        community['isSuperAdmin'] = True
    
    subgroups = await db.subgroups.find({"communityId": community_id}).to_list(100)
    for sg in subgroups:
        if '_id' in sg:
            del sg['_id']
        sg['memberCount'] = len(sg.get('members', []))
        sg['isMember'] = current_user['uid'] in sg.get('members', [])
        sg['hasPendingRequest'] = any(r.get('uid') == current_user['uid'] for r in sg.get('pendingRequests', []))
    
    community['subGroupsList'] = subgroups
    return community

@api_router.post("/communities/{community_id}/join")
async def join_community(community_id: str, current_user: dict = Depends(get_current_user)):
    community = await db.communities.find_one({"id": community_id})
    if not community:
        raise HTTPException(status_code=404, detail="Topluluk bulunamadı")

    # Check if banned
    if current_user['uid'] in community.get('bannedUsers', []):
        raise HTTPException(status_code=403, detail="Bu topluluktan yasaklandınız")

    await db.communities.update_one(
        {"id": community_id},
        {"$addToSet": {"members": current_user['uid']}}
    )
    await db.users.update_one(
        {"uid": current_user['uid']},
        {"$addToSet": {"communities": community_id}}
    )
    return {"message": "Topluluğa katıldınız. Duyuru kanalına otomatik eklendiniz."}

@api_router.post("/communities/{community_id}/leave")
async def leave_community(community_id: str, current_user: dict = Depends(get_current_user)):
    community = await db.communities.find_one({"id": community_id})
    if not community:
        raise HTTPException(status_code=404, detail="Topluluk bulunamadı")

    user = await db.users.find_one({"uid": current_user['uid']})
    is_global_admin = user.get('isAdmin', False) or user.get('email', '').lower() == ADMIN_EMAIL.lower()
    
    if is_global_admin:
        raise HTTPException(status_code=400, detail="Global yönetici topluluktan ayrılamaz")

    await db.communities.update_one(
        {"id": community_id},
        {"$pull": {"members": current_user['uid'], "superAdmins": current_user['uid']}}
    )
    await db.users.update_one(
        {"uid": current_user['uid']},
        {"$pull": {"communities": community_id}}
    )
    
    # Also remove from all subgroups of this community
    await db.subgroups.update_many(
        {"communityId": community_id},
        {"$pull": {"members": current_user['uid'], "groupAdmins": current_user['uid']}}
    )
    
    return {"message": "Topluluktan ayrıldınız"}

# ==================== SUBGROUPS ====================

# Subgroup katılım istekleri için ayrı koleksiyon şeması (bilgi amaçlı)
# subgroup_join_requests:
#   - id
#   - communityId
#   - subgroupId
#   - subgroupName
#   - userId
#   - status: pending | approved | rejected
#   - createdAt
#   - updatedAt


@api_router.post("/communities/{community_id}/subgroups")
async def create_subgroup(community_id: str, subgroup_data: dict, current_user: dict = Depends(get_current_user)):
    community = await db.communities.find_one({"id": community_id})
    if not community:
        raise HTTPException(status_code=404, detail="Topluluk bulunamadı")

    user = await db.users.find_one({"uid": current_user['uid']})
    is_super_admin = current_user['uid'] in community.get('superAdmins', [])
    is_global_admin = user.get('isAdmin', False) or user.get('email', '').lower() == ADMIN_EMAIL.lower()

    if not is_super_admin and not is_global_admin:
        raise HTTPException(status_code=403, detail="Bu işlem için süper yönetici yetkisi gerekiyor")

    subgroup_id = str(uuid.uuid4())
    new_subgroup = {
        "id": subgroup_id,
        "communityId": community_id,
        "name": subgroup_data['name'],
        "description": subgroup_data.get('description', ''),
        "imageUrl": subgroup_data.get('imageUrl'),
        "groupAdmins": [current_user['uid']],
        "members": [current_user['uid']],
        "bannedUsers": [],
        "restrictedUsers": [],
        "pinnedMessages": [],
        "pendingRequests": [],
        "isPublic": subgroup_data.get('isPublic', True),
        "requiresApproval": subgroup_data.get('requiresApproval', True),
        "createdBy": current_user['uid'],
        "createdByName": f"{user['firstName']} {user['lastName']}",
        "createdAt": datetime.utcnow()
    }

    await db.subgroups.insert_one(new_subgroup)
    await db.communities.update_one(
        {"id": community_id},
        {"$addToSet": {"subGroups": subgroup_id}}
    )

    if '_id' in new_subgroup:
        del new_subgroup['_id']
    return new_subgroup

@api_router.get("/subgroups/{subgroup_id}")
async def get_subgroup(subgroup_id: str, current_user: dict = Depends(get_current_user)):
    subgroup = await db.subgroups.find_one({"id": subgroup_id})
    if not subgroup:
        raise HTTPException(status_code=404, detail="Alt grup bulunamadı")

    if '_id' in subgroup:
        del subgroup['_id']

    subgroup['memberCount'] = len(subgroup.get('members', []))
    subgroup['isMember'] = current_user['uid'] in subgroup.get('members', [])
    subgroup['isGroupAdmin'] = current_user['uid'] in subgroup.get('groupAdmins', [])
    subgroup['hasPendingRequest'] = any(r.get('uid') == current_user['uid'] for r in subgroup.get('pendingRequests', []))

    community = await db.communities.find_one({"id": subgroup['communityId']})
    if community:
        subgroup['communityName'] = community['name']
        subgroup['isSuperAdmin'] = current_user['uid'] in community.get('superAdmins', [])
        
    # Check global admin
    user = await db.users.find_one({"uid": current_user['uid']})
    if user and (user.get('isAdmin') or user.get('email', '').lower() == ADMIN_EMAIL.lower()):
        subgroup['isSuperAdmin'] = True
        subgroup['isGroupAdmin'] = True

    return subgroup

# Request to join subgroup
@api_router.post("/subgroups/{subgroup_id}/request-join")
async def request_join_subgroup(subgroup_id: str, current_user: dict = Depends(get_current_user)):
    subgroup = await db.subgroups.find_one({"id": subgroup_id})
    if not subgroup:
        raise HTTPException(status_code=404, detail="Alt grup bulunamadı")

    if current_user['uid'] in subgroup.get('bannedUsers', []):
        raise HTTPException(status_code=403, detail="Bu gruptan yasaklandınız")

    if current_user['uid'] in subgroup.get('members', []):
        raise HTTPException(status_code=400, detail="Zaten bu grubun üyesisiniz")

    # Check if already has pending request
    pending = subgroup.get('pendingRequests', [])
    if any(r.get('uid') == current_user['uid'] for r in pending):
        raise HTTPException(status_code=400, detail="Zaten katılma isteğiniz var")

    # Check if requires approval
    if subgroup.get('requiresApproval', True):
        user = await db.users.find_one({"uid": current_user['uid']})
        request = {
            "uid": current_user['uid'],
            "name": f"{user['firstName']} {user['lastName']}",
            "profileImageUrl": user.get('profileImageUrl'),
            "requestedAt": datetime.utcnow()
        }
        await db.subgroups.update_one(
            {"id": subgroup_id},
            {"$push": {"pendingRequests": request}}
        )
        return {"message": "Katılma isteği gönderildi. Yönetici onayı bekleniyor.", "status": "pending"}
    else:
        # Direct join if no approval required
        await db.subgroups.update_one(
            {"id": subgroup_id},
            {"$addToSet": {"members": current_user['uid']}}
        )
        return {"message": "Gruba katıldınız", "status": "joined"}

# Approve join request
@api_router.post("/subgroups/{subgroup_id}/approve/{user_id}")
async def approve_join_request(subgroup_id: str, user_id: str, current_user: dict = Depends(get_current_user)):
    subgroup = await db.subgroups.find_one({"id": subgroup_id})
    if not subgroup:
        raise HTTPException(status_code=404, detail="Alt grup bulunamadı")

    # Check if current user is admin
    user = await db.users.find_one({"uid": current_user['uid']})
    is_group_admin = current_user['uid'] in subgroup.get('groupAdmins', [])
    is_global_admin = user.get('isAdmin', False) or user.get('email', '').lower() == ADMIN_EMAIL.lower()
    
    community = await db.communities.find_one({"id": subgroup['communityId']})
    is_super_admin = current_user['uid'] in community.get('superAdmins', []) if community else False

    if not is_group_admin and not is_super_admin and not is_global_admin:
        raise HTTPException(status_code=403, detail="Bu işlem için yönetici yetkisi gerekiyor")

    # Remove from pending and add to members
    await db.subgroups.update_one(
        {"id": subgroup_id},
        {
            "$pull": {"pendingRequests": {"uid": user_id}},
            "$addToSet": {"members": user_id}
        }
    )

    return {"message": "Katılma isteği onaylandı"}

# Reject join request
@api_router.post("/subgroups/{subgroup_id}/reject/{user_id}")
async def reject_join_request(subgroup_id: str, user_id: str, current_user: dict = Depends(get_current_user)):
    subgroup = await db.subgroups.find_one({"id": subgroup_id})
    if not subgroup:
        raise HTTPException(status_code=404, detail="Alt grup bulunamadı")

    # Check if current user is admin
    user = await db.users.find_one({"uid": current_user['uid']})
    is_group_admin = current_user['uid'] in subgroup.get('groupAdmins', [])
    is_global_admin = user.get('isAdmin', False) or user.get('email', '').lower() == ADMIN_EMAIL.lower()
    
    community = await db.communities.find_one({"id": subgroup['communityId']})
    is_super_admin = current_user['uid'] in community.get('superAdmins', []) if community else False

    if not is_group_admin and not is_super_admin and not is_global_admin:
        raise HTTPException(status_code=403, detail="Bu işlem için yönetici yetkisi gerekiyor")

    await db.subgroups.update_one(
        {"id": subgroup_id},
        {"$pull": {"pendingRequests": {"uid": user_id}}}
    )

    return {"message": "Katılma isteği reddedildi"}

# Get pending requests
@api_router.get("/subgroups/{subgroup_id}/pending-requests")
async def get_pending_requests(subgroup_id: str, current_user: dict = Depends(get_current_user)):
    subgroup = await db.subgroups.find_one({"id": subgroup_id})
    if not subgroup:
        raise HTTPException(status_code=404, detail="Alt grup bulunamadı")

    # Check if current user is admin
    user = await db.users.find_one({"uid": current_user['uid']})
    is_group_admin = current_user['uid'] in subgroup.get('groupAdmins', [])
    is_global_admin = user.get('isAdmin', False) or user.get('email', '').lower() == ADMIN_EMAIL.lower()
    
    community = await db.communities.find_one({"id": subgroup['communityId']})
    is_super_admin = current_user['uid'] in community.get('superAdmins', []) if community else False

    if not is_group_admin and not is_super_admin and not is_global_admin:
        raise HTTPException(status_code=403, detail="Bu işlem için yönetici yetkisi gerekiyor")

    return subgroup.get('pendingRequests', [])

@api_router.post("/subgroups/{subgroup_id}/join")
async def join_subgroup(subgroup_id: str, current_user: dict = Depends(get_current_user)):
    subgroup = await db.subgroups.find_one({"id": subgroup_id})
    if not subgroup:
        raise HTTPException(status_code=404, detail="Alt grup bulunamadı")

    if current_user['uid'] in subgroup.get('bannedUsers', []):
        raise HTTPException(status_code=403, detail="Bu gruptan yasaklandınız")

    if current_user['uid'] in subgroup.get('members', []):
        raise HTTPException(status_code=400, detail="Zaten bu grubun üyesisiniz")

    # If requires approval, redirect to request-join
    if subgroup.get('requiresApproval', True):
        return await request_join_subgroup(subgroup_id, current_user)

    await db.subgroups.update_one(
        {"id": subgroup_id},
        {"$addToSet": {"members": current_user['uid']}}
    )
    return {"message": "Gruba katıldınız", "status": "joined"}

@api_router.post("/subgroups/{subgroup_id}/leave")
async def leave_subgroup(subgroup_id: str, current_user: dict = Depends(get_current_user)):
    await db.subgroups.update_one(
        {"id": subgroup_id},
        {"$pull": {"members": current_user['uid'], "groupAdmins": current_user['uid']}}
    )
    return {"message": "Gruptan ayrıldınız"}

# ==================== MESSAGES ====================

@api_router.get("/subgroups/{subgroup_id}/messages")
async def get_subgroup_messages(subgroup_id: str, current_user: dict = Depends(get_current_user)):
    messages = await db.messages.find({
        "groupId": subgroup_id,
        "deletedForEveryone": {"$ne": True}
    }).sort("timestamp", -1).limit(100).to_list(100)

    for msg in messages:
        if '_id' in msg:
            del msg['_id']
        if current_user['uid'] in msg.get('deletedFor', []):
            msg['isDeleted'] = True
            msg['content'] = 'Bu mesaj silindi'

    return messages

@api_router.post("/subgroups/{subgroup_id}/messages")
async def send_subgroup_message(subgroup_id: str, message_data: dict, current_user: dict = Depends(get_current_user)):
    subgroup = await db.subgroups.find_one({"id": subgroup_id})
    if not subgroup:
        raise HTTPException(status_code=404, detail="Alt grup bulunamadı")

    # Check if user is restricted
    restricted_users = subgroup.get('restrictedUsers', [])
    for restriction in restricted_users:
        if restriction.get('uid') == current_user['uid']:
            until = restriction.get('until')
            if until and until > datetime.utcnow():
                raise HTTPException(status_code=403, detail=f"Mesaj gönderme yetkiniz kısıtlandı")

    if current_user['uid'] not in subgroup.get('members', []):
        raise HTTPException(status_code=403, detail="Bu grubun üyesi değilsiniz")

    user = await db.users.find_one({"uid": current_user['uid']})

    new_message = {
        "id": str(uuid.uuid4()),
        "groupId": subgroup_id,
        "senderId": current_user['uid'],
        "senderName": f"{user['firstName']} {user['lastName']}",
        "senderProfileImage": user.get('profileImageUrl'),
        "content": message_data.get('content', ''),
        "type": message_data.get('type', 'text'),
        "mediaUrl": message_data.get('mediaUrl'),
        "replyTo": message_data.get('replyTo'),
        "reactions": {},
        "isPinned": False,
        "isDeleted": False,
        "deletedForEveryone": False,
        "deletedFor": [],
        "isEdited": False,
        "status": "sent",
        "deliveredTo": [],
        "readBy": [current_user['uid']],
        "timestamp": datetime.utcnow()
    }

    await db.messages.insert_one(new_message)
    
    if '_id' in new_message:
        del new_message['_id']
    
    await sio.emit('new_message', new_message, room=subgroup_id)
    return new_message

@api_router.delete("/subgroups/{subgroup_id}/messages/{message_id}")
async def delete_subgroup_message(subgroup_id: str, message_id: str, current_user: dict = Depends(get_current_user)):
    """Grup mesajını sil"""
    message = await db.messages.find_one({"id": message_id, "groupId": subgroup_id})
    if not message:
        raise HTTPException(status_code=404, detail="Mesaj bulunamadı")

    # Check if user owns the message
    if message['senderId'] != current_user['uid']:
        # Check if user is admin
        user = await db.users.find_one({"uid": current_user['uid']})
        is_global_admin = user.get('isAdmin', False) or user.get('email', '').lower() == ADMIN_EMAIL.lower()
        
        subgroup = await db.subgroups.find_one({"id": subgroup_id})
        is_group_admin = current_user['uid'] in subgroup.get('groupAdmins', []) if subgroup else False
        
        if not is_global_admin and not is_group_admin:
            raise HTTPException(status_code=403, detail="Bu mesajı silme yetkiniz yok")

    await db.messages.update_one(
        {"id": message_id},
        {"$set": {"deletedForEveryone": True, "content": "Bu mesaj silindi", "isDeleted": True}}
    )
    
    await sio.emit('message_deleted', {"messageId": message_id}, room=subgroup_id)
    return {"message": "Mesaj silindi"}

@api_router.put("/subgroups/{subgroup_id}/messages/{message_id}")
async def edit_subgroup_message(subgroup_id: str, message_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    """Grup mesajını düzenle"""
    message = await db.messages.find_one({"id": message_id, "groupId": subgroup_id})
    if not message:
        raise HTTPException(status_code=404, detail="Mesaj bulunamadı")

    # Only message owner can edit
    if message['senderId'] != current_user['uid']:
        raise HTTPException(status_code=403, detail="Sadece kendi mesajınızı düzenleyebilirsiniz")

    new_content = data.get('content', '').strip()
    if not new_content:
        raise HTTPException(status_code=400, detail="Mesaj içeriği boş olamaz")

    await db.messages.update_one(
        {"id": message_id},
        {"$set": {"content": new_content, "isEdited": True, "editedAt": datetime.utcnow()}}
    )
    
    await sio.emit('message_edited', {"messageId": message_id, "content": new_content}, room=subgroup_id)
    return {"message": "Mesaj düzenlendi"}

@api_router.delete("/messages/{message_id}")
async def delete_message(message_id: str, current_user: dict = Depends(get_current_user)):
    message = await db.messages.find_one({"id": message_id})
    if not message:
        raise HTTPException(status_code=404, detail="Mesaj bulunamadı")

    user = await db.users.find_one({"uid": current_user['uid']})
    is_global_admin = user.get('isAdmin', False) or user.get('email', '').lower() == ADMIN_EMAIL.lower()
    
    # Check group admin
    group_id = message.get('groupId')
    is_group_admin = False
    if group_id:
        subgroup = await db.subgroups.find_one({"id": group_id})
        if subgroup:
            is_group_admin = current_user['uid'] in subgroup.get('groupAdmins', [])

    if message['senderId'] != current_user['uid'] and not is_global_admin and not is_group_admin:
        raise HTTPException(status_code=403, detail="Bu mesajı silme yetkiniz yok")

    await db.messages.update_one(
        {"id": message_id},
        {"$set": {"deletedForEveryone": True, "content": "Bu mesaj silindi", "isDeleted": True}}
    )
    return {"message": "Mesaj silindi"}

# Update message status
@api_router.post("/messages/{message_id}/status")
async def update_message_status(message_id: str, status_data: dict, current_user: dict = Depends(get_current_user)):
    message = await db.messages.find_one({"id": message_id})
    if not message:
        raise HTTPException(status_code=404, detail="Mesaj bulunamadı")

    status = status_data.get('status')
    
    if status == 'delivered':
        await db.messages.update_one(
            {"id": message_id},
            {"$addToSet": {"deliveredTo": current_user['uid']}}
        )
    elif status == 'read':
        await db.messages.update_one(
            {"id": message_id},
            {"$addToSet": {"readBy": current_user['uid']}}
        )
    
    # Check if all members have read/received
    updated_message = await db.messages.find_one({"id": message_id})
    if '_id' in updated_message:
        del updated_message['_id']
    
    return updated_message

# ==================== PRIVATE MESSAGES / CHATS ====================

# Get chat list
@api_router.get("/chats")
async def get_chat_list(current_user: dict = Depends(get_current_user)):
    # Get all unique chat partners
    pipeline = [
        {
            "$match": {
                "$or": [
                    {"senderId": current_user['uid']},
                    {"receiverId": current_user['uid']}
                ],
                "chatId": {"$exists": True}
            }
        },
        {
            "$sort": {"timestamp": -1}
        },
        {
            "$group": {
                "_id": "$chatId",
                "lastMessage": {"$first": "$$ROOT"},
                "unreadCount": {
                    "$sum": {
                        "$cond": [
                            {
                                "$and": [
                                    {"$ne": ["$senderId", current_user['uid']]},
                                    {"$not": {"$in": [current_user['uid'], {"$ifNull": ["$readBy", []]}]}}
                                ]
                            },
                            1,
                            0
                        ]
                    }
                }
            }
        },
        {
            "$sort": {"lastMessage.timestamp": -1}
        }
    ]
    
    chats = await db.messages.aggregate(pipeline).to_list(100)
    
    result = []
    for chat in chats:
        chat_id = chat['_id']
        last_message = chat['lastMessage']
        
        # Get the other user
        other_user_id = last_message['receiverId'] if last_message['senderId'] == current_user['uid'] else last_message['senderId']
        other_user = await db.users.find_one({"uid": other_user_id})
        
        if other_user:
            result.append({
                "chatId": chat_id,
                "userId": other_user_id,
                "userName": f"{other_user['firstName']} {other_user['lastName']}",
                "userProfileImage": other_user.get('profileImageUrl'),
                "lastMessage": last_message['content'],
                "lastMessageTime": last_message['timestamp'].isoformat() if last_message.get('timestamp') else None,
                "lastMessageType": last_message.get('type', 'text'),
                "unreadCount": chat['unreadCount'],
                "isOnline": False  # Can be implemented with Socket.IO
            })
    
    return result

@api_router.get("/private-messages/{other_user_id}")
async def get_private_messages(other_user_id: str, current_user: dict = Depends(get_current_user)):
    user_ids = sorted([current_user['uid'], other_user_id])
    chat_id = f"{user_ids[0]}_{user_ids[1]}"

    messages = await db.messages.find({
        "chatId": chat_id,
        "deletedForEveryone": {"$ne": True}
    }).sort("timestamp", -1).limit(100).to_list(100)
    
    # Mark messages as read
    await db.messages.update_many(
        {
            "chatId": chat_id,
            "senderId": other_user_id,
            "readBy": {"$ne": current_user['uid']}
        },
        {"$addToSet": {"readBy": current_user['uid']}}
    )
    
    for msg in messages:
        if '_id' in msg:
            del msg['_id']
    return messages

@api_router.post("/private-messages")
async def send_private_message(message: dict, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"uid": current_user['uid']})
    receiver_id = message['receiverId']

    user_ids = sorted([current_user['uid'], receiver_id])
    chat_id = f"{user_ids[0]}_{user_ids[1]}"

    new_message = {
        "id": str(uuid.uuid4()),
        "chatId": chat_id,
        "senderId": current_user['uid'],
        "senderName": f"{user['firstName']} {user['lastName']}",
        "senderProfileImage": user.get('profileImageUrl'),
        "receiverId": receiver_id,
        "content": message.get('content', ''),
        "type": message.get('type', 'text'),
        "mediaUrl": message.get('mediaUrl'),
        "reactions": {},
        "isDeleted": False,
        "deletedForEveryone": False,
        "deletedFor": [],
        "status": "sent",
        "deliveredTo": [],
        "readBy": [current_user['uid']],
        "timestamp": datetime.utcnow()
    }

    await db.messages.insert_one(new_message)
    
    if '_id' in new_message:
        del new_message['_id']
    
    await sio.emit('new_private_message', new_message, room=chat_id)
    await sio.emit('new_private_message', new_message, room=f"user_{receiver_id}")
    return new_message

# Upload media
@api_router.post("/upload/media")
async def upload_media(media_data: dict, current_user: dict = Depends(get_current_user)):
    # Media is sent as base64
    base64_data = media_data.get('data')
    media_type = media_data.get('type', 'image')
    
    if not base64_data:
        raise HTTPException(status_code=400, detail="Medya verisi gerekli")
    
    # Store the base64 data directly (for simplicity)
    # In production, you'd upload to cloud storage
    return {
        "url": base64_data,
        "type": media_type
    }

# Typing indicator
@api_router.post("/typing")
async def typing_indicator(data: dict, current_user: dict = Depends(get_current_user)):
    room = data.get('room')  # chatId or groupId
    is_typing = data.get('isTyping', False)
    
    user = await db.users.find_one({"uid": current_user['uid']})
    
    await sio.emit('typing', {
        "userId": current_user['uid'],
        "userName": f"{user['firstName']} {user['lastName']}",
        "isTyping": is_typing
    }, room=room)
    
    return {"message": "OK"}

# ==================== USERS ====================

@api_router.get("/users")
async def get_users(current_user: dict = Depends(get_current_user)):
    users = await db.users.find({"uid": {"$ne": current_user['uid']}}).to_list(1000)
    for u in users:
        if '_id' in u:
            del u['_id']
    return users

@api_router.get("/users/{user_id}")
async def get_user(user_id: str, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"uid": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    if '_id' in user:
        del user['_id']
    return user

# ==================== POSTS ====================

@api_router.get("/posts")
async def get_posts(current_user: dict = Depends(get_current_user)):
    posts = await db.posts.find().sort("timestamp", -1).limit(50).to_list(50)
    for post in posts:
        if '_id' in post:
            del post['_id']
        post['isLiked'] = current_user['uid'] in post.get('likes', [])
        post['likeCount'] = len(post.get('likes', []))
        post['commentCount'] = len(post.get('comments', []))
    return posts

@api_router.post("/posts")
async def create_post(post: dict, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"uid": current_user['uid']})

    new_post = {
        "id": str(uuid.uuid4()),
        "userId": current_user['uid'],
        "userName": f"{user['firstName']} {user['lastName']}",
        "userProfileImage": user.get('profileImageUrl'),
        "content": post['content'],
        "imageUrl": post.get('imageUrl'),
        "likes": [],
        "comments": [],
        "shares": 0,
        "timestamp": datetime.utcnow()
    }

    await db.posts.insert_one(new_post)
    
    if '_id' in new_post:
        del new_post['_id']
    return new_post

@api_router.post("/posts/{post_id}/like")
async def toggle_like_post(post_id: str, current_user: dict = Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Gönderi bulunamadı")

    likes = post.get('likes', [])
    if current_user['uid'] in likes:
        await db.posts.update_one(
            {"id": post_id},
            {"$pull": {"likes": current_user['uid']}}
        )
        return {"liked": False, "likeCount": len(likes) - 1}
    else:
        await db.posts.update_one(
            {"id": post_id},
            {"$addToSet": {"likes": current_user['uid']}}
        )
        return {"liked": True, "likeCount": len(likes) + 1}

@api_router.get("/posts/{post_id}/comments")
async def get_post_comments(post_id: str, current_user: dict = Depends(get_current_user)):
    comments = await db.comments.find({"postId": post_id}).sort("timestamp", 1).to_list(100)
    for comment in comments:
        if '_id' in comment:
            del comment['_id']
    return comments

@api_router.post("/posts/{post_id}/comments")
async def add_comment(post_id: str, comment_data: dict, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"uid": current_user['uid']})

    new_comment = {
        "id": str(uuid.uuid4()),
        "postId": post_id,
        "userId": current_user['uid'],
        "userName": f"{user['firstName']} {user['lastName']}",
        "userProfileImage": user.get('profileImageUrl'),
        "content": comment_data['content'],
        "likes": [],
        "timestamp": datetime.utcnow()
    }

    await db.comments.insert_one(new_comment)
    await db.posts.update_one(
        {"id": post_id},
        {"$push": {"comments": {"id": new_comment['id'], "userId": current_user['uid']}}}
    )

    if '_id' in new_comment:
        del new_comment['_id']
    return new_comment

@api_router.delete("/posts/{post_id}")
async def delete_post(post_id: str, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"uid": current_user['uid']})
    is_global_admin = user.get('isAdmin', False) or user.get('email', '').lower() == ADMIN_EMAIL.lower()
    
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Gönderi bulunamadı")
        
    if post['userId'] != current_user['uid'] and not is_global_admin:
        raise HTTPException(status_code=403, detail="Bu gönderiyi silme yetkiniz yok")
        
    await db.posts.delete_one({"id": post_id})
    return {"message": "Gönderi silindi"}

@api_router.get("/my-posts")
async def get_my_posts(current_user: dict = Depends(get_current_user)):
    posts = await db.posts.find({"userId": current_user['uid']}).sort("timestamp", -1).to_list(100)
    for post in posts:
        if '_id' in post:
            del post['_id']
    return posts

# ==================== SERVICES ====================

@api_router.get("/services")
async def get_services(current_user: dict = Depends(get_current_user)):
    services = await db.services.find().sort("timestamp", -1).to_list(100)
    for service in services:
        if '_id' in service:
            del service['_id']
    return services

@api_router.post("/services")
async def create_service(service: dict, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"uid": current_user['uid']})

    new_service = {
        "id": str(uuid.uuid4()),
        "userId": current_user['uid'],
        "userName": f"{user['firstName']} {user['lastName']}",
        "title": service['title'],
        "description": service['description'],
        "category": service['category'],
        "city": user['city'],
        "contactPhone": user.get('phone', ''),
        "timestamp": datetime.utcnow()
    }

    await db.services.insert_one(new_service)
    
    if '_id' in new_service:
        del new_service['_id']
    return new_service

@api_router.delete("/services/{service_id}")
async def delete_service(service_id: str, current_user: dict = Depends(get_current_user)):
    service = await db.services.find_one({"id": service_id, "userId": current_user['uid']})
    if not service:
        raise HTTPException(status_code=404, detail="Hizmet bulunamadı")
    await db.services.delete_one({"id": service_id})
    return {"message": "Hizmet silindi"}

@api_router.get("/my-services")
async def get_my_services(current_user: dict = Depends(get_current_user)):
    """Kullanıcının kendi hizmetlerini döner"""
    services = await db.services.find({"userId": current_user['uid']}).sort("timestamp", -1).to_list(100)
    for service in services:
        if '_id' in service:
            del service['_id']
    return services

# ==================== NOTIFICATIONS ====================

@api_router.get("/notifications")
async def get_notifications(current_user: dict = Depends(get_current_user)):
    """Kullanıcının bildirimlerini döner"""
    notifications = await db.notifications.find({"userId": current_user['uid']}).sort("timestamp", -1).to_list(50)
    for notification in notifications:
        if '_id' in notification:
            del notification['_id']
    return notifications

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    """Bildirimi okundu olarak işaretler"""
    result = await db.notifications.update_one(
        {"id": notification_id, "userId": current_user['uid']},
        {"$set": {"isRead": True}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Bildirim bulunamadı")
    return {"message": "Bildirim okundu olarak işaretlendi"}

@api_router.put("/notifications/read-all")
async def mark_all_notifications_read(current_user: dict = Depends(get_current_user)):
    """Tüm bildirimleri okundu olarak işaretler"""
    await db.notifications.update_many(
        {"userId": current_user['uid'], "isRead": False},
        {"$set": {"isRead": True}}
    )
    return {"message": "Tüm bildirimler okundu olarak işaretlendi"}

# ==================== PINNED MESSAGES ====================

@api_router.post("/subgroups/{subgroup_id}/messages/{message_id}/pin")
async def pin_message(subgroup_id: str, message_id: str, current_user: dict = Depends(get_current_user)):
    """Mesajı sabitle"""
    subgroup = await db.subgroups.find_one({"id": subgroup_id})
    if not subgroup:
        raise HTTPException(status_code=404, detail="Grup bulunamadı")
    
    # Admin kontrolü
    user = await db.users.find_one({"uid": current_user['uid']})
    is_global_admin = user.get('isAdmin', False) or user.get('email', '').lower() == ADMIN_EMAIL.lower()
    is_group_admin = current_user['uid'] in subgroup.get('groupAdmins', [])
    
    if not is_global_admin and not is_group_admin:
        raise HTTPException(status_code=403, detail="Mesaj sabitleme yetkisi yok")
    
    message = await db.messages.find_one({"id": message_id, "groupId": subgroup_id})
    if not message:
        raise HTTPException(status_code=404, detail="Mesaj bulunamadı")
    
    await db.messages.update_one({"id": message_id}, {"$set": {"isPinned": True, "pinnedAt": datetime.utcnow()}})
    await sio.emit('message_pinned', {"messageId": message_id}, room=subgroup_id)
    return {"message": "Mesaj sabitlendi"}

@api_router.delete("/subgroups/{subgroup_id}/messages/{message_id}/pin")
async def unpin_message(subgroup_id: str, message_id: str, current_user: dict = Depends(get_current_user)):
    """Mesaj sabitlemesini kaldır"""
    subgroup = await db.subgroups.find_one({"id": subgroup_id})
    if not subgroup:
        raise HTTPException(status_code=404, detail="Grup bulunamadı")
    
    user = await db.users.find_one({"uid": current_user['uid']})
    is_global_admin = user.get('isAdmin', False) or user.get('email', '').lower() == ADMIN_EMAIL.lower()
    is_group_admin = current_user['uid'] in subgroup.get('groupAdmins', [])
    
    if not is_global_admin and not is_group_admin:
        raise HTTPException(status_code=403, detail="Mesaj sabitleme yetkisi yok")
    
    await db.messages.update_one({"id": message_id}, {"$set": {"isPinned": False}})
    await sio.emit('message_unpinned', {"messageId": message_id}, room=subgroup_id)
    return {"message": "Sabitleme kaldırıldı"}

@api_router.get("/subgroups/{subgroup_id}/pinned-messages")
async def get_pinned_messages(subgroup_id: str, current_user: dict = Depends(get_current_user)):
    """Sabitlenmiş mesajları getir"""
    messages = await db.messages.find({"groupId": subgroup_id, "isPinned": True}).sort("pinnedAt", -1).to_list(20)
    for msg in messages:
        if '_id' in msg:
            del msg['_id']
    return messages

# ==================== POLLS ====================

@api_router.post("/subgroups/{subgroup_id}/polls")
async def create_poll(subgroup_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    """Anket oluştur"""
    subgroup = await db.subgroups.find_one({"id": subgroup_id})
    if not subgroup:
        raise HTTPException(status_code=404, detail="Grup bulunamadı")
    
    if current_user['uid'] not in subgroup.get('memberIds', []):
        raise HTTPException(status_code=403, detail="Grup üyesi değilsiniz")
    
    user = await db.users.find_one({"uid": current_user['uid']})
    
    poll = {
        "id": str(uuid.uuid4()),
        "groupId": subgroup_id,
        "question": data.get('question', ''),
        "options": [{"id": str(uuid.uuid4()), "text": opt, "votes": []} for opt in data.get('options', [])],
        "creatorId": current_user['uid'],
        "creatorName": f"{user.get('firstName', '')} {user.get('lastName', '')}".strip(),
        "allowMultiple": data.get('allowMultiple', False),
        "isAnonymous": data.get('isAnonymous', False),
        "endsAt": data.get('endsAt'),
        "createdAt": datetime.utcnow().isoformat(),
        "isActive": True
    }
    
    await db.polls.insert_one(poll)
    del poll['_id']
    await sio.emit('new_poll', poll, room=subgroup_id)
    return poll

@api_router.get("/subgroups/{subgroup_id}/polls")
async def get_polls(subgroup_id: str, current_user: dict = Depends(get_current_user)):
    """Grup anketlerini getir"""
    polls = await db.polls.find({"groupId": subgroup_id, "isActive": True}).sort("createdAt", -1).to_list(20)
    for poll in polls:
        if '_id' in poll:
            del poll['_id']
    return polls

@api_router.post("/subgroups/{subgroup_id}/polls/{poll_id}/vote")
async def vote_poll(subgroup_id: str, poll_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    """Ankete oy ver"""
    poll = await db.polls.find_one({"id": poll_id, "groupId": subgroup_id})
    if not poll:
        raise HTTPException(status_code=404, detail="Anket bulunamadı")
    
    option_ids = data.get('optionIds', [])
    if not poll.get('allowMultiple') and len(option_ids) > 1:
        raise HTTPException(status_code=400, detail="Bu ankette tek seçim yapılabilir")
    
    # Önceki oyları kaldır
    for opt in poll['options']:
        if current_user['uid'] in opt['votes']:
            opt['votes'].remove(current_user['uid'])
    
    # Yeni oyları ekle
    for opt in poll['options']:
        if opt['id'] in option_ids:
            opt['votes'].append(current_user['uid'])
    
    await db.polls.update_one({"id": poll_id}, {"$set": {"options": poll['options']}})
    await sio.emit('poll_updated', {"pollId": poll_id, "options": poll['options']}, room=subgroup_id)
    return {"message": "Oyunuz kaydedildi"}

@api_router.delete("/subgroups/{subgroup_id}/polls/{poll_id}")
async def delete_poll(subgroup_id: str, poll_id: str, current_user: dict = Depends(get_current_user)):
    """Anketi sil"""
    poll = await db.polls.find_one({"id": poll_id, "groupId": subgroup_id})
    if not poll:
        raise HTTPException(status_code=404, detail="Anket bulunamadı")
    
    if poll['creatorId'] != current_user['uid']:
        user = await db.users.find_one({"uid": current_user['uid']})
        if not user.get('isAdmin'):
            raise HTTPException(status_code=403, detail="Bu anketi silme yetkiniz yok")
    
    await db.polls.delete_one({"id": poll_id})
    await sio.emit('poll_deleted', {"pollId": poll_id}, room=subgroup_id)
    return {"message": "Anket silindi"}

# ==================== MESSAGE SEARCH ====================

@api_router.get("/subgroups/{subgroup_id}/messages/search")
async def search_messages(subgroup_id: str, q: str, current_user: dict = Depends(get_current_user)):
    """Mesajlarda arama yap"""
    if not q or len(q) < 2:
        return []
    
    messages = await db.messages.find({
        "groupId": subgroup_id,
        "content": {"$regex": q, "$options": "i"},
        "isDeleted": {"$ne": True}
    }).sort("timestamp", -1).to_list(50)
    
    for msg in messages:
        if '_id' in msg:
            del msg['_id']
    return messages

# ==================== MODERATION ====================

@api_router.post("/subgroups/{subgroup_id}/members/{user_id}/mute")
async def mute_member(subgroup_id: str, user_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    """Üyeyi sustur"""
    subgroup = await db.subgroups.find_one({"id": subgroup_id})
    if not subgroup:
        raise HTTPException(status_code=404, detail="Grup bulunamadı")
    
    user = await db.users.find_one({"uid": current_user['uid']})
    is_global_admin = user.get('isAdmin', False) or user.get('email', '').lower() == ADMIN_EMAIL.lower()
    is_group_admin = current_user['uid'] in subgroup.get('groupAdmins', [])
    
    if not is_global_admin and not is_group_admin:
        raise HTTPException(status_code=403, detail="Moderasyon yetkisi yok")
    
    duration_minutes = data.get('duration', 60)  # Default 1 saat
    mute_until = datetime.utcnow() + timedelta(minutes=duration_minutes)
    
    muted_members = subgroup.get('mutedMembers', {})
    muted_members[user_id] = mute_until.isoformat()
    
    await db.subgroups.update_one({"id": subgroup_id}, {"$set": {"mutedMembers": muted_members}})
    return {"message": f"Üye {duration_minutes} dakika susturuldu", "muteUntil": mute_until.isoformat()}

@api_router.delete("/subgroups/{subgroup_id}/members/{user_id}/mute")
async def unmute_member(subgroup_id: str, user_id: str, current_user: dict = Depends(get_current_user)):
    """Susturmayı kaldır"""
    subgroup = await db.subgroups.find_one({"id": subgroup_id})
    if not subgroup:
        raise HTTPException(status_code=404, detail="Grup bulunamadı")
    
    user = await db.users.find_one({"uid": current_user['uid']})
    is_global_admin = user.get('isAdmin', False) or user.get('email', '').lower() == ADMIN_EMAIL.lower()
    is_group_admin = current_user['uid'] in subgroup.get('groupAdmins', [])
    
    if not is_global_admin and not is_group_admin:
        raise HTTPException(status_code=403, detail="Moderasyon yetkisi yok")
    
    await db.subgroups.update_one({"id": subgroup_id}, {"$unset": {f"mutedMembers.{user_id}": ""}})
    return {"message": "Susturma kaldırıldı"}

@api_router.post("/subgroups/{subgroup_id}/members/{user_id}/kick")
async def kick_member(subgroup_id: str, user_id: str, current_user: dict = Depends(get_current_user)):
    """Üyeyi gruptan çıkar"""
    subgroup = await db.subgroups.find_one({"id": subgroup_id})
    if not subgroup:
        raise HTTPException(status_code=404, detail="Grup bulunamadı")
    
    user = await db.users.find_one({"uid": current_user['uid']})
    is_global_admin = user.get('isAdmin', False) or user.get('email', '').lower() == ADMIN_EMAIL.lower()
    is_group_admin = current_user['uid'] in subgroup.get('groupAdmins', [])
    
    if not is_global_admin and not is_group_admin:
        raise HTTPException(status_code=403, detail="Moderasyon yetkisi yok")
    
    member_ids = subgroup.get('memberIds', [])
    if user_id in member_ids:
        member_ids.remove(user_id)
    
    await db.subgroups.update_one(
        {"id": subgroup_id}, 
        {"$set": {"memberIds": member_ids}, "$inc": {"memberCount": -1}}
    )
    return {"message": "Üye gruptan çıkarıldı"}

@api_router.post("/messages/{message_id}/report")
async def report_message(message_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    """Mesajı raporla"""
    message = await db.messages.find_one({"id": message_id})
    if not message:
        raise HTTPException(status_code=404, detail="Mesaj bulunamadı")
    
    report = {
        "id": str(uuid.uuid4()),
        "messageId": message_id,
        "reporterId": current_user['uid'],
        "reason": data.get('reason', 'spam'),
        "description": data.get('description', ''),
        "timestamp": datetime.utcnow().isoformat(),
        "status": "pending"
    }
    
    await db.reports.insert_one(report)
    return {"message": "Rapor gönderildi"}

# ==================== MEMBER PROFILES ====================

@api_router.get("/users/{user_id}/profile")
async def get_user_profile(user_id: str, current_user: dict = Depends(get_current_user)):
    """Kullanıcı profilini getir"""
    user = await db.users.find_one({"uid": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    # Ortak toplulukları bul
    current_user_communities = await db.communities.find({"memberIds": current_user['uid']}).to_list(100)
    target_user_communities = await db.communities.find({"memberIds": user_id}).to_list(100)
    
    current_ids = {c['id'] for c in current_user_communities}
    common_communities = [c for c in target_user_communities if c['id'] in current_ids]
    
    for c in common_communities:
        if '_id' in c:
            del c['_id']
    
    return {
        "uid": user['uid'],
        "firstName": user.get('firstName', ''),
        "lastName": user.get('lastName', ''),
        "profileImageUrl": user.get('profileImageUrl'),
        "city": user.get('city'),
        "occupation": user.get('occupation'),
        "bio": user.get('bio', ''),
        "commonCommunities": common_communities,
        "commonCommunitiesCount": len(common_communities)
    }

@api_router.get("/subgroups/{subgroup_id}/members")
async def get_group_members(subgroup_id: str, current_user: dict = Depends(get_current_user)):
    """Grup üyelerini getir"""
    subgroup = await db.subgroups.find_one({"id": subgroup_id})
    if not subgroup:
        raise HTTPException(status_code=404, detail="Grup bulunamadı")
    
    member_ids = subgroup.get('memberIds', [])
    members = await db.users.find({"uid": {"$in": member_ids}}).to_list(100)
    
    result = []
    for member in members:
        result.append({
            "uid": member['uid'],
            "firstName": member.get('firstName', ''),
            "lastName": member.get('lastName', ''),
            "profileImageUrl": member.get('profileImageUrl'),
            "isAdmin": member['uid'] in subgroup.get('groupAdmins', []),
            "isMuted": member['uid'] in subgroup.get('mutedMembers', {})
        })
    
    return result

# ==================== ANNOUNCEMENTS ====================

@api_router.get("/communities/{community_id}/announcements")
async def get_announcements(community_id: str, current_user: dict = Depends(get_current_user)):
    """Topluluk duyurularını döner.

    - Üye olmayanlar: Son X (varsayılan 5) duyuruyu sadece OKUMA modunda görebilir.
    - Üyeler / yöneticiler: Daha fazla sayıda (örn. 50) duyuru görebilir.
    """
    community = await db.communities.find_one({"id": community_id})
    if not community:
        raise HTTPException(status_code=404, detail="Topluluk bulunamadı")

    announcement_channel_id = community.get('announcementChannelId')
    if not announcement_channel_id:
        return []

    # Üyelik ve yetki durumu
    is_member = current_user['uid'] in community.get('members', [])
    is_super_admin = current_user['uid'] in community.get('superAdmins', [])
    is_global_admin = await check_global_admin(current_user)

    # Üye olmayanlar için sadece son X duyuru (örneğin 5 adet)
    if not (is_member or is_super_admin or is_global_admin):
        limit = 5
    else:
        # Üyeler ve yöneticiler daha fazla duyuru görebilir
        limit = 50

    messages = await db.messages.find({"groupId": announcement_channel_id}).sort("timestamp", -1).limit(limit).to_list(limit)
    for msg in messages:
        if '_id' in msg:
            del msg['_id']
    return messages

@api_router.post("/communities/{community_id}/announcements")
async def send_announcement(community_id: str, message_data: dict, current_user: dict = Depends(get_current_user)):
    community = await db.communities.find_one({"id": community_id})
    if not community:
        raise HTTPException(status_code=404, detail="Topluluk bulunamadı")

    user = await db.users.find_one({"uid": current_user['uid']})
    is_super_admin = current_user['uid'] in community.get('superAdmins', [])
    is_global_admin = user.get('isAdmin', False) or user.get('email', '').lower() == ADMIN_EMAIL.lower()

    if not is_super_admin and not is_global_admin:
        raise HTTPException(status_code=403, detail="Sadece süper yöneticiler duyuru gönderebilir")

    announcement_channel_id = community.get('announcementChannelId')

    new_message = {
        "id": str(uuid.uuid4()),
        "groupId": announcement_channel_id,
        "senderId": current_user['uid'],
        "senderName": f"{user['firstName']} {user['lastName']}",
        "content": message_data.get('content', ''),
        "type": "announcement",
        "timestamp": datetime.utcnow()
    }

    await db.messages.insert_one(new_message)
    
    if '_id' in new_message:
        del new_message['_id']
    return new_message

@api_router.delete("/communities/{community_id}/announcements/{announcement_id}")
async def delete_announcement(community_id: str, announcement_id: str, current_user: dict = Depends(get_current_user)):
    """Duyuru sil"""
    community = await db.communities.find_one({"id": community_id})
    if not community:
        raise HTTPException(status_code=404, detail="Topluluk bulunamadı")

    user = await db.users.find_one({"uid": current_user['uid']})
    is_super_admin = current_user['uid'] in community.get('superAdmins', [])
    is_global_admin = user.get('isAdmin', False) or user.get('email', '').lower() == ADMIN_EMAIL.lower()

    if not is_super_admin and not is_global_admin:
        raise HTTPException(status_code=403, detail="Sadece yöneticiler duyuru silebilir")

    result = await db.messages.delete_one({"id": announcement_id, "groupId": community.get('announcementChannelId')})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Duyuru bulunamadı")
    
    return {"message": "Duyuru silindi"}

# ==================== ADMIN PANEL APIs ====================

# Dashboard Stats
@api_router.get("/admin/dashboard")
async def admin_dashboard(current_user: dict = Depends(get_current_user)):
    if not await check_global_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekiyor")

    total_users = await db.users.count_documents({})
    total_communities = await db.communities.count_documents({})
    total_subgroups = await db.subgroups.count_documents({})
    total_messages = await db.messages.count_documents({})
    total_posts = await db.posts.count_documents({})
    total_services = await db.services.count_documents({})

    week_ago = datetime.utcnow() - timedelta(days=7)
    new_users_week = await db.users.count_documents({"createdAt": {"$gte": week_ago}})

    banned_users = await db.users.count_documents({"isBanned": True})
    
    pending_requests = 0
    subgroups = await db.subgroups.find().to_list(1000)
    for sg in subgroups:
        pending_requests += len(sg.get('pendingRequests', []))

    return {
        "stats": {
            "totalUsers": total_users,
            "totalCommunities": total_communities,
            "totalSubgroups": total_subgroups,
            "totalMessages": total_messages,
            "totalPosts": total_posts,
            "totalServices": total_services,
            "newUsersThisWeek": new_users_week,
            "bannedUsers": banned_users,
            "pendingRequests": pending_requests
        }
    }

# List all pending subgroup join requests (admin global view)
@api_router.get("/admin/subgroup-join-requests")
async def admin_subgroup_join_requests(community_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Tüm alt gruplardaki bekleyen katılma isteklerini listeler.

    İsteğe bağlı olarak belirli bir community_id için filtrelenebilir.
    Global admin yetkisi gerektirir.
    """
    if not await check_global_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekiyor")

    query: dict = {"pendingRequests": {"$exists": True, "$ne": []}}
    if community_id:
        query["communityId"] = community_id

    subgroups = await db.subgroups.find(query).to_list(1000)

    results = []
    for sg in subgroups:
        community = await db.communities.find_one({"id": sg["communityId"]})
        community_name = community["name"] if community else None

        for req in sg.get("pendingRequests", []):
            user_id = req.get("uid")
            user_doc = await db.users.find_one({"uid": user_id}) if user_id else None
            if user_doc and "_id" in user_doc:
                del user_doc["_id"]

            results.append({
                "communityId": sg["communityId"],
                "communityName": community_name,
                "subgroupId": sg["id"],
                "subgroupName": sg.get("name"),
                "userId": user_id,
                "userName": req.get("name"),
                "profileImageUrl": req.get("profileImageUrl"),
                "requestedAt": req.get("requestedAt"),
                "userCity": user_doc.get("city") if user_doc else None,
                "userOccupation": user_doc.get("occupation") if user_doc else None,
                "userEmail": user_doc.get("email") if user_doc else None,
            })

    # requestedAt alanına göre en yeniler önce gelecek şekilde sırala
    def sort_key(item):
        ts = item.get("requestedAt")
        return ts if isinstance(ts, datetime) else datetime.min

    results.sort(key=sort_key, reverse=True)
    return results

# Get all users (admin)
@api_router.get("/admin/users")
async def admin_get_users(current_user: dict = Depends(get_current_user), search: str = None):
    if not await check_global_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekiyor")

    query = {}
    if search:
        query = {
            "$or": [
                {"firstName": {"$regex": search, "$options": "i"}},
                {"lastName": {"$regex": search, "$options": "i"}},
                {"email": {"$regex": search, "$options": "i"}},
                {"city": {"$regex": search, "$options": "i"}}
            ]
        }

    users = await db.users.find(query).sort("createdAt", -1).to_list(1000)

    for user in users:
        if '_id' in user:
            del user['_id']

    return users

# Ban user globally
@api_router.post("/admin/users/{user_id}/ban")
async def admin_ban_user(user_id: str, current_user: dict = Depends(get_current_user)):
    if not await check_global_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekiyor")

    target_user = await db.users.find_one({"uid": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    if target_user.get('email', '').lower() == ADMIN_EMAIL.lower():
        raise HTTPException(status_code=400, detail="Ana yönetici yasaklanamaz")

    await db.users.update_one(
        {"uid": user_id},
        {"$set": {"isBanned": True}}
    )

    # Remove from all communities
    await db.communities.update_many(
        {},
        {"$pull": {"members": user_id, "superAdmins": user_id}, "$addToSet": {"bannedUsers": user_id}}
    )

    # Remove from all subgroups
    await db.subgroups.update_many(
        {},
        {"$pull": {"members": user_id, "groupAdmins": user_id}, "$addToSet": {"bannedUsers": user_id}}
    )

    return {"message": "Kullanıcı yasaklandı"}

# Unban user
@api_router.post("/admin/users/{user_id}/unban")
async def admin_unban_user(user_id: str, current_user: dict = Depends(get_current_user)):
    if not await check_global_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekiyor")

    await db.users.update_one(
        {"uid": user_id},
        {"$set": {"isBanned": False}}
    )

    # Remove from ban lists
    await db.communities.update_many(
        {},
        {"$pull": {"bannedUsers": user_id}}
    )

    await db.subgroups.update_many(
        {},
        {"$pull": {"bannedUsers": user_id}}
    )

    return {"message": "Kullanıcının yasağı kaldırıldı"}

# Restrict user (mute)
@api_router.post("/admin/users/{user_id}/restrict")
async def admin_restrict_user(user_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    if not await check_global_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekiyor")

    hours = data.get('hours', 24)
    reason = data.get('reason', 'Yönetici tarafından kısıtlandı')
    until = datetime.utcnow() + timedelta(hours=hours)

    await db.users.update_one(
        {"uid": user_id},
        {"$set": {"isRestricted": True, "restrictedUntil": until}}
    )

    # Add to restricted list in all subgroups
    restriction = {"uid": user_id, "until": until, "reason": reason}
    await db.subgroups.update_many(
        {"members": user_id},
        {"$push": {"restrictedUsers": restriction}}
    )

    return {"message": f"Kullanıcı {hours} saat kısıtlandı", "until": until.isoformat()}

# Unrestrict user
@api_router.post("/admin/users/{user_id}/unrestrict")
async def admin_unrestrict_user(user_id: str, current_user: dict = Depends(get_current_user)):
    if not await check_global_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekiyor")

    await db.users.update_one(
        {"uid": user_id},
        {"$set": {"isRestricted": False, "restrictedUntil": None}}
    )

    await db.subgroups.update_many(
        {},
        {"$pull": {"restrictedUsers": {"uid": user_id}}}
    )

    return {"message": "Kullanıcının kısıtlaması kaldırıldı"}

# Delete user's recent messages
@api_router.delete("/admin/users/{user_id}/messages")
async def admin_delete_user_messages(user_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    if not await check_global_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekiyor")

    hours = data.get('hours', 24)
    since = datetime.utcnow() - timedelta(hours=hours)

    result = await db.messages.delete_many({
        "senderId": user_id,
        "timestamp": {"$gte": since}
    })

    return {"message": f"{result.deleted_count} mesaj silindi"}

# Make user admin
@api_router.post("/admin/users/{user_id}/make-admin")
async def admin_make_admin(user_id: str, current_user: dict = Depends(get_current_user)):
    if not await check_global_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekiyor")

    await db.users.update_one(
        {"uid": user_id},
        {"$set": {"isAdmin": True}}
    )

    # Add as super admin to all communities
    await db.communities.update_many(
        {},
        {"$addToSet": {"superAdmins": user_id, "members": user_id}}
    )

    return {"message": "Kullanıcı yönetici yapıldı"}

# Remove admin
@api_router.post("/admin/users/{user_id}/remove-admin")
async def admin_remove_admin(user_id: str, current_user: dict = Depends(get_current_user)):
    if not await check_global_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekiyor")

    target_user = await db.users.find_one({"uid": user_id})
    if target_user and target_user.get('email', '').lower() == ADMIN_EMAIL.lower():
        raise HTTPException(status_code=400, detail="Ana yöneticinin yetkisi kaldırılamaz")

    await db.users.update_one(
        {"uid": user_id},
        {"$set": {"isAdmin": False}}
    )

    # Remove from super admins (but keep as member)
    await db.communities.update_many(
        {},
        {"$pull": {"superAdmins": user_id}}
    )

    return {"message": "Yönetici yetkisi kaldırıldı"}

# Create new community (admin)
@api_router.post("/admin/communities")
async def admin_create_community(data: dict, current_user: dict = Depends(get_current_user)):
    if not await check_global_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekiyor")

    name = data.get("name")
    city = data.get("city")
    description = data.get("description", "")

    if not name or not city:
        raise HTTPException(status_code=400, detail="İsim ve şehir zorunludur")

    existing = await db.communities.find_one({"name": name})
    if existing:
        raise HTTPException(status_code=400, detail="Bu isimde bir topluluk zaten var")

    community_id = str(uuid.uuid4())
    announcement_id = str(uuid.uuid4())

    community = {
        "id": community_id,
        "name": name,
        "description": description,
        "city": city,
        "imageUrl": data.get("imageUrl"),
        "superAdmins": [],
        "members": [],
        "subGroups": [],
        "bannedUsers": [],
        "restrictedUsers": [],
        "announcementChannelId": announcement_id,
        "createdBy": current_user['uid'],
        "createdByName": data.get("createdByName") or "Admin",
        "createdAt": datetime.utcnow()
    }

    await db.communities.insert_one(community)

    # Varsayılan alt grupları oluştur
    subgroup_ids = await create_default_subgroups(community_id, name, current_user['uid'])
    await db.communities.update_one(
        {"id": community_id},
        {"$set": {"subGroups": subgroup_ids}}
    )

    if "_id" in community:
        del community["_id"]
    return community

# Delete community (admin)
@api_router.delete("/admin/communities/{community_id}")
async def admin_delete_community(community_id: str, current_user: dict = Depends(get_current_user)):
    if not await check_global_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekiyor")

    community = await db.communities.find_one({"id": community_id})
    if not community:
        raise HTTPException(status_code=404, detail="Topluluk bulunamadı")

    # Topluluğa bağlı alt grupları ve mesajlarını da sil
    subgroups = await db.subgroups.find({"communityId": community_id}).to_list(1000)
    subgroup_ids = [sg["id"] for sg in subgroups]

    if subgroup_ids:
        await db.subgroups.delete_many({"communityId": community_id})
        await db.messages.delete_many({"groupId": {"$in": subgroup_ids}})

    # Duyuru kanalındaki mesajlar
    announcement_id = community.get("announcementChannelId")
    if announcement_id:
        await db.messages.delete_many({"groupId": announcement_id})

    await db.communities.delete_one({"id": community_id})

    # Kullanıcı profillerinden bu topluluğu kaldır
    await db.users.update_many(
        {},
        {"$pull": {"communities": community_id}}
    )

    return {"message": "Topluluk ve ilişkili alt gruplar ve mesajlar silindi"}

# Update subgroup (admin)
@api_router.put("/admin/subgroups/{subgroup_id}")
async def admin_update_subgroup(subgroup_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    if not await check_global_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekiyor")

    allowed_fields = ["name", "description", "imageUrl"]
    updates = {k: v for k, v in data.items() if k in allowed_fields}

    if updates:
        await db.subgroups.update_one({"id": subgroup_id}, {"$set": updates})

    return {"message": "Alt grup güncellendi"}

# Delete subgroup (admin)
@api_router.delete("/admin/subgroups/{subgroup_id}")
async def admin_delete_subgroup(subgroup_id: str, current_user: dict = Depends(get_current_user)):
    if not await check_global_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekiyor")

    subgroup = await db.subgroups.find_one({"id": subgroup_id})
    if not subgroup:
        raise HTTPException(status_code=404, detail="Alt grup bulunamadı")

    community_id = subgroup.get("communityId")

    # Alt grup mesajlarını sil
    await db.messages.delete_many({"groupId": subgroup_id})

    # Alt grubun kendisini sil
    await db.subgroups.delete_one({"id": subgroup_id})

    # Topluluk dokümanından referansı kaldır
    if community_id:
        await db.communities.update_one(
            {"id": community_id},
            {"$pull": {"subGroups": subgroup_id}}
        )

    return {"message": "Alt grup ve mesajları silindi"}

# Get all communities (admin)
@api_router.get("/admin/communities")
async def admin_get_communities(current_user: dict = Depends(get_current_user)):
    if not await check_global_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekiyor")

    communities = await db.communities.find().sort("name", 1).to_list(100)

    for c in communities:
        if '_id' in c:
            del c['_id']
        c['memberCount'] = len(c.get('members', []))
        c['superAdminCount'] = len(c.get('superAdmins', []))
        c['subGroupCount'] = len(c.get('subGroups', []))
        c['bannedCount'] = len(c.get('bannedUsers', []))

    return communities

# Get community members (admin)
@api_router.get("/admin/communities/{community_id}/members")
async def admin_get_community_members(community_id: str, current_user: dict = Depends(get_current_user)):
    if not await check_global_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekiyor")

    community = await db.communities.find_one({"id": community_id})
    if not community:
        raise HTTPException(status_code=404, detail="Topluluk bulunamadı")

    member_ids = community.get('members', [])
    members = await db.users.find({"uid": {"$in": member_ids}}).to_list(1000)

    for member in members:
        if '_id' in member:
            del member['_id']
        member['isSuperAdmin'] = member['uid'] in community.get('superAdmins', [])
        member['isBannedFromCommunity'] = member['uid'] in community.get('bannedUsers', [])

    return members

# Ban user from community
@api_router.post("/admin/communities/{community_id}/ban/{user_id}")
async def admin_ban_from_community(community_id: str, user_id: str, current_user: dict = Depends(get_current_user)):
    if not await check_global_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekiyor")

    await db.communities.update_one(
        {"id": community_id},
        {"$pull": {"members": user_id, "superAdmins": user_id}, "$addToSet": {"bannedUsers": user_id}}
    )

    await db.users.update_one(
        {"uid": user_id},
        {"$pull": {"communities": community_id}}
    )

    return {"message": "Kullanıcı topluluktan yasaklandı"}

# Kick user from community
@api_router.post("/admin/communities/{community_id}/kick/{user_id}")
async def admin_kick_from_community(community_id: str, user_id: str, current_user: dict = Depends(get_current_user)):
    if not await check_global_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekiyor")

    await db.communities.update_one(
        {"id": community_id},
        {"$pull": {"members": user_id, "superAdmins": user_id}}
    )

    await db.users.update_one(
        {"uid": user_id},
        {"$pull": {"communities": community_id}}
    )

    return {"message": "Kullanıcı topluluktan çıkarıldı"}

# Add super admin to community
@api_router.post("/admin/communities/{community_id}/super-admin/{user_id}")
async def admin_add_super_admin(community_id: str, user_id: str, current_user: dict = Depends(get_current_user)):
    if not await check_global_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekiyor")

    await db.communities.update_one(
        {"id": community_id},
        {"$addToSet": {"superAdmins": user_id, "members": user_id}}
    )

    return {"message": "Süper yönetici eklendi"}

# Remove super admin from community
@api_router.delete("/admin/communities/{community_id}/super-admin/{user_id}")
async def admin_remove_super_admin(community_id: str, user_id: str, current_user: dict = Depends(get_current_user)):
    if not await check_global_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekiyor")

    await db.communities.update_one(
        {"id": community_id},
        {"$pull": {"superAdmins": user_id}}
    )

    return {"message": "Süper yönetici kaldırıldı"}

# Update community settings
@api_router.put("/admin/communities/{community_id}")
async def admin_update_community(community_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    if not await check_global_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekiyor")

    allowed_fields = ['name', 'description', 'imageUrl']
    updates = {k: v for k, v in data.items() if k in allowed_fields}

    if updates:
        await db.communities.update_one({"id": community_id}, {"$set": updates})

    return {"message": "Topluluk güncellendi"}

# Get subgroup members (admin)
@api_router.get("/admin/subgroups/{subgroup_id}/members")
async def admin_get_subgroup_members(subgroup_id: str, current_user: dict = Depends(get_current_user)):
    if not await check_global_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekiyor")

    subgroup = await db.subgroups.find_one({"id": subgroup_id})
    if not subgroup:
        raise HTTPException(status_code=404, detail="Alt grup bulunamadı")

    member_ids = subgroup.get('members', [])
    members = await db.users.find({"uid": {"$in": member_ids}}).to_list(1000)

    restricted_users = {r.get('uid'): r for r in subgroup.get('restrictedUsers', [])}

    for member in members:
        if '_id' in member:
            del member['_id']
        member['isGroupAdmin'] = member['uid'] in subgroup.get('groupAdmins', [])
        member['isBannedFromGroup'] = member['uid'] in subgroup.get('bannedUsers', [])
        restriction = restricted_users.get(member['uid'])
        member['isRestrictedInGroup'] = restriction is not None
        member['restrictedUntil'] = restriction.get('until').isoformat() if restriction else None

    return members

# Ban user from subgroup
@api_router.post("/admin/subgroups/{subgroup_id}/ban/{user_id}")
async def admin_ban_from_subgroup(subgroup_id: str, user_id: str, current_user: dict = Depends(get_current_user)):
    if not await check_global_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekiyor")

    await db.subgroups.update_one(
        {"id": subgroup_id},
        {"$pull": {"members": user_id, "groupAdmins": user_id}, "$addToSet": {"bannedUsers": user_id}}
    )

    return {"message": "Kullanıcı gruptan yasaklandı"}

# Kick user from subgroup
@api_router.post("/admin/subgroups/{subgroup_id}/kick/{user_id}")
async def admin_kick_from_subgroup(subgroup_id: str, user_id: str, current_user: dict = Depends(get_current_user)):
    if not await check_global_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekiyor")

    await db.subgroups.update_one(
        {"id": subgroup_id},
        {"$pull": {"members": user_id, "groupAdmins": user_id}}
    )

    return {"message": "Kullanıcı gruptan çıkarıldı"}

# Restrict user in subgroup
@api_router.post("/admin/subgroups/{subgroup_id}/restrict/{user_id}")
async def admin_restrict_in_subgroup(subgroup_id: str, user_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    if not await check_global_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekiyor")

    hours = data.get('hours', 24)
    reason = data.get('reason', 'Yönetici tarafından kısıtlandı')
    until = datetime.utcnow() + timedelta(hours=hours)

    # Remove existing restriction
    await db.subgroups.update_one(
        {"id": subgroup_id},
        {"$pull": {"restrictedUsers": {"uid": user_id}}}
    )

    # Add new restriction
    await db.subgroups.update_one(
        {"id": subgroup_id},
        {"$push": {"restrictedUsers": {"uid": user_id, "until": until, "reason": reason}}}
    )

    return {"message": f"Kullanıcı {hours} saat kısıtlandı"}

# Unrestrict user in subgroup
@api_router.post("/admin/subgroups/{subgroup_id}/unrestrict/{user_id}")
async def admin_unrestrict_in_subgroup(subgroup_id: str, user_id: str, current_user: dict = Depends(get_current_user)):
    if not await check_global_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekiyor")

    await db.subgroups.update_one(
        {"id": subgroup_id},
        {"$pull": {"restrictedUsers": {"uid": user_id}}}
    )

    return {"message": "Kullanıcının kısıtlaması kaldırıldı"}

# Add group admin
@api_router.post("/admin/subgroups/{subgroup_id}/admin/{user_id}")
async def admin_add_group_admin(subgroup_id: str, user_id: str, current_user: dict = Depends(get_current_user)):
    if not await check_global_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekiyor")

    await db.subgroups.update_one(
        {"id": subgroup_id},
        {"$addToSet": {"groupAdmins": user_id, "members": user_id}}
    )

    return {"message": "Grup yöneticisi eklendi"}

# Remove group admin
@api_router.delete("/admin/subgroups/{subgroup_id}/admin/{user_id}")
async def admin_remove_group_admin(subgroup_id: str, user_id: str, current_user: dict = Depends(get_current_user)):
    if not await check_global_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekiyor")

    await db.subgroups.update_one(
        {"id": subgroup_id},
        {"$pull": {"groupAdmins": user_id}}
    )

    return {"message": "Grup yöneticisi kaldırıldı"}

# Delete user's messages in subgroup
@api_router.delete("/admin/subgroups/{subgroup_id}/messages/{user_id}")
async def admin_delete_subgroup_messages(subgroup_id: str, user_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    if not await check_global_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekiyor")

    hours = data.get('hours', 24)
    since = datetime.utcnow() - timedelta(hours=hours)

    result = await db.messages.delete_many({
        "groupId": subgroup_id,
        "senderId": user_id,
        "timestamp": {"$gte": since}
    })

    return {"message": f"{result.deleted_count} mesaj silindi"}

# Pin message
@api_router.post("/admin/messages/{message_id}/pin")
async def admin_pin_message(message_id: str, current_user: dict = Depends(get_current_user)):
    if not await check_global_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekiyor")

    message = await db.messages.find_one({"id": message_id})
    if not message:
        raise HTTPException(status_code=404, detail="Mesaj bulunamadı")

    is_pinned = not message.get('isPinned', False)

    await db.messages.update_one(
        {"id": message_id},
        {"$set": {"isPinned": is_pinned}}
    )

    group_id = message.get('groupId')
    if group_id and is_pinned:
        await db.subgroups.update_one(
            {"id": group_id},
            {"$addToSet": {"pinnedMessages": message_id}}
        )
    elif group_id:
        await db.subgroups.update_one(
            {"id": group_id},
            {"$pull": {"pinnedMessages": message_id}}
        )

    return {"message": "Mesaj sabitlendi" if is_pinned else "Sabitleme kaldırıldı", "isPinned": is_pinned}

# Delete any message
@api_router.delete("/admin/messages/{message_id}")
async def admin_delete_message(message_id: str, current_user: dict = Depends(get_current_user)):
    if not await check_global_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekiyor")

    await db.messages.update_one(
        {"id": message_id},
        {"$set": {"deletedForEveryone": True, "content": "Bu mesaj yönetici tarafından silindi", "isDeleted": True}}
    )

    return {"message": "Mesaj silindi"}

# Create poll
@api_router.post("/admin/subgroups/{subgroup_id}/polls")
async def admin_create_poll(subgroup_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    if not await check_global_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekiyor")

    user = await db.users.find_one({"uid": current_user['uid']})

    poll = {
        "id": str(uuid.uuid4()),
        "groupId": subgroup_id,
        "question": data['question'],
        "options": [{"text": opt, "votes": []} for opt in data.get('options', [])],
        "createdBy": current_user['uid'],
        "createdByName": f"{user['firstName']} {user['lastName']}",
        "isAnonymous": data.get('isAnonymous', False),
        "multipleChoice": data.get('multipleChoice', False),
        "expiresAt": datetime.utcnow() + timedelta(hours=data.get('expiresInHours', 24)) if data.get('expiresInHours') else None,
        "createdAt": datetime.utcnow()
    }

    await db.polls.insert_one(poll)

    # Also create a message for the poll
    poll_message = {
        "id": str(uuid.uuid4()),
        "groupId": subgroup_id,
        "senderId": current_user['uid'],
        "senderName": f"{user['firstName']} {user['lastName']}",
        "content": f"📊 Anket: {data['question']}",
        "type": "poll",
        "pollId": poll['id'],
        "timestamp": datetime.utcnow()
    }

    await db.messages.insert_one(poll_message)

    if '_id' in poll:
        del poll['_id']

    return poll

# Socket.IO events
@sio.event
async def connect(sid, environ):
    logging.info(f"Client connected: {sid}")

@sio.event
async def disconnect(sid):
    logging.info(f"Client disconnected: {sid}")

@sio.event
async def join_room(sid, data):
    room = data.get('room')
    if room:
        sio.enter_room(sid, room)
        logging.info(f"Client {sid} joined room {room}")

@sio.event
async def leave_room(sid, data):
    room = data.get('room')
    if room:
        sio.leave_room(sid, room)

@sio.event
async def typing(sid, data):
    room = data.get('room')
    user_id = data.get('userId')
    user_name = data.get('userName')
    is_typing = data.get('isTyping', False)
    
    if room:
        await sio.emit('typing', {
            'userId': user_id,
            'userName': user_name,
            'isTyping': is_typing
        }, room=room, skip_sid=sid)

# Import and setup additional routes
from routes.badges import setup_badges_routes, badges_router
from routes.reviews import setup_reviews_routes, reviews_router
from routes.events import setup_events_routes, events_router

# Setup badges routes
badges_router = setup_badges_routes(db, get_current_user, check_global_admin)
api_router.include_router(badges_router)

# Setup reviews routes  
reviews_router = setup_reviews_routes(db, get_current_user)
api_router.include_router(reviews_router)

# Setup events routes
events_router = setup_events_routes(db, get_current_user, check_global_admin)
api_router.include_router(events_router)

# Import and setup 2FA routes
from routes.auth_2fa import setup_auth_routes
auth_router = setup_auth_routes(db, get_current_user)
api_router.include_router(auth_router)

# Import and setup notifications routes
from routes.notifications import setup_notifications_routes
notifications_router = setup_notifications_routes(db, get_current_user)
api_router.include_router(notifications_router)

# Import and setup AI routes
from routes.ai_smart_replies import setup_ai_routes
ai_router = setup_ai_routes(db, get_current_user)
api_router.include_router(ai_router)

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    try:
        await initialize_city_communities()
        await ensure_admin_in_all_communities()
        logger.info("City communities initialized and admin configured")
    except Exception as e:
        logger.error(f"Error during startup: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# Wrap FastAPI app with Socket.IO
app = socketio.ASGIApp(sio, app)
