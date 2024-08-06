from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
from rembg import remove
from PIL import Image, ImageFilter, ImageEnhance
import io

app = Flask(__name__)
CORS(app)

# Folder untuk menyimpan gambar sementara
UPLOAD_FOLDER = 'uploads'
RESULT_FOLDER = 'results'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESULT_FOLDER, exist_ok=True)

def post_process_image(image_data):
    """ Melakukan post-processing pada gambar untuk mengurangi kebocoran seleksi. """
    with Image.open(io.BytesIO(image_data)) as img:
        # Ubah gambar ke mode RGBA
        img = img.convert("RGBA")
        
        # Terapkan Gaussian Blur untuk menghaluskan tepi
        img = img.filter(ImageFilter.GaussianBlur(radius=1))
        
        # Menajamkan gambar
        enhancer = ImageEnhance.Sharpness(img)
        img = enhancer.enhance(2)  # Nilai dapat disesuaikan untuk ketajaman
        
        # Terapkan lagi Gaussian Blur dengan radius kecil untuk final touch
        img = img.filter(ImageFilter.GaussianBlur(radius=0.5))
        
        # Menghapus piksel tunggal yang mungkin tersisa di sekitar tepi
        img_data = img.getdata()
        new_data = []
        for item in img_data:
            if item[3] < 10:  # Mengatur nilai threshold untuk alpha channel
                new_data.append((255, 255, 255, 0))
            else:
                new_data.append(item)
        img.putdata(new_data)
        
        # Simpan gambar yang telah diproses ke buffer
        output_buffer = io.BytesIO()
        img.save(output_buffer, format='PNG')
        return output_buffer.getvalue()

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if file:
        file_path = os.path.join(UPLOAD_FOLDER, file.filename)
        file.save(file_path)

        result_path = os.path.join(RESULT_FOLDER, file.filename)
        try:
            # Baca gambar dari file
            with open(file_path, 'rb') as input_file:
                input_data = input_file.read()
                
                # Hapus latar belakang
                output_data = remove(input_data)
                
                # Post-processing untuk memperbaiki hasil
                processed_data = post_process_image(output_data)
                
                # Simpan hasil ke file
                with open(result_path, 'wb') as output_file:
                    output_file.write(processed_data)
        except Exception as e:
            print(f"Error: {e}")  # Print exception message
            return jsonify({'error': str(e)}), 500

        return send_from_directory(RESULT_FOLDER, file.filename, as_attachment=True)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)