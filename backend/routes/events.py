from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timedelta
import uuid
from typing import List, Optional
from pydantic import BaseModel

events_router = APIRouter(prefix="/events", tags=["events"])

class EventCreate(BaseModel):
    title: str
    description: str
    date: str  # YYYY-MM-DD
    time: str  # HH:MM
    location: str
    communityId: Optional[str] = None
    isOnline: bool = False
    meetingLink: Optional[str] = None
    maxAttendees: Optional[int] = None

def setup_events_routes(db, get_current_user, check_global_admin):
    
    @events_router.post("/")
    async def create_event(event_data: EventCreate, current_user: dict = Depends(get_current_user)):
        """Etkinlik oluştur"""
        user = await db.users.find_one({"uid": current_user['uid']})
        
        community_name = None
        if event_data.communityId:
            community = await db.communities.find_one({"id": event_data.communityId})
            if community:
                community_name = community.get('name')
        
        event = {
            "id": str(uuid.uuid4()),
            "title": event_data.title,
            "description": event_data.description,
            "date": event_data.date,
            "time": event_data.time,
            "location": event_data.location,
            "communityId": event_data.communityId,
            "communityName": community_name,
            "createdBy": current_user['uid'],
            "createdByName": f"{user.get('firstName', '')} {user.get('lastName', '')}".strip(),
            "attendees": [current_user['uid']],  # Oluşturan otomatik katılır
            "maxAttendees": event_data.maxAttendees,
            "isOnline": event_data.isOnline,
            "meetingLink": event_data.meetingLink if event_data.isOnline else None,
            "isCancelled": False,
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
        
        await db.events.insert_one(event)
        del event['_id']
        return event
    
    @events_router.get("/")
    async def get_events(current_user: dict = Depends(get_current_user), community_id: Optional[str] = None):
        """Etkinlikleri listele"""
        query = {"isCancelled": False}
        if community_id:
            query["communityId"] = community_id
        
        events = await db.events.find(query).sort("date", 1).to_list(100)
        
        for event in events:
            if '_id' in event:
                del event['_id']
            event['attendeeCount'] = len(event.get('attendees', []))
            event['isAttending'] = current_user['uid'] in event.get('attendees', [])
            event['isFull'] = event.get('maxAttendees') and event['attendeeCount'] >= event['maxAttendees']
            event['isCreator'] = event['createdBy'] == current_user['uid']
        
        return events
    
    @events_router.get("/upcoming")
    async def get_upcoming_events(current_user: dict = Depends(get_current_user)):
        """Yaklaşan etkinlikleri listele"""
        today = datetime.utcnow().strftime('%Y-%m-%d')
        
        events = await db.events.find({
            "date": {"$gte": today},
            "isCancelled": False
        }).sort("date", 1).limit(10).to_list(10)
        
        for event in events:
            if '_id' in event:
                del event['_id']
            event['attendeeCount'] = len(event.get('attendees', []))
            event['isAttending'] = current_user['uid'] in event.get('attendees', [])
        
        return events
    
    @events_router.get("/my-events")
    async def get_my_events(current_user: dict = Depends(get_current_user)):
        """Kullanıcının katıldığı etkinlikleri listele"""
        events = await db.events.find({
            "attendees": current_user['uid'],
            "isCancelled": False
        }).sort("date", 1).to_list(100)
        
        for event in events:
            if '_id' in event:
                del event['_id']
            event['attendeeCount'] = len(event.get('attendees', []))
            event['isCreator'] = event['createdBy'] == current_user['uid']
        
        return events
    
    @events_router.get("/{event_id}")
    async def get_event(event_id: str, current_user: dict = Depends(get_current_user)):
        """Etkinlik detaylarını getir"""
        event = await db.events.find_one({"id": event_id})
        if not event:
            raise HTTPException(status_code=404, detail="Etkinlik bulunamadı")
        
        if '_id' in event:
            del event['_id']
        
        # Katılımcı listesi
        attendee_ids = event.get('attendees', [])
        attendees = await db.users.find({"uid": {"$in": attendee_ids}}).to_list(100)
        
        event['attendeeList'] = [{
            "uid": a['uid'],
            "name": f"{a.get('firstName', '')} {a.get('lastName', '')}".strip(),
            "profileImageUrl": a.get('profileImageUrl')
        } for a in attendees]
        
        event['attendeeCount'] = len(attendee_ids)
        event['isAttending'] = current_user['uid'] in attendee_ids
        event['isFull'] = event.get('maxAttendees') and event['attendeeCount'] >= event['maxAttendees']
        event['isCreator'] = event['createdBy'] == current_user['uid']
        
        return event
    
    @events_router.post("/{event_id}/join")
    async def join_event(event_id: str, current_user: dict = Depends(get_current_user)):
        """Etkinliğe katıl"""
        event = await db.events.find_one({"id": event_id})
        if not event:
            raise HTTPException(status_code=404, detail="Etkinlik bulunamadı")
        
        if event.get('isCancelled'):
            raise HTTPException(status_code=400, detail="Bu etkinlik iptal edildi")
        
        if current_user['uid'] in event.get('attendees', []):
            raise HTTPException(status_code=400, detail="Zaten bu etkinliğe katıldınız")
        
        attendee_count = len(event.get('attendees', []))
        if event.get('maxAttendees') and attendee_count >= event['maxAttendees']:
            raise HTTPException(status_code=400, detail="Etkinlik dolu")
        
        await db.events.update_one(
            {"id": event_id},
            {"$addToSet": {"attendees": current_user['uid']}}
        )
        
        # Etkinlik sahibine bildirim
        user = await db.users.find_one({"uid": current_user['uid']})
        notification = {
            "id": str(uuid.uuid4()),
            "userId": event['createdBy'],
            "type": "event_join",
            "title": "Yeni Katılımcı",
            "message": f"{user.get('firstName', '')} etkinliğinize katıldı: {event['title']}",
            "data": {"eventId": event_id},
            "isRead": False,
            "timestamp": datetime.utcnow()
        }
        await db.notifications.insert_one(notification)
        
        return {"message": "Etkinliğe katıldınız"}
    
    @events_router.post("/{event_id}/leave")
    async def leave_event(event_id: str, current_user: dict = Depends(get_current_user)):
        """Etkinlikten ayrıl"""
        event = await db.events.find_one({"id": event_id})
        if not event:
            raise HTTPException(status_code=404, detail="Etkinlik bulunamadı")
        
        if event['createdBy'] == current_user['uid']:
            raise HTTPException(status_code=400, detail="Etkinliği oluşturan ayrılamaz, etkinliği iptal edin")
        
        await db.events.update_one(
            {"id": event_id},
            {"$pull": {"attendees": current_user['uid']}}
        )
        
        return {"message": "Etkinlikten ayrıldınız"}
    
    @events_router.put("/{event_id}")
    async def update_event(event_id: str, event_data: EventCreate, current_user: dict = Depends(get_current_user)):
        """Etkinliği güncelle"""
        event = await db.events.find_one({"id": event_id})
        if not event:
            raise HTTPException(status_code=404, detail="Etkinlik bulunamadı")
        
        if event['createdBy'] != current_user['uid']:
            if not await check_global_admin(current_user):
                raise HTTPException(status_code=403, detail="Bu etkinliği düzenleme yetkiniz yok")
        
        await db.events.update_one(
            {"id": event_id},
            {"$set": {
                "title": event_data.title,
                "description": event_data.description,
                "date": event_data.date,
                "time": event_data.time,
                "location": event_data.location,
                "isOnline": event_data.isOnline,
                "meetingLink": event_data.meetingLink if event_data.isOnline else None,
                "maxAttendees": event_data.maxAttendees,
                "updatedAt": datetime.utcnow()
            }}
        )
        
        return {"message": "Etkinlik güncellendi"}
    
    @events_router.delete("/{event_id}")
    async def cancel_event(event_id: str, current_user: dict = Depends(get_current_user)):
        """Etkinliği iptal et"""
        event = await db.events.find_one({"id": event_id})
        if not event:
            raise HTTPException(status_code=404, detail="Etkinlik bulunamadı")
        
        if event['createdBy'] != current_user['uid']:
            if not await check_global_admin(current_user):
                raise HTTPException(status_code=403, detail="Bu etkinliği iptal etme yetkiniz yok")
        
        await db.events.update_one(
            {"id": event_id},
            {"$set": {"isCancelled": True}}
        )
        
        # Katılımcılara bildirim gönder
        for attendee_id in event.get('attendees', []):
            if attendee_id != current_user['uid']:
                notification = {
                    "id": str(uuid.uuid4()),
                    "userId": attendee_id,
                    "type": "event_cancelled",
                    "title": "Etkinlik İptal Edildi",
                    "message": f"{event['title']} etkinliği iptal edildi",
                    "data": {"eventId": event_id},
                    "isRead": False,
                    "timestamp": datetime.utcnow()
                }
                await db.notifications.insert_one(notification)
        
        return {"message": "Etkinlik iptal edildi"}
    
    return events_router
