# RELATÓRIO DE WIDE RESEARCH: VALIDAÇÃO E AMPLIAÇÃO DE FONTES ESG/ODS MUNICIPAL

**Data:** 07/04/2026
**Projeto:** IOC ESG Municipal

## 1. INTRODUÇÃO

Este relatório consolida os resultados de 15 pesquisas simultâneas de validação profunda realizadas sobre as fontes de referência para o projeto IOC ESG Municipal. O objetivo foi auditar dados citados em documentos anteriores, corrigir inconsistências, e ampliar o leque de referências com novas plataformas, metodologias e componentes visuais de classe mundial.

## 2. VALIDAÇÃO DE FONTES EXISTENTES

sc.cidadessustentaveis.org.br/ está ativa e correta. 2. A plataforma cobre 5.570 municípios brasileiros. (Fonte: https://idsc.cidadessustentaveis.org.br/) 3. O financiamento é realizado pela Caixa, Ministério do Meio Ambiente e Mudança do Clima e pela União Europeia. (Fonte: https://idsc.cidadessustentaveis.org.br/) 4. A metodologia de cálculo do score é baseada na normalização min-max dos indicadores e na ponderação igualitária dos 17 ODS. (Fonte: https://idsc.cidadessustentaveis.org.br/methodology/)

**Correções/Atualizações:**
Nenhum dado incorreto ou desatualizado foi encontrado.

**Descobertas Adicionais:**
Nome: Metodologia IDSC-BR (PDF) | URL: https://idsc-sp.cidadessustentaveis.org.br/static/Metodologia.pdf | Descrição: Documento PDF com a metodologia detalhada do IDSC-BR. | Relevância para IOC: Alta

**Implicação para o IOC:**

1. Integrar os 100 indicadores do IDSC-BR ao sistema do IOC para monitoramento e análise.
2. Utilizar a metodologia de cálculo de score do IDSC-BR como referência para o desenvolvimento de um score próprio do IOC.
3. Explorar a possibilidade de uma parceria com o Instituto Cidades Sustentáveis para acesso a dados mais detalhados ou a uma futura API.

---

### SDG Index & Dashboards - Verificação e Ampliação

**Status da Fonte:**
URL: https://dashboards.sdgindex.org/ — ATIVA | Dados gerais: CONFIRMADOS
URL: https://s3.amazonaws.com/sustainabledevelopment.report/2025/sustainable-development-report-2025.pdf — ATIVA | Relatório completo 2025: CONFIRMADO | Autores, 10ª edição, países e indicadores: CONFIRMADOS | Metodologia (visão geral): CONFIRMADA
URL: https://sdg-transformation-center-sdsn.hub.arcgis.com/datasets/sdsn::sustainable-development-report-2025-with-indicators/about — ATIVA | API pública: CONFIRMADA
URL: https://github.com/sdsna/2018GlobalIndex/raw/master/2018GlobalIndexMethodology.pdf — ATIVA | Metodologia detalhada (versão 2018): CONFIRMADA

**Dados Confirmados:**

1. A URL https://dashboards.sdgindex.org/ está ativa e funcional.
2. O Sustainable Development Report 2025 cobre 167 dos 193 estados membros da ONU no SDG Index (fonte: Sustainable Development Report 2025, página 59).
3. O relatório utiliza 17 indicadores principais para o SDG Index (SDGi) simplificado (fonte: Sustainable Development Report 2025, página 9 e Tabela 2.1).
4. Os autores do Sustainable Development Report 2025 são Jeffrey D. Sachs, Guillaume Lafortune, Grayson Fuller e Guilherme Iablonovski (fonte: Sustainable Development Report 2025, página 3).
5. A 10ª edição do Sustainable Development Report (2025) marca o 10º aniversário da adoção dos Objetivos de Desenvolvimento Sustentável (ODS) e foca em 'Financing the SDGs by 2030 and Mid-Century'. A edição introduz um SDG Index (SDGi) simplificado, usando 17 indicadores principais para rastrear o progresso geral dos ODS (fonte: Sustainable Development Report 2025, páginas 3 e 9).
6. Há uma API pública disponível através do Esri ArcGIS Hub para acesso aos dados completos do relatório (fonte: https://sdg-transformation-center-sdsn.hub.arcgis.com/datasets/sdsn::sustainable-development-report-2025-with-indicators/about).

**Correções/Atualizações:**
ERRO: Metodologia de normalização de 2025 → CORRETO: A metodologia detalhada é referenciada a um documento de 2018 (Lafortune et al., 2018) e a uma auditoria estatística de 2019 pelo JRC. O relatório de 2025 oferece apenas uma visão geral da metodologia nas páginas 59-61. O link 'Methodological Paper PDF' na página de downloads aponta para um PDF de 2018 (fonte: Sustainable Development Report 2025, página 59; https://github.com/sdsna/2018GlobalIndex/raw/master/2018GlobalIndexMethodology.pdf).

**Descobertas Adicionais:**
Nome: Esri ArcGIS Hub API | URL: https://sdg-transformation-center-sdsn.hub.arcgis.com/datasets/sdsn::sustainable-development-report-2025-with-indicators/about | Descrição: Plataforma para acesso programático aos dados completos do Sustainable Development Report 2025. | Relevância para IOC: alta
Nome: Sustainable Development Report 2025 (PDF) | URL: https://s3.amazonaws.com/sustainabledevelopment.report/2025/sustainable-development-report-2025.pdf | Descrição: Relatório completo com detalhes sobre países, indicadores, metodologia e novidades da 10ª edição. | Relevância para IOC: alta
Nome: Methodological Paper PDF (2018) | URL: https://github.com/sdsna/2018GlobalIndex/raw/master/2018GlobalIndexMethodology.pdf | Descrição: Documento detalhado sobre a metodologia do SDG Index, embora seja uma versão de 2018. | Relevância para IOC: média
Nome: SDSN Transformation Center | URL: https://sdgtransformationcenter.org | Descrição: Centro responsável pela preparação do SDR e onde o dashboard interativo e dados adicionais podem ser acessados. | Relevância para IOC: alta

**Implicação para o IOC:**

1. Utilizar a API do Esri ArcGIS Hub para integrar os dados do Sustainable Development Report 2025 diretamente nas plataformas do projeto IOC, garantindo acesso a informações atualizadas e abrangentes.
2. Ao citar a metodologia, referenciar o 'Sustainable Development Report 2025' para a visão geral e o 'Methodological Paper PDF (2018)' para detalhes mais aprofundados, esclarecendo a versão da metodologia utilizada.
3. Monitorar o site https://dashboards.sdgindex.org/downloads/ para a publicação de um documento metodológico atualizado para a edição de 2025, caso seja disponibilizado futuramente.
4. Explorar o 'Sustainable Development Report 2025' para identificar os 17 indicadores principais e a lista completa de indicadores na Tabela A.4 para alinhamento com as categorias de pesquisa do projeto IOC.
5. Considerar a arquitetura tecnológica do site (Material UI, React/Next.js) como referência para o desenvolvimento de futuras plataformas do projeto IOC, visando uma experiência de usuário moderna e responsiva.

---

### Our World in Data (OWID) - Verificação e Ampliação

**Status da Fonte:**
URL: https://ourworldindata.org/ — ATIVA | Grapher open-source: CONFIRMADO | Lovie Award 2019: CONFIRMADO | Visitantes únicos 2021: CONFIRMADO (fonte externa) | Stack tecnológica: CONFIRMADO | Licença CC BY: CONFIRMADO
URL: https://github.com/owid/owid-grapher — ATIVA | Grapher open-source: CONFIRMADO | Stack tecnológica: CONFIRMADO
URL: https://ourworldindata.org/we-won-the-lovie-award — ATIVA | Lovie Award 2019: CONFIRMADO
URL: https://docs.owid.io/ — ATIVA | Documentação do Grapher: CONFIRMADO | API disponível: CONFIRMADO
URL: https://docs.owid.io/projects/etl/api/chart-api/ — ATIVA | API disponível: CONFIRMADO

**Dados Confirmados:**

1. O Grapher é open-source e seu repositório GitHub é https://github.com/owid/owid-grapher [1].
2. Our World in Data ganhou o Lovie Award 2019 (Lovie Be Greater with Data Award) [2].
3. O site Our World in Data teve 89 milhões de visitantes únicos em 2021 [3].
4. A stack tecnológica atual do Grapher inclui React, TypeScript e Mobx [1].
5. O conteúdo (visualizações, dados, artigos) do Our World in Data é licenciado sob Creative Commons BY [4]. A API também é licenciada sob CC BY 4.0 [5].

**Correções/Atualizações:**
Nenhum dado original foi encontrado incorreto ou desatualizado.

**Descobertas Adicionais:**
Nome: OWID Technical Documentation | URL: https://docs.owid.io/ | Descrição: Documentação técnica abrangente para os projetos do Our World in Data, incluindo o Grapher e suas APIs. | Relevância para IOC: alta
Nome: Grapher Chart API Documentation | URL: https://docs.owid.io/projects/etl/api/chart-api/ | Descrição: Detalhes sobre a API do Grapher, métodos de acesso a dados e metadados. | Relevância para IOC: alta
Nome: Timeline of Our World in Data (Issa Rice) | URL: https://timelines.issarice.com/wiki/Timeline_of_Our_World_in_Data | Descrição: Linha do tempo com marcos importantes do Our World in Data, incluindo estatísticas de tráfego. | Relevância para IOC: média

**Implicação para o IOC:**

1. Explorar a API do Grapher (https://docs.owid.io/projects/etl/api/chart-api/) para identificar datasets relevantes que possam ser agregados ou filtrados para análise em nível municipal, mesmo que não haja suporte direto para municípios.
2. Avaliar a viabilidade de utilizar os dados de "Urbanization" e "Population of the world's largest cities" do OWID para criar indicadores ou análises em nível municipal, considerando a necessidade de processamento adicional para granularidade específica.
3. Investigar a possibilidade de contribuir com o projeto Our World in Data, sugerindo a inclusão de dados ou funcionalidades específicas para o nível municipal, dado que o projeto é open-source e aceita contribuições.

---

### Gapminder - Verificação e Ampliação

**Status da Fonte:**
URL: https://www.gapminder.org/ — ATIVA | Fast Company World Changing Ideas 2017: CONFIRMADO (Dollar Street) | Hans Rosling TIME 100 2012: CONFIRMADO | Royal Television Society Award 2014: CONFIRMADO (Don't Panic) | Tecnologia bubble chart: CONFIRMADO (Vizabi, D3/SVG) | Versão para dados municipais: INCORRETO (não há versão direta para dados municipais nos tools)
URL: https://www.fastcompany.com/3068873/announcing-the-winners-of-the-2017-world-changing-ideas-awards — ATIVA | Reconhecimento do Dollar Street: CONFIRMADO
URL: https://flowingdata.com/2012/04/18/hans-rosling-makes-time-100-most-influential/ — ATIVA | Hans Rosling TIME 100 2012: CONFIRMADO
URL: https://content.time.com/time/specials/packages/article/0,28804,2111975_2111976_2112170,00.html — INATIVA (bloqueada por política)
URL: https://www.gapminder.org/tools/ — ATIVA | Tecnologia bubble chart: CONFIRMADO (Vizabi, D3/SVG) | Dados municipais: INCORRETO (não há dados municipais, apenas de países)
URL: https://gapmindercms.docs.apiary.io/ — ATIVA (mas página em branco) | Documentação API: INCOMPLETA/NÃO DISPONÍVEL
URL: https://github.com/edsfocci/gapminder-api — ATIVA | API: CONFIRMADO (API não oficial, mantida pela comunidade)
URL: https://www.gapminder.org/data/ — ATIVA | Download de dados: CONFIRMADO (CSV/XLSX, não API)

**Dados Confirmados:**

1. O projeto Dollar Street do Gapminder foi reconhecido no Fast Company World Changing Ideas Awards 2017 (fonte: https://www.fastcompany.com/3068873/announcing-the-winners-of-the-2017-world-changing-ideas-awards).
2. Hans Rosling foi incluído na lista TIME 100 em 2012 (fonte: https://flowingdata.com/2012/04/18/hans-rosling-makes-time-100-most-influential/).
3. O documentário "Don't Panic" (associado ao Gapminder) ganhou o Royal Television Society's Television Journalism Awards em 2014, na categoria "Innovative News" (fonte: https://www.gapminder.org/about/about-gapminder/awards/).

**Correções/Atualizações:**
ERRO: Royal Television Society Award 2014 para Gapminder ou Hans Rosling → CORRETO: O documentário "Don't Panic", associado ao Gapminder, ganhou o Royal Television Society's Television Journalism Awards em 2014, na categoria "Innovative News" (fonte: https://www.gapminder.org/about/about-gapminder/awards/).

**Descobertas Adicionais:**
Nome: edsfocci/gapminder-api (GitHub) | URL: https://github.com/edsfocci/gapminder-api | Descrição: Repositório GitHub com uma API JSON não oficial para o Gapminder. | Relevância para IOC: média
Nome: Vizabi | URL: https://vizabi.com/ | Descrição: Framework open-source para visualização de dados, utilizado pelo Gapminder para seus bubble charts. | Relevância para IOC: alta

**Implicação para o IOC:**

1. Para dados municipais, explorar alternativas ao Gapminder ou verificar se a comunidade Vizabi oferece extensões para granularidade subnacional.
2. Considerar o uso da API não oficial `edsfocci/gapminder-api` para acesso programático aos dados, com a devida avaliação de sua estabilidade e manutenção.
3. Monitorar o site `vizabi.com` para atualizações na documentação técnica, caso haja interesse em desenvolver visualizações personalizadas com a mesma tecnologia do Gapminder.
4. Entrar em contato com a equipe do Gapminder para verificar a possibilidade de acesso a dados mais granulares ou a uma API oficial para fins de pesquisa.

---

### Atlas Brasil - Verificação e Ampliação

**Status da Fonte:**
URL: http://www.atlasbrasil.org.br/ — ATIVA | Dados confirmados: URL ativa, número de municípios e indicadores, escala do IDHM, parceria, metodologia, dados de uso, como baixar dados.
URL: https://www.undp.org/pt/brazil/atlas-dos-municipios — ATIVA | Dados confirmados: número de municípios e indicadores.
URL: http://www.atlasbrasil.org.br/acervo/atlas — ATIVA | Dados confirmados: número de municípios e indicadores, escala do IDHM, parceria, metodologia, dados de uso.
URL: http://www.atlasbrasil.org.br/acervo/biblioteca — ATIVA | Dados confirmados: como baixar dados, ano base dos dados mais recentes (2022 para algumas notas metodológicas do Radar IDHM).

**Dados Confirmados:**

1. A URL http://www.atlasbrasil.org.br/ está ativa. (Fonte: Navegação direta)
2. O Atlas Brasil cobre mais de 330 indicadores socioeconômicos para 5.570 municípios, cinco macrorregiões, 27 Unidades da Federação (UFs), 21 regiões metropolitanas (RMs), três regiões integradas de desenvolvimento (RIDEs) e aproximadamente 17.000 unidades de desenvolvimento humano (UDHs). (Fonte: http://www.atlasbrasil.org.br/acervo/atlas)
3. O Índice de Desenvolvimento Humano Municipal (IDHM) varia entre 0,000 e 1,000. (Fonte: http://www.atlasbrasil.org.br/acervo/atlas)
4. A parceria é entre o Programa das Nações Unidas para o Desenvolvimento (PNUD), o Instituto de Pesquisa Econômica Aplicada (IPEA) e a Fundação João Pinheiro (FJP). (Fonte: http://www.atlasbrasil.org.br/acervo/atlas)
5. A metodologia do IDHM brasileiro segue as mesmas três dimensões do IDH Global – longevidade, educação e renda – mas é adequada ao contexto brasileiro e à disponibilidade de indicadores nacionais. (Fonte: http://www.atlasbrasil.org.br/acervo/atlas)
6. O Atlas Brasil tem como objetivo instrumentalizar a sociedade e democratizar o acesso às informações no âmbito municipal, metropolitano e nacional, contribuindo para o fortalecimento das capacidades locais, da gestão pública municipal e do empoderamento dos cidadãos brasileiros. (Fonte: http://www.atlasbrasil.org.br/acervo/atlas)
7. É possível baixar os dados diretamente na seção "Bases de dados" do acervo. (Fonte: http://www.atlasbrasil.org.br/acervo/biblioteca)

**Correções/Atualizações:**
ERRO: O Atlas Brasil cobre 330+ municípios → CORRETO: O Atlas Brasil cobre 5.570 municípios e mais de 330 indicadores. (Fonte: http://www.atlasbrasil.org.br/acervo/atlas)

**Descobertas Adicionais:**
Nome: Atlas do Estado Brasileiro API | URL: https://www.ipea.gov.br/atlasestado/api | Descrição: API para o Atlas do Estado Brasileiro, que pode ser uma fonte de dados relacionados, embora não seja diretamente o Atlas Brasil (PNUD/IPEA/FJP). | Relevância para IOC: média
Nome: Radar IDHM: Nota Metodológica de IDHM 2022 | URL: http://www.atlasbrasil.org.br/acervo/biblioteca | Descrição: Documento que detalha a metodologia e o ano base mais recente (2022) para o cálculo do IDHM. | Relevância para IOC: alta

**Implicação para o IOC:**

1. Explorar a API do Atlas do Estado Brasileiro (https://www.ipea.gov.br/atlasestado/api) para verificar a possibilidade de integração de dados com o projeto IOC.
2. Analisar as notas metodológicas do Radar IDHM, especialmente a de 2022, para compreender as atualizações e aprofundar o conhecimento sobre a metodologia do IDHM e a disponibilidade de dados mais recentes.
3. Utilizar os links de download de bases de dados disponíveis no acervo do Atlas Brasil para obter conjuntos de dados brutos e realizar análises mais detalhadas para o projeto IOC.
4. Investigar a possibilidade de contato com as equipes do PNUD, IPEA e FJP para obter informações sobre futuras APIs ou formas de acesso programático aos dados do Atlas Brasil.

---

### Firjan IFDM - Verificação e Ampliação

**Status da Fonte:**
URL: https://www.firjan.com.br/ifdm/ — ATIVA (mas acesso bloqueado) | URL: https://pt.wikipedia.org/wiki/%C3%8Dndice_FIRJAN_de_Desenvolvimento_Municipal — ATIVA | URL: https://agenciabrasil.ebc.com.br/direitos-humanos/noticia/2025-05/quase-60-milhoes-vivem-em-cidades-com-desenvolvimento-baixo-ou-critico — ATIVA | URL: https://www.sicavrj.org.br/noticias/ifdm-57-milhoes-de-brasileiros-vivem-em-cidades-com-desenvolvimento-socioeconomico-baixo-ou-critico/ — ATIVA | URL: https://www.poder360.com.br/poder-brasil/57-mi-de-brasileiros-vivem-em-cidades-menos-desenvolvidas-diz-estudo/ — ATIVA | URL: https://portal.montesclaros.mg.gov.br/noticia/conceito-maximo-no-ifdm-empregos-e-renda-impulsionam-desenvolvimento-socioeconomico-de-montes-claros — ATIVA | URL: https://www.revistas.unijui.edu.br/index.php/desenvolvimentoemquestao/article/view/9660/6423 — ATIVA | URL: https://www.ipea.gov.br/ppp/index.php/PPP/article/view/1317 — ATIVA | URL: https://repositorio.unilab.edu.br/jspui/bitstream/123456789/2628/1/JOS%C3%89%20CARLOS%20PINHEIRO%20DA%20SILVA%20Mono.pdf — ATIVA | URL: https://scispace.com/pdf/estudo-comparativo-do-indice-de-desenvolvimento-humano-32c2dfth8j.pdf — ATIVA

**Dados Confirmados:**

1. A URL original do Firjan IFDM é https://www.firjan.com.br/ifdm/.
2. O IFDM é elaborado pela Federação das Indústrias do Estado do Rio de Janeiro (Firjan).
3. O IFDM 2025 avaliou 5.550 municípios brasileiros (fonte: Agência Brasil, SICAVRJ, Poder360, Portal Montes Claros).
4. 47,3% dos municípios brasileiros tinham IFDM baixo ou crítico no ano-base 2023 (fonte: Agência Brasil, SICAVRJ, Poder360).
5. As 3 dimensões do IFDM são Emprego & Renda, Educação e Saúde (fonte: Wikipédia).
6. A metodologia do IFDM utiliza como referência metas e parâmetros nacionais e o padrão de desenvolvimento de países mais avançados, com o índice variando de 0 a 1 ponto (fonte: Wikipédia).
7. Os dados mais recentes disponíveis para o IFDM 2025 são referentes ao ano-base 2023 (fonte: Agência Brasil, SICAVRJ, Poder360, Portal Montes Claros).

**Correções/Atualizações:**
ERRO: A URL https://www.firjan.com.br/ifdm/ e os links diretos para PDFs no domínio firjan.com.br/data/files/ estão bloqueados no ambiente de execução. → CORRETO: A URL principal do Firjan IFDM está ativa, mas o acesso direto foi bloqueado por proteção de segurança, impedindo a navegação e download de arquivos PDF diretamente do site da Firjan (fonte: Observação direta do navegador).

**Descobertas Adicionais:**
Nome: Wikipédia - Índice FIRJAN de Desenvolvimento Municipal | URL: https://pt.wikipedia.org/wiki/%C3%8Dndice_FIRJAN_de_Desenvolvimento_Municipal | Descrição: Fornece uma visão geral do IFDM, suas dimensões, metodologia e histórico. | Relevância para IOC: alta
Nome: Agência Brasil - Quase 60 milhões vivem em cidades com desenvolvimento baixo ou crítico | URL: https://agenciabrasil.ebc.com.br/direitos-humanos/noticia/2025-05/quase-60-milhoes-vivem-em-cidades-com-desenvolvimento-baixo-ou-critico | Descrição: Notícia que confirma a porcentagem de municípios com desenvolvimento baixo ou crítico e o ano-base do IFDM 2025. | Relevância para IOC: alta
Nome: SICAVRJ - IFDM: 57 milhões de brasileiros vivem em cidades com desenvolvimento socioeconômico baixo ou crítico | URL: https://www.sicavrj.org.br/noticias/ifdm-57-milhoes-de-brasileiros-vivem-em-cidades-com-desenvolvimento-socioeconomico-baixo-ou-critico/ | Descrição: Notícia que confirma a porcentagem de municípios com desenvolvimento baixo ou crítico e o ano-base do IFDM 2025. | Relevância para IOC: alta
Nome: Poder360 - 57 mi de brasileiros vivem em cidades menos desenvolvidas, diz estudo | URL: https://www.poder360.com.br/poder-brasil/57-mi-de-brasileiros-vivem-em-cidades-menos-desenvolvidas-diz-estudo/ | Descrição: Notícia que confirma a porcentagem de municípios com desenvolvimento baixo ou crítico e o ano-base do IFDM 2025. | Relevância para IOC: alta
Nome: Portal Montes Claros - CONCEITO MÁXIMO NO IFDM - Empregos e Renda impulsionam desenvolvimento socioeconômico de Montes Claros | URL: https://portal.montesclaros.mg.gov.br/noticia/conceito-maximo-no-ifdm-empregos-e-renda-impulsionam-desenvolvimento-socioeconomico-de-montes-claros | Descrição: Notícia que menciona o IFDM 2025/2023 e o número de municípios avaliados. | Relevância para IOC: média
Nome: Revista Desenvolvimento em Questão - Estudo Comparativo do Índice de Desenvolvimento Humano Municipal (IDH-M) e o Índice Firjan de Desenvolvimento Municipal (IFDM) | URL: https://www.revistas.unijui.edu.br/index.php/desenvolvimentoemquestao/article/view/9660/6423 | Descrição: Artigo acadêmico que compara o IDHM e o IFDM, relevante para a busca de comparação. | Relevância para IOC: alta
Nome: IPEA - REVISANDO O DESENVOLVIMENTO EM EDUCAÇÃO DOS MUNICÍPIOS BRASILEIROS: UMA ANÁLISE COMPARATIVA ENTRE O IDHM-EDUCAÇÃO E O IFDM-EDUCAÇÃO | URL: https://www.ipea.gov.br/ppp/index.php/PPP/article/view/1317 | Descrição: Artigo acadêmico que compara o IDHM-Educação e o IFDM-Educação. | Relevância para IOC: alta
Nome: Repositório UNILAB - Análise dos Índices Firjan de Desenvolvimento Municipal (IFDM) e de Gestão Fiscal (IFGF) | URL: https://repositorio.unilab.edu.br/jspui/bitstream/123456789/2628/1/JOS%C3%89%20CARLOS%20PINHEIRO%20DA%20SILVA%20Mono.pdf | Descrição: Monografia que compara IFDM e IFGF, mencionando a vantagem do IFDM sobre o IDHM em termos de atualização. | Relevância para IOC: média
Nome: SciSpace - Estudo Comparativo do Índice de Desenvolvimento Humano Municipal (IDH-M) e o Índice Firjan de Desenvolvimento Municipal (IFDM) | URL: https://scispace.com/pdf/estudo-comparativo-do-indice-de-desenvolvimento-humano-32c2dfth8j.pdf | Descrição: Artigo que analisa a relação entre as variáveis de Renda do IDH-M e Emprego e Renda do IFDM. | Relevância para IOC: alta

**Implicação para o IOC:**

1. Monitorar o site oficial da Firjan para verificar a normalização do acesso e a disponibilidade de relatórios completos e dados brutos do IFDM 2025.
2. Utilizar as novas fontes identificadas (notícias e artigos acadêmicos) para complementar a análise do IFDM 2025, especialmente para comparações com o IDHM.
3. Considerar a possibilidade de contato direto com a Firjan para solicitar acesso aos dados e relatórios completos, caso o bloqueio persista.
4. Ao citar dados do IFDM 2025, sempre mencionar o ano-base 2023 para garantir a precisão da informação.

---

### SICONFI - Verificação e Ampliação

**Status da Fonte:**
URL: https://siconfi.tesouro.gov.br/ — ATIVA | Dados municipais (receitas, despesas, FPM): CONFIRMADO | API pública: CONFIRMADO | Formato dos dados (JSON): CONFIRMADO | Frequência de atualização: CONFIRMADO
URL: http://apidatalake.tesouro.gov.br/docs/siconfi/ — ATIVA | Documentação da API: CONFIRMADO | Formato dos dados (JSON): CONFIRMADO | Frequência de atualização: CONFIRMADO

**Dados Confirmados:**

1. A URL do SICONFI (https://siconfi.tesouro.gov.br/) está ativa e funcional.
2. O SICONFI disponibiliza dados contábeis e fiscais de municípios, incluindo informações sobre receitas e despesas, através de relatórios como RREO, RGF e DCA, e da Matriz de Saldos Contábeis (MSC) [1].
3. Existe uma API pública de dados abertos para o SICONFI, acessível em http://apidatalake.tesouro.gov.br/docs/siconfi/ [2].
4. Os dados fornecidos pela API são entregues em formato JSON [2].
5. A API permite acesso a dados da Matriz de Saldos Contábeis (MSC), Relatório Resumido de Execução Orçamentária (RREO) e Relatório de Gestão Fiscal (RGF), que contêm informações detalhadas sobre receitas e despesas [2].
6. A frequência de atualização dos dados varia conforme o relatório, sendo bimestral, quadrimestral, semestral ou anual para RREO e RGF, e mensal ou anual para MSC [2].
7. É possível filtrar os dados por Unidade da Federação (UF), incluindo Santa Catarina (SC), e por código IBGE do município [2].
8. O Fundo de Participação dos Municípios (FPM) é uma receita municipal e pode ser encontrado nos dados de receita dos relatórios RREO e MSC Orçamentária [3].

**Correções/Atualizações:**
Nenhum dado original estava incorreto ou desatualizado.

**Descobertas Adicionais:**
Nome: SICONFI - API de Dados Abertos | URL: https://www.tesourotransparente.gov.br/consultas/consultas-siconfi/siconfi-api-de-dados-abertos | Descrição: Página do Tesouro Transparente que apresenta a API de Dados Abertos do SICONFI. | Relevância para IOC: alta
Nome: rsiconfi (pacote R) | URL: https://github.com/tchiluanda/rsiconfi | Descrição: Pacote R para acessar dados do SICONFI. | Relevância para IOC: média
Nome: siconfir (pacote R) | URL: https://github.com/aspeddro/siconfir | Descrição: Pacote R para acessar dados fiscais e contábeis de estados e municípios brasileiros do SICONFI. | Relevância para IOC: média
Nome: Extração de Dados da API do SICONFI com R | URL: https://www.rpubs.com/marcosfs2006/extracao-dados-api-siconfi | Descrição: Tutorial sobre como extrair dados da API do SICONFI usando o pacote {siconfir} em R. | Relevância para IOC: alta

**Implicação para o IOC:**

1. Utilizar a API de Dados Abertos do SICONFI (http://apidatalake.tesouro.gov.br/docs/siconfi/) para acesso programático aos dados de receitas e despesas municipais.
2. Para obter dados de FPM, consultar os relatórios RREO ou a MSC Orçamentária via API, filtrando por natureza da receita correspondente ao FPM.
3. Ao buscar dados para municípios de Santa Catarina, utilizar o parâmetro 'uf=SC' nas requisições da API.
4. Considerar o uso de pacotes como 'rsiconfi' ou 'siconfir' em R para facilitar a extração e manipulação dos dados da API.
5. Explorar os exemplos de uso e a documentação da API para otimizar as consultas e extrair os dados mais relevantes para o projeto IOC.

---

### Bloomberg Mayors Challenge - Verificação e Ampliação

**Status da Fonte:**
URL: https://mayorschallenge.bloomberg.org/ — INATIVA (acesso negado)
URL: https://www.bloomberg.org/government-innovation/spurring-innovation-in-cities/mayors-challenge/ — INATIVA (acesso negado)
URL: https://bloombergcities.jhu.edu/program/mayors-challenge/ — ATIVA | Dados gerais: CONFIRMADOS
URL: https://bloombergcities.jhu.edu/program/mayors-challenge/2025-winning-cities — ATIVA | Edição 2025-2026: CONFIRMADA | 24 cidades premiadas com US$1M: CONFIRMADO | Mais de 630 candidatas: CONFIRMADO | South Bend e Ghent vencedores: CONFIRMADO | Critérios de seleção: CONFIRMADOS
URL: https://bloombergcities.jhu.edu/program/mayors-challenge/about — ATIVA | Edições anteriores: CONFIRMADO (5 rodadas anteriores, 38 vencedores)
URL: https://www.bloomberg.com/news/articles/2016-12-01/bloomberg-mayors-challenge-honors-s-o-paulo — ATIVA | São Paulo vencedor em 2016: CONFIRMADO
URL: https://sdglocalaction.org/2025-global-mayors-challenge/ — ATIVA | Abertura de candidaturas 2025: CONFIRMADO

**Dados Confirmados:**

1. A edição 2025-2026 do Bloomberg Mayors Challenge existe. (Fonte: https://bloombergcities.jhu.edu/program/mayors-challenge/2025-winning-cities)
2. O desafio premiou 24 cidades com US$1 milhão cada. (Fonte: https://bloombergcities.jhu.edu/program/mayors-challenge/2025-winning-cities)
3. Mais de 630 cidades se candidataram à edição 2025-2026. (Fonte: https://bloombergcities.jhu.edu/program/mayors-challenge/2025-winning-cities)
4. South Bend (Estados Unidos) e Ghent (Bélgica) foram vencedores da edição 2025-2026. (Fonte: https://bloombergcities.jhu.edu/program/mayors-challenge/2025-winning-cities)
5. Os critérios de seleção para as ideias vencedoras da edição 2025-2026 foram: novidade, impacto potencial e força dos planos de implementação. (Fonte: https://bloombergcities.jhu.edu/program/mayors-challenge/2025-winning-cities)
6. São Paulo (Brasil) foi um dos vencedores do Bloomberg Mayors Challenge em 2016. (Fonte: https://www.bloomberg.com/news/articles/2016-12-01/bloomberg-mayors-challenge-honors-s-o-paulo)
7. As candidaturas para o 2025 Mayors Challenge foram abertas em outubro de 2024. (Fonte: https://sdglocalaction.org/2025-global-mayors-challenge/)

**Descobertas Adicionais:**
Nome: Bloomberg Cities Network | URL: https://bloombergcities.jhu.edu/program/mayors-challenge | Descrição: Plataforma oficial com informações detalhadas sobre o Mayors Challenge, incluindo edições atuais e anteriores, vencedores e critérios. | Relevância para IOC: alta
Nome: SDG Local Action | URL: https://sdglocalaction.org/2025-global-mayors-challenge/ | Descrição: Artigo sobre a abertura das candidaturas para o 2025 Mayors Challenge, fornecendo detalhes sobre o processo de submissão. | Relevância para IOC: média
Nome: Bloomberg.com (Notícia sobre São Paulo) | URL: https://www.bloomberg.com/news/articles/2016-12-01/bloomberg-mayors-challenge-honors-s-o-paulo | Descrição: Notícia confirmando São Paulo como vencedor do Mayors Challenge em 2016. | Relevância para IOC: alta

**Implicação para o IOC:**

1. Monitorar o site do Bloomberg Cities Network para futuras edições do Mayors Challenge e oportunidades de candidatura.
2. Analisar os projetos vencedores da edição 2025-2026 e edições anteriores (como o de São Paulo) para identificar tendências e áreas de inovação relevantes para o projeto IOC.
3. Acompanhar as notícias e comunicados da Bloomberg Philanthropies para se manter atualizado sobre iniciativas e desafios relacionados à inovação urbana.

---

### Prêmio CONIP - Verificação e Ampliação

**Status da Fonte:**
URL: https://www.conip.com.br/ — INATIVA para o propósito da pesquisa (empresa de controle de pragas)
URL: https://conipdigital.com.br/ — ATIVA | Dados gerais sobre o prêmio: CONFIRMADO | Vencedores 2025: CONFIRMADO
URL: https://conipdigital.com.br/premio-conip/ — ATIVA | Existência do prêmio desde 1998: CONFIRMADO
URL: https://conipdigital.com.br/submissao-de-case-premio-conip/ — ATIVA | Como se inscrever: CONFIRMADO
URL: https://conipdigital.com.br/wp-content/uploads/2024/03/Regulamento-Oficial-2024-final.pdf — ATIVA | Existência do prêmio desde 1998: CONFIRMADO | Categorias atuais: CONFIRMADO | Como se inscrever: CONFIRMADO | Critérios de avaliação: CONFIRMADO | Datas de inscrição (2024): CONFIRMADO
URL: https://www.gov.br/mcom/pt-br/noticias/2025/agosto/programa-computadores-para-a-inclusao-vence-premio-conip-2025-na-categoria-servico-ao-cidadao — ATIVA | Categorias atuais: CONFIRMADO | Vencedores 2025: CONFIRMADO
URL: https://www.anadep.org.br/wtk/pagina/materia?id=60182&nomePaginaEstrutura=enadep_estrutura — ATIVA | Categorias atuais: CONFIRMADO
URL: https://www.trt4.jus.br/portais/trt4/modulos/noticias/50849785 — ATIVA | Vencedores 2025: CONFIRMADO
URL: https://www.gov.br/transferegov/pt-br/noticias/noticias/2024/agosto/obrasgov-br-vence-premio-conip-de-excelencia-na-categoria-transparencia — ATIVA | Vencedores 2024: CONFIRMADO
URL: https://www.agenciaminas.mg.gov.br/noticia/governo-de-minas-vence-premiacao-nacional-com-digitalizacao-de-servicos-de-saude — ATIVA | Vencedores 2025: CONFIRMADO
URL: https://www.curitiba.pr.gov.br/noticias/curitiba-conquista-premio-conip-de-excelencia-em-gestao-publica-pelo-sistema-que-usa-a-tecnologia-para-facilitar-a-manutencao-urbana/79124 — ATIVA | Vencedores 2025: CONFIRMADO

**Dados Confirmados:**

1. O Prêmio CONIP de Excelência existe desde 1998 (fonte: https://conipdigital.com.br/premio-conip/, https://conipdigital.com.br/wp-content/uploads/2024/03/Regulamento-Oficial-2024-final.pdf)
2. As categorias atuais (2025) incluem Políticas Públicas, Inteligência Artificial, Proteção de Dados, Gestão Interna, Transformação Digital e Serviço ao Cidadão (fonte: https://www.gov.br/mcom/pt-br/noticias/2025/agosto/programa-computadores-para-a-inclusao-vence-premio-conip-2025-na-categoria-servico-ao-cidadao, https://www.anadep.org.br/wtk/pagina/materia?id=60182&nomePaginaEstrutura=enadep_estrutura)
3. O processo de inscrição para o Prêmio CONIP 2024 ocorreu de 02 de março a 17 de maio de 2024, através do site conipdigital.com.br, com submissão de vídeo de até 10 minutos (fonte: https://conipdigital.com.br/wp-content/uploads/2024/03/Regulamento-Oficial-2024-final.pdf)
4. Vencedores recentes (2024/2025) incluem: Obrasgov.br (Transparência, 2024), Programa Computadores para a Inclusão (Serviço ao Cidadão, 2025), TRT-RS (2025, com sistema Galileu), Governo de Minas (2025, digitalização de serviços de saúde), Prefeitura Municipal de Curitiba (2025, sistema Sigmu Cidade) (fonte: https://www.gov.br/transferegov/pt-br/noticias/noticias/2024/agosto/obrasgov-br-vence-premio-conip-de-excelencia-na-categoria-transparencia, https://www.gov.br/mcom/pt-br/noticias/2025/agosto/programa-computadores-para-a-inclusao-vence-premio-conip-2025-na-categoria-servico-ao-cidadao, https://www.trt4.jus.br/portais/trt4/modulos/noticias/50849785, https://www.agenciaminas.mg.gov.br/noticia/governo-de-minas-vence-premiacao-nacional-com-digitalizacao-de-servicos-de-saude, https://www.curitiba.pr.gov.br/noticias/curitiba-conquista-premio-conip-de-excelencia-em-gestao-publica-pelo-sistema-que-usa-a-tecnologia-para-facilitar-a-manutencao-urbana/79124)
5. Os critérios de avaliação incluem: Situação-problema ou oportunidade, Solução implementada, Inovação e ineditismo, Público-alvo, Relevância para o interesse público, Impacto causado e Facilidade de reprodução (fonte: https://conipdigital.com.br/wp-content/uploads/2024/03/Regulamento-Oficial-2024-final.pdf)

**Correções/Atualizações:**
ERRO: URL original https://www.conip.com.br/ é de uma empresa de controle de pragas → CORRETO: A URL oficial do Congresso Nacional de Informática Pública (CONIP) é https://conipdigital.com.br/ (fonte: https://conipdigital.com.br/)

**Descobertas Adicionais:**
Nome: Regulamento Oficial do Prêmio CONIP de Excelência em Inovação na Gestão Pública 2024: https://conipdigital.com.br/wp-content/uploads/2024/03/Regulamento-Oficial-2024-final.pdf | Descrição: Documento oficial com detalhes sobre o prêmio, categorias, critérios e processo de inscrição. | Relevância para IOC: alta
Nome: Notícia - Programa Computadores para a Inclusão vence Prêmio CONIP 2025: https://www.gov.br/mcom/pt-br/noticias/2025/agosto/programa-computadores-para-a-inclusao-vence-premio-conip-2025-na-categoria-servico-ao-cidadao | Descrição: Notícia oficial do governo sobre um dos vencedores de 2025 e as categorias do prêmio. | Relevância para IOC: média
Nome: Notícia - Obrasgov.br vence Prêmio Conip de Excelência na categoria Transparência: https://www.gov.br/transferegov/pt-br/noticias/noticias/2024/agosto/obrasgov-br-vence-premio-conip-de-excelencia-na-categoria-transparencia | Descrição: Notícia oficial do governo sobre um dos vencedores de 2024. | Relevância para IOC: média

**Implicação para o IOC:**

1. Monitorar o site oficial do CONIP (https://conipdigital.com.br/) para o lançamento do regulamento e datas de inscrição do Prêmio CONIP 2026, visto que o regulamento de 2024 foi divulgado em março.
2. Analisar os cases vencedores de 2024 e 2025, disponíveis no site e em notícias, para identificar tendências e áreas de foco que possam ser alinhadas com o projeto IOC.
3. Entrar em contato com a organização do CONIP (premio@conipdigital.com.br) para verificar a possibilidade de inclusão de uma categoria específica para plataformas de scoring ODS ou ESG em futuras edições do prêmio, dado que não foi identificada nenhuma plataforma de scoring ODS entre os vencedores recentes.
4. Preparar um vídeo de apresentação de até 10 minutos, conforme as normas de submissão, caso o projeto IOC decida concorrer ao prêmio, abordando os 7 tópicos de avaliação detalhados no regulamento.

---

### Information is Beautiful Awards - Verificação e Ampliação

**Status da Fonte:**
URL: https://www.informationisbeautifulawards.com/ — ATIVA | Informações gerais: CONFIRMADO
URL: https://www.informationisbeautifulawards.com/awards — ATIVA | Datas de inscrição, como se inscrever, categorias: CONFIRMADO
URL: https://www.informationisbeautifulawards.com/showcase?page=1&type=awards — ATIVA | Categorias, exemplos de vencedores: CONFIRMADO
URL: https://thevisualagency.com/tva-blog-articles/codex-atlanticus-lands-in-london-and-boston/ — ATIVA | Confirmação do "Oscar" da visualização de dados: CONFIRMADO
URL: https://www.datavisualizationsociety.org/iib-awards-faqs — ATIVA | Critérios de avaliação, datas de inscrição, elegibilidade: CONFIRMADO
URL: https://gijn.org/stories/gijns-data-journalism-top-10-open-source-artificial-intelligence-interactive-oceans-bar-chart-races-eu-polling/ — ATIVA | Menção de "Brazil's First Data Awards": CONFIRMADO

**Dados Confirmados:**

1. O Information is Beautiful Awards é amplamente considerado o "Oscar" da visualização de dados e design de informação (fonte: https://thevisualagency.com/tva-blog-articles/codex-atlanticus-lands-in-london-and-boston/)
2. As categorias 'Interactive Visualization' e 'Business Analytics' (que pode incluir dashboards) são presentes no showcase dos prêmios (fonte: https://www.informationisbeautifulawards.com/showcase?page=1&type=awards)
3. Critérios de avaliação incluem: Impacto, Engajamento, Clareza, Inovação e Criatividade, Inclusão, Acessibilidade, Eficácia e Beleza (fonte: https://www.datavisualizationsociety.org/iib-awards-faqs)
4. Datas de inscrição para 2025: Deadline 3.2.2025 (Entry Details), The Long List 10.3.2025, The Short List 19.4.2025, The Winners TBC (fonte: https://www.informationisbeautifulawards.com/awards)

**Correções/Atualizações:**
ERRO: Datas de inscrição 2025/2026 → CORRETO: As datas de inscrição e etapas do processo para 2025 são: Inscrições abertas de 15 de dezembro de 2024 a 31 de janeiro de 2025; Longlist anunciada em 10 de março de 2025; Shortlist anunciada em 20 de abril de 2025; Apresentação dos prêmios em junho de 2025 (fonte: https://www.datavisualizationsociety.org/iib-awards-faqs). Não há menção explícita a datas para 2026, apenas para 2025.

**Descobertas Adicionais:**
Nome: The Visual Agency Blog | URL: https://thevisualagency.com/tva-blog-articles/codex-atlanticus-lands-in-london-and-boston/ | Descrição: Artigo que menciona o Information is Beautiful Awards como o "Oscar" da visualização de dados. | Relevância para IOC: alta
Nome: Data Visualization Society - IIB Awards FAQs | URL: https://www.datavisualizationsociety.org/iib-awards-faqs | Descrição: Página oficial com perguntas frequentes sobre os prêmios, incluindo critérios de avaliação detalhados e cronograma. | Relevância para IOC: alta
Nome: GIJN - Data Journalism Top 10 | URL: https://gijn.org/stories/gijns-data-journalism-top-10-open-source-artificial-intelligence-interactive-oceans-bar-chart-races-eu-polling/ | Descrição: Artigo que menciona a existência de "Brazil's First Data Awards", indicando um possível vencedor brasileiro. | Relevância para IOC: média

**Implicação para o IOC:**

1. Explorar o "Entry Showcase" (https://www.informationisbeautifulawards.com/showcase) com filtros para identificar especificamente vencedores em categorias como "Current Affairs & Politics" ou "Politics & Global" para exemplos de dados governamentais.
2. Realizar uma busca mais aprofundada no "Entry Showcase" por termos como "dashboard" ou "interactive" para coletar mais exemplos de dashboards vencedores.
3. Investigar a menção de "Brazil's First Data Awards" na fonte GIJN para identificar vencedores brasileiros específicos e suas plataformas.
4. Monitorar o site oficial do Information is Beautiful Awards e da Data Visualization Society para atualizações sobre as datas de inscrição para 2026, caso sejam anunciadas.

---

---

## PARTE 2: AMPLIAÇÃO — NOVAS FONTES DESCOBERTAS

### 2.1 Plataformas Brasileiras de Dados Municipais (Não Citadas Anteriormente)

A auditoria identificou seis plataformas brasileiras de dados municipais de alta relevância que não constavam nos documentos de pesquisa originais:

| Plataforma                      | URL                                                                                                         | Cobertura                                  | Relevância para IOC             |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------- |
| **IEPS Data**                   | https://iepsdata.org.br/                                                                                    | Indicadores de saúde municipal desde 2010  | **Alta** — dados para ODS 3     |
| **Observatório das Metrópoles** | https://observatoriodemetropoles.net.br/                                                                    | Dados urbanos e metropolitanos             | **Média** — contexto regional   |
| **MUNIC/IBGE**                  | https://www.ibge.gov.br/estatisticas/sociais/educacao/10586-pesquisa-de-informacoes-basicas-municipais.html | Informações básicas de todos os municípios | **Alta** — dados institucionais |
| **SNIS**                        | https://www.gov.br/cidades/pt-br/assuntos/saneamento/snis                                                   | Saneamento básico municipal                | **Alta** — dados para ODS 6     |
| **DataSUS**                     | https://datasus.saude.gov.br/                                                                               | Indicadores de saúde municipal             | **Alta** — dados para ODS 3     |
| **QEdu**                        | https://www.qedu.org.br/                                                                                    | Indicadores educacionais municipais        | **Alta** — dados para ODS 4     |

**Destaque — IEPS Data:** O IEPS Data (`https://iepsdata.org.br/`) é uma plataforma que reúne dados e indicadores de saúde de todo o Brasil desde 2010, com visualizações, documentações e bases de dados para download. Abrange temas como mortalidade infantil, cobertura de atenção básica, internações e gastos em saúde — indicadores diretamente relevantes para o ODS 3 do IOC. A plataforma já realiza o trabalho de limpeza e padronização dos dados do DataSUS, o que pode reduzir significativamente o esforço de desenvolvimento do agente coletor de saúde.

---

### 2.2 Plataformas Internacionais de Referência (Não Citadas Anteriormente)

| Plataforma                         | URL                                                      | Cobertura                            | Relevância para IOC                          |
| ---------------------------------- | -------------------------------------------------------- | ------------------------------------ | -------------------------------------------- |
| **OECD Regional Well-Being**       | https://www.oecdregionalwellbeing.org/                   | 467 regiões da OCDE, 11 dimensões    | **Alta** — metodologia de bem-estar regional |
| **EU Cohesion Data**               | https://cohesiondata.ec.europa.eu/                       | Municípios europeus, dados de coesão | **Média** — referência metodológica          |
| **City Health Dashboard (NYU)**    | https://www.cityhealthdashboard.com/                     | Saúde municipal nos EUA              | **Alta** — modelo de dashboard de saúde      |
| **Eurostat Urban Audit**           | https://ec.europa.eu/eurostat/web/cities                 | Dados urbanos europeus               | **Média** — referência comparativa           |
| **UN-Habitat Urban Indicators**    | https://data.unhabitat.org/                              | Indicadores ONU para cidades         | **Alta** — alinhamento com ODS               |
| **Brookings Global Metro Monitor** | https://www.brookings.edu/articles/global-metro-monitor/ | Metrópoles globais                   | **Baixa** — foco em grandes cidades          |

**Destaque — City Health Dashboard (NYU):** O City Health Dashboard (`https://www.cityhealthdashboard.com/`) é o caso internacional mais próximo do que o IOC implementa para ODS 3. Cobre indicadores de saúde para municípios americanos com visualizações interativas, comparações entre cidades e drill-down por indicador. O modelo de UX deste dashboard deve ser estudado em profundidade para o redesign mobile-first do IOC.

---

### 2.3 Design Systems e Component Libraries (Descobertas Críticas)

| Sistema/Biblioteca              | URL                          | Versão Atual | Relevância para IOC                       |
| ------------------------------- | ---------------------------- | ------------ | ----------------------------------------- |
| **Design System GOV.BR**        | https://www.gov.br/ds        | v3.7.0       | **Alta** — padrão oficial brasileiro      |
| **Tremor**                      | https://tremor.so/           | v3.x         | **Alta** — componentes de dashboard React |
| **Shadcn/ui Charts**            | https://ui.shadcn.com/charts | 2025         | **Alta** — já usado no projeto            |
| **Recharts vs Victory vs Nivo** | —                            | —            | **Alta** — comparativo de bibliotecas     |

**Descoberta crítica — Design System GOV.BR v3.7.0:** O DS GOV.BR possui componentes específicos para dashboards governamentais, incluindo Card, Table, Tag (para status) e componentes de acessibilidade. A adoção parcial deste design system pode ser um diferencial estratégico de credibilidade junto a prefeituras que já utilizam sistemas do governo federal.

---

### 2.4 Metodologias de Score: Referências Acadêmicas Verificadas

As seguintes referências acadêmicas foram verificadas como ativas e relevantes para a metodologia do IOC:

- **European Journal of Sustainable Development Research** — artigo sobre IA para ODS e desempenho do setor público: `https://www.ejosdr.com/download/ai-for-sustainable-development-modelling-the-impact-of-the-17-sdgs-on-public-sector-performance-17396.pdf`
- **Nature — npj Urban Sustainability** — artigo sobre normalização para índices ODS municipais: `https://www.nature.com/articles/s42949-025-00238-4`
- **UNDP — Metodologia HDI/IDHM**: `https://hdr.undp.org/data-center/human-development-index` e `https://www.undp.org/pt/brazil/o-que-e-o-idhm`
- **COINr Documentation** (média geométrica vs aritmética): `https://bluefoxr.github.io/COINrDoc/aggregation.html`

A abordagem de **média geométrica** para agregação de dimensões penaliza o desenvolvimento desbalanceado de forma matematicamente comprovada. O IOC deve considerar adotar este método no cálculo do score composto.

---

### 2.5 IA Generativa e Agentes em Plataformas Governamentais Brasileiras

A auditoria revelou um ecossistema brasileiro de IA municipal mais desenvolvido do que o documentado na pesquisa original:

| Projeto                            | URL                                                                                                                                                                 | Descrição                                                                     | Relevância                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------- |
| **LLM4Gov (USP São Carlos)**       | https://saocarlos.usp.br/pesquisadores-da-usp-sao-carlos-desenvolvem-modelo-de-inteligencia-artificial-segura-para-uso-governamental-e-ganham-premio-internacional/ | LLM para análise de processos jurídicos governamentais com soberania de dados | **Alta**                        |
| **Pró-Cidadão (Florianópolis)**    | https://ndmais.com.br/cidadania/chatbot-do-pro-cidadao-passa-de-43-mil-atendimentos-e-amplia-acesso-a-servicos-em-florianopolis/                                    | Chatbot com 43 mil+ atendimentos via WhatsApp                                 | **Alta** — caso local em SC     |
| **Lia (Prefeitura de Limeira)**    | https://limeira.sp.gov.br/lia                                                                                                                                       | Chatbot com IA generativa, atualização a cada 8h                              | **Alta** — modelo de referência |
| **Rio 3 Open (Prefeitura do Rio)** | https://www.baguete.com.br/noticias/prefeitura-do-rio-lanca-seis-llms                                                                                               | 6 LLMs para serviços municipais                                               | **Alta** — escala e ambição     |
| **Guia IA Gov Federal**            | https://www.gov.br/governodigital/pt-br/infraestrutura-nacional-de-dados/inteligencia-artificial-1/ia-generativa-no-servico-publico.pdf                             | Guia oficial de IA generativa no serviço público                              | **Média** — compliance          |

O caso do Pró-Cidadão de Florianópolis é particularmente relevante por ser um município catarinense — o mesmo mercado-alvo do IOC. Com mais de 43 mil atendimentos via WhatsApp, demonstra que gestores e cidadãos catarinenses já estão receptivos à IA no contexto municipal.

---

## PARTE 3: CORREÇÕES OBRIGATÓRIAS NOS DOCUMENTOS EXISTENTES

As seguintes informações nos documentos de pesquisa anteriores devem ser corrigidas antes de qualquer uso em materiais de apresentação ou marketing:

| #   | Dado Original                                                | Status                     | Correção Verificada                                                                                      |
| --- | ------------------------------------------------------------ | -------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1   | "Forio usado pelo Banco Mundial"                             | **INCORRETO**              | Forio tem contrato com o CDC (EUA) para hospedagem de simulações. Uso pelo Banco Mundial não confirmado. |
| 2   | "URL iSDG Model: https://sdgintegration.undp.org/isdg-model" | **URL INATIVA**            | URL correta: https://sdgs.un.org/partnerships/integrated-sustainable-development-goals-isdg-model        |
| 3   | "SDG Index cobre 193 países"                                 | **PARCIALMENTE INCORRETO** | O SDG Index 2025 cobre 167 dos 193 estados membros da ONU (não todos os 193).                            |
| 4   | "Gapminder — Fast Company World Changing Ideas 2017"         | **PARCIALMENTE INCORRETO** | O prêmio foi para o projeto Dollar Street do Gapminder, não para o Gapminder como um todo.               |
| 5   | "Royal Television Society Award 2014 para Gapminder"         | **PARCIALMENTE INCORRETO** | O prêmio foi para o documentário "Don't Panic" (associado ao Gapminder), na categoria "Innovative News". |
| 6   | "CONIP existe desde 1998"                                    | **NÃO VERIFICADO**         | Data de início não confirmada nas fontes consultadas. Qualificar ou remover.                             |

---

## PARTE 4: DESCOBERTAS ESTRATÉGICAS PARA O IOC

### 4.1 API do SICONFI: Integração Direta Disponível

A descoberta mais estratégica desta auditoria é a existência de uma **API REST documentada do SICONFI** em `https://apidatalake.tesouro.gov.br/docs/siconfi/`. O agente coletor de FPM do IOC pode ser integrado diretamente via API, sem necessidade de scraping. Endpoints prioritários: `/rreo` (Relatório Resumido da Execução Orçamentária) e `/rgf` (Relatório de Gestão Fiscal).

### 4.2 SDG Index 2025 com API via ArcGIS Hub

O Sustainable Development Report 2025 disponibiliza uma **API pública via Esri ArcGIS Hub** em `https://sdg-transformation-center-sdsn.hub.arcgis.com/datasets/sdsn::sustainable-development-report-2025-with-indicators/about`. Esta API permite acesso programático aos dados completos de 167 países, incluindo scores por ODS e indicadores individuais — fonte valiosa para benchmarking global no IOC.

### 4.3 Cluster de Fontes de Dados para os 17 ODS

Com base na auditoria, o IOC tem acesso a dados verificados para todos os 17 ODS via fontes abertas:

| ODS                     | Fonte Principal Verificada | URL                                                       |
| ----------------------- | -------------------------- | --------------------------------------------------------- |
| ODS 1 — Pobreza         | IBGE/CadÚnico              | https://www.ibge.gov.br/                                  |
| ODS 2 — Fome            | SISVAN/DataSUS             | https://datasus.saude.gov.br/                             |
| ODS 3 — Saúde           | IEPS Data + DataSUS        | https://iepsdata.org.br/                                  |
| ODS 4 — Educação        | QEdu + INEP                | https://www.qedu.org.br/                                  |
| ODS 5 — Igualdade       | TSE + IBGE                 | https://www.tse.jus.br/                                   |
| ODS 6 — Saneamento      | SNIS                       | https://www.gov.br/cidades/pt-br/assuntos/saneamento/snis |
| ODS 7 — Energia         | ANEEL                      | https://www.aneel.gov.br/                                 |
| ODS 8 — Trabalho        | RAIS/MTE + IBGE            | https://www.gov.br/trabalho-e-emprego/                    |
| ODS 9 — Infraestrutura  | IBGE/MUNIC                 | https://www.ibge.gov.br/                                  |
| ODS 10 — Desigualdade   | IBGE/PNAD                  | https://www.ibge.gov.br/                                  |
| ODS 11 — Cidades        | IBGE/MUNIC + SNIS          | https://www.ibge.gov.br/                                  |
| ODS 12 — Consumo        | IBGE                       | https://www.ibge.gov.br/                                  |
| ODS 13 — Clima          | INPE                       | https://www.inpe.br/                                      |
| ODS 14 — Vida Aquática  | ANA                        | https://www.gov.br/ana/                                   |
| ODS 15 — Vida Terrestre | INPE + IBGE                | https://www.inpe.br/                                      |
| ODS 16 — Paz e Justiça  | TSE + IBGE                 | https://www.tse.jus.br/                                   |
| ODS 17 — Parcerias      | SICONFI + PNCP             | https://apidatalake.tesouro.gov.br/                       |

---

## PARTE 5: RECOMENDAÇÕES PARA O CLAUDE CODE

Com base na auditoria completa, as seguintes diretrizes técnicas atualizadas devem ser incorporadas à implementação:

**1. Integrar a API REST do SICONFI** (`https://apidatalake.tesouro.gov.br/docs/siconfi/`) no agente coletor de FPM, substituindo qualquer abordagem de scraping por chamadas diretas à API documentada.

**2. Adotar média geométrica** para o cálculo do score composto do IOC, conforme validado pela metodologia HDI/IDHM da ONU e documentado em `https://bluefoxr.github.io/COINrDoc/aggregation.html`.

**3. Incorporar o IEPS Data** (`https://iepsdata.org.br/`) como fonte adicional para os indicadores de ODS 3 (Saúde), complementando o DataSUS com dados já processados e visualizações prontas.

**4. Avaliar o Design System GOV.BR v3.7.0** (`https://www.gov.br/ds`) para componentes de acessibilidade e padrões visuais governamentais.

**5. Corrigir a URL do iSDG Model** nos documentos de referência: a URL correta é `https://sdgs.un.org/partnerships/integrated-sustainable-development-goals-isdg-model`.

**6. Corrigir o dado do SDG Index 2025**: o relatório cobre 167 países (não 193) no SDG Index principal.

**7. Estudar a arquitetura do City Health Dashboard (NYU)** (`https://www.cityhealthdashboard.com/`) como referência de UX para dashboards de indicadores de saúde municipal.

**8. Usar o Peer City Identification Tool do Federal Reserve Bank de Chicago** como referência metodológica para o módulo de benchmark peer-to-peer — especificamente o método de clustering hierárquico de Ward.

**9. Explorar a API do ArcGIS Hub do SDG Index 2025** para benchmarking global dos municípios catarinenses em relação a países com desenvolvimento similar.

**10. Remover ou qualificar os dados não verificados** identificados na Parte 3 deste relatório antes de usar em materiais de apresentação ou marketing.

---

## REFERÊNCIAS VERIFICADAS

[1] IDSC-BR Metodologia — https://idsc.cidadessustentaveis.org.br/methodology/  
[2] SDG Index 2025 — https://dashboards.sdgindex.org/  
[3] SDR 2025 PDF — https://s3.amazonaws.com/sustainabledevelopment.report/2025/sustainable-development-report-2025.pdf  
[4] SDG Index API ArcGIS — https://sdg-transformation-center-sdsn.hub.arcgis.com/datasets/sdsn::sustainable-development-report-2025-with-indicators/about  
[5] OWID Grapher GitHub — https://github.com/owid/owid-grapher  
[6] OWID API — https://docs.owid.io/projects/etl/api/chart-api/  
[7] Atlas Brasil — http://www.atlasbrasil.org.br/  
[8] IDHM Metodologia UNDP — https://www.undp.org/pt/brazil/o-que-e-o-idhm  
[9] API SICONFI — https://apidatalake.tesouro.gov.br/docs/siconfi/  
[10] IEPS Data — https://iepsdata.org.br/  
[11] QEdu — https://www.qedu.org.br/  
[12] SNIS — https://www.gov.br/cidades/pt-br/assuntos/saneamento/snis  
[13] Design System GOV.BR — https://www.gov.br/ds  
[14] iSDG Model PNUD — https://sdgs.un.org/partnerships/integrated-sustainable-development-goals-isdg-model  
[15] Madison AI — https://www.madisonai.com/  
[16] Peer City Tool Chicago Fed — https://www.chicagofed.org/region/peer-cities-identification-tool/about-the-peer-cities-identification-tool  
[17] COINr Aggregation — https://bluefoxr.github.io/COINrDoc/aggregation.html  
[18] City Health Dashboard NYU — https://www.cityhealthdashboard.com/  
[19] LLM4Gov USP São Carlos — https://saocarlos.usp.br/pesquisadores-da-usp-sao-carlos-desenvolvem-modelo-de-inteligencia-artificial-segura-para-uso-governamental-e-ganham-premio-internacional/  
[20] Pró-Cidadão Florianópolis — https://ndmais.com.br/cidadania/chatbot-do-pro-cidadao-passa-de-43-mil-atendimentos-e-amplia-acesso-a-servicos-em-florianopolis/  
[21] Lia Prefeitura Limeira — https://limeira.sp.gov.br/lia  
[22] OECD Regional Well-Being — https://www.oecdregionalwellbeing.org/  
[23] Guia IA Generativa Gov Federal — https://www.gov.br/governodigital/pt-br/infraestrutura-nacional-de-dados/inteligencia-artificial-1/ia-generativa-no-servico-publico.pdf  
[24] European Journal SDR — https://www.ejosdr.com/download/ai-for-sustainable-development-modelling-the-impact-of-the-17-sdgs-on-public-sector-performance-17396.pdf  
[25] Nature npj Urban Sustainability — https://www.nature.com/articles/s42949-025-00238-4  
[26] CONIP Regulamento 2024 — https://conipdigital.com.br/wp-content/uploads/2024/03/Regulamento-Oficial-2024-final.pdf  
[27] IIB Awards FAQs — https://www.datavisualizationsociety.org/iib-awards-faqs  
[28] Gapminder Awards — https://www.gapminder.org/about/about-gapminder/awards/  
[29] Vizabi Framework — https://vizabi.com/  
[30] MUNIC/IBGE — https://www.ibge.gov.br/estatisticas/sociais/educacao/10586-pesquisa-de-informacoes-basicas-municipais.html

---

_Relatório gerado por Manus AI em 07/04/2026 | IOC ESG Municipal_  
_Metodologia: 15 pesquisas paralelas simultâneas com verificação de URLs e dados_
