import os
from PIL import Image

def crop_hero():
    try:
        path = "public/karen-hero.jpg"
        if not os.path.exists(path): return
        img = Image.open(path)
        # Banner is 2056x765. Karen is on the left.
        # Let's crop a portrait of her: Left 0, Top 0, Right 850, Bottom 765
        cropped = img.crop((0, 0, 850, 765))
        cropped.save("public/karen-hero-cropped.jpg")
        print("Hero cropped successfully.")
    except Exception as e:
        print(f"Error cropping hero: {e}")

def crop_bio():
    try:
        path = "public/karen-bio.jpg"
        if not os.path.exists(path): return
        img = Image.open(path)
        # Flyer is 1080x1350. Karen is at the bottom right.
        # Let's crop: Left 350, Top 650, Right 1080, Bottom 1350
        cropped = img.crop((350, 600, 1080, 1350))
        cropped.save("public/karen-bio-cropped.jpg")
        print("Bio cropped successfully.")
    except Exception as e:
        print(f"Error cropping bio: {e}")

crop_hero()
crop_bio()
