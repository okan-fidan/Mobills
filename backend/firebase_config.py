import firebase_admin
from firebase_admin import credentials, auth
from pathlib import Path

# Initialize Firebase Admin SDK with service account
service_account_path = Path(__file__).parent / 'firebase-service-account.json'

try:
    # Check if already initialized
    firebase_admin.get_app()
except ValueError:
    # Initialize with service account credentials
    cred = credentials.Certificate(str(service_account_path))
    firebase_admin.initialize_app(cred, {
        'projectId': 'networksolution-a9480',
        'storageBucket': 'networksolution-a9480.firebasestorage.app'
    })

def verify_firebase_token(token: str):
    """Verify Firebase ID token using Firebase Admin SDK"""
    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except auth.ExpiredIdTokenError:
        raise Exception("Token has expired")
    except auth.RevokedIdTokenError:
        raise Exception("Token has been revoked")
    except auth.InvalidIdTokenError as e:
        raise Exception(f"Invalid token: {str(e)}")
    except Exception as e:
        raise Exception(f"Token verification failed: {str(e)}")
