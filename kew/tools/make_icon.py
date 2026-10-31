# Kew launcher icon generator — Cybergah Group.
# Draws a clean keklik (chukar partridge), supersampled for smooth edges.
# Transparent background (no medallion) — just the bird.
import sys, os
from PIL import Image, ImageDraw

GOLD = (202, 166, 74)
BODY = (201, 178, 122)
BODY_DK = (150, 128, 80)
CREAM = (245, 237, 214)
RED = (212, 50, 42)
BLACK = (22, 20, 18)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def _draw(S):
    """Draw the keklik on a transparent SxS canvas (design space 1000x1000)."""
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    k = S / 1000.0

    def P(*pts):
        return [(x * k, y * k) for x, y in pts]

    def E(x0, y0, x1, y1):
        return [x0 * k, y0 * k, x1 * k, y1 * k]

    # tail (behind body)
    d.polygon(P((380, 545), (210, 470), (255, 545), (340, 650), (415, 605)), fill=BODY_DK)
    # body
    d.ellipse(E(330, 470, 720, 765), fill=BODY)
    # belly highlight
    d.ellipse(E(395, 560, 660, 760), fill=lerp(BODY, CREAM, 0.25))
    # head
    d.ellipse(E(520, 300, 775, 555), fill=BODY)
    # cheek / throat cream patch
    d.ellipse(E(560, 360, 770, 540), fill=CREAM)
    # black chukar face-stripe — crescent through eye to throat
    stripe = P((628, 330), (690, 352), (738, 400), (742, 452), (708, 500), (652, 522))
    d.line(stripe, fill=BLACK, width=int(20 * k), joint="curve")
    # eye
    d.ellipse(E(686, 392, 726, 432), fill=BLACK)
    d.ellipse(E(700, 400, 714, 414), fill=CREAM)
    # beak (red)
    d.polygon(P((758, 412), (860, 396), (780, 470)), fill=RED)
    # flank bars
    for y in (600, 645, 690):
        d.line(P((600, y), (695, y + 8)), fill=BODY_DK, width=int(13 * k))
    # legs
    d.line(P((520, 752), (505, 835)), fill=RED, width=int(15 * k))
    d.line(P((610, 758), (625, 840)), fill=RED, width=int(15 * k))
    return img


def render(size, margin=0.06):
    """Bird only, auto-cropped and centered on a transparent square."""
    S = size * 4
    big = _draw(S)
    bbox = big.getbbox()
    bird = big.crop(bbox)
    target = int(S * (1 - 2 * margin))
    w, h = bird.size
    scale = target / max(w, h)
    bird = bird.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.LANCZOS)
    canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    canvas.paste(bird, ((S - bird.size[0]) // 2, (S - bird.size[1]) // 2), bird)
    return canvas.resize((size, size), Image.LANCZOS)


def export(res_dir, assets_dir):
    dens = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
    for name, px in dens.items():
        img = render(px)
        d = os.path.join(res_dir, "mipmap-" + name)
        os.makedirs(d, exist_ok=True)
        img.save(os.path.join(d, "ic_launcher.png"))
        img.save(os.path.join(d, "ic_launcher_round.png"))
        img.save(os.path.join(d, "ic_launcher_foreground.png"))
        print("wrote", d)
    render(512).save(os.path.join(res_dir, "..", "..", "..", "..", "kew-icon-512.png"))
    os.makedirs(assets_dir, exist_ok=True)
    render(256).save(os.path.join(assets_dir, "logo.png"))
    print("wrote in-app logo + 512 reference")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "export":
        export(sys.argv[2], sys.argv[3])
    else:
        out = sys.argv[1] if len(sys.argv) > 1 else "icon_preview.png"
        render(512).save(out)
        print("wrote", out)
