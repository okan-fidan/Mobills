from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
import uuid
from typing import List, Optional
from pydantic import BaseModel

reviews_router = APIRouter(prefix="/reviews", tags=["reviews"])

class ReviewCreate(BaseModel):
    serviceId: str
    rating: int  # 1-5
    comment: str
    title: Optional[str] = None

def setup_reviews_routes(db, get_current_user):
    
    @reviews_router.post("/")
    async def create_review(review_data: ReviewCreate, current_user: dict = Depends(get_current_user)):
        """Hizmet değerlendirmesi oluştur"""
        # Hizmeti kontrol et
        service = await db.services.find_one({"id": review_data.serviceId})
        if not service:
            raise HTTPException(status_code=404, detail="Hizmet bulunamadı")
        
        # Kendi hizmetini değerlendiremez
        if service['userId'] == current_user['uid']:
            raise HTTPException(status_code=400, detail="Kendi hizmetinizi değerlendiremezsiniz")
        
        # Daha önce değerlendirme yaptı mı kontrol et
        existing_review = await db.reviews.find_one({
            "serviceId": review_data.serviceId,
            "userId": current_user['uid']
        })
        if existing_review:
            raise HTTPException(status_code=400, detail="Bu hizmeti zaten değerlendirdiniz")
        
        # Rating kontrolü
        if review_data.rating < 1 or review_data.rating > 5:
            raise HTTPException(status_code=400, detail="Rating 1-5 arasında olmalı")
        
        user = await db.users.find_one({"uid": current_user['uid']})
        
        review = {
            "id": str(uuid.uuid4()),
            "serviceId": review_data.serviceId,
            "userId": current_user['uid'],
            "userName": f"{user.get('firstName', '')} {user.get('lastName', '')}".strip(),
            "userProfileImage": user.get('profileImageUrl'),
            "rating": review_data.rating,
            "title": review_data.title,
            "comment": review_data.comment,
            "helpful": [],
            "response": None,
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
        
        await db.reviews.insert_one(review)
        
        # Hizmetin ortalama puanını güncelle
        await update_service_rating(db, review_data.serviceId)
        
        # Hizmet sahibine bildirim gönder
        notification = {
            "id": str(uuid.uuid4()),
            "userId": service['userId'],
            "type": "new_review",
            "title": "Yeni Değerlendirme",
            "message": f"{user.get('firstName', '')} hizmetinizi değerlendirdi: {'⭐' * review_data.rating}",
            "data": {"serviceId": review_data.serviceId, "reviewId": review['id']},
            "isRead": False,
            "timestamp": datetime.utcnow()
        }
        await db.notifications.insert_one(notification)
        
        del review['_id']
        return review
    
    @reviews_router.get("/service/{service_id}")
    async def get_service_reviews(service_id: str, current_user: dict = Depends(get_current_user)):
        """Hizmetin değerlendirmelerini döner"""
        reviews = await db.reviews.find({"serviceId": service_id}).sort("createdAt", -1).to_list(100)
        
        for review in reviews:
            if '_id' in review:
                del review['_id']
            review['isHelpful'] = current_user['uid'] in review.get('helpful', [])
            review['helpfulCount'] = len(review.get('helpful', []))
        
        # Özet istatistikler
        total = len(reviews)
        avg_rating = sum(r['rating'] for r in reviews) / total if total > 0 else 0
        rating_counts = {i: 0 for i in range(1, 6)}
        for r in reviews:
            rating_counts[r['rating']] += 1
        
        return {
            "reviews": reviews,
            "summary": {
                "total": total,
                "averageRating": round(avg_rating, 1),
                "ratingDistribution": rating_counts
            }
        }
    
    @reviews_router.get("/user/{user_id}")
    async def get_user_reviews(user_id: str, current_user: dict = Depends(get_current_user)):
        """Kullanıcının verdiği değerlendirmeleri döner"""
        reviews = await db.reviews.find({"userId": user_id}).sort("createdAt", -1).to_list(100)
        
        for review in reviews:
            if '_id' in review:
                del review['_id']
            # Hizmet bilgisini ekle
            service = await db.services.find_one({"id": review['serviceId']})
            if service:
                review['serviceName'] = service.get('title', '')
                review['serviceCategory'] = service.get('category', '')
        
        return reviews
    
    @reviews_router.put("/{review_id}")
    async def update_review(review_id: str, review_data: ReviewCreate, current_user: dict = Depends(get_current_user)):
        """Değerlendirmeyi güncelle"""
        review = await db.reviews.find_one({"id": review_id})
        if not review:
            raise HTTPException(status_code=404, detail="Değerlendirme bulunamadı")
        
        if review['userId'] != current_user['uid']:
            raise HTTPException(status_code=403, detail="Bu değerlendirmeyi düzenleme yetkiniz yok")
        
        if review_data.rating < 1 or review_data.rating > 5:
            raise HTTPException(status_code=400, detail="Rating 1-5 arasında olmalı")
        
        await db.reviews.update_one(
            {"id": review_id},
            {"$set": {
                "rating": review_data.rating,
                "title": review_data.title,
                "comment": review_data.comment,
                "updatedAt": datetime.utcnow()
            }}
        )
        
        # Ortalama puanı güncelle
        await update_service_rating(db, review['serviceId'])
        
        return {"message": "Değerlendirme güncellendi"}
    
    @reviews_router.delete("/{review_id}")
    async def delete_review(review_id: str, current_user: dict = Depends(get_current_user)):
        """Değerlendirmeyi sil"""
        review = await db.reviews.find_one({"id": review_id})
        if not review:
            raise HTTPException(status_code=404, detail="Değerlendirme bulunamadı")
        
        if review['userId'] != current_user['uid']:
            # Admin kontrolü
            user = await db.users.find_one({"uid": current_user['uid']})
            if not user.get('isAdmin'):
                raise HTTPException(status_code=403, detail="Bu değerlendirmeyi silme yetkiniz yok")
        
        service_id = review['serviceId']
        await db.reviews.delete_one({"id": review_id})
        
        # Ortalama puanı güncelle
        await update_service_rating(db, service_id)
        
        return {"message": "Değerlendirme silindi"}
    
    @reviews_router.post("/{review_id}/helpful")
    async def toggle_helpful(review_id: str, current_user: dict = Depends(get_current_user)):
        """Değerlendirmeyi yararlı işaretle/kaldır"""
        review = await db.reviews.find_one({"id": review_id})
        if not review:
            raise HTTPException(status_code=404, detail="Değerlendirme bulunamadı")
        
        helpful = review.get('helpful', [])
        
        if current_user['uid'] in helpful:
            await db.reviews.update_one(
                {"id": review_id},
                {"$pull": {"helpful": current_user['uid']}}
            )
            return {"helpful": False, "count": len(helpful) - 1}
        else:
            await db.reviews.update_one(
                {"id": review_id},
                {"$addToSet": {"helpful": current_user['uid']}}
            )
            return {"helpful": True, "count": len(helpful) + 1}
    
    @reviews_router.post("/{review_id}/response")
    async def respond_to_review(review_id: str, data: dict, current_user: dict = Depends(get_current_user)):
        """Değerlendirmeye yanıt ver (sadece hizmet sahibi)"""
        review = await db.reviews.find_one({"id": review_id})
        if not review:
            raise HTTPException(status_code=404, detail="Değerlendirme bulunamadı")
        
        service = await db.services.find_one({"id": review['serviceId']})
        if not service or service['userId'] != current_user['uid']:
            raise HTTPException(status_code=403, detail="Bu değerlendirmeye yanıt verme yetkiniz yok")
        
        response_text = data.get('response', '').strip()
        if not response_text:
            raise HTTPException(status_code=400, detail="Yanıt metni gerekli")
        
        await db.reviews.update_one(
            {"id": review_id},
            {"$set": {
                "response": {
                    "text": response_text,
                    "createdAt": datetime.utcnow().isoformat()
                }
            }}
        )
        
        return {"message": "Yanıt eklendi"}
    
    return reviews_router

async def update_service_rating(db, service_id: str):
    """Hizmetin ortalama puanını güncelle"""
    reviews = await db.reviews.find({"serviceId": service_id}).to_list(1000)
    
    if reviews:
        avg_rating = sum(r['rating'] for r in reviews) / len(reviews)
        await db.services.update_one(
            {"id": service_id},
            {"$set": {
                "averageRating": round(avg_rating, 1),
                "reviewCount": len(reviews)
            }}
        )
    else:
        await db.services.update_one(
            {"id": service_id},
            {"$set": {"averageRating": 0, "reviewCount": 0}}
        )
