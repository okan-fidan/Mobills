#!/usr/bin/env python3
"""
Network Solution Backend API Test Suite
Tests the basic health check endpoints and server connectivity
"""

import requests
import json
import sys
from typing import Dict, Any

# Backend URL from frontend environment
BACKEND_URL = "https://bizcomm-3.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

class NetworkSolutionAPITester:
    def __init__(self):
        self.results = {
            "health_check": {"status": "pending", "details": ""},
            "cities_endpoint": {"status": "pending", "details": ""},
            "communities_endpoint": {"status": "pending", "details": ""},
            "admin_dashboard": {"status": "pending", "details": ""},
            "admin_users": {"status": "pending", "details": ""},
            "admin_communities": {"status": "pending", "details": ""},
            "server_connectivity": {"status": "pending", "details": ""}
        }
        self.session = requests.Session()
        self.session.timeout = 10
        
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