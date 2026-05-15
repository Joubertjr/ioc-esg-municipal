"""
Instagram Carousel Capture MCP

Servidor MCP local que expõe ferramentas para baixar mídias (fotos, vídeos,
legendas, metadados) de posts e carrosséis públicos do Instagram a partir
de uma URL, usando Instaloader.

NÃO faz parte da plataforma IOC ESG Municipal — é uma ferramenta auxiliar
isolada em tools/.

Uso responsável: respeite os Termos de Serviço do Instagram e a legislação
de direitos autorais. Baixe apenas conteúdo que você tem permissão para
acessar/copiar.
"""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Any

import instaloader
from fastmcp import FastMCP

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("instagram-carousel-mcp")

mcp = FastMCP("instagram-carousel-capture")

SHORTCODE_PATTERNS = [
    re.compile(r"instagram\.com/p/(?P<code>[^/?#]+)"),
    re.compile(r"instagram\.com/reel/(?P<code>[^/?#]+)"),
    re.compile(r"instagram\.com/tv/(?P<code>[^/?#]+)"),
]


def extract_shortcode(url: str) -> str | None:
    for pattern in SHORTCODE_PATTERNS:
        match = pattern.search(url)
        if match:
            return match.group("code")
    return None


def build_loader(target_dir: Path, save_metadata: bool, download_video_thumbnails: bool) -> instaloader.Instaloader:
    return instaloader.Instaloader(
        dirname_pattern=str(target_dir),
        filename_pattern="{shortcode}_{mediaid}",
        download_pictures=True,
        download_videos=True,
        download_video_thumbnails=download_video_thumbnails,
        download_comments=False,
        download_geotags=False,
        save_metadata=save_metadata,
        compress_json=False,
        post_metadata_txt_pattern="",
        quiet=True,
    )


def summarize_post(post: instaloader.Post) -> dict[str, Any]:
    return {
        "shortcode": post.shortcode,
        "owner_username": post.owner_username,
        "is_video": post.is_video,
        "typename": post.typename,
        "mediacount": post.mediacount if post.typename == "GraphSidecar" else 1,
        "caption": post.caption,
        "date_utc": post.date_utc.isoformat() if post.date_utc else None,
        "likes": post.likes,
        "video_view_count": post.video_view_count if post.is_video else None,
    }


@mcp.tool()
def capture_instagram_carousel(
    url: str,
    output_dir: str = "./downloads",
    save_metadata: bool = True,
    download_video_thumbnails: bool = False,
    session_username: str | None = None,
    session_file: str | None = None,
) -> dict[str, Any]:
    """
    Baixa as mídias de um post, carrossel, reel ou IGTV público do Instagram.

    Args:
        url: URL pública do post (ex.: https://www.instagram.com/p/SHORTCODE/).
        output_dir: Diretório base onde os arquivos serão salvos.
            Será criado um subdiretório com o shortcode do post.
        save_metadata: Se True, salva metadados (.json.xz) e legenda.
        download_video_thumbnails: Se True, baixa também as thumbnails de vídeos.
        session_username: (Opcional) Username Instagram para carregar sessão
            salva previamente — necessário para posts privados/restritos.
        session_file: (Opcional) Caminho do arquivo de sessão do Instaloader.
            Se omitido, usa o local padrão do Instaloader.

    Returns:
        Dict com status, diretório de saída, lista de arquivos baixados e
        metadados do post (shortcode, autor, legenda, contagem de mídias).
    """
    shortcode = extract_shortcode(url)
    if not shortcode:
        return {
            "ok": False,
            "error": "URL inválida. Esperado formato https://www.instagram.com/{p|reel|tv}/SHORTCODE/",
            "url": url,
        }

    target_dir = Path(output_dir).expanduser().resolve() / shortcode
    target_dir.mkdir(parents=True, exist_ok=True)

    logger.info("Capturando shortcode=%s para %s", shortcode, target_dir)

    loader = build_loader(target_dir, save_metadata, download_video_thumbnails)

    if session_username:
        try:
            if session_file:
                loader.load_session_from_file(session_username, session_file)
            else:
                loader.load_session_from_file(session_username)
            logger.info("Sessão carregada para %s", session_username)
        except FileNotFoundError as exc:
            return {
                "ok": False,
                "error": f"Arquivo de sessão não encontrado para {session_username}: {exc}",
                "shortcode": shortcode,
            }

    try:
        post = instaloader.Post.from_shortcode(loader.context, shortcode)
    except instaloader.exceptions.InstaloaderException as exc:
        return {
            "ok": False,
            "error": f"Falha ao buscar post: {exc.__class__.__name__}: {exc}",
            "shortcode": shortcode,
        }

    try:
        loader.download_post(post, target=Path(target_dir).name)
    except instaloader.exceptions.InstaloaderException as exc:
        return {
            "ok": False,
            "error": f"Falha ao baixar mídias: {exc.__class__.__name__}: {exc}",
            "shortcode": shortcode,
            "output_dir": str(target_dir),
        }

    files = sorted(p.name for p in target_dir.iterdir() if p.is_file())

    return {
        "ok": True,
        "shortcode": shortcode,
        "output_dir": str(target_dir),
        "files": files,
        "post": summarize_post(post),
    }


@mcp.tool()
def inspect_instagram_post(url: str) -> dict[str, Any]:
    """
    Retorna metadados de um post público sem baixar mídias.

    Útil para validar uma URL, conferir se o post é um carrossel e quantas
    mídias contém antes de chamar capture_instagram_carousel.
    """
    shortcode = extract_shortcode(url)
    if not shortcode:
        return {"ok": False, "error": "URL inválida.", "url": url}

    loader = instaloader.Instaloader(quiet=True)
    try:
        post = instaloader.Post.from_shortcode(loader.context, shortcode)
    except instaloader.exceptions.InstaloaderException as exc:
        return {
            "ok": False,
            "error": f"{exc.__class__.__name__}: {exc}",
            "shortcode": shortcode,
        }

    return {"ok": True, "shortcode": shortcode, "post": summarize_post(post)}


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
