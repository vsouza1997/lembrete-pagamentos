import pathlib
import struct
import zlib


def png(tamanho, rgb):
    linha = b"\x00" + bytes(rgb) * tamanho
    bruto = linha * tamanho

    def bloco(tipo, dados):
        corpo = tipo + dados
        return struct.pack(">I", len(dados)) + corpo + struct.pack(">I", zlib.crc32(corpo) & 0xFFFFFFFF)

    return (
        b"\x89PNG\r\n\x1a\n"
        + bloco(b"IHDR", struct.pack(">IIBBBBB", tamanho, tamanho, 8, 2, 0, 0, 0))
        + bloco(b"IDAT", zlib.compress(bruto))
        + bloco(b"IEND", b"")
    )


pasta = pathlib.Path("public/icons")
pasta.mkdir(parents=True, exist_ok=True)
for tamanho in (192, 512):
    (pasta / f"icon-{tamanho}.png").write_bytes(png(tamanho, (37, 165, 106)))
