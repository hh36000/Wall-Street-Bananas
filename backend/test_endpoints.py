import requests

BASE_URL = "http://localhost:8080"

def test_root():
    """Test the root endpoint"""
    print("Testing GET /")
    try:
        response = requests.get(f"{BASE_URL}/")
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        print("✅ Root endpoint working!\n")
    except Exception as e:
        print(f"❌ Error: {e}\n")


def test_health():
    """Test the health check endpoint"""
    print("Testing GET /health")
    try:
        response = requests.get(f"{BASE_URL}/health")
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        print("✅ Health endpoint working!\n")
    except Exception as e:
        print(f"❌ Error: {e}\n")


def test_docs():
    """Test the docs endpoint"""
    print("Testing GET /docs")
    try:
        response = requests.get(f"{BASE_URL}/docs")
        print(f"Status Code: {response.status_code}")
        print(f"Content Type: {response.headers.get('content-type')}")
        print("✅ Docs endpoint working!\n")
    except Exception as e:
        print(f"❌ Error: {e}\n")


if __name__ == "__main__":
    print("=" * 50)
    print("Testing FastAPI Endpoints")
    print("=" * 50 + "\n")
    
    test_root()
    test_health()
    test_docs()
    
    print("=" * 50)
    print("All tests completed!")
    print("=" * 50)





