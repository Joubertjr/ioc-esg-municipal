# 🔧 GUIA TÉCNICO DE INTEGRAÇÃO DE APIS - IOC ESG MUNICIPAL

## Resumo Executivo

Este guia fornece instruções técnicas passo a passo para integrar cada uma das principais fontes de dados ao IOC ESG Municipal. Inclui exemplos de código em Python, tratamento de erros e boas práticas.

---

## PARTE 1: CONFIGURAÇÃO INICIAL DO AMBIENTE

### 1.1 Dependências Python

```bash
# Instalar dependências necessárias
pip install requests pandas numpy python-dateutil pytz sqlalchemy psycopg2-binary

# Dependências adicionais para processamento de dados
pip install pandas-profiling great-expectations

# Para armazenamento em banco de dados
pip install sqlalchemy psycopg2-binary pymongo
```

### 1.2 Estrutura de Diretórios

```
ioc-esg-municipal/
├── src/
│   ├── collectors/          # Agentes coletores de dados
│   │   ├── siconfi_collector.py
│   │   ├── ibge_collector.py
│   │   ├── pncp_collector.py
│   │   ├── snis_collector.py
│   │   └── ...
│   ├── processors/          # Processadores de dados
│   │   ├── validator.py
│   │   ├── normalizer.py
│   │   └── enricher.py
│   ├── analyzers/           # Agentes de análise
│   │   ├── esg_analyzer.py
│   │   ├── ods_analyzer.py
│   │   └── risk_analyzer.py
│   ├── database/            # Camada de persistência
│   │   ├── models.py
│   │   └── connection.py
│   └── config.py            # Configurações globais
├── data/
│   ├── raw/                 # Dados brutos
│   ├── processed/           # Dados processados
│   └── cache/               # Cache de APIs
├── logs/                    # Logs de execução
└── tests/                   # Testes unitários
```

---

## PARTE 2: INTEGRAÇÃO COM SICONFI (Dados Financeiros)

### 2.1 Coletor SICONFI

```python
# src/collectors/siconfi_collector.py

import requests
import pandas as pd
from datetime import datetime, timedelta
import logging
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

class SiconfiCollector:
    """
    Coletor de dados do SICONFI (Tesouro Nacional)
    Responsável por extrair dados financeiros de municípios
    """
    
    BASE_URL = "https://api.siconfi.tesouro.gov.br/v1"
    TIMEOUT = 30
    
    def __init__(self, uf: str = "SC"):
        self.uf = uf
        self.session = requests.Session()
    
    def get_municipios(self) -> List[Dict]:
        """
        Obtém lista de municípios de um estado
        
        Returns:
            List[Dict]: Lista de municípios com código IBGE
        """
        try:
            # Para SC, retorna os 295 municípios
            # Você pode obter a lista do IBGE ou de um arquivo local
            municipios = [
                {"codigo_ibge": 4204202, "nome": "Florianópolis"},
                {"codigo_ibge": 4202404, "nome": "Joinville"},
                # ... mais municípios
            ]
            logger.info(f"Carregados {len(municipios)} municípios de {self.uf}")
            return municipios
        except Exception as e:
            logger.error(f"Erro ao obter municípios: {e}")
            raise
    
    def get_siconfi_data(self, codigo_ibge: int, exercicio: int = 2025) -> Optional[Dict]:
        """
        Obtém dados SICONFI de um município para um exercício específico
        
        Args:
            codigo_ibge: Código IBGE do município (7 dígitos)
            exercicio: Ano fiscal (padrão: ano atual)
        
        Returns:
            Dict: Dados SICONFI ou None se erro
        """
        try:
            # Formatar código IBGE (remover dígito verificador se necessário)
            codigo_str = str(codigo_ibge)[:6]
            
            url = f"{self.BASE_URL}/municipios/{self.uf}/{codigo_str}/exercicio/{exercicio}/siconfi"
            
            response = self.session.get(url, timeout=self.TIMEOUT)
            response.raise_for_status()
            
            dados = response.json()
            logger.info(f"Dados SICONFI obtidos para município {codigo_ibge}")
            return dados
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Erro ao obter dados SICONFI: {e}")
            return None
    
    def get_receitas(self, codigo_ibge: int, exercicio: int = 2025) -> Optional[pd.DataFrame]:
        """
        Obtém receitas detalhadas de um município
        
        Args:
            codigo_ibge: Código IBGE do município
            exercicio: Ano fiscal
        
        Returns:
            DataFrame: Receitas por categoria
        """
        try:
            codigo_str = str(codigo_ibge)[:6]
            url = f"{self.BASE_URL}/municipios/{self.uf}/{codigo_str}/exercicio/{exercicio}/receitas"
            
            response = self.session.get(url, timeout=self.TIMEOUT)
            response.raise_for_status()
            
            dados = response.json()
            df = pd.DataFrame(dados)
            
            logger.info(f"Receitas obtidas: {len(df)} registros")
            return df
            
        except Exception as e:
            logger.error(f"Erro ao obter receitas: {e}")
            return None
    
    def get_fpm_repasses(self, codigo_ibge: int, ano: int = 2025) -> Optional[pd.DataFrame]:
        """
        Obtém repasses do FPM (Fundo de Participação dos Municípios)
        
        Args:
            codigo_ibge: Código IBGE do município
            ano: Ano dos repasses
        
        Returns:
            DataFrame: Repasses mensais do FPM
        """
        try:
            # Usar API de Transferências Constitucionais
            url = f"https://api.tesouro.gov.br/v1/fpm/{self.uf}/{codigo_ibge}/{ano}"
            
            response = self.session.get(url, timeout=self.TIMEOUT)
            response.raise_for_status()
            
            dados = response.json()
            df = pd.DataFrame(dados)
            
            logger.info(f"FPM obtido: {len(df)} repasses")
            return df
            
        except Exception as e:
            logger.error(f"Erro ao obter FPM: {e}")
            return None
    
    def collect_all_municipios(self, exercicio: int = 2025) -> pd.DataFrame:
        """
        Coleta dados SICONFI de todos os municípios de SC
        
        Args:
            exercicio: Ano fiscal
        
        Returns:
            DataFrame: Dados consolidados de todos os municípios
        """
        municipios = self.get_municipios()
        todos_dados = []
        
        for municipio in municipios:
            try:
                dados = self.get_siconfi_data(municipio["codigo_ibge"], exercicio)
                if dados:
                    dados["municipio_nome"] = municipio["nome"]
                    dados["codigo_ibge"] = municipio["codigo_ibge"]
                    todos_dados.append(dados)
            except Exception as e:
                logger.warning(f"Erro ao coletar {municipio['nome']}: {e}")
        
        df = pd.DataFrame(todos_dados)
        logger.info(f"Total de municípios coletados: {len(df)}")
        return df
```

### 2.2 Uso do Coletor SICONFI

```python
# Exemplo de uso
from src.collectors.siconfi_collector import SiconfiCollector

# Criar coletor
coletor = SiconfiCollector(uf="SC")

# Obter dados de um município específico (Florianópolis)
dados = coletor.get_siconfi_data(codigo_ibge=4204202, exercicio=2025)

# Obter FPM de Florianópolis
fpm = coletor.get_fpm_repasses(codigo_ibge=4204202, ano=2025)

# Coletar de todos os municípios
todos = coletor.collect_all_municipios(exercicio=2025)
todos.to_csv("data/raw/siconfi_sc_2025.csv", index=False)
```

---

## PARTE 3: INTEGRAÇÃO COM IBGE (Dados Demográficos)

### 3.1 Coletor IBGE

```python
# src/collectors/ibge_collector.py

import requests
import pandas as pd
import logging
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

class IbgeCollector:
    """
    Coletor de dados do IBGE (Instituto Brasileiro de Geografia e Estatística)
    Responsável por extrair dados demográficos e socioeconômicos
    """
    
    BASE_URL = "https://servicodados.ibge.gov.br/api/v1/localidades"
    TIMEOUT = 30
    
    def __init__(self):
        self.session = requests.Session()
    
    def get_municipios_sc(self) -> List[Dict]:
        """
        Obtém lista completa de municípios de Santa Catarina
        
        Returns:
            List[Dict]: Lista de municípios com metadados
        """
        try:
            url = f"{self.BASE_URL}/estados/SC/municipios"
            response = self.session.get(url, timeout=self.TIMEOUT)
            response.raise_for_status()
            
            municipios = response.json()
            logger.info(f"Total de municípios em SC: {len(municipios)}")
            return municipios
            
        except Exception as e:
            logger.error(f"Erro ao obter municípios SC: {e}")
            raise
    
    def get_municipio_info(self, codigo_ibge: int) -> Optional[Dict]:
        """
        Obtém informações detalhadas de um município
        
        Args:
            codigo_ibge: Código IBGE do município
        
        Returns:
            Dict: Informações do município
        """
        try:
            url = f"{self.BASE_URL}/municipios/{codigo_ibge}"
            response = self.session.get(url, timeout=self.TIMEOUT)
            response.raise_for_status()
            
            return response.json()
            
        except Exception as e:
            logger.error(f"Erro ao obter info do município {codigo_ibge}: {e}")
            return None
    
    def get_microrregioes_sc(self) -> List[Dict]:
        """
        Obtém microrregiões de SC
        
        Returns:
            List[Dict]: Microrregiões
        """
        try:
            url = f"{self.BASE_URL}/estados/SC/microrregioes"
            response = self.session.get(url, timeout=self.TIMEOUT)
            response.raise_for_status()
            
            return response.json()
            
        except Exception as e:
            logger.error(f"Erro ao obter microrregiões: {e}")
            raise
    
    def get_mesorregios_sc(self) -> List[Dict]:
        """
        Obtém mesorregiões de SC
        
        Returns:
            List[Dict]: Mesorregiões
        """
        try:
            url = f"{self.BASE_URL}/estados/SC/mesorregioes"
            response = self.session.get(url, timeout=self.TIMEOUT)
            response.raise_for_status()
            
            return response.json()
            
        except Exception as e:
            logger.error(f"Erro ao obter mesorregiões: {e}")
            raise
    
    def collect_all_municipios_info(self) -> pd.DataFrame:
        """
        Coleta informações de todos os municípios de SC
        
        Returns:
            DataFrame: Informações consolidadas
        """
        municipios = self.get_municipios_sc()
        dados_lista = []
        
        for municipio in municipios:
            try:
                info = self.get_municipio_info(municipio["id"])
                if info:
                    dados_lista.append({
                        "codigo_ibge": municipio["id"],
                        "nome": municipio["nome"],
                        "regiao": info.get("regiao", {}).get("nome"),
                        "mesorregiao": info.get("mesorregiao", {}).get("nome"),
                        "microrregiao": info.get("microrregiao", {}).get("nome"),
                    })
            except Exception as e:
                logger.warning(f"Erro ao processar {municipio['nome']}: {e}")
        
        df = pd.DataFrame(dados_lista)
        logger.info(f"Informações coletadas de {len(df)} municípios")
        return df
```

---

## PARTE 4: INTEGRAÇÃO COM PNCP (Licitações)

### 4.1 Coletor PNCP

```python
# src/collectors/pncp_collector.py

import requests
import pandas as pd
import logging
from datetime import datetime
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

class PncpCollector:
    """
    Coletor de dados do PNCP (Portal Nacional de Contratações Públicas)
    Responsável por monitorar licitações e contratos
    """
    
    BASE_URL = "https://pncp.gov.br/api/consulta"
    TIMEOUT = 30
    
    def __init__(self):
        self.session = requests.Session()
    
    def get_licitacoes_municipio(self, codigo_municipio: int, 
                                 data_inicio: str = None, 
                                 data_fim: str = None) -> Optional[pd.DataFrame]:
        """
        Obtém licitações de um município em um período
        
        Args:
            codigo_municipio: Código IBGE do município
            data_inicio: Data de início (formato: YYYY-MM-DD)
            data_fim: Data de fim (formato: YYYY-MM-DD)
        
        Returns:
            DataFrame: Licitações encontradas
        """
        try:
            # Construir parâmetros
            params = {
                "ente": codigo_municipio,
                "pagina": 1,
                "tamanhoPagina": 100
            }
            
            if data_inicio:
                params["dataInicio"] = data_inicio
            if data_fim:
                params["dataFim"] = data_fim
            
            url = f"{self.BASE_URL}/licitacoes"
            response = self.session.get(url, params=params, timeout=self.TIMEOUT)
            response.raise_for_status()
            
            dados = response.json()
            licitacoes = dados.get("data", [])
            
            df = pd.DataFrame(licitacoes)
            logger.info(f"Licitações obtidas: {len(df)} registros")
            return df
            
        except Exception as e:
            logger.error(f"Erro ao obter licitações: {e}")
            return None
    
    def get_contratos_municipio(self, codigo_municipio: int) -> Optional[pd.DataFrame]:
        """
        Obtém contratos vigentes de um município
        
        Args:
            codigo_municipio: Código IBGE do município
        
        Returns:
            DataFrame: Contratos
        """
        try:
            params = {
                "ente": codigo_municipio,
                "pagina": 1,
                "tamanhoPagina": 100
            }
            
            url = f"{self.BASE_URL}/contratos"
            response = self.session.get(url, params=params, timeout=self.TIMEOUT)
            response.raise_for_status()
            
            dados = response.json()
            contratos = dados.get("data", [])
            
            df = pd.DataFrame(contratos)
            logger.info(f"Contratos obtidos: {len(df)} registros")
            return df
            
        except Exception as e:
            logger.error(f"Erro ao obter contratos: {e}")
            return None
    
    def verificar_compliance_lei_14133(self, licitacao: Dict) -> Dict:
        """
        Verifica se uma licitação está em compliance com Lei 14.133
        
        Args:
            licitacao: Dados da licitação
        
        Returns:
            Dict: Resultado da verificação
        """
        compliance_checks = {
            "tem_criterios_sustentabilidade": False,
            "menciona_ods": False,
            "menciona_ciclo_vida": False,
            "conformidade_geral": False
        }
        
        descricao = str(licitacao.get("descricao", "")).lower()
        
        # Verificações básicas
        if any(termo in descricao for termo in ["sustentável", "sustentabilidade", "ambiental", "verde"]):
            compliance_checks["tem_criterios_sustentabilidade"] = True
        
        if any(termo in descricao for termo in ["ods", "objetivo desenvolvimento", "agenda 2030"]):
            compliance_checks["menciona_ods"] = True
        
        if any(termo in descricao for termo in ["ciclo vida", "logística reversa", "eficiência"]):
            compliance_checks["menciona_ciclo_vida"] = True
        
        # Conformidade geral
        compliance_checks["conformidade_geral"] = compliance_checks["tem_criterios_sustentabilidade"]
        
        return compliance_checks
```

---

## PARTE 5: PROCESSAMENTO E VALIDAÇÃO DE DADOS

### 5.1 Validador de Dados

```python
# src/processors/validator.py

import pandas as pd
import logging
from typing import Dict, List, Tuple

logger = logging.getLogger(__name__)

class DataValidator:
    """
    Valida integridade e qualidade dos dados coletados
    """
    
    @staticmethod
    def validar_siconfi(df: pd.DataFrame) -> Tuple[bool, List[str]]:
        """
        Valida dados SICONFI
        
        Args:
            df: DataFrame com dados SICONFI
        
        Returns:
            Tuple[bool, List[str]]: (É válido, Lista de erros)
        """
        erros = []
        
        # Verificar colunas obrigatórias
        colunas_obrigatorias = ["codigo_ibge", "exercicio", "receita", "despesa"]
        for col in colunas_obrigatorias:
            if col not in df.columns:
                erros.append(f"Coluna obrigatória ausente: {col}")
        
        # Verificar valores negativos inválidos
        if (df["receita"] < 0).any():
            erros.append("Receitas negativas detectadas")
        
        # Verificar valores nulos críticos
        if df["codigo_ibge"].isnull().any():
            erros.append("Códigos IBGE nulos detectados")
        
        return len(erros) == 0, erros
    
    @staticmethod
    def validar_licitacoes(df: pd.DataFrame) -> Tuple[bool, List[str]]:
        """
        Valida dados de licitações
        
        Args:
            df: DataFrame com dados de licitações
        
        Returns:
            Tuple[bool, List[str]]: (É válido, Lista de erros)
        """
        erros = []
        
        # Verificar colunas obrigatórias
        colunas_obrigatorias = ["id", "numero", "data_publicacao", "valor"]
        for col in colunas_obrigatorias:
            if col not in df.columns:
                erros.append(f"Coluna obrigatória ausente: {col}")
        
        # Verificar valores nulos
        if df["id"].isnull().any():
            erros.append("IDs de licitação nulos detectados")
        
        # Verificar valores monetários
        if (df["valor"] < 0).any():
            erros.append("Valores de licitação negativos detectados")
        
        return len(erros) == 0, erros
```

---

## PARTE 6: ARMAZENAMENTO EM BANCO DE DADOS

### 6.1 Modelos de Dados

```python
# src/database/models.py

from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, create_engine
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class Municipio(Base):
    __tablename__ = "municipios"
    
    id = Column(Integer, primary_key=True)
    codigo_ibge = Column(Integer, unique=True, nullable=False)
    nome = Column(String(255), nullable=False)
    estado = Column(String(2), nullable=False)
    populacao = Column(Integer)
    pib = Column(Float)
    data_atualizacao = Column(DateTime, default=datetime.utcnow)

class DadosSiconfi(Base):
    __tablename__ = "dados_siconfi"
    
    id = Column(Integer, primary_key=True)
    codigo_ibge = Column(Integer, nullable=False)
    exercicio = Column(Integer, nullable=False)
    receita_total = Column(Float)
    despesa_total = Column(Float)
    fpm_recebido = Column(Float)
    data_coleta = Column(DateTime, default=datetime.utcnow)

class Licitacao(Base):
    __tablename__ = "licitacoes"
    
    id = Column(Integer, primary_key=True)
    id_pncp = Column(String(255), unique=True, nullable=False)
    codigo_municipio = Column(Integer, nullable=False)
    numero = Column(String(100))
    data_publicacao = Column(DateTime)
    valor = Column(Float)
    tem_criterios_sustentabilidade = Column(Boolean, default=False)
    conformidade_lei_14133 = Column(Boolean, default=False)
    data_coleta = Column(DateTime, default=datetime.utcnow)

class ScoreEsg(Base):
    __tablename__ = "scores_esg"
    
    id = Column(Integer, primary_key=True)
    codigo_municipio = Column(Integer, nullable=False)
    data = Column(DateTime, default=datetime.utcnow)
    score_e = Column(Float)  # Environmental
    score_s = Column(Float)  # Social
    score_g = Column(Float)  # Governance
    score_total = Column(Float)
    ods_1 = Column(Float)
    ods_2 = Column(Float)
    # ... mais ODS
```

### 6.2 Conexão com Banco de Dados

```python
# src/database/connection.py

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os

class DatabaseConnection:
    """
    Gerencia conexão com banco de dados PostgreSQL
    """
    
    def __init__(self, host: str = "localhost", 
                 port: int = 5432,
                 database: str = "ioc_esg",
                 user: str = "postgres",
                 password: str = ""):
        
        self.connection_string = f"postgresql://{user}:{password}@{host}:{port}/{database}"
        self.engine = create_engine(self.connection_string)
        self.Session = sessionmaker(bind=self.engine)
    
    def create_tables(self):
        """Cria todas as tabelas"""
        from src.database.models import Base
        Base.metadata.create_all(self.engine)
    
    def get_session(self):
        """Retorna uma nova sessão"""
        return self.Session()
    
    def insert_municipio(self, codigo_ibge: int, nome: str, estado: str):
        """Insere um município"""
        session = self.get_session()
        try:
            from src.database.models import Municipio
            municipio = Municipio(codigo_ibge=codigo_ibge, nome=nome, estado=estado)
            session.add(municipio)
            session.commit()
        finally:
            session.close()
```

---

## CONCLUSÃO

Este guia fornece a base técnica para implementar o IOC ESG Municipal. Os próximos passos são:

1. **Configurar ambiente Python** com as dependências
2. **Implementar coletores** para cada fonte de dados
3. **Criar pipeline de processamento** com validação e normalização
4. **Armazenar dados** em banco de dados PostgreSQL
5. **Desenvolver agentes de análise** para gerar insights
6. **Criar dashboard** para visualização

Cada componente foi desenhado para ser modular e escalável, permitindo adicionar novas fontes de dados sem impactar o sistema existente.
