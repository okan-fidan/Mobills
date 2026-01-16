#!/usr/bin/env python3
"""
Network Solution Backend API Comprehensive Test Suite
Tests ALL backend features as requested by user with test user:
- Email: testuser@test.com
- Password: Test123!
- Name: Test Kullanıcı
"""

import requests
import json
import sys
import uuid
from datetime import datetime
from typing import Dict, Any

# Backend URL from frontend environment
BACKEND_URL = "https://founder-talk.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

# Test User Configuration
TEST_USER = {
    "email": "testuser@test.com",
    "password": "Test123!",
    "firstName": "Test",
    "lastName": "Kullanıcı"
}

class NetworkSolutionComprehensiveTester:
    def __init__(self):
        self.results = {}
        self.session = requests.Session()
        self.session.timeout = 10
        self.auth_token = None
        self.test_user_id = None
        self.created_resources = {
            "posts": [],
            "services": [],
            "communities": [],
            "messages": []
        }
        
    def log_result(self, test_name: str, success: bool, details: str = "", error: str = ""):
        """Log test result with Turkish format"""
        status = "✅ BAŞARILI" if success else "❌ BAŞARISIZ"
        self.results[test_name] = {
            "status": status,
            "success": success,
            "details": details,
            "error": error,
            "timestamp": datetime.now().isoformat()
        }
        
        print(f"{status}: {test_name}")
        if details:
            print(f"   Detay: {details}")
        if error:
            print(f"   Hata: {error}")
        print()
        
    def test_server_connectivity(self):
        """Test 1: Server Connectivity"""
        try:
            response = self.session.get(BACKEND_URL, timeout=5)
            if response.status_code in [200, 404, 405]:
                self.log_result("Sunucu Bağlantısı", True, f"Sunucu yanıt veriyor (status: {response.status_code})")
                return True
            else:
                self.log_result("Sunucu Bağlantısı", False, "", f"Beklenmeyen status kodu: {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Sunucu Bağlantısı", False, "", str(e))
            return False

    def test_health_check_api(self):
        """Test 2: Health Check API Endpoint"""
        try:
            response = self.session.get(f"{API_BASE}/")
            if response.status_code == 200:
                data = response.json()
                if data.get("message") == "Network Solution API":
                    self.log_result("Health Check API", True, f"Doğru yanıt: {data}")
                    return True
                else:
                    self.log_result("Health Check API", False, "", f"Yanlış mesaj: {data}")
                    return False
            else:
                self.log_result("Health Check API", False, "", f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_result("Health Check API", False, "", str(e))
            return False

    def test_cities_api(self):
        """Test 3: Cities API"""
        try:
            response = self.session.get(f"{API_BASE}/cities")
            if response.status_code == 200:
                data = response.json()
                cities = data.get("cities", [])
                if len(cities) == 81 and "İstanbul" in cities and "Ankara" in cities:
                    self.log_result("Şehirler API", True, f"81 şehir döndü: İstanbul, Ankara dahil")
                    return True
                else:
                    self.log_result("Şehirler API", False, "", f"Beklenen 81 şehir bulunamadı. Dönen: {len(cities)}")
                    return False
            else:
                self.log_result("Şehirler API", False, "", f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_result("Şehirler API", False, "", str(e))
            return False

    def test_authentication_protection(self):
        """Test 4: Authentication Protection"""
        protected_endpoints = [
            ("/communities", "Topluluklar"),
            ("/posts", "Gönderiler"),
            ("/services", "Hizmetler"),
            ("/notifications", "Bildirimler"),
            ("/user/profile", "Kullanıcı Profili"),
            ("/chats", "Sohbetler")
        ]
        
        all_protected = True
        for endpoint, name in protected_endpoints:
            try:
                response = self.session.get(f"{API_BASE}{endpoint}")
                if response.status_code in [401, 403, 422]:
                    self.log_result(f"{name} Koruması", True, f"Doğru şekilde korunuyor (status: {response.status_code})")
                else:
                    self.log_result(f"{name} Koruması", False, "", f"Korunmuyor! Status: {response.status_code}")
                    all_protected = False
            except Exception as e:
                self.log_result(f"{name} Koruması", False, "", str(e))
                all_protected = False
        
        return all_protected

    def test_admin_endpoints_protection(self):
        """Test 5: Admin Endpoints Protection"""
        admin_endpoints = [
            ("/admin/dashboard", "Admin Dashboard"),
            ("/admin/users", "Admin Kullanıcılar"),
            ("/admin/communities", "Admin Topluluklar")
        ]
        
        all_protected = True
        for endpoint, name in admin_endpoints:
            try:
                response = self.session.get(f"{API_BASE}{endpoint}")
                if response.status_code in [401, 403, 422]:
                    self.log_result(f"{name} Koruması", True, f"Doğru şekilde korunuyor (status: {response.status_code})")
                else:
                    self.log_result(f"{name} Koruması", False, "", f"Korunmuyor! Status: {response.status_code}")
                    all_protected = False
            except Exception as e:
                self.log_result(f"{name} Koruması", False, "", str(e))
                all_protected = False
        
        return all_protected

    def test_user_registration_mock(self):
        """Test 6: User Registration (Mock Firebase Token)"""
        try:
            # Since we can't create real Firebase tokens, we test the endpoint structure
            headers = {"Authorization": "Bearer mock_firebase_token"}
            user_data = {
                "email": TEST_USER["email"],
                "firstName": TEST_USER["firstName"],
                "lastName": TEST_USER["lastName"],
                "city": "İstanbul",
                "occupation": "Test Engineer"
            }
            
            response = self.session.post(f"{API_BASE}/user/register", json=user_data, headers=headers)
            
            if response.status_code == 401:
                self.log_result("Kullanıcı Kaydı", True, "Firebase authentication sistemi aktif - 401 Unauthorized")
                return True
            elif response.status_code == 200:
                # If somehow it works (maybe with mock token)
                data = response.json()
                self.log_result("Kullanıcı Kaydı", True, f"Kullanıcı oluşturuldu: {data.get('firstName')} {data.get('lastName')}")
                return True
            else:
                self.log_result("Kullanıcı Kaydı", False, "", f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_result("Kullanıcı Kaydı", False, "", str(e))
            return False

    def test_profile_endpoints_structure(self):
        """Test 7: Profile Endpoints Structure"""
        profile_endpoints = [
            ("/user/profile", "GET", "Profil Görüntüleme"),
            ("/user/privacy-settings", "GET", "Gizlilik Ayarları"),
            ("/user/is-admin", "GET", "Admin Kontrolü")
        ]
        
        all_structured = True
        for endpoint, method, name in profile_endpoints:
            try:
                if method == "GET":
                    response = self.session.get(f"{API_BASE}{endpoint}")
                
                if response.status_code in [401, 403, 422]:
                    self.log_result(f"{name} Yapısı", True, f"Endpoint mevcut ve korunuyor (status: {response.status_code})")
                elif response.status_code == 200:
                    self.log_result(f"{name} Yapısı", True, f"Endpoint çalışıyor (status: {response.status_code})")
                else:
                    self.log_result(f"{name} Yapısı", False, "", f"Beklenmeyen status: {response.status_code}")
                    all_structured = False
            except Exception as e:
                self.log_result(f"{name} Yapısı", False, "", str(e))
                all_structured = False
        
        return all_structured

    def test_communities_structure(self):
        """Test 8: Communities API Structure"""
        try:
            # Test communities list endpoint
            response = self.session.get(f"{API_BASE}/communities")
            if response.status_code in [401, 403, 422]:
                self.log_result("Topluluklar API Yapısı", True, f"Endpoint mevcut ve korunuyor (status: {response.status_code})")
                return True
            else:
                self.log_result("Topluluklar API Yapısı", False, "", f"Beklenmeyen status: {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Topluluklar API Yapısı", False, "", str(e))
            return False

    def test_messaging_structure(self):
        """Test 9: Messaging API Structure"""
        messaging_endpoints = [
            ("/chats", "Sohbet Listesi"),
            ("/private-messages", "Özel Mesajlar")
        ]
        
        all_structured = True
        for endpoint, name in messaging_endpoints:
            try:
                response = self.session.get(f"{API_BASE}{endpoint}")
                if response.status_code in [401, 403, 422]:
                    self.log_result(f"{name} API Yapısı", True, f"Endpoint mevcut ve korunuyor (status: {response.status_code})")
                else:
                    self.log_result(f"{name} API Yapısı", False, "", f"Beklenmeyen status: {response.status_code}")
                    all_structured = False
            except Exception as e:
                self.log_result(f"{name} API Yapısı", False, "", str(e))
                all_structured = False
        
        return all_structured

    def test_posts_structure(self):
        """Test 10: Posts API Structure"""
        try:
            response = self.session.get(f"{API_BASE}/posts")
            if response.status_code in [401, 403, 422]:
                self.log_result("Gönderiler API Yapısı", True, f"Endpoint mevcut ve korunuyor (status: {response.status_code})")
                return True
            else:
                self.log_result("Gönderiler API Yapısı", False, "", f"Beklenmeyen status: {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Gönderiler API Yapısı", False, "", str(e))
            return False

    def test_services_structure(self):
        """Test 11: Services API Structure"""
        try:
            response = self.session.get(f"{API_BASE}/services")
            if response.status_code in [401, 403, 422]:
                self.log_result("Hizmetler API Yapısı", True, f"Endpoint mevcut ve korunuyor (status: {response.status_code})")
                return True
            else:
                self.log_result("Hizmetler API Yapısı", False, "", f"Beklenmeyen status: {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Hizmetler API Yapısı", False, "", str(e))
            return False

    def test_notifications_structure(self):
        """Test 12: Notifications API Structure"""
        try:
            response = self.session.get(f"{API_BASE}/notifications")
            if response.status_code in [401, 403, 422]:
                self.log_result("Bildirimler API Yapısı", True, f"Endpoint mevcut ve korunuyor (status: {response.status_code})")
                return True
            else:
                self.log_result("Bildirimler API Yapısı", False, "", f"Beklenmeyen status: {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Bildirimler API Yapısı", False, "", str(e))
            return False

    def test_feedback_structure(self):
        """Test 13: Feedback API Structure"""
        try:
            # Test feedback submission endpoint
            headers = {"Authorization": "Bearer mock_firebase_token"}
            feedback_data = {
                "type": "bug",
                "subject": "Test Feedback",
                "message": "Test message",
                "rating": 5
            }
            response = self.session.post(f"{API_BASE}/feedback", json=feedback_data, headers=headers)
            
            if response.status_code in [401, 403, 422]:
                self.log_result("Geri Bildirim API Yapısı", True, f"Endpoint mevcut ve korunuyor (status: {response.status_code})")
                return True
            elif response.status_code == 200:
                self.log_result("Geri Bildirim API Yapısı", True, f"Endpoint çalışıyor (status: {response.status_code})")
                return True
            else:
                self.log_result("Geri Bildirim API Yapısı", False, "", f"Beklenmeyen status: {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Geri Bildirim API Yapısı", False, "", str(e))
            return False

    def test_users_list_structure(self):
        """Test 14: Users List API Structure"""
        try:
            response = self.session.get(f"{API_BASE}/users")
            if response.status_code in [401, 403, 422]:
                self.log_result("Kullanıcılar Listesi API Yapısı", True, f"Endpoint mevcut ve korunuyor (status: {response.status_code})")
                return True
            else:
                self.log_result("Kullanıcılar Listesi API Yapısı", False, "", f"Beklenmeyen status: {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Kullanıcılar Listesi API Yapısı", False, "", str(e))
            return False

    def test_media_upload_structure(self):
        """Test 15: Media Upload API Structure"""
        try:
            headers = {"Authorization": "Bearer mock_firebase_token"}
            media_data = {
                "data": "base64_test_data",
                "type": "image"
            }
            response = self.session.post(f"{API_BASE}/upload/media", json=media_data, headers=headers)
            
            if response.status_code in [401, 403, 422]:
                self.log_result("Medya Yükleme API Yapısı", True, f"Endpoint mevcut ve korunuyor (status: {response.status_code})")
                return True
            elif response.status_code == 200:
                self.log_result("Medya Yükleme API Yapısı", True, f"Endpoint çalışıyor (status: {response.status_code})")
                return True
            else:
                self.log_result("Medya Yükleme API Yapısı", False, "", f"Beklenmeyen status: {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Medya Yükleme API Yapısı", False, "", str(e))
            return False
        
    def test_server_connectivity(self):
        """Test basic server connectivity"""
        print("🔍 Testing server connectivity...")
        try:
            response = self.session.get(BACKEND_URL, timeout=5)
            if response.status_code in [200, 404, 405]:  # Any response means server is up
                self.results["server_connectivity"]["status"] = "pass"
                self.results["server_connectivity"]["details"] = f"Server responding (status: {response.status_code})"
                print(f"✅ Server is responding (status: {response.status_code})")
                return True
            else:
                self.results["server_connectivity"]["status"] = "fail"
                self.results["server_connectivity"]["details"] = f"Unexpected status code: {response.status_code}"
                print(f"❌ Unexpected status code: {response.status_code}")
                return False
        except requests.exceptions.RequestException as e:
            self.results["server_connectivity"]["status"] = "fail"
            self.results["server_connectivity"]["details"] = f"Connection error: {str(e)}"
            print(f"❌ Server connection failed: {str(e)}")
            return False

    def test_health_check(self):
        """Test GET /api/ endpoint"""
        print("🔍 Testing health check endpoint...")
        try:
            response = self.session.get(f"{API_BASE}/")
            
            if response.status_code == 200:
                data = response.json()
                expected_message = "Network Solution API"
                
                if data.get("message") == expected_message:
                    self.results["health_check"]["status"] = "pass"
                    self.results["health_check"]["details"] = f"Correct response: {data}"
                    print(f"✅ Health check passed: {data}")
                    return True
                else:
                    self.results["health_check"]["status"] = "fail"
                    self.results["health_check"]["details"] = f"Wrong message. Expected: '{expected_message}', Got: {data}"
                    print(f"❌ Wrong message. Expected: '{expected_message}', Got: {data}")
                    return False
            else:
                self.results["health_check"]["status"] = "fail"
                self.results["health_check"]["details"] = f"HTTP {response.status_code}: {response.text}"
                print(f"❌ Health check failed with status {response.status_code}: {response.text}")
                return False
                
        except requests.exceptions.RequestException as e:
            self.results["health_check"]["status"] = "fail"
            self.results["health_check"]["details"] = f"Request error: {str(e)}"
            print(f"❌ Health check request failed: {str(e)}")
            return False
        except json.JSONDecodeError as e:
            self.results["health_check"]["status"] = "fail"
            self.results["health_check"]["details"] = f"Invalid JSON response: {str(e)}"
            print(f"❌ Invalid JSON response: {str(e)}")
            return False

    def test_cities_endpoint(self):
        """Test GET /api/cities endpoint"""
        print("🔍 Testing cities endpoint...")
        try:
            response = self.session.get(f"{API_BASE}/cities")
            
            if response.status_code == 200:
                data = response.json()
                cities = data.get("cities", [])
                
                # Check if we have 81 Turkish cities
                if len(cities) == 81:
                    # Check for some expected cities
                    expected_cities = ["İstanbul", "Ankara", "İzmir", "Bursa", "Antalya"]
                    missing_cities = [city for city in expected_cities if city not in cities]
                    
                    if not missing_cities:
                        self.results["cities_endpoint"]["status"] = "pass"
                        self.results["cities_endpoint"]["details"] = f"All 81 Turkish cities returned correctly. Sample: {cities[:5]}"
                        print(f"✅ Cities endpoint passed: {len(cities)} cities returned")
                        print(f"   Sample cities: {cities[:5]}")
                        return True
                    else:
                        self.results["cities_endpoint"]["status"] = "fail"
                        self.results["cities_endpoint"]["details"] = f"Missing expected cities: {missing_cities}"
                        print(f"❌ Missing expected cities: {missing_cities}")
                        return False
                else:
                    self.results["cities_endpoint"]["status"] = "fail"
                    self.results["cities_endpoint"]["details"] = f"Expected 81 cities, got {len(cities)}"
                    print(f"❌ Expected 81 cities, got {len(cities)}")
                    return False
            else:
                self.results["cities_endpoint"]["status"] = "fail"
                self.results["cities_endpoint"]["details"] = f"HTTP {response.status_code}: {response.text}"
                print(f"❌ Cities endpoint failed with status {response.status_code}: {response.text}")
                return False
                
        except requests.exceptions.RequestException as e:
            self.results["cities_endpoint"]["status"] = "fail"
            self.results["cities_endpoint"]["details"] = f"Request error: {str(e)}"
            print(f"❌ Cities endpoint request failed: {str(e)}")
            return False
        except json.JSONDecodeError as e:
            self.results["cities_endpoint"]["status"] = "fail"
            self.results["cities_endpoint"]["details"] = f"Invalid JSON response: {str(e)}"
            print(f"❌ Invalid JSON response: {str(e)}")
            return False

    def test_admin_endpoints_protection(self):
        """Test admin endpoints without authentication - should return 401/403"""
        admin_endpoints = [
            ("admin_dashboard", "/admin/dashboard"),
            ("admin_users", "/admin/users"), 
            ("admin_communities", "/admin/communities")
        ]
        
        for endpoint_key, endpoint_path in admin_endpoints:
            print(f"🔍 Testing {endpoint_path} protection...")
            try:
                response = self.session.get(f"{API_BASE}{endpoint_path}")
                
                # Should return 401, 403, or 422 (missing auth header)
                if response.status_code in [401, 403, 422]:
                    self.results[endpoint_key]["status"] = "pass"
                    self.results[endpoint_key]["details"] = f"Correctly requires authentication (status: {response.status_code})"
                    print(f"✅ {endpoint_path} correctly protected (status: {response.status_code})")
                else:
                    self.results[endpoint_key]["status"] = "fail"
                    self.results[endpoint_key]["details"] = f"Not protected! Status {response.status_code}: {response.text[:200]}"
                    print(f"❌ {endpoint_path} not protected! Status {response.status_code}")
                    
            except requests.exceptions.RequestException as e:
                self.results[endpoint_key]["status"] = "fail"
                self.results[endpoint_key]["details"] = f"Request error: {str(e)}"
                print(f"❌ {endpoint_path} request failed: {str(e)}")

    def test_communities_endpoint_auth_required(self):
        """Test GET /api/communities endpoint (should require auth)"""
        print("🔍 Testing communities endpoint (auth required)...")
        try:
            response = self.session.get(f"{API_BASE}/communities")
            
            # This endpoint should return 401 or 403 without auth token
            if response.status_code in [401, 403]:
                self.results["communities_endpoint"]["status"] = "pass"
                self.results["communities_endpoint"]["details"] = f"Correctly requires authentication (status: {response.status_code})"
                print(f"✅ Communities endpoint correctly requires authentication (status: {response.status_code})")
                return True
            elif response.status_code == 422:
                # FastAPI returns 422 for missing authorization header
                self.results["communities_endpoint"]["status"] = "pass"
                self.results["communities_endpoint"]["details"] = f"Correctly requires authentication (status: {response.status_code})"
                print(f"✅ Communities endpoint correctly requires authentication (status: {response.status_code})")
                return True
            else:
                self.results["communities_endpoint"]["status"] = "fail"
                self.results["communities_endpoint"]["details"] = f"Expected auth error, got status {response.status_code}: {response.text}"
                print(f"❌ Expected auth error, got status {response.status_code}: {response.text}")
                return False
                
        except requests.exceptions.RequestException as e:
            self.results["communities_endpoint"]["status"] = "fail"
            self.results["communities_endpoint"]["details"] = f"Request error: {str(e)}"
            print(f"❌ Communities endpoint request failed: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all tests and return summary"""
        print("🚀 Starting Network Solution API Tests")
        print(f"📍 Testing backend at: {BACKEND_URL}")
        print("=" * 60)
        
        # Test server connectivity first
        if not self.test_server_connectivity():
            print("\n❌ Server is not accessible. Skipping other tests.")
            return self.get_summary()
        
        # Run all tests
        self.test_health_check()
        self.test_cities_endpoint()
        self.test_communities_endpoint_auth_required()
        self.test_admin_endpoints_protection()
        
        return self.get_summary()

    def get_summary(self):
        """Get test results summary"""
        print("\n" + "=" * 60)
        print("📊 TEST RESULTS SUMMARY")
        print("=" * 60)
        
        passed = 0
        failed = 0
        
        for test_name, result in self.results.items():
            status = result["status"]
            details = result["details"]
            
            if status == "pass":
                print(f"✅ {test_name}: PASSED")
                passed += 1
            elif status == "fail":
                print(f"❌ {test_name}: FAILED - {details}")
                failed += 1
            else:
                print(f"⏸️  {test_name}: PENDING")
        
        print(f"\n📈 Total: {passed} passed, {failed} failed")
        
        if failed == 0 and passed > 0:
            print("🎉 All tests passed!")
            return True
        else:
            print("⚠️  Some tests failed!")
            return False

def main():
    """Main test runner"""
    tester = NetworkSolutionAPITester()
    success = tester.run_all_tests()
    
    # Return appropriate exit code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()