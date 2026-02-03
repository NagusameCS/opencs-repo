from cryptography.fernet import Fernet
import os

# Get the directory where this utils folder is located
_UTILS_DIR = os.path.dirname(os.path.abspath(__file__))
_BASE_DIR = os.path.dirname(_UTILS_DIR)  # Parent of utils/
KEY_FILE = os.path.join(_BASE_DIR, "secret.key")

def generate_key():
    """Generates a key and saves it into a file"""
    key = Fernet.generate_key()
    with open(KEY_FILE, "wb") as key_file:
        key_file.write(key)

def load_key():
    """Loads the key from the valentin directory"""
    if not os.path.exists(KEY_FILE):
        generate_key()
    return open(KEY_FILE, "rb").read()

def encrypt_file(file_path):
    """Encrypts a file"""
    key = load_key()
    f = Fernet(key)
    with open(file_path, "rb") as file:
        file_data = file.read()
    encrypted_data = f.encrypt(file_data)
    with open(file_path, "wb") as file:
        file.write(encrypted_data)

def decrypt_file(file_path):
    """Decrypts a file"""
    key = load_key()
    f = Fernet(key)
    with open(file_path, "rb") as file:
        encrypted_data = file.read()
    decrypted_data = f.decrypt(encrypted_data)
    with open(file_path, "wb") as file:
        file.write(decrypted_data)

def encrypt_data(data):
    """Encrypts string data"""
    key = load_key()
    f = Fernet(key)
    return f.encrypt(data.encode()).decode()

def decrypt_data(encrypted_data):
    """Decrypts string data"""
    key = load_key()
    f = Fernet(key)
    return f.decrypt(encrypted_data.encode()).decode()
