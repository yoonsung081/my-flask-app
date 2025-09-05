from flask import Flask, jsonify, request

app = Flask(__name__)

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
    filtered_airports = [airport for airport in airports if location.lower() in airport['name'].lower()]
    return jsonify(filtered_airports)

if __name__ == '__main__':
    app.run(debug=True)
