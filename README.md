# Open Street Map Public Transport Parser

> [!IMPORTANT]
> **Aviso de Modificação (20/04/2026):** Este repositório foi modificado e organizado para incluir uma ferramenta de visualização web, detecção de gaps e CI modernizado. Estas alterações foram realizadas sob os termos da licença AGPL v3.

## Web Visualizer (Novo!)

O projeto agora conta com uma aplicação web completa para visualizar e diagnosticar relações do OSM diretamente no navegador. Ela permite identificar gaps no traçado, verificar a ordem dos nós e integrar-se com o JOSM.

### Como executar
Para usar o visualizador, basta abrir o arquivo `webapp/index.html` em qualquer navegador moderno. Não é necessário servidor backend (ele utiliza a API oficial do Overpass).

1. Abra `webapp/index.html`.
2. Insira o **ID de uma Relação OSM** (ex: `1613149` para uma linha de ônibus).
3. Defina a **Tolerância de Gap** em metros (padrão: 150m).
4. Clique em **Analisar**.

**Funcionalidades:**
- **Visualização Geolocalizada:** Mapa interativo com o traçado da relação.
- **Detecção de Gaps:** Identifica onde o traçado está quebrado e qual a distância do salto.
- **Integração JOSM:** Botão para carregar a área e a relação diretamente no editor JOSM (via Controle Remoto).
- **Dark Mode:** Interface moderna e otimizada para análise.

---

## Parser CLI (Rust)

A ferramenta CLI permite processar arquivos `.osm.pbf` em larga escala, reconectando relações descontinuadas, ordenando pontos internos e exportando-os como GeoJSON.

### Como funciona

1. Lê dados de um arquivo `.pbf`, extraindo caminhos e relações filtrados por atributos.
2. Processa cada relação:
   - Ordena os caminhos (ways) por proximidade.
   - Une caminhos que compartilham coordenadas idênticas.
   - Une gaps menores que o limite especificado (padrão: 150m).
3. Exporta um array JSON com cada funcionalidade em formato GeoJSON.

### Instalação e Requisitos

- **Rust 1.77 ou superior** (necessário para suporte ao `Cargo.lock` v4 e `clap v4`).
- Para instalar/atualizar: `rustup update stable`

### Exemplos de Uso

**Clonar e testar rápido:**
```bash
git clone https://github.com/arrobaraujo/osmptparser.git
cd osmptparser
wget http://download.geofabrik.de/south-america/ecuador-latest.osm.pbf
cargo run --release ./ecuador-latest.osm.pbf --example main
```

**Filtrar áreas específicas:**
```bash
cargo run --release ./ecuador-latest.osm.pbf --filter "boundary=national_park"
```

**Extrair transporte público (PTv2):**
```bash
cargo run --release ./ecuador-latest.osm.pbf --filter-ptv2
```

**Opções de Performance:**
```bash
# Usar 8 CPUs e tolerância de 200 metros
cargo run --release ./ecuador-latest.osm.pbf --filter-ptv2 --cpus 8 --gap 200.0
```

---

## Desenvolvimento e CI

Para garantir a qualidade do código, o projeto utiliza um workflow rigoroso no GitHub Actions.

**Executar linter e testes localmente:**
```bash
cargo fmt -- --check
cargo clippy -- -D warnings -A clippy::ptr-arg
cargo test
```

### CI Status
[![Status](https://github.com/arrobaraujo/osmptparser/workflows/Test/badge.svg)](https://github.com/arrobaraujo/osmptparser/actions)
[![codecov](https://codecov.io/gh/arrobaraujo/osmptparser/branch/master/graph/badge.svg)](https://codecov.io/gh/arrobaraujo/osmptparser)

---

## Gerar arquivos de teste customizados

Caso queira extrair relações específicas de um PBF grande para testes:
```bash
wget http://download.geofabrik.de/south-america/ecuador-latest.osm.pbf
osmconvert ecuador-latest.osm.pbf -o=ecuador.o5m
osmfilter ecuador.o5m --keep= --keep-relations="@id=85965 =2030162" > test.o5m
osmconvert test.o5m -o=test.pbf
```

[Veja o blogpost original](https://jperelli.com.ar/post/2019/08/12/oxidizing-cualbondi/) para uma descrição detalhada da lógica de "oxidação" do parser.
