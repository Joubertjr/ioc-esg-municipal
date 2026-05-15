# Instagram Carousel MCP

Servidor MCP local que expõe ferramentas para baixar mídias de posts e carrosséis
do Instagram via URL, usando [Instaloader](https://instaloader.github.io/).

> Ferramenta **isolada** em `tools/` — **não faz parte** da plataforma IOC ESG
> Municipal. Mantida no repo apenas porque o ambiente remoto exige commit + push
> para preservar arquivos. Pode ser extraída para um repo próprio a qualquer
> momento.

## Ferramentas MCP expostas

| Nome                          | Descrição                                                       |
| ----------------------------- | --------------------------------------------------------------- |
| `inspect_instagram_post`      | Retorna metadados sem baixar mídias (autor, legenda, contagem). |
| `capture_instagram_carousel`  | Baixa todas as mídias de um post/carrossel/reel/IGTV público.   |

## Instalação

```bash
cd tools/instagram-carousel-mcp
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Execução standalone (sanity check)

```bash
python instagram_carousel_mcp.py
```

O processo fica escutando na stdio aguardando um cliente MCP.

## Configuração em Claude Code / Cursor / Claude Desktop

Veja `mcp-config.example.json`. Copie para a configuração do seu cliente e ajuste
o caminho absoluto.

```jsonc
{
  "mcpServers": {
    "instagram-carousel": {
      "command": "python",
      "args": ["/abs/path/tools/instagram-carousel-mcp/instagram_carousel_mcp.py"]
    }
  }
}
```

Se estiver usando virtualenv, aponte `command` para o `python` do `.venv`:

```jsonc
"command": "/abs/path/tools/instagram-carousel-mcp/.venv/bin/python"
```

## Uso pelo agente

Inspeção:

```
Use a ferramenta inspect_instagram_post com:
  url = "https://www.instagram.com/p/DYPq1A3Fvhq/"
```

Captura:

```
Use a ferramenta capture_instagram_carousel com:
  url = "https://www.instagram.com/p/DYPq1A3Fvhq/?igsh=YjhocTB2MnVkZXR3"
  output_dir = "./downloads"
```

URLs aceitas:

- `https://www.instagram.com/p/SHORTCODE/`
- `https://www.instagram.com/reel/SHORTCODE/`
- `https://www.instagram.com/tv/SHORTCODE/`
- Qualquer querystring extra (`?igsh=...`) é ignorada.

## Conteúdo privado / rate limit

Para posts privados, restritos, ou se o IP estiver rate-limited, é preciso uma
sessão autenticada do Instaloader:

```bash
# Login interativo, cria arquivo de sessão local
instaloader --login=SEU_USUARIO
```

Depois passe `session_username` (e opcionalmente `session_file`) ao chamar
`capture_instagram_carousel`. Nunca commite o arquivo de sessão.

## Saída

Cada chamada cria `output_dir/<SHORTCODE>/` com:

- `<SHORTCODE>_<MEDIA_ID>.jpg` / `.mp4` — mídias do carrossel
- `<SHORTCODE>_<MEDIA_ID>.json.xz` — metadados (se `save_metadata=True`)

O retorno da ferramenta inclui a lista de arquivos e um resumo do post
(autor, legenda, contagem de mídias, data, likes).

## Avisos

- **Termos de Serviço:** O scraping do Instagram viola o ToS do Meta para uso
  comercial não autorizado. Use apenas para conteúdo próprio, conteúdo com
  permissão explícita ou propósitos compatíveis com fair use.
- **Direitos autorais:** Você é responsável por respeitar os direitos do criador
  original.
- **Rate limits:** O Instagram bloqueia IPs que fazem muitas requisições. Use
  com moderação; prefira sessão autenticada para volumes maiores.
- **Mudanças quebram:** O Instaloader depende de endpoints internos do Instagram
  que mudam sem aviso. Mantenha a lib atualizada (`pip install -U instaloader`).

## Segurança

- O servidor MCP roda **localmente**; não expõe rede.
- Nunca commite arquivos `*.session-*` ou `downloads/`. Verifique o `.gitignore`
  deste diretório antes de commitar.
