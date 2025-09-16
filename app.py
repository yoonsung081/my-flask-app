import os
from flask import Flask, jsonify, request
from flask_cors import CORS  # CORS 허용

app = Flask(__name__)
CORS(app)  # 모든 출처 허용, 필요하면 origins=["http://127.0.0.1:5500"]로 제한 가능

# 예시 공항 데이터 (원하면 나중에 외부 API로 확장 가능)
airports = [
    {'code': 'ICN', 'name': '인천국제공항'},
    {'code': 'GMP', 'name': '김포국제공항'},
    {'code': 'PUS', 'name': '부산김해국제공항'},
]

@app.route('/')
def home():
    return "Hello, Flask World!"

@app.route('/airports', methods=['GET'])
def get_airports():
    location = request.args.get('location', '')
    # location 문자열이 공항 이름에 포함되는 경우 필터링
    filtered_airports = [airport for airport in airports if location.lower() in airport['name'].lower()]
    
    # 디버깅용 로그
    print("Location param:", location)
    print("Filtered Airports:", filtered_airports)
    
    return jsonify(filtered_airports)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))  # Render에서 지정한 PORT 사용, 없으면 5000
    app.run(host="0.0.0.0", port=port)
