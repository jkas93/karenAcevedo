import os
from PIL import Image

def convert_to_webp():
    input_path = r"c:\Users\KEVIN AVALOS\Webs\karen\Gemini_Generated_Image_eamahqeamahqeama.png"
    output_path = r"c:\Users\KEVIN AVALOS\Webs\karen\web-campana\public\karen-oficial.webp"
    
    try:
        if not os.path.exists(input_path):
            print("Input file not found.")
            return
            
        img = Image.open(input_path)
        img.save(output_path, "webp", quality=85)
        print("Successfully converted to WebP!")
    except Exception as e:
        print(f"Error converting image: {e}")

if __name__ == "__main__":
    convert_to_webp()
