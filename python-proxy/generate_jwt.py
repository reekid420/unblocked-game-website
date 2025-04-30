import jwt
import time

JWT_SECRET = "9f3886119b42bbfef4a01917499b457136bf1096dbfb2010012eea820e7ea3f76dfa041223f1fd25a614b4bb87dca76803270f0e4cba259f3d85cfd7bd60194c"
payload = {
    "sub": "testuser",
    "exp": int(time.time()) + 3600,
    "type": "access"
}

token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
print(token)