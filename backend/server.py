from fastapi import FastAPI, APIRouter, HTTPException, Depends
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

# Initialize city communities
async def initialize_city_communities():
    for city in TURKISH_CITIES:
        existing = await db.communities.find_one({"city": city})
        if not existing:
            announcement_id = str(uuid.uuid4())
            community = {
                "id": str(uuid.uuid4()),
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
    return {"message": "Topluluğa katıldınız"}

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
    return {"message": "Topluluktan ayrıldınız"}

# ==================== SUBGROUPS ====================

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

@api_router.post("/subgroups/{subgroup_id}/join")
async def join_subgroup(subgroup_id: str, current_user: dict = Depends(get_current_user)):
    subgroup = await db.subgroups.find_one({"id": subgroup_id})
    if not subgroup:
        raise HTTPException(status_code=404, detail="Alt grup bulunamadı")

    if current_user['uid'] in subgroup.get('bannedUsers', []):
        raise HTTPException(status_code=403, detail="Bu gruptan yasaklandınız")

    if current_user['uid'] in subgroup.get('members', []):
        raise HTTPException(status_code=400, detail="Zaten bu grubun üyesisiniz")

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
        "fileUrl": message_data.get('fileUrl'),
        "replyTo": message_data.get('replyTo'),
        "reactions": {},
        "isPinned": False,
        "isDeleted": False,
        "deletedForEveryone": False,
        "deletedFor": [],
        "isEdited": False,
        "readBy": [current_user['uid']],
        "timestamp": datetime.utcnow()
    }

    await db.messages.insert_one(new_message)
    
    if '_id' in new_message:
        del new_message['_id']
    
    await sio.emit('new_message', new_message, room=subgroup_id)
    return new_message

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

# ==================== PRIVATE MESSAGES ====================

@api_router.get("/private-messages/{other_user_id}")
async def get_private_messages(other_user_id: str, current_user: dict = Depends(get_current_user)):
    user_ids = sorted([current_user['uid'], other_user_id])
    chat_id = f"{user_ids[0]}_{user_ids[1]}"

    messages = await db.messages.find({
        "chatId": chat_id,
        "deletedForEveryone": {"$ne": True}
    }).sort("timestamp", -1).limit(100).to_list(100)
    
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
        "fileUrl": message.get('fileUrl'),
        "reactions": {},
        "isDeleted": False,
        "deletedForEveryone": False,
        "deletedFor": [],
        "readBy": [current_user['uid']],
        "timestamp": datetime.utcnow()
    }

    await db.messages.insert_one(new_message)
    
    if '_id' in new_message:
        del new_message['_id']
    
    await sio.emit('new_private_message', new_message, room=chat_id)
    return new_message

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

# ==================== ANNOUNCEMENTS ====================

@api_router.get("/communities/{community_id}/announcements")
async def get_announcements(community_id: str, current_user: dict = Depends(get_current_user)):
    community = await db.communities.find_one({"id": community_id})
    if not community:
        raise HTTPException(status_code=404, detail="Topluluk bulunamadı")

    announcement_channel_id = community.get('announcementChannelId')
    if not announcement_channel_id:
        return []

    messages = await db.messages.find({"groupId": announcement_channel_id}).sort("timestamp", -1).limit(50).to_list(50)
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

    return {
        "stats": {
            "totalUsers": total_users,
            "totalCommunities": total_communities,
            "totalSubgroups": total_subgroups,
            "totalMessages": total_messages,
            "totalPosts": total_posts,
            "totalServices": total_services,
            "newUsersThisWeek": new_users_week,
            "bannedUsers": banned_users
        }
    }

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

@sio.event
async def leave_room(sid, data):
    room = data.get('room')
    if room:
        sio.leave_room(sid, room)

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
