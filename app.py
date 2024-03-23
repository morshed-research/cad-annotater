import os
import json
from flask import Flask, request, send_from_directory, jsonify

app = Flask(__name__, static_url_path='', static_folder='frontend')

@app.route('/')
def index():
    return send_from_directory('frontend', 'index.html')

if __name__ == '__main__':
    app.run(debug=True)
