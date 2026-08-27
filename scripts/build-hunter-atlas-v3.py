from collections import deque
from pathlib import Path

from PIL import Image, ImageEnhance


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "art-source" / "pixel-runtime" / "hunter-aiko-chroma-v3.png"
LEGACY = ROOT / "public" / "art" / "pixel-hunters-v1.webp"
OUTPUT = ROOT / "public" / "art" / "pixel-hunters-v3.webp"
PREVIEW = ROOT / "work" / "pixel-hunters-v3-preview.png"
CELL_WIDTH = 16
CELL_HEIGHT = 20


def chroma_alpha(source: Image.Image) -> Image.Image:
    """Remove only the connected green-screen background, preserving interior colors."""
    source = source.convert("RGB")
    width, height = source.size
    pixels = source.load()
    outside = bytearray(width * height)
    queue: deque[int] = deque()

    def green(index: int) -> bool:
        red, value, blue = pixels[index % width, index // width]
        return value > 92 and value - red > 30 and value - blue > 30

    for x in range(width):
        queue.extend((x, (height - 1) * width + x))
    for y in range(height):
        queue.extend((y * width, y * width + width - 1))

    while queue:
        index = queue.popleft()
        if outside[index] or not green(index):
            continue
        outside[index] = 1
        x, y = index % width, index // width
        if x:
            queue.append(index - 1)
        if x + 1 < width:
            queue.append(index + 1)
        if y:
            queue.append(index - width)
        if y + 1 < height:
            queue.append(index + width)

    result = Image.new("RGBA", source.size)
    result.putdata(
        [(*rgb, 0 if outside[index] else 255) for index, rgb in enumerate(source.get_flattened_data())]
    )
    return result


def pixel_character(cell: Image.Image) -> Image.Image:
    alpha = cell.getchannel("A").point(lambda value: 255 if value >= 64 else 0)
    box = alpha.getbbox()
    if not box:
        return Image.new("RGBA", (CELL_WIDTH, CELL_HEIGHT))

    cell = cell.crop(box)
    scale = min((CELL_WIDTH - 2) / cell.width, (CELL_HEIGHT - 2) / cell.height)
    cell = cell.resize(
        (max(1, round(cell.width * scale)), max(1, round(cell.height * scale))),
        Image.Resampling.NEAREST,
    )
    cell = ImageEnhance.Color(cell).enhance(1.08)
    cell = ImageEnhance.Contrast(cell).enhance(1.08)
    cell = ImageEnhance.Brightness(cell).enhance(1.06)

    clean = Image.new("RGB", cell.size)
    clean.paste(cell.convert("RGB"), mask=cell.getchannel("A"))
    clean = clean.quantize(
        colors=18, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE
    ).convert("RGB")
    rebuilt = Image.new("RGBA", cell.size)
    rebuilt.paste(clean)
    rebuilt.putalpha(cell.getchannel("A").point(lambda value: 255 if value >= 64 else 0))

    output = Image.new("RGBA", (CELL_WIDTH, CELL_HEIGHT))
    output.alpha_composite(
        rebuilt,
        ((CELL_WIDTH - rebuilt.width) // 2, CELL_HEIGHT - rebuilt.height - 1),
    )
    return output


def recolor_cell(cell: Image.Image, index: int) -> Image.Image:
    """Keep approved east-facing silhouettes while aligning latest identities."""
    result = cell.copy()
    pixels = result.load()
    for y in range(result.height):
        for x in range(result.width):
            red, green, blue, alpha = pixels[x, y]
            if not alpha:
                continue

            # Vesper's approved pose predates her silver-hair identity pass.
            if index == 0 and y < 13 and red > green * 1.12 and blue >= red * 0.88:
                light = max(red, blue)
                pixels[x, y] = (
                    min(211, round(light * 1.45)),
                    min(216, round(light * 1.48)),
                    min(225, round(light * 1.55)),
                    alpha,
                )

            # Tempest: warm the visible skin, retain the silver braid and cobalt kit.
            elif index == 4 and red > blue * 1.28 and red > green * 1.08:
                if red > 175 and green > 105:
                    pixels[x, y] = (
                        min(222, round(red * 0.92)),
                        min(157, round(green * 0.79)),
                        min(111, round(blue * 0.76)),
                        alpha,
                    )

            # Briar: turn the orange prototype hair/coat into auburn and burgundy.
            elif index == 5 and red > 70 and red > green * 1.65 and green > blue * 1.5:
                brightness = max(red, green)
                if green >= 38:
                    pixels[x, y] = (
                        min(112, round(brightness * 0.64)),
                        min(58, round(brightness * 0.32)),
                        min(43, round(brightness * 0.24)),
                        alpha,
                    )
                else:
                    pixels[x, y] = (
                        min(82, round(brightness * 0.72)),
                        min(39, round(brightness * 0.29)),
                        min(46, round(brightness * 0.35)),
                        alpha,
                    )
    return result


def main() -> None:
    legacy = Image.open(LEGACY).convert("RGBA")
    atlas = Image.new("RGBA", legacy.size)

    for index in range(8):
        column, row = index % 4, index // 4
        box = (
            column * CELL_WIDTH,
            row * CELL_HEIGHT,
            (column + 1) * CELL_WIDTH,
            (row + 1) * CELL_HEIGHT,
        )
        atlas.alpha_composite(recolor_cell(legacy.crop(box), index), box[:2])

    # Slot 2 formerly held Ama's retired model. Replace it with current Aiko.
    aiko = pixel_character(chroma_alpha(Image.open(SOURCE)))
    atlas.paste(Image.new("RGBA", (CELL_WIDTH, CELL_HEIGHT)), (2 * CELL_WIDTH, 0))
    atlas.alpha_composite(aiko, (2 * CELL_WIDTH, 0))

    atlas.save(OUTPUT, "WEBP", lossless=True, method=6)
    preview = Image.new("RGBA", atlas.size, "#07362b")
    preview.alpha_composite(atlas)
    preview.resize(
        (atlas.width * 12, atlas.height * 12), Image.Resampling.NEAREST
    ).convert("RGB").save(PREVIEW)
    used = sum(1 for alpha in atlas.getchannel("A").get_flattened_data() if alpha)
    print(f"{OUTPUT.name}: {atlas.size}, opaque-pixels={used}")


if __name__ == "__main__":
    main()
