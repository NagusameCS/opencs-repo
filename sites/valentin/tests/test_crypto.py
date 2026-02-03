import unittest
import sys
import os
from cryptography.fernet import Fernet

# Add parent directory to path to import utils
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.crypto_utils import encrypt_data, decrypt_data, generate_key, load_key

class TestCrypto(unittest.TestCase):
    def setUp(self):
        # Ensure a key exists
        if not os.path.exists("secret.key"):
            generate_key()

    def test_encrypt_decrypt_string(self):
        original_text = "This is a secret message"
        encrypted = encrypt_data(original_text)
        decrypted = decrypt_data(encrypted)
        
        self.assertNotEqual(original_text, encrypted)
        self.assertEqual(original_text, decrypted)

if __name__ == '__main__':
    unittest.main()
